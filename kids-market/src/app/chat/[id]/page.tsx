import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { BUYER_TEMPLATES, DEAL_STATUS_LABELS, MAX_PRICE, SELLER_TEMPLATES, STICKERS } from "@/lib/content";
import { signPhotos } from "@/lib/photos";
import { ActionForm, Submit } from "@/components/action-form";
import { ReportForm } from "@/components/report-form";
import { Avatar, Badge, Card, inputClass, shekel } from "@/components/ui";
import type { Conversation, Deal, Listing, Message, Profile } from "@/lib/types";
import { blockConversation, cancelDeal, confirmDelivery, decideDeal, makeOffer, respondOffer, sendMessage, sendSticker } from "./actions";
import { LiveRefresh } from "./live-refresh";

export default async function ChatPage({ params }: PageProps<"/chat/[id]">) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile();
  const { data: conv } = await supabase.from("conversations").select("*").eq("id", id).maybeSingle<Conversation>();
  if (!conv) notFound();

  const [{ data: listing }, { data: messages }, { data: deals }, { data: people }] = await Promise.all([
    supabase.from("listings").select("*").eq("id", conv.listing_id).single<Listing>(),
    supabase.from("messages").select("*").eq("conversation_id", id).order("created_at").returns<Message[]>(),
    supabase.from("deals").select("*").eq("conversation_id", id).order("created_at", { ascending: false }).returns<Deal[]>(),
    supabase.from("profiles").select("*").in("family_id", [conv.buyer_family_id, conv.seller_family_id]).returns<Profile[]>(),
  ]);
  if (!listing) notFound();
  const byId = new Map((people ?? []).map((p) => [p.id, p]));
  const buyer = byId.get(conv.buyer_id);
  const seller = byId.get(listing.seller_id);
  const deal = deals?.[0];
  const { data: sentSticker } = deal?.status === "completed"
    ? await supabase.from("stickers").select("sticker").eq("deal_id", deal.id).maybeSingle()
    : { data: null };
  const thumb = (await signPhotos([listing.photos[0]]))[listing.photos[0]];

  const isKid = profile.role === "kid";
  const iAmBuyerSide = profile.family_id === conv.buyer_family_id;
  const isParticipant = profile.id === conv.buyer_id || profile.id === listing.seller_id ||
    (profile.role === "parent" && (profile.family_id === conv.buyer_family_id || profile.family_id === conv.seller_family_id));
  const myKidInChat = isKid && (profile.id === conv.buyer_id || profile.id === listing.seller_id);
  const openDeal = deal && ["awaiting_parent", "approved"].includes(deal.status);
  const canOffer = myKidInChat && listing.status === "active" && !openDeal;
  const templates = profile.id === conv.buyer_id ? BUYER_TEMPLATES : SELLER_TEMPLATES;
  const other = profile.id === conv.buyer_id ? seller : buyer;

  return (
    <div className="grid gap-3">
      <LiveRefresh conversationId={id} />
      <Link href={`/listing/${listing.id}`}>
        <Card className="flex items-center gap-3 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {thumb && <img src={thumb} alt="" className="w-14 h-14 rounded-xl object-cover" />}
          <div className="flex-1">
            <div className="font-bold">{listing.title}</div>
            <div className="text-[var(--brand)] font-bold">{shekel(listing.price)}</div>
          </div>
          {other && <div className="text-center text-sm"><Avatar avatar={other.avatar} size="sm" /><div>{other.nickname}</div></div>}
        </Card>
      </Link>
      {!isKid && <p className="text-sm text-center text-[var(--muted)]">👀 את/ה צופה בשיחה כהורה. ההודעות שלך מסומנות &quot;הורה&quot;.</p>}

      {deal && (
        <Card className="border-[var(--brand)]">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold">🤝 עסקה: {shekel(deal.price)}</span>
            <Badge tone={deal.status === "completed" ? "ok" : deal.status === "approved" ? "brand" : ["declined", "cancelled"].includes(deal.status) ? "danger" : "warn"}>
              {DEAL_STATUS_LABELS[deal.status]}
            </Badge>
          </div>

          {deal.status === "awaiting_parent" && !isKid && iAmBuyerSide && (
            <ActionForm action={decideDeal} className="flex gap-2">
              <input type="hidden" name="conversation_id" value={id} />
              <input type="hidden" name="deal_id" value={deal.id} />
              <Submit name="approve" value="yes" className="flex-1">✅ אישור הקנייה</Submit>
              <Submit name="approve" value="no" variant="secondary">לא הפעם</Submit>
            </ActionForm>
          )}

          {deal.status === "approved" && (
            <div className="grid gap-2">
              <p className="text-sm">הורים: תאמו כאן מקום וזמן למסירה. התשלום במזומן או בביט, במסירה.</p>
              <p className="text-sm">
                קונה: {deal.buyer_confirmed ? "✅ קיבל/ה" : "⏳"} · מוכר/ת: {deal.seller_confirmed ? "✅ מסר/ה" : "⏳"}
              </p>
              {isParticipant && !(iAmBuyerSide ? deal.buyer_confirmed : deal.seller_confirmed) && (
                <ActionForm action={confirmDelivery}>
                  <input type="hidden" name="conversation_id" value={id} />
                  <input type="hidden" name="deal_id" value={deal.id} />
                  <Submit className="w-full">{iAmBuyerSide ? "קיבלתי ✅" : "נמסר ✅"}</Submit>
                </ActionForm>
              )}
            </div>
          )}

          {openDeal && !isKid && isParticipant && (
            <ActionForm action={cancelDeal} className="mt-2" confirm="לבטל את העסקה?">
              <input type="hidden" name="conversation_id" value={id} />
              <input type="hidden" name="deal_id" value={deal.id} />
              <Submit variant="ghost">ביטול העסקה</Submit>
            </ActionForm>
          )}

          {deal.status === "completed" && profile.id === deal.buyer_id && !sentSticker && (
            <ActionForm action={sendSticker}>
              <input type="hidden" name="conversation_id" value={id} />
              <input type="hidden" name="deal_id" value={deal.id} />
              <p className="font-semibold mb-2">שלחו מדבקת תודה 💛</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(STICKERS).map(([k, v]) => <Submit key={k} name="sticker" value={k} variant="secondary" className="py-2">{v}</Submit>)}
              </div>
            </ActionForm>
          )}
          {deal.status === "completed" && sentSticker && <p>נשלחה מדבקה: {STICKERS[sentSticker.sticker]}</p>}
        </Card>
      )}

      <div className="grid gap-2">
        {(messages ?? []).map((m) => {
          if (m.kind === "system") return <div key={m.id} className="text-center text-sm bg-[var(--soft)] rounded-xl px-3 py-2">{m.body}</div>;
          const sender = m.sender_id ? byId.get(m.sender_id) : undefined;
          const mineMsg = m.sender_id === profile.id;
          return (
            <div key={m.id} className={`flex gap-2 items-end ${mineMsg ? "flex-row-reverse" : ""}`}>
              {sender && <Avatar avatar={sender.avatar} size="sm" />}
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${mineMsg ? "bg-[var(--brand)] text-white" : "bg-[var(--card)] border border-[var(--line)]"}`}>
                <div className="text-xs opacity-75">{sender?.nickname}{sender?.role === "parent" && " (הורה)"}</div>
                {m.kind === "offer" ? (
                  <div>
                    <div className="font-bold text-lg">💰 הצעה: {shekel(m.amount ?? 0)}</div>
                    <div className="text-sm">{{ pending: "מחכה לתשובה", accepted: "התקבלה! 🎉", declined: "נדחתה", countered: "נשלחה הצעה נגדית", expired: "לא בתוקף" }[m.offer_status ?? "expired"]}</div>
                    {m.offer_status === "pending" && myKidInChat && !mineMsg && (
                      <ActionForm action={respondOffer} className="mt-2 grid gap-2">
                        <input type="hidden" name="conversation_id" value={id} />
                        <input type="hidden" name="message_id" value={m.id} />
                        <div className="flex gap-2">
                          <Submit name="action" value="accept" className="flex-1 py-2">מסכים/ה 🤝</Submit>
                          <Submit name="action" value="decline" variant="secondary" className="py-2">לא</Submit>
                        </div>
                        <div className="flex gap-2">
                          <input name="amount" type="number" min={1} max={MAX_PRICE} placeholder="מחיר אחר" className={`${inputClass} py-2 text-[var(--fg)]`} />
                          <Submit name="action" value="counter" variant="secondary" className="py-2">הצעה נגדית</Submit>
                        </div>
                      </ActionForm>
                    )}
                  </div>
                ) : (
                  <div className="whitespace-pre-line">{m.body}</div>
                )}
                {m.filtered && <div className="text-xs opacity-75 mt-1">🚫 פרטים אישיים הוסתרו</div>}
              </div>
            </div>
          );
        })}
      </div>

      {isParticipant && (
        <div className="grid gap-2 sticky bottom-20 bg-[var(--bg)] pt-2">
          {isKid && (
            <div className="flex gap-2 overflow-x-auto -mx-4 px-4">
              {templates.map((t) => (
                <ActionForm key={t} action={sendMessage} className="shrink-0">
                  <input type="hidden" name="conversation_id" value={id} />
                  <input type="hidden" name="kind" value="template" />
                  <input type="hidden" name="body" value={t} />
                  <Submit variant="secondary" className="py-2 text-sm whitespace-nowrap">{t}</Submit>
                </ActionForm>
              ))}
            </div>
          )}
          {canOffer && (
            <ActionForm action={makeOffer} className="flex gap-2">
              <input type="hidden" name="conversation_id" value={id} />
              <input name="amount" type="number" required min={1} max={MAX_PRICE} defaultValue={listing.price} className={inputClass} aria-label="מחיר" />
              <Submit variant="secondary" className="shrink-0">💰 הצעת מחיר</Submit>
            </ActionForm>
          )}
          <ActionForm action={sendMessage} className="flex gap-2">
            <input type="hidden" name="conversation_id" value={id} />
            <input name="body" required maxLength={500} autoComplete="off" placeholder="כתבו הודעה…" className={inputClass} />
            <Submit className="shrink-0">שליחה</Submit>
          </ActionForm>
        </div>
      )}

      {isParticipant && (
        <div className="flex justify-between items-start gap-4 mt-4">
          <ReportForm type="conversation" target={id} label="🚩 דיווח על השיחה" />
          <details>
            <summary className="cursor-pointer text-sm text-[var(--muted)]">⛔ חסימה</summary>
            <ActionForm action={blockConversation} className="mt-2" confirm="לחסום את המשפחה השנייה? לא תוכלו לדבר יותר.">
              <input type="hidden" name="conversation_id" value={id} />
              <Submit variant="danger" className="py-2">חסימה</Submit>
            </ActionForm>
          </details>
        </div>
      )}
    </div>
  );
}
