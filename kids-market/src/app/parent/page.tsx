import Link from "next/link";
import { requireParent } from "@/lib/auth";
import { APPROVAL_CHECKLIST, CATEGORIES, CONDITIONS, FORBIDDEN_ITEMS } from "@/lib/content";
import { signPhotos } from "@/lib/photos";
import { ActionForm, Submit } from "@/components/action-form";
import { Avatar, ButtonLink, Card, Empty, inputClass, PageTitle, shekel } from "@/components/ui";
import type { Deal, Listing, Profile } from "@/lib/types";
import { decideDealFromInbox, reviewListing } from "./actions";

export default async function ParentInbox() {
  const { supabase, profile } = await requireParent();
  const [{ data: pending }, { data: deals }, { data: kids }] = await Promise.all([
    supabase.from("listings").select("*").eq("family_id", profile.family_id).eq("status", "pending").order("created_at").returns<Listing[]>(),
    supabase.from("deals").select("*").in("status", ["awaiting_parent", "approved"]).order("created_at").returns<Deal[]>(),
    supabase.from("profiles").select("*").eq("family_id", profile.family_id).eq("role", "kid").returns<Profile[]>(),
  ]);
  const toApprove = (deals ?? []).filter((d) => d.status === "awaiting_parent" && d.buyer_family_id === profile.family_id);
  const toDeliver = (deals ?? []).filter((d) => d.status === "approved");
  const dealListingIds = [...toApprove, ...toDeliver].map((d) => d.listing_id);
  const { data: dealListings } = await supabase.from("listings").select("*")
    .in("id", dealListingIds.length ? dealListingIds : ["00000000-0000-0000-0000-000000000000"]).returns<Listing[]>();
  const dl = new Map((dealListings ?? []).map((l) => [l.id, l]));
  const kidMap = new Map((kids ?? []).map((k) => [k.id, k]));
  const photos = await signPhotos((pending ?? []).flatMap((l) => l.photos));

  return (
    <div className="grid gap-5">
      <PageTitle sub="כל מה שמחכה לך">אישורים ✅</PageTitle>

      {!kids?.length && (
        <Card className="bg-[var(--soft)]">
          <p className="mb-3">עוד אין פרופילים לילדים.</p>
          <ButtonLink href="/parent/settings">הוספת ילד/ה</ButtonLink>
        </Card>
      )}

      <section>
        <h2 className="text-xl font-bold mb-2">קניות שמחכות לאישור ({toApprove.length})</h2>
        {!toApprove.length && <p className="text-[var(--muted)]">אין כרגע.</p>}
        <div className="grid gap-3">
          {toApprove.map((d) => {
            const kid = kidMap.get(d.buyer_id);
            const l = dl.get(d.listing_id);
            return (
              <Card key={d.id}>
                <div className="flex items-center gap-2 mb-2">
                  {kid && <Avatar avatar={kid.avatar} size="sm" />}
                  <span><b>{kid?.nickname}</b> רוצה לקנות <b>{l?.title}</b> ב-<b>{shekel(d.price)}</b></span>
                </div>
                <Link href={`/chat/${d.conversation_id}`} className="text-sm underline text-[var(--brand)]">לקריאת השיחה</Link>
                <ActionForm action={decideDealFromInbox} className="flex gap-2 mt-3">
                  <input type="hidden" name="deal_id" value={d.id} />
                  <Submit name="approve" value="yes" className="flex-1">✅ אישור</Submit>
                  <Submit name="approve" value="no" variant="secondary">לא הפעם</Submit>
                </ActionForm>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-2">מודעות שמחכות לאישור ({pending?.length ?? 0})</h2>
        {!pending?.length && <p className="text-[var(--muted)]">אין כרגע.</p>}
        <div className="grid gap-3">
          {(pending ?? []).map((l) => {
            const kid = kidMap.get(l.seller_id);
            return (
              <Card key={l.id}>
                <div className="flex items-center gap-2 mb-3">
                  {kid && <Avatar avatar={kid.avatar} size="sm" />}
                  <b>{kid?.nickname}</b> רוצה למכור:
                </div>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {l.photos.map((p) => (
                    <a key={p} href={photos[p]} target="_blank" rel="noreferrer" className="aspect-square rounded-xl overflow-hidden bg-[var(--soft)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {photos[p] && <img src={photos[p]} alt="" className="w-full h-full object-cover" />}
                    </a>
                  ))}
                </div>
                <div className="font-bold text-lg">{l.title} · {shekel(l.price)}</div>
                <div className="text-sm text-[var(--muted)]">{CATEGORIES[l.category]} · {CONDITIONS[l.condition]}</div>
                <p className="mt-2">⭐ {l.coolest}</p>
                {l.description && <p className="mt-1 text-sm whitespace-pre-line">{l.description}</p>}

                <ActionForm action={reviewListing} className="mt-4">
                  <input type="hidden" name="listing_id" value={l.id} />
                  <fieldset className="grid gap-2 mb-3">
                    <legend className="font-semibold mb-1">בדיקה לפני אישור</legend>
                    {APPROVAL_CHECKLIST.map((c, i) => (
                      <label key={c} className="flex gap-2 items-start">
                        <input type="checkbox" name="check" value={i} className="mt-1 w-5 h-5" />
                        <span>{c}{i === 1 && <span className="block text-xs text-[var(--muted)]">אסור: {FORBIDDEN_ITEMS.join(", ")}</span>}</span>
                      </label>
                    ))}
                  </fieldset>
                  <Submit name="decision" value="approve" className="w-full">✅ אישור ופרסום</Submit>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[var(--muted)]">לא מאשר/ת</summary>
                    <textarea name="reason" maxLength={300} rows={2} className={`${inputClass} mt-2`} placeholder="הסבר קצר לילד/ה (רשות)" />
                    <Submit name="decision" value="reject" variant="secondary" className="mt-2">החזרה לילד/ה</Submit>
                  </details>
                </ActionForm>
              </Card>
            );
          })}
        </div>
      </section>

      {toDeliver.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-2">מסירות לתיאום 📦</h2>
          <div className="grid gap-2">
            {toDeliver.map((d) => (
              <Link key={d.id} href={`/chat/${d.conversation_id}`}>
                <Card className="p-3">
                  {d.buyer_family_id === profile.family_id ? "קנייה" : "מכירה"}: <b>{dl.get(d.listing_id)?.title}</b> · {shekel(d.price)}
                  <span className="text-sm text-[var(--brand)] mr-2">לתיאום בצ&apos;אט ←</span>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {!pending?.length && !toApprove.length && !toDeliver.length && kids?.length ? <Empty emoji="😌">הכל מטופל!</Empty> : null}
    </div>
  );
}
