-- בדיקת זרימה מלאה: הרשמה → יריד → מודעה → אישור → צ'אט → הצעות → עסקה → מסירה → מדבקה.
-- מריצים על Postgres נקי אחרי 00_supabase_stub.sql והמיגרציות.
\set ON_ERROR_STOP 1
\set QUIET 1

create or replace function pg_temp.act_as(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), false); end $$;

create or replace function pg_temp.expect_error(sql text, needle text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'FAIL: expected error containing "%" from: %', needle, sql;
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  if position(needle in sqlerrm) = 0 then
    raise exception 'FAIL: wrong error for %: % (expected %)', sql, sqlerrm, needle;
  end if;
end $$;

-- משתמשים
insert into auth.users (id, phone) values
  ('00000000-0000-0000-0000-0000000000a1', '972500000001'),  -- הורה א
  ('00000000-0000-0000-0000-0000000000b1', '972500000002'),  -- הורה ב
  ('00000000-0000-0000-0000-0000000000a2', null),            -- ילד א
  ('00000000-0000-0000-0000-0000000000b2', null),            -- ילד ב
  ('00000000-0000-0000-0000-0000000000c1', '972500000003');  -- הורה ג (מחוץ ליריד)
insert into public.invites (code, max_uses) values ('BOOT0001', 5);

create temp table ctx (k text primary key, v text);
grant all on ctx to authenticated;

-- 1. הורה א נרשם עם הזמנה ופותח יריד
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.complete_parent_signup('boot0001', 'דנה כהן', true);
select pg_temp.expect_error($$select public.complete_parent_signup('boot0001', 'דנה כהן', true)$$, 'כבר רשום');
insert into ctx select 'fair', public.create_fair('יריד המשפחה', 'בדיקה', now() - interval '1 hour', now() + interval '7 days');
insert into ctx select 'fair_code', invite_code from public.fairs where id = (select v::uuid from ctx where k = 'fair');

-- 2. הורה ב מצטרף דרך קישור היריד
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect_error($$select public.complete_parent_signup('NOPE1234', 'יוסי לוי', true)$$, 'לא תקין');
select pg_temp.expect_error(format($$select public.complete_parent_signup(%L, 'יוסי לוי', false)$$, (select v from ctx where k = 'fair_code')), 'תנאי השימוש');
select public.complete_parent_signup((select v from ctx where k = 'fair_code'), 'יוסי לוי', true);
do $$ begin
  if not public.is_fair_member((select v::uuid from ctx where k = 'fair')) then raise exception 'FAIL: parent B not in fair'; end if;
end $$;

-- 3. הורה ג נרשם בהזמנה כללית, לא ביריד
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select public.complete_parent_signup('BOOT0001', 'רון אבני', true);

-- 4. הוספת ילדים (service_role) ובדיקת PIN
reset role;
set role service_role;
select pg_temp.expect_error($$select public.admin_register_kid('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', 'נועה', 'נועה כהן', 'fox', '12a4', true)$$, '4 ספרות');
select public.admin_register_kid('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', 'נועה הסוחרת', 'נועה כהן', 'fox', '1234', true);
select public.admin_register_kid('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2', 'איתי', 'איתי לוי', 'lion', '4321', true);
reset role;
do $$
declare code text; r text;
begin
  select f.kid_login_code into code from public.families f join public.profiles p on p.family_id = f.id
  where p.id = '00000000-0000-0000-0000-0000000000a2';
  if (select count(*) from public.kids_for_login(lower(code))) <> 1 then raise exception 'FAIL: kids_for_login'; end if;
  if public.verify_kid_pin(code, '00000000-0000-0000-0000-0000000000a2', '1234') <> 'ok' then raise exception 'FAIL: pin ok'; end if;
  if public.verify_kid_pin('ZZZZZZ', '00000000-0000-0000-0000-0000000000a2', '1234') <> 'invalid' then raise exception 'FAIL: wrong code accepted'; end if;
  for i in 1..5 loop r := public.verify_kid_pin(code, '00000000-0000-0000-0000-0000000000a2', '0000'); end loop;
  if public.verify_kid_pin(code, '00000000-0000-0000-0000-0000000000a2', '1234') <> 'locked' then raise exception 'FAIL: lockout'; end if;
  update private.kid_secrets set locked_until = null, failed_attempts = 0;
end $$;

-- ילד לא יכול לקרוא לפונקציות שרת
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
select pg_temp.expect_error($$select public.kids_for_login('X')$$, 'permission denied');
select pg_temp.expect_error($$select public.admin_register_kid(null, null, '', '', '', '', true)$$, 'permission denied');
select pg_temp.expect_error($$select * from private.kid_secrets$$, 'permission denied');
update public.profiles set is_admin = true where id = auth.uid();  -- אין מדיניות UPDATE → 0 שורות
do $$ begin
  if (select is_admin from public.profiles where id = auth.uid()) then raise exception 'FAIL: privilege escalation'; end if;
end $$;

-- 5. ילד א מעלה מודעה
select pg_temp.expect_error(format($$insert into public.listings (fair_id, family_id, seller_id, title, coolest, category, condition, price, photos)
  values (%L, public.my_family(), auth.uid(), 'לגו', 'מגניב', 'lego', 'used', 150, array[public.my_family()::text || '/a.jpg'])$$,
  (select v from ctx where k = 'fair')), 'price_check');
select pg_temp.expect_error(format($$insert into public.listings (fair_id, family_id, seller_id, title, coolest, category, condition, price, photos)
  values (%L, public.my_family(), auth.uid(), 'לגו', 'מגניב', 'lego', 'used', 50, array['other-family/a.jpg'])$$,
  (select v from ctx where k = 'fair')), 'נתיב תמונה');
insert into public.listings (fair_id, family_id, seller_id, title, coolest, category, condition, price, photos, status)
values ((select v::uuid from ctx where k = 'fair'), public.my_family(), auth.uid(), 'לגו חללית', 'יש לה אורות!', 'lego', 'like_new', 80,
        array[public.my_family()::text || '/a.jpg'], 'active');
insert into ctx select 'listing', id from public.listings;
do $$ begin
  if (select status from public.listings) <> 'pending' then raise exception 'FAIL: status not forced to pending'; end if;
end $$;

-- ילד ב לא רואה מודעה ממתינה
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
do $$ begin
  if exists (select 1 from public.listings) then raise exception 'FAIL: pending listing visible'; end if;
end $$;

-- הורה ב לא יכול לאשר מודעה של משפחה אחרת; הורה א מאשר
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect_error(format($$select public.review_listing(%L, true, null)$$, (select v from ctx where k = 'listing')), 'אין הרשאה');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  if not exists (select 1 from public.notifications where type = 'listing_pending') then raise exception 'FAIL: parent not notified'; end if;
end $$;
select public.review_listing((select v::uuid from ctx where k = 'listing'), true, null);

-- הורה ג (מחוץ ליריד) לא רואה כלום
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
do $$ begin
  if exists (select 1 from public.listings) then raise exception 'FAIL: outsider sees listing'; end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'FAIL: outsider sees profiles'; end if;
  if exists (select 1 from public.fairs) then raise exception 'FAIL: outsider sees fair'; end if;
end $$;

-- 6. ילד ב רואה, פותח שיחה, שולח הודעות
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
do $$ begin
  if (select count(*) from public.listings) <> 1 then raise exception 'FAIL: kid B cannot see active listing'; end if;
  if (select full_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a2') <> 'נועה כהן' then
    raise exception 'FAIL: full name not visible in fair'; end if;
end $$;
insert into ctx select 'conv', public.start_conversation((select v::uuid from ctx where k = 'listing'));
do $$ begin
  if public.start_conversation((select v::uuid from ctx where k = 'listing')) <> (select v::uuid from ctx where k = 'conv') then
    raise exception 'FAIL: duplicate conversation'; end if;
end $$;
insert into public.messages (conversation_id, sender_id, kind, body)
values ((select v::uuid from ctx where k = 'conv'), auth.uid(), 'text', 'תתקשרי אליי 050-1234567 או www.site.com, אני גר ברחוב הרצל');
insert into public.messages (conversation_id, sender_id, kind, body)
values ((select v::uuid from ctx where k = 'conv'), auth.uid(), 'text', 'אפשר ב-10 עד 20 שקל?');
do $$
declare b text; f boolean;
begin
  select body, filtered into b, f from public.messages order by created_at, body limit 1 offset 0;
  select body, filtered into b, f from public.messages where body like 'תתקשרי%';
  if not f or b like '%050%' or b like '%www%' or b like '%הרצל%' then raise exception 'FAIL: filter missed: %', b; end if;
  if (select filtered from public.messages where body like 'אפשר%') then raise exception 'FAIL: false positive filter'; end if;
end $$;
select pg_temp.expect_error(format($$insert into public.messages (conversation_id, sender_id, kind, amount, offer_status)
  values (%L, auth.uid(), 'offer', 1, 'pending')$$, (select v from ctx where k = 'conv')), 'row-level security');
select pg_temp.expect_error(format($$select public.make_offer(%L, 101)$$, (select v from ctx where k = 'conv')), 'בין 1 ל-100');

-- הורה ג לא יכול לשלוח הודעה או לקרוא את השיחה
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_error(format($$insert into public.messages (conversation_id, sender_id, kind, body) values (%L, auth.uid(), 'text', 'היי')$$,
  (select v from ctx where k = 'conv')), 'row-level security');
do $$ begin
  if exists (select 1 from public.messages) then raise exception 'FAIL: outsider reads messages'; end if;
end $$;

-- הורה המוכר רואה את השיחה, והטקסט שלו לא מסונן
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
insert into public.messages (conversation_id, sender_id, kind, body)
values ((select v::uuid from ctx where k = 'conv'), auth.uid(), 'text', 'נפגש בגן ציבורי, טלפון 050-7654321');
do $$ begin
  if (select count(*) from public.messages) <> 3 then raise exception 'FAIL: seller parent cannot read chat'; end if;
  if not exists (select 1 from public.messages where body like '%050-7654321%') then raise exception 'FAIL: parent text filtered'; end if;
end $$;

-- 7. משא ומתן
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
insert into ctx select 'offer1', public.make_offer((select v::uuid from ctx where k = 'conv'), 50);
select pg_temp.expect_error(format($$select public.respond_offer(%L, 'accept', null)$$, (select v from ctx where k = 'offer1')), 'הצד השני');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
insert into ctx select 'offer2', public.respond_offer((select v::uuid from ctx where k = 'offer1'), 'counter', 70);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
insert into ctx select 'deal', public.respond_offer((select v::uuid from ctx where k = 'offer2'), 'accept', null);
do $$ begin
  if (select status || ':' || price from public.deals) <> 'awaiting_parent:70' then raise exception 'FAIL: deal state'; end if;
end $$;

-- 8. רק הורה הקונה מאשר
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select pg_temp.expect_error(format($$select public.decide_deal(%L, true)$$, (select v from ctx where k = 'deal')), 'הורה הקונה');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select pg_temp.expect_error(format($$select public.decide_deal(%L, true)$$, (select v from ctx where k = 'deal')), 'הורה הקונה');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.decide_deal((select v::uuid from ctx where k = 'deal'), true);
do $$ begin
  if (select status from public.listings) <> 'reserved' then raise exception 'FAIL: listing not reserved'; end if;
end $$;

-- 9. מסירה ומדבקה
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select pg_temp.expect_error(format($$select public.send_sticker(%L, 'trusted')$$, (select v from ctx where k = 'deal')), 'אחרי המסירה');
select public.confirm_delivery((select v::uuid from ctx where k = 'deal'));
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
select public.confirm_delivery((select v::uuid from ctx where k = 'deal'));
select pg_temp.expect_error(format($$select public.send_sticker(%L, 'trusted')$$, (select v from ctx where k = 'deal')), 'רק הקונה');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select public.send_sticker((select v::uuid from ctx where k = 'deal'), 'trusted');
do $$ begin
  if (select status from public.deals) <> 'completed' then raise exception 'FAIL: deal not completed'; end if;
  if (select status from public.listings) <> 'sold' then raise exception 'FAIL: listing not sold'; end if;
end $$;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
do $$ begin
  if (select count(*) from public.stickers where to_id = auth.uid()) <> 1 then raise exception 'FAIL: seller cannot see sticker'; end if;
end $$;

-- 10. דיווח וחסימה
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select public.report_content('conversation', (select v::uuid from ctx where k = 'conv'), 'בדיקת דיווח');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  if not exists (select 1 from public.reports) then raise exception 'FAIL: organizer cannot see report'; end if;
end $$;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select public.block_conversation((select v::uuid from ctx where k = 'conv'));
select pg_temp.expect_error(format($$insert into public.messages (conversation_id, sender_id, kind, body) values (%L, auth.uid(), 'text', 'היי')$$,
  (select v from ctx where k = 'conv')), 'חסומה');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.unblock_family((select family_id from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'));

-- 11. anon לא רואה כלום
reset role;
set role anon;
select pg_temp.expect_error($$select * from public.listings$$, 'permission denied');
select * from public.check_invite('BOOT0001');
reset role;

\echo ALL_TESTS_PASSED
