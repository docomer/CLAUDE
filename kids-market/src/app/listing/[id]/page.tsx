import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { CATEGORIES, CONDITIONS, STATUS_LABELS, STICKERS } from "@/lib/content";
import { signPhotos } from "@/lib/photos";
import { ActionForm, Submit } from "@/components/action-form";
import { ReportForm } from "@/components/report-form";
import { Avatar, Badge, ButtonLink, Card, shekel } from "@/components/ui";
import { moderateRemoveListing, startConversation, withdrawListing } from "@/lib/actions";
import type { Fair, Listing, Profile } from "@/lib/types";
import { fairState } from "@/lib/fair";

export default async function ListingPage({ params }: PageProps<"/listing/[id]">) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile();
  const { data: l } = await supabase.from("listings").select("*").eq("id", id).maybeSingle<Listing>();
  if (!l) notFound();

  const [{ data: seller }, { data: fair }, { data: stickers }, { data: isOrganizer }, { data: myConv }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", l.seller_id).maybeSingle<Profile>(),
    supabase.from("fairs").select("*").eq("id", l.fair_id).maybeSingle<Fair>(),
    supabase.from("stickers").select("sticker").eq("to_id", l.seller_id),
    supabase.rpc("is_fair_organizer", { f: l.fair_id }),
    supabase.from("conversations").select("id").eq("listing_id", l.id).eq("buyer_id", profile.id).maybeSingle(),
  ]);
  const photos = await signPhotos(l.photos);
  const mine = l.family_id === profile.family_id;
  const fairOpen = !!fair && fairState(fair) === "open";
  const stickerCounts = Object.entries(
    (stickers ?? []).reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.sticker]: (acc[s.sticker] ?? 0) + 1 }), {}),
  );

  return (
    <div className="grid gap-4">
      <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory -mx-4 px-4">
        {l.photos.map((p) => (
          <div key={p} className="snap-center shrink-0 w-full aspect-square rounded-2xl overflow-hidden bg-[var(--soft)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {photos[p] && <img src={photos[p]} alt={l.title} className="w-full h-full object-cover" />}
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-2xl font-bold">{l.title}</h1>
          <span className="text-2xl font-extrabold text-[var(--brand)] shrink-0">{shekel(l.price)}</span>
        </div>
        <div className="flex gap-2 mt-2 flex-wrap">
          <Badge>{CATEGORIES[l.category]}</Badge>
          <Badge>{CONDITIONS[l.condition]}</Badge>
          {l.status !== "active" && <Badge tone={l.status === "sold" ? "ok" : "warn"}>{STATUS_LABELS[l.status]}</Badge>}
        </div>
      </div>

      <Card className="bg-[var(--soft)] border-[var(--brand)]">
        <div className="font-bold mb-1">⭐ למה זה הכי מגניב?</div>
        <p className="text-lg">{l.coolest}</p>
      </Card>
      {l.description && <p className="whitespace-pre-line">{l.description}</p>}
      {l.status === "rejected" && l.rejection_reason && <Card className="border-[var(--danger)]">ההורים כתבו: {l.rejection_reason}</Card>}

      {seller && (
        <Card className="flex items-center gap-3">
          <Avatar avatar={seller.avatar} />
          <div className="flex-1">
            <div className="font-bold">{seller.nickname}</div>
            <div className="text-sm text-[var(--muted)]">{seller.full_name}</div>
            {stickerCounts.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-1">
                {stickerCounts.map(([k, n]) => <Badge key={k}>{STICKERS[k]} ×{n}</Badge>)}
              </div>
            )}
          </div>
        </Card>
      )}

      {profile.role === "kid" && !mine && (
        myConv ? <ButtonLink href={`/chat/${myConv.id}`} className="text-lg">💬 לשיחה עם המוכר/ת</ButtonLink>
          : l.status === "active" && fairOpen && (
            <ActionForm action={startConversation}>
              <input type="hidden" name="listing_id" value={l.id} />
              <Submit className="w-full text-lg">אני רוצה את זה! 💬</Submit>
            </ActionForm>
          )
      )}

      {mine && ["pending", "active", "rejected"].includes(l.status) && (
        <ActionForm action={withdrawListing} confirm="להוריד את המודעה?">
          <input type="hidden" name="listing_id" value={l.id} />
          <Submit variant="secondary">הורדת המודעה</Submit>
        </ActionForm>
      )}

      {(isOrganizer || profile.is_admin) && !mine && !["removed", "sold"].includes(l.status) && (
        <ActionForm action={moderateRemoveListing} confirm="להסיר את המודעה מהיריד?">
          <input type="hidden" name="listing_id" value={l.id} />
          <Submit variant="danger">הסרה (מארגן)</Submit>
        </ActionForm>
      )}

      {!mine && <ReportForm type="listing" target={l.id} />}
    </div>
  );
}
