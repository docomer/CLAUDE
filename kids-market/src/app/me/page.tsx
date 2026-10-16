import Link from "next/link";
import { requireKid } from "@/lib/auth";
import { STATUS_LABELS, STICKERS } from "@/lib/content";
import { signPhotos } from "@/lib/photos";
import { PushToggle } from "@/components/push-toggle";
import { Avatar, Badge, Card, Empty, PageTitle, shekel } from "@/components/ui";
import type { Deal, Listing } from "@/lib/types";
import { kidSignOut } from "./actions";

export default async function MyBusinessPage({ searchParams }: PageProps<"/me">) {
  const { supabase, profile } = await requireKid();
  const { posted } = await searchParams;
  const [{ data: listings }, { data: sales }, { data: stickers }] = await Promise.all([
    supabase.from("listings").select("*").eq("seller_id", profile.id).order("created_at", { ascending: false }).returns<Listing[]>(),
    supabase.from("deals").select("*").eq("seller_id", profile.id).eq("status", "completed").returns<Deal[]>(),
    supabase.from("stickers").select("sticker").eq("to_id", profile.id),
  ]);
  const earned = (sales ?? []).reduce((sum, d) => sum + d.price, 0);
  const counts = (stickers ?? []).reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.sticker]: (acc[s.sticker] ?? 0) + 1 }), {});
  const photos = await signPhotos((listings ?? []).map((l) => l.photos[0]));

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <Avatar avatar={profile.avatar} size="lg" />
        <PageTitle sub={profile.full_name}>העסק של {profile.nickname}</PageTitle>
      </div>

      {posted && <Card className="bg-emerald-50 border-emerald-300 text-emerald-900">🚀 המודעה נשלחה! ההורים יאשרו אותה בקרוב.</Card>}

      <div className="grid grid-cols-3 gap-3 text-center">
        <Card><div className="text-3xl font-extrabold text-[var(--brand)]">{earned} ₪</div><div className="text-sm">הרווחתי</div></Card>
        <Card><div className="text-3xl font-extrabold">{sales?.length ?? 0}</div><div className="text-sm">מכרתי</div></Card>
        <Card><div className="text-3xl font-extrabold">{stickers?.length ?? 0}</div><div className="text-sm">מדבקות</div></Card>
      </div>

      {Object.keys(counts).length > 0 && (
        <Card>
          <div className="font-bold mb-2">המדבקות שלי 💛</div>
          <div className="flex flex-wrap gap-2">{Object.entries(counts).map(([k, n]) => <Badge key={k} tone="brand">{STICKERS[k]} ×{n}</Badge>)}</div>
        </Card>
      )}

      <section>
        <h2 className="text-xl font-bold mb-2">המודעות שלי</h2>
        {!listings?.length && <Empty emoji="🧸">עוד לא העליתם מודעות. <Link className="underline" href="/sell">בואו נמכור משהו!</Link></Empty>}
        <div className="grid gap-2">
          {(listings ?? []).map((l) => (
            <Link key={l.id} href={`/listing/${l.id}`}>
              <Card className="flex items-center gap-3 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {photos[l.photos[0]] && <img src={photos[l.photos[0]]} alt="" className="w-12 h-12 rounded-xl object-cover" />}
                <div className="flex-1">
                  <div className="font-bold">{l.title}</div>
                  <div className="text-sm">{shekel(l.price)}</div>
                </div>
                <Badge tone={l.status === "sold" ? "ok" : l.status === "active" ? "brand" : l.status === "pending" ? "warn" : "soft"}>{STATUS_LABELS[l.status]}</Badge>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <Card><PushToggle /></Card>
      <form action={kidSignOut}><button className="text-[var(--muted)] underline">יציאה</button></form>
    </div>
  );
}
