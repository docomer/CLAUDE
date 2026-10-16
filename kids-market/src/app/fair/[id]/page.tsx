import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { CATEGORIES, STATUS_LABELS } from "@/lib/content";
import { signPhotos } from "@/lib/photos";
import { Avatar, Badge, ButtonLink, Card, Empty, PageTitle, shekel } from "@/components/ui";
import type { Fair, Listing, Profile } from "@/lib/types";
import { fairState, fairStatusText } from "@/lib/fair";

export default async function FairPage({ params, searchParams }: PageProps<"/fair/[id]">) {
  const { id } = await params;
  const { cat } = await searchParams;
  const { supabase, profile } = await requireProfile();
  const { data: fair } = await supabase.from("fairs").select("*").eq("id", id).maybeSingle<Fair>();
  if (!fair) notFound();

  let query = supabase.from("listings").select("*").eq("fair_id", id).in("status", ["active", "reserved", "sold"])
    .order("created_at", { ascending: false });
  if (typeof cat === "string" && cat in CATEGORIES) query = query.eq("category", cat);
  const { data: listings } = await query.returns<Listing[]>();
  const sellerIds = [...new Set((listings ?? []).map((l) => l.seller_id))];
  const { data: sellers } = await supabase.from("profiles").select("*").in("id", sellerIds.length ? sellerIds : ["00000000-0000-0000-0000-000000000000"]).returns<Profile[]>();
  const sellerMap = new Map((sellers ?? []).map((s) => [s.id, s]));
  const photos = await signPhotos((listings ?? []).map((l) => l.photos[0]));

  const open = fairState(fair) === "open";
  const { data: isOrganizer } = await supabase.rpc("is_fair_organizer", { f: fair.id });

  return (
    <div>
      <PageTitle sub={fairStatusText(fair)}>
        🎪 {fair.name}
      </PageTitle>
      {fair.description && <p className="mb-4 -mt-2">{fair.description}</p>}

      <div className="flex gap-2 mb-4 flex-wrap">
        {profile.role === "kid" && open && <ButtonLink href={`/sell?fair=${fair.id}`}>➕ למכור משהו</ButtonLink>}
        {isOrganizer && <ButtonLink href={`/fair/${fair.id}/manage`} variant="secondary">ניהול היריד</ButtonLink>}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-4 px-4">
        <Link href={`/fair/${fair.id}`} className={`shrink-0 rounded-full px-3 py-1.5 ${!cat ? "bg-[var(--brand)] text-white" : "bg-[var(--soft)]"}`}>הכל</Link>
        {Object.entries(CATEGORIES).map(([k, v]) => (
          <Link key={k} href={`/fair/${fair.id}?cat=${k}`} className={`shrink-0 rounded-full px-3 py-1.5 ${cat === k ? "bg-[var(--brand)] text-white" : "bg-[var(--soft)]"}`}>{v}</Link>
        ))}
      </div>

      {!listings?.length && <Empty emoji="🧸">עדיין אין כאן מודעות. {profile.role === "kid" ? "תהיו הראשונים!" : ""}</Empty>}
      <div className="grid grid-cols-2 gap-3">
        {(listings ?? []).map((l) => {
          const seller = sellerMap.get(l.seller_id);
          return (
            <Link key={l.id} href={`/listing/${l.id}`}>
              <Card className={`p-0 overflow-hidden h-full ${l.status !== "active" ? "opacity-70" : ""}`}>
                <div className="aspect-square bg-[var(--soft)] relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {photos[l.photos[0]] && <img src={photos[l.photos[0]]} alt="" className="w-full h-full object-cover" />}
                  {l.status !== "active" && <span className="absolute top-2 right-2"><Badge tone={l.status === "sold" ? "ok" : "warn"}>{STATUS_LABELS[l.status]}</Badge></span>}
                </div>
                <div className="p-3">
                  <div className="font-bold leading-tight">{l.title}</div>
                  <div className="text-lg font-extrabold text-[var(--brand)]">{shekel(l.price)}</div>
                  {seller && <div className="flex items-center gap-1 text-sm text-[var(--muted)] mt-1"><Avatar avatar={seller.avatar} size="sm" />{seller.nickname}</div>}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
