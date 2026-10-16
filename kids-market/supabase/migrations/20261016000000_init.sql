-- היריד — סכמה ראשונית (גרסה 0)
-- כל שינויי המצב עוברים דרך פונקציות SECURITY DEFINER כדי שהכללים (אישורי הורים,
-- תקרת מחיר, סינון טקסט) ייאכפו בשרת ולא רק בממשק.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public;

-- ───────────────────────── עזרים ─────────────────────────

create or replace function public.gen_code(len int)
returns text language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(len);
  result text := '';
begin
  for i in 0..len - 1 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return result;
end $$;

-- מסנן טקסט חופשי של ילדים: טלפונים, מיילים, קישורים, כתובות ורשתות חברתיות.
create or replace function public.filter_kid_text(t text)
returns text language plpgsql immutable set search_path = '' as $$
declare r text := t;
begin
  r := regexp_replace(r, '(https?://\S+|www\.\S+)', '🚫', 'gi');
  r := regexp_replace(r, '\S+@\S+\.\S+', '🚫', 'g');
  r := regexp_replace(r, '\S+\.(com|co\.il|org\.il|net|org|io|me|ly|app|link)(/\S*)?', '🚫', 'gi');
  r := regexp_replace(r, '\+?(\d[\s.\-]?){6,}\d', '🚫', 'g');
  r := regexp_replace(r, '(רחוב|רח''|רח׳|שדרות|שד''|שד׳|דירה|קומה|כניסה|בניין)\s*\S*', '🚫', 'g');
  r := regexp_replace(r, '(whatsapp|וואטסאפ|ווטסאפ|ווצאפ|וואצאפ|instagram|אינסטגרם|אינסטה|tiktok|טיקטוק|telegram|טלגרם|snapchat|סנאפ)', '🚫', 'gi');
  r := regexp_replace(r, '@\w+', '🚫', 'g');
  return r;
end $$;

-- ───────────────────────── טבלאות ─────────────────────────

create table public.families (
  id uuid primary key default gen_random_uuid(),
  kid_login_code text not null unique default public.gen_code(6),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  role text not null check (role in ('parent', 'kid')),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 60),
  nickname text not null check (char_length(btrim(nickname)) between 2 and 30),
  avatar text not null default 'fox' check (avatar ~ '^[a-z_]{2,20}$'),
  is_admin boolean not null default false,
  name_consent_at timestamptz,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.profiles (family_id);

create table private.kid_secrets (
  kid_id uuid primary key references public.profiles (id) on delete cascade,
  pin_hash text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz
);

create table public.fairs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  description text not null default '' check (char_length(description) <= 500),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  organizer_id uuid references public.profiles (id) on delete set null,
  invite_code text not null unique default public.gen_code(8),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.fair_members (
  fair_id uuid not null references public.fairs (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'removed')),
  joined_at timestamptz not null default now(),
  primary key (fair_id, family_id)
);
create index on public.fair_members (family_id);

-- הזמנה למשפחה חדשה (family_id ריק) או להורה נוסף באותה משפחה (family_id מלא).
create table public.invites (
  code text primary key default public.gen_code(8),
  created_by uuid references public.profiles (id) on delete cascade,
  family_id uuid references public.families (id) on delete cascade,
  max_uses int not null default 1 check (max_uses between 1 and 50),
  uses int not null default 0,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  fair_id uuid not null references public.fairs (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 60),
  description text not null default '' check (char_length(description) <= 500),
  coolest text not null check (char_length(btrim(coolest)) between 2 and 200),
  category text not null check (category in ('toys', 'books', 'games', 'lego', 'dolls', 'sports', 'crafts', 'other')),
  condition text not null check (condition in ('new', 'like_new', 'used')),
  price int not null check (price between 1 and 100),
  photos text[] not null check (cardinality(photos) between 1 and 4),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'rejected', 'reserved', 'sold', 'withdrawn', 'removed')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text check (char_length(rejection_reason) <= 300),
  created_at timestamptz not null default now()
);
create index on public.listings (fair_id, status);
create index on public.listings (family_id);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  buyer_family_id uuid not null references public.families (id) on delete cascade,
  seller_family_id uuid not null references public.families (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_id)
);
create index on public.conversations (buyer_family_id);
create index on public.conversations (seller_family_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('text', 'template', 'offer', 'system')),
  body text not null default '' check (char_length(body) <= 500),
  amount int check (amount between 1 and 100),
  offer_status text check (offer_status in ('pending', 'accepted', 'declined', 'countered', 'expired')),
  filtered boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.messages (conversation_id, created_at);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  buyer_family_id uuid not null references public.families (id) on delete cascade,
  seller_family_id uuid not null references public.families (id) on delete cascade,
  price int not null check (price between 1 and 100),
  status text not null default 'awaiting_parent'
    check (status in ('awaiting_parent', 'approved', 'declined', 'completed', 'cancelled')),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  buyer_confirmed boolean not null default false,
  seller_confirmed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index deals_one_open_per_listing on public.deals (listing_id)
  where status in ('awaiting_parent', 'approved');
create index on public.deals (buyer_family_id);
create index on public.deals (seller_family_id);

create table public.stickers (
  deal_id uuid primary key references public.deals (id) on delete cascade,
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  to_family_id uuid not null references public.families (id) on delete cascade,
  sticker text not null check (sticker in ('trusted', 'polite', 'fast', 'great_item', 'fair_price', 'friendly')),
  created_at timestamptz not null default now()
);
create index on public.stickers (to_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  fair_id uuid references public.fairs (id) on delete cascade,
  target_type text not null check (target_type in ('listing', 'conversation')),
  target_id uuid not null,
  reason text not null check (char_length(btrim(reason)) between 2 and 500),
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.blocks (
  blocker_family_id uuid not null references public.families (id) on delete cascade,
  blocked_family_id uuid not null references public.families (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_family_id, blocked_family_id),
  check (blocker_family_id <> blocked_family_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  link text not null default '/',
  read_at timestamptz,
  pushed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (created_at) where pushed_at is null;
create index on public.notifications (user_id, created_at desc);

-- מייל להתראות (רק ההורה עצמו רואה).
create table public.parent_contacts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  email text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ───────────────────────── פונקציות הרשאה ─────────────────────────

create or replace function public.my_family()
returns uuid language sql stable security definer set search_path = '' as $$
  select family_id from public.profiles where id = auth.uid()
$$;

create or replace function public.my_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_fair_member(f uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.fair_members
    where fair_id = f and family_id = public.my_family() and status = 'active'
  )
$$;

create or replace function public.is_fair_organizer(f uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.fairs fa join public.profiles p on p.id = fa.organizer_id
    where fa.id = f and p.family_id = public.my_family()
  ) and public.my_role() = 'parent'
$$;

create or replace function public.shares_fair(other_family uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.fair_members a
    join public.fair_members b on a.fair_id = b.fair_id
    where a.family_id = public.my_family() and b.family_id = other_family
      and a.status = 'active' and b.status = 'active'
  )
$$;

create or replace function public.is_blocked(fa uuid, fb uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks
    where (blocker_family_id = fa and blocked_family_id = fb)
       or (blocker_family_id = fb and blocked_family_id = fa)
  )
$$;

create or replace function public.fair_is_open(f uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.fairs where id = f and now() between starts_at and ends_at)
$$;

-- משתתף בשיחה: הילד הקונה, הילד המוכר, וכל הורה בשתי המשפחות.
create or replace function public.is_conversation_participant(conv uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversations c
    join public.listings l on l.id = c.listing_id
    join public.profiles me on me.id = auth.uid()
    where c.id = conv and (
      me.id = c.buyer_id or me.id = l.seller_id
      or (me.role = 'parent' and me.family_id in (c.buyer_family_id, c.seller_family_id))
    )
  )
$$;

create or replace function public.can_read_conversation(conv uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_conversation_participant(conv)
    or public.is_admin()
    or exists (
      select 1 from public.reports r
      join public.conversations c on c.id = r.target_id
      join public.listings l on l.id = c.listing_id
      where r.target_type = 'conversation' and r.target_id = conv
        and public.is_fair_organizer(l.fair_id)
    )
$$;

-- ───────────────────────── RLS ─────────────────────────

alter table public.families enable row level security;
alter table public.profiles enable row level security;
alter table public.fairs enable row level security;
alter table public.fair_members enable row level security;
alter table public.invites enable row level security;
alter table public.listings enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.deals enable row level security;
alter table public.stickers enable row level security;
alter table public.reports enable row level security;
alter table public.blocks enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.parent_contacts enable row level security;

create policy families_select on public.families for select to authenticated
  using (id = public.my_family() or public.is_admin());

-- ביריד סגור השם המלא גלוי לכל חברי היריד.
create policy profiles_select on public.profiles for select to authenticated
  using (family_id = public.my_family() or public.shares_fair(family_id) or public.is_admin());

create policy fairs_select on public.fairs for select to authenticated
  using (public.is_fair_member(id) or public.is_fair_organizer(id) or public.is_admin());

create policy fair_members_select on public.fair_members for select to authenticated
  using (public.is_fair_member(fair_id) or public.is_fair_organizer(fair_id) or public.is_admin());

create policy invites_select on public.invites for select to authenticated
  using (created_by = auth.uid());

create policy listings_select on public.listings for select to authenticated
  using (
    family_id = public.my_family()
    or (public.is_fair_member(fair_id) and status in ('active', 'reserved', 'sold')
        and not public.is_blocked(public.my_family(), family_id))
    or exists (select 1 from public.conversations c
               where c.listing_id = listings.id and c.buyer_family_id = public.my_family())
    or public.is_fair_organizer(fair_id)
    or public.is_admin()
  );

-- ילד מעלה מודעה; טריגר מכריח סטטוס "ממתין לאישור".
create policy listings_insert on public.listings for insert to authenticated
  with check (
    seller_id = auth.uid() and public.my_role() = 'kid'
    and family_id = public.my_family()
    and public.is_fair_member(fair_id) and public.fair_is_open(fair_id)
  );

create policy conversations_select on public.conversations for select to authenticated
  using (public.can_read_conversation(id));

create policy messages_select on public.messages for select to authenticated
  using (public.can_read_conversation(conversation_id));

create policy messages_insert on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid() and kind in ('text', 'template')
    and amount is null and offer_status is null
    and public.is_conversation_participant(conversation_id)
  );

create policy deals_select on public.deals for select to authenticated
  using (public.my_family() in (buyer_family_id, seller_family_id) or public.is_admin());

create policy stickers_select on public.stickers for select to authenticated
  using (to_family_id = public.my_family() or public.shares_fair(to_family_id) or public.is_admin());

create policy reports_select on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin()
         or (fair_id is not null and public.is_fair_organizer(fair_id)));

create policy blocks_select on public.blocks for select to authenticated
  using (blocker_family_id = public.my_family());

create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy contacts_select on public.parent_contacts for select to authenticated
  using (user_id = auth.uid());
create policy contacts_insert on public.parent_contacts for insert to authenticated
  with check (user_id = auth.uid() and public.my_role() = 'parent');
create policy contacts_update on public.parent_contacts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy push_select on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid());
create policy push_insert on public.push_subscriptions for insert to authenticated
  with check (user_id = auth.uid());
create policy push_delete on public.push_subscriptions for delete to authenticated
  using (user_id = auth.uid());

-- ───────────────────────── התראות ─────────────────────────

create or replace function public.notify(p_user uuid, p_type text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, type, title, body, link)
  values (p_user, p_type, p_title, p_body, p_link)
$$;

create or replace function public.notify_parents(p_family uuid, p_type text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, type, title, body, link)
  select id, p_type, p_title, p_body, p_link
  from public.profiles where family_id = p_family and role = 'parent'
$$;

-- ───────────────────────── טריגרים ─────────────────────────

create or replace function public.listings_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.status := 'pending';
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.rejection_reason := null;
  new.created_at := now();
  -- תמונות חייבות להיות בתיקיית המשפחה (הועלו דרך השרת, אחרי מחיקת EXIF).
  if exists (select 1 from unnest(new.photos) p where p not like new.family_id::text || '/%') then
    raise exception 'נתיב תמונה לא תקין';
  end if;
  return new;
end $$;
create trigger listings_before_insert before insert on public.listings
  for each row execute function public.listings_before_insert();

create or replace function public.listings_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare kid_name text;
begin
  select nickname into kid_name from public.profiles where id = new.seller_id;
  perform public.notify_parents(new.family_id, 'listing_pending',
    'מודעה חדשה ממתינה לאישור', kid_name || ' רוצה למכור: ' || new.title, '/parent');
  return new;
end $$;
create trigger listings_after_insert after insert on public.listings
  for each row execute function public.listings_after_insert();

create or replace function public.messages_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  sender_role text;
  conv public.conversations;
  sender_family uuid;
  original text := new.body;
begin
  new.created_at := now();
  if new.kind in ('text', 'template') then
    select role, family_id into sender_role, sender_family from public.profiles where id = new.sender_id;
    select * into conv from public.conversations where id = new.conversation_id;
    if public.is_blocked(conv.buyer_family_id, conv.seller_family_id) then
      raise exception 'השיחה הזו חסומה';
    end if;
    -- גם הודעות מוכנות עוברות סינון, כי הלקוח יכול לשלוח כל טקסט בתור "template".
    if sender_role = 'kid' then
      new.body := public.filter_kid_text(new.body);
      new.filtered := new.body <> original;
    end if;
    if btrim(new.body) = '' then
      raise exception 'הודעה ריקה';
    end if;
  end if;
  return new;
end $$;
create trigger messages_before_insert before insert on public.messages
  for each row execute function public.messages_before_insert();

-- ───────────────────────── הרשמה וחשבונות ─────────────────────────

-- בדיקת קוד הזמנה לפני התחברות. kind: fair | family | coparent
create or replace function public.check_invite(p_code text)
returns table (kind text, label text) language plpgsql stable security definer set search_path = '' as $$
begin
  return query
    select 'fair'::text, f.name from public.fairs f
    where f.invite_code = upper(btrim(p_code)) and f.ends_at > now();
  if found then return; end if;
  return query
    select case when i.family_id is null then 'family' else 'coparent' end, ''::text
    from public.invites i
    where i.code = upper(btrim(p_code)) and i.expires_at > now() and i.uses < i.max_uses;
end $$;

create or replace function public.complete_parent_signup(p_code text, p_full_name text, p_accept_terms boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_code text := upper(btrim(p_code));
  v_fair public.fairs;
  v_invite public.invites;
  v_family uuid;
begin
  if auth.uid() is null then raise exception 'יש להתחבר'; end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'החשבון כבר רשום';
  end if;
  if not coalesce(p_accept_terms, false) then
    raise exception 'יש לאשר את תנאי השימוש ומדיניות הפרטיות';
  end if;

  select * into v_fair from public.fairs where invite_code = v_code and ends_at > now();
  if not found then
    select * into v_invite from public.invites
      where code = v_code and expires_at > now() and uses < max_uses for update;
    if not found then raise exception 'קוד ההזמנה לא תקין או שפג תוקפו'; end if;
    update public.invites set uses = uses + 1 where code = v_code;
  end if;

  v_family := v_invite.family_id;
  if v_family is null then
    insert into public.families default values returning id into v_family;
  end if;

  insert into public.profiles (id, family_id, role, full_name, nickname, avatar, terms_accepted_at)
  values (auth.uid(), v_family, 'parent', btrim(p_full_name), split_part(btrim(p_full_name), ' ', 1), 'owl', now());

  if v_fair.id is not null then
    insert into public.fair_members (fair_id, family_id) values (v_fair.id, v_family)
    on conflict do nothing;
  end if;
  return v_family;
end $$;

create or replace function public.create_invite(p_coparent boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if public.my_role() is distinct from 'parent' then raise exception 'רק הורה יכול להזמין'; end if;
  insert into public.invites (created_by, family_id, max_uses)
  values (auth.uid(), case when p_coparent then public.my_family() end, case when p_coparent then 1 else 5 end)
  returning code into v_code;
  return v_code;
end $$;

-- נקרא מהשרת (service_role) אחרי יצירת משתמש auth לילד.
create or replace function public.admin_register_kid(
  p_parent uuid, p_kid uuid, p_nickname text, p_full_name text, p_avatar text, p_pin text, p_name_consent boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_family uuid;
begin
  select family_id into v_family from public.profiles where id = p_parent and role = 'parent';
  if v_family is null then raise exception 'רק הורה יכול להוסיף ילד'; end if;
  if not coalesce(p_name_consent, false) then raise exception 'יש לאשר את הצגת השם המלא'; end if;
  if p_pin !~ '^\d{4}$' then raise exception 'הקוד הסודי צריך להיות 4 ספרות'; end if;
  insert into public.profiles (id, family_id, role, full_name, nickname, avatar, name_consent_at)
  values (p_kid, v_family, 'kid', btrim(p_full_name), btrim(p_nickname), p_avatar, now());
  insert into private.kid_secrets (kid_id, pin_hash)
  values (p_kid, extensions.crypt(p_pin, extensions.gen_salt('bf')));
end $$;

create or replace function public.kids_for_login(p_code text)
returns table (id uuid, nickname text, avatar text) language sql stable security definer set search_path = '' as $$
  select p.id, p.nickname, p.avatar from public.profiles p
  join public.families f on f.id = p.family_id
  where f.kid_login_code = upper(btrim(p_code)) and p.role = 'kid'
  order by p.created_at
$$;

-- 5 ניסיונות שגויים → נעילה ל-15 דקות.
create or replace function public.verify_kid_pin(p_code text, p_kid uuid, p_pin text)
returns text language plpgsql security definer set search_path = '' as $$
declare s private.kid_secrets;
begin
  select ks.* into s from private.kid_secrets ks
  join public.profiles p on p.id = ks.kid_id
  join public.families f on f.id = p.family_id
  where ks.kid_id = p_kid and f.kid_login_code = upper(btrim(p_code))
  for update of ks;
  if not found then return 'invalid'; end if;
  if s.locked_until is not null and s.locked_until > now() then return 'locked'; end if;
  if s.pin_hash = extensions.crypt(p_pin, s.pin_hash) then
    update private.kid_secrets set failed_attempts = 0, locked_until = null where kid_id = p_kid;
    return 'ok';
  end if;
  update private.kid_secrets
    set failed_attempts = failed_attempts + 1,
        locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' end
    where kid_id = p_kid;
  return 'invalid';
end $$;

create or replace function public.update_kid(p_kid uuid, p_nickname text, p_full_name text, p_avatar text, p_pin text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.my_role() is distinct from 'parent'
     or not exists (select 1 from public.profiles where id = p_kid and role = 'kid' and family_id = public.my_family()) then
    raise exception 'אין הרשאה';
  end if;
  update public.profiles set nickname = btrim(p_nickname), full_name = btrim(p_full_name), avatar = p_avatar
  where id = p_kid;
  if p_pin is not null and p_pin <> '' then
    if p_pin !~ '^\d{4}$' then raise exception 'הקוד הסודי צריך להיות 4 ספרות'; end if;
    update private.kid_secrets set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')),
      failed_attempts = 0, locked_until = null where kid_id = p_kid;
  end if;
end $$;

create or replace function public.regenerate_login_code()
returns text language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if public.my_role() is distinct from 'parent' then raise exception 'אין הרשאה'; end if;
  update public.families set kid_login_code = public.gen_code(6) where id = public.my_family()
  returning kid_login_code into v_code;
  return v_code;
end $$;

-- ───────────────────────── ירידים ─────────────────────────

create or replace function public.create_fair(p_name text, p_description text, p_starts timestamptz, p_ends timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if public.my_role() is distinct from 'parent' then raise exception 'רק מבוגר יכול לפתוח יריד'; end if;
  if p_ends <= p_starts then raise exception 'תאריך הסיום חייב להיות אחרי תאריך הפתיחה'; end if;
  insert into public.fairs (name, description, starts_at, ends_at, organizer_id)
  values (btrim(p_name), coalesce(p_description, ''), p_starts, p_ends, auth.uid())
  returning id into v_id;
  insert into public.fair_members (fair_id, family_id) values (v_id, public.my_family());
  return v_id;
end $$;

create or replace function public.join_fair(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_fair public.fairs;
begin
  if public.my_role() is distinct from 'parent' then raise exception 'רק הורה יכול לצרף את המשפחה'; end if;
  select * into v_fair from public.fairs where invite_code = upper(btrim(p_code)) and ends_at > now();
  if not found then raise exception 'קוד היריד לא תקין או שהיריד הסתיים'; end if;
  if exists (select 1 from public.fair_members where fair_id = v_fair.id and family_id = public.my_family() and status = 'removed') then
    raise exception 'המשפחה הוסרה מהיריד הזה';
  end if;
  insert into public.fair_members (fair_id, family_id) values (v_fair.id, public.my_family())
  on conflict do nothing;
  return v_fair.id;
end $$;

create or replace function public.remove_fair_member(p_fair uuid, p_family uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (public.is_fair_organizer(p_fair) or public.is_admin()) then raise exception 'אין הרשאה'; end if;
  if p_family = public.my_family() then raise exception 'אי אפשר להסיר את המשפחה שלך'; end if;
  update public.fair_members set status = 'removed' where fair_id = p_fair and family_id = p_family;
  update public.listings set status = 'removed'
  where fair_id = p_fair and family_id = p_family and status in ('pending', 'active');
end $$;

-- ───────────────────────── מודעות ─────────────────────────

create or replace function public.review_listing(p_listing uuid, p_approve boolean, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare l public.listings;
begin
  select * into l from public.listings where id = p_listing for update;
  if not found or public.my_role() is distinct from 'parent' or l.family_id <> public.my_family() then
    raise exception 'אין הרשאה';
  end if;
  if l.status <> 'pending' then raise exception 'המודעה כבר טופלה'; end if;
  if p_approve then
    update public.listings set status = 'active', reviewed_by = auth.uid(), reviewed_at = now() where id = p_listing;
    perform public.notify(l.seller_id, 'listing_approved', 'המודעה שלך אושרה! 🎉', l.title || ' עלתה ליריד', '/listing/' || l.id);
  else
    update public.listings set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
      rejection_reason = nullif(btrim(p_reason), '') where id = p_listing;
    perform public.notify(l.seller_id, 'listing_rejected', 'המודעה לא אושרה', coalesce(nullif(btrim(p_reason), ''), l.title), '/me');
  end if;
end $$;

create or replace function public.withdraw_listing(p_listing uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare l public.listings;
begin
  select * into l from public.listings where id = p_listing for update;
  if not found or l.family_id <> public.my_family() then raise exception 'אין הרשאה'; end if;
  if l.status not in ('pending', 'active', 'rejected') then raise exception 'אי אפשר להוריד מודעה בעסקה פעילה'; end if;
  update public.listings set status = 'withdrawn' where id = p_listing;
  update public.deals set status = 'cancelled' where listing_id = p_listing and status = 'awaiting_parent';
end $$;

create or replace function public.moderate_remove_listing(p_listing uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare l public.listings;
begin
  select * into l from public.listings where id = p_listing for update;
  if not found or not (public.is_fair_organizer(l.fair_id) or public.is_admin()) then raise exception 'אין הרשאה'; end if;
  update public.listings set status = 'removed' where id = p_listing;
  update public.deals set status = 'cancelled' where listing_id = p_listing and status in ('awaiting_parent', 'approved');
  perform public.notify_parents(l.family_id, 'listing_removed', 'מודעה הוסרה ע"י מארגן היריד', l.title, '/parent');
end $$;

-- ───────────────────────── שיחות והצעות ─────────────────────────

create or replace function public.start_conversation(p_listing uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  l public.listings;
  v_id uuid;
begin
  if public.my_role() is distinct from 'kid' then raise exception 'רק ילדים קונים ביריד'; end if;
  select * into l from public.listings where id = p_listing;
  if not found or l.status <> 'active' or not public.is_fair_member(l.fair_id) then
    raise exception 'המודעה לא זמינה';
  end if;
  if l.family_id = public.my_family() then raise exception 'זו מודעה של המשפחה שלך'; end if;
  if public.is_blocked(public.my_family(), l.family_id) then raise exception 'אי אפשר לפנות למוכר הזה'; end if;
  if not public.fair_is_open(l.fair_id) then raise exception 'היריד סגור כרגע'; end if;

  select id into v_id from public.conversations where listing_id = p_listing and buyer_id = auth.uid();
  if v_id is null then
    insert into public.conversations (listing_id, buyer_id, buyer_family_id, seller_family_id)
    values (p_listing, auth.uid(), public.my_family(), l.family_id)
    returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.make_offer(p_conversation uuid, p_amount int)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  c public.conversations;
  l public.listings;
  v_id uuid;
  v_other uuid;
begin
  select * into c from public.conversations where id = p_conversation;
  if not found then raise exception 'שיחה לא קיימת'; end if;
  select * into l from public.listings where id = c.listing_id;
  if auth.uid() not in (c.buyer_id, l.seller_id) then raise exception 'רק הילדים בעסקה יכולים להציע מחיר'; end if;
  if l.status <> 'active' then raise exception 'המודעה לא זמינה'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 100 then raise exception 'המחיר חייב להיות בין 1 ל-100 ₪'; end if;
  if public.is_blocked(c.buyer_family_id, c.seller_family_id) then raise exception 'השיחה הזו חסומה'; end if;

  update public.messages set offer_status = 'expired'
  where conversation_id = p_conversation and kind = 'offer' and offer_status = 'pending';

  insert into public.messages (conversation_id, sender_id, kind, body, amount, offer_status)
  values (p_conversation, auth.uid(), 'offer', '', p_amount, 'pending')
  returning id into v_id;

  v_other := case when auth.uid() = c.buyer_id then l.seller_id else c.buyer_id end;
  perform public.notify(v_other, 'offer', 'הצעת מחיר חדשה: ' || p_amount || ' ₪', l.title, '/chat/' || c.id);
  return v_id;
end $$;

create or replace function public.respond_offer(p_message uuid, p_action text, p_counter int)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  m public.messages;
  c public.conversations;
  l public.listings;
  v_deal uuid;
begin
  select * into m from public.messages where id = p_message and kind = 'offer' for update;
  if not found or m.offer_status <> 'pending' then raise exception 'ההצעה כבר לא בתוקף'; end if;
  select * into c from public.conversations where id = m.conversation_id;
  select * into l from public.listings where id = c.listing_id for update;
  if auth.uid() not in (c.buyer_id, l.seller_id) or auth.uid() = m.sender_id then
    raise exception 'רק הצד השני יכול להגיב להצעה';
  end if;

  if p_action = 'decline' then
    update public.messages set offer_status = 'declined' where id = p_message;
    return null;
  elsif p_action = 'counter' then
    update public.messages set offer_status = 'countered' where id = p_message;
    return public.make_offer(c.id, p_counter);
  elsif p_action <> 'accept' then
    raise exception 'פעולה לא מוכרת';
  end if;

  if l.status <> 'active' then raise exception 'המודעה לא זמינה'; end if;
  if exists (select 1 from public.deals where listing_id = l.id and status in ('awaiting_parent', 'approved')) then
    raise exception 'כבר יש עסקה פתוחה על הפריט הזה';
  end if;

  update public.messages set offer_status = 'accepted' where id = p_message;
  insert into public.deals (conversation_id, listing_id, buyer_id, seller_id, buyer_family_id, seller_family_id, price)
  values (c.id, l.id, c.buyer_id, l.seller_id, c.buyer_family_id, c.seller_family_id, m.amount)
  returning id into v_deal;

  insert into public.messages (conversation_id, kind, body)
  values (c.id, 'system', 'סגרנו על ' || m.amount || ' ₪! 🤝 מחכים לאישור של הורה הקונה.');

  perform public.notify_parents(c.buyer_family_id, 'deal_pending', 'עסקה ממתינה לאישורך',
    l.title || ' ב-' || m.amount || ' ₪', '/parent');
  return v_deal;
end $$;

-- ───────────────────────── עסקאות ─────────────────────────

create or replace function public.decide_deal(p_deal uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  d public.deals;
  l public.listings;
begin
  select * into d from public.deals where id = p_deal for update;
  if not found or public.my_role() is distinct from 'parent' or d.buyer_family_id <> public.my_family() then
    raise exception 'רק הורה הקונה יכול לאשר';
  end if;
  if d.status <> 'awaiting_parent' then raise exception 'העסקה כבר טופלה'; end if;
  select * into l from public.listings where id = d.listing_id for update;

  if p_approve then
    if l.status <> 'active' then raise exception 'המודעה כבר לא זמינה'; end if;
    update public.deals set status = 'approved', decided_by = auth.uid(), decided_at = now() where id = p_deal;
    update public.listings set status = 'reserved' where id = l.id;
    update public.messages set offer_status = 'expired'
      where kind = 'offer' and offer_status = 'pending'
        and conversation_id in (select id from public.conversations where listing_id = l.id);
    insert into public.messages (conversation_id, kind, body)
    values (d.conversation_id, 'system', 'ההורה אישר/ה את העסקה ✅ עכשיו ההורים מתאמים מקום וזמן למסירה. התשלום במזומן או בביט, במסירה.');
    perform public.notify(d.seller_id, 'deal_approved', 'העסקה אושרה! 🎉', l.title, '/chat/' || d.conversation_id);
    perform public.notify(d.buyer_id, 'deal_approved', 'ההורה אישר/ה את הקנייה! 🎉', l.title, '/chat/' || d.conversation_id);
    perform public.notify_parents(d.seller_family_id, 'deal_approved', 'עסקה אושרה — תאמו מסירה', l.title, '/chat/' || d.conversation_id);
  else
    update public.deals set status = 'declined', decided_by = auth.uid(), decided_at = now() where id = p_deal;
    insert into public.messages (conversation_id, kind, body)
    values (d.conversation_id, 'system', 'הפעם ההורה לא אישר/ה את העסקה.');
    perform public.notify(d.seller_id, 'deal_declined', 'העסקה לא אושרה', l.title, '/chat/' || d.conversation_id);
  end if;
end $$;

create or replace function public.confirm_delivery(p_deal uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  d public.deals;
  me public.profiles;
begin
  select * into d from public.deals where id = p_deal for update;
  select * into me from public.profiles where id = auth.uid();
  if not found or d.status <> 'approved' then raise exception 'העסקה לא במצב מסירה'; end if;

  if me.id = d.buyer_id or (me.role = 'parent' and me.family_id = d.buyer_family_id) then
    update public.deals set buyer_confirmed = true where id = p_deal;
  elsif me.id = d.seller_id or (me.role = 'parent' and me.family_id = d.seller_family_id) then
    update public.deals set seller_confirmed = true where id = p_deal;
  else
    raise exception 'אין הרשאה';
  end if;

  select * into d from public.deals where id = p_deal;
  if d.buyer_confirmed and d.seller_confirmed then
    update public.deals set status = 'completed', completed_at = now() where id = p_deal;
    update public.listings set status = 'sold' where id = d.listing_id;
    insert into public.messages (conversation_id, kind, body)
    values (d.conversation_id, 'system', 'נמסר! ✅ העסקה הושלמה. אפשר לשלוח מדבקת תודה 💛');
    perform public.notify(d.buyer_id, 'deal_completed', 'העסקה הושלמה — שלחו מדבקת תודה 💛', '', '/chat/' || d.conversation_id);
  end if;
end $$;

create or replace function public.cancel_deal(p_deal uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare d public.deals;
begin
  select * into d from public.deals where id = p_deal for update;
  if not found or public.my_role() is distinct from 'parent'
     or public.my_family() not in (d.buyer_family_id, d.seller_family_id) then
    raise exception 'רק הורה יכול לבטל עסקה';
  end if;
  if d.status not in ('awaiting_parent', 'approved') then raise exception 'אי אפשר לבטל את העסקה הזו'; end if;
  update public.deals set status = 'cancelled' where id = p_deal;
  update public.listings set status = 'active' where id = d.listing_id and status = 'reserved';
  insert into public.messages (conversation_id, kind, body)
  values (d.conversation_id, 'system', 'העסקה בוטלה על ידי הורה.');
end $$;

create or replace function public.send_sticker(p_deal uuid, p_sticker text)
returns void language plpgsql security definer set search_path = '' as $$
declare d public.deals;
begin
  select * into d from public.deals where id = p_deal;
  if not found or d.buyer_id <> auth.uid() then raise exception 'רק הקונה שולח מדבקת תודה'; end if;
  if d.status <> 'completed' then raise exception 'אפשר לשלוח מדבקה אחרי המסירה'; end if;
  insert into public.stickers (deal_id, from_id, to_id, to_family_id, sticker)
  values (p_deal, auth.uid(), d.seller_id, d.seller_family_id, p_sticker);
  perform public.notify(d.seller_id, 'sticker', 'קיבלת מדבקת תודה! 💛', '', '/me');
end $$;

-- ───────────────────────── דיווחים וחסימות ─────────────────────────

create or replace function public.report_content(p_type text, p_target uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_fair uuid;
  v_organizer uuid;
begin
  if auth.uid() is null then raise exception 'יש להתחבר'; end if;
  if p_type = 'listing' then
    select fair_id into v_fair from public.listings where id = p_target;
  elsif p_type = 'conversation' then
    if not public.is_conversation_participant(p_target) then raise exception 'אין הרשאה'; end if;
    select l.fair_id into v_fair from public.conversations c join public.listings l on l.id = c.listing_id where c.id = p_target;
  else
    raise exception 'סוג דיווח לא מוכר';
  end if;
  if v_fair is null or not public.is_fair_member(v_fair) then raise exception 'אין הרשאה'; end if;

  insert into public.reports (reporter_id, fair_id, target_type, target_id, reason)
  values (auth.uid(), v_fair, p_type, p_target, btrim(p_reason));

  select organizer_id into v_organizer from public.fairs where id = v_fair;
  perform public.notify(v_organizer, 'report', 'דיווח חדש ביריד', left(btrim(p_reason), 100), '/admin');
  insert into public.notifications (user_id, type, title, body, link)
  select id, 'report', 'דיווח חדש', left(btrim(p_reason), 100), '/admin'
  from public.profiles where is_admin and id <> v_organizer;
end $$;

create or replace function public.resolve_report(p_report uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.reports;
begin
  select * into r from public.reports where id = p_report;
  if not found or not (public.is_admin() or (r.fair_id is not null and public.is_fair_organizer(r.fair_id))) then
    raise exception 'אין הרשאה';
  end if;
  update public.reports set status = 'resolved', resolved_by = auth.uid(), resolved_at = now() where id = p_report;
end $$;

create or replace function public.block_conversation(p_conversation uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  c public.conversations;
  v_other uuid;
begin
  if not public.is_conversation_participant(p_conversation) then raise exception 'אין הרשאה'; end if;
  select * into c from public.conversations where id = p_conversation;
  v_other := case when public.my_family() = c.buyer_family_id then c.seller_family_id else c.buyer_family_id end;
  insert into public.blocks (blocker_family_id, blocked_family_id) values (public.my_family(), v_other)
  on conflict do nothing;
  update public.deals set status = 'cancelled'
  where conversation_id = p_conversation and status in ('awaiting_parent', 'approved');
  update public.listings set status = 'active'
  where id = c.listing_id and status = 'reserved'
    and not exists (select 1 from public.deals where listing_id = c.listing_id and status = 'approved');
  perform public.notify_parents(public.my_family(), 'blocked', 'בוצעה חסימה', 'אחד מבני המשפחה חסם משפחה אחרת. אפשר לבטל בעמוד ההורים.', '/parent');
end $$;

create or replace function public.unblock_family(p_family uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.my_role() is distinct from 'parent' then raise exception 'רק הורה יכול לבטל חסימה'; end if;
  delete from public.blocks where blocker_family_id = public.my_family() and blocked_family_id = p_family;
end $$;

-- ───────────────────────── מחיקת חשבון ─────────────────────────

-- מחזיר את מזהי המשתמשים של המשפחה, כדי שהשרת ימחק אותם מ-auth (מוחק בשרשור את כל השאר).
create or replace function public.family_user_ids_for_deletion(p_parent uuid)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select p.id from public.profiles p
  where p.family_id = (select family_id from public.profiles where id = p_parent and role = 'parent')
$$;

-- ───────────────────────── הרשאות ─────────────────────────

revoke all on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
grant execute on function public.check_invite(text) to anon;

revoke execute on function public.admin_register_kid(uuid, uuid, text, text, text, text, boolean) from authenticated;
revoke execute on function public.kids_for_login(text) from authenticated;
revoke execute on function public.verify_kid_pin(text, uuid, text) from authenticated;
revoke execute on function public.family_user_ids_for_deletion(uuid) from authenticated;
revoke execute on function public.notify(uuid, text, text, text, text) from authenticated;
revoke execute on function public.notify_parents(uuid, text, text, text, text) from authenticated;
grant execute on all functions in schema public to service_role;

revoke all on all tables in schema public from anon;

-- ───────────────────────── אחסון ו-Realtime ─────────────────────────

insert into storage.buckets (id, name, public) values ('listing-photos', 'listing-photos', false)
on conflict (id) do nothing;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.deals;
  end if;
end $$;
