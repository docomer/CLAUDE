import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { signPhotos } from "@/lib/photos";
import { Avatar, Card, Empty, PageTitle } from "@/components/ui";
import type { Conversation, Listing, Message, Profile } from "@/lib/types";

export default async function ChatsPage() {
  const { supabase, profile } = await requireProfile();
  const { data: convs } = await supabase.from("conversations").select("*").order("created_at", { ascending: false }).returns<Conversation[]>();
  const list = (convs ?? []).filter((c) => c.buyer_family_id === profile.family_id || c.seller_family_id === profile.family_id);
  const listingIds = list.map((c) => c.listing_id);
  const convIds = list.map((c) => c.id);
  const none = ["00000000-0000-0000-0000-000000000000"];
  const [{ data: listings }, { data: lastMessages }] = await Promise.all([
    supabase.from("listings").select("*").in("id", listingIds.length ? listingIds : none).returns<Listing[]>(),
    supabase.from("messages").select("*").in("conversation_id", convIds.length ? convIds : none).order("created_at", { ascending: false }).limit(200).returns<Message[]>(),
  ]);
  const listingMap = new Map((listings ?? []).map((l) => [l.id, l]));
  const kidIds = [...new Set(list.flatMap((c) => [c.buyer_id, listingMap.get(c.listing_id)?.seller_id].filter(Boolean) as string[]))];
  const { data: kids } = await supabase.from("profiles").select("*").in("id", kidIds.length ? kidIds : none).returns<Profile[]>();
  const kidMap = new Map((kids ?? []).map((k) => [k.id, k]));
  const last = new Map<string, Message>();
  for (const m of lastMessages ?? []) if (!last.has(m.conversation_id)) last.set(m.conversation_id, m);
  const photos = await signPhotos([...listingMap.values()].map((l) => l.photos[0]));

  // ילד רואה רק את השיחות שלו; הורה רואה את כל שיחות המשפחה.
  const visible = profile.role === "kid"
    ? list.filter((c) => c.buyer_id === profile.id || listingMap.get(c.listing_id)?.seller_id === profile.id)
    : list;
  visible.sort((a, b) => (last.get(b.id)?.created_at ?? b.created_at).localeCompare(last.get(a.id)?.created_at ?? a.created_at));

  return (
    <div>
      <PageTitle>צ&apos;אטים 💬</PageTitle>
      {!visible.length && <Empty emoji="💬">עוד אין שיחות. מצאו משהו מגניב ביריד!</Empty>}
      <div className="grid gap-2">
        {visible.map((c) => {
          const l = listingMap.get(c.listing_id);
          const buying = c.buyer_family_id === profile.family_id;
          const otherKid = kidMap.get(buying ? (l?.seller_id ?? "") : c.buyer_id);
          const myKid = kidMap.get(buying ? c.buyer_id : (l?.seller_id ?? ""));
          const m = last.get(c.id);
          return (
            <Link key={c.id} href={`/chat/${c.id}`}>
              <Card className="flex items-center gap-3 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {l && photos[l.photos[0]] ? <img src={photos[l.photos[0]]} alt="" className="w-12 h-12 rounded-xl object-cover" /> : <span className="w-12 h-12" />}
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{l?.title}</div>
                  <div className="text-sm text-[var(--muted)] truncate">
                    {profile.role === "parent" && myKid && `${myKid.nickname} ${buying ? "קונה מ" : "מוכר/ת ל"}${otherKid?.nickname ?? ""} · `}
                    {m ? (m.kind === "offer" ? `💰 ${m.amount} ₪` : m.body) : "שיחה חדשה"}
                  </div>
                </div>
                {otherKid && <Avatar avatar={otherKid.avatar} size="sm" />}
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
