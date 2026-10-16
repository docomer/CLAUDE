"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { errorMessage, requireProfile } from "@/lib/auth";
import { dispatchPending } from "@/lib/notify";
import type { ActionResult } from "@/lib/types";

const s = (d: FormData, k: string) => String(d.get(k) ?? "");

async function run(conv: string, fn: string, args: Record<string, unknown>, ok?: string): Promise<ActionResult> {
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { error: errorMessage(error) };
  after(dispatchPending);
  revalidatePath(`/chat/${conv}`);
  return ok ? { ok } : undefined;
}

export async function sendMessage(_: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireProfile();
  const conv = s(data, "conversation_id");
  const body = s(data, "body").trim();
  if (!body) return;
  const kind = data.get("kind") === "template" ? "template" : "text";
  const { error } = await supabase.from("messages").insert({ conversation_id: conv, sender_id: user.id, kind, body });
  if (error) return { error: errorMessage(error) };
  revalidatePath(`/chat/${conv}`);
}

export async function makeOffer(_: ActionResult, data: FormData) {
  return run(s(data, "conversation_id"), "make_offer", { p_conversation: s(data, "conversation_id"), p_amount: Number(data.get("amount")) });
}

export async function respondOffer(_: ActionResult, data: FormData) {
  const action = s(data, "action");
  return run(s(data, "conversation_id"), "respond_offer", {
    p_message: s(data, "message_id"), p_action: action, p_counter: action === "counter" ? Number(data.get("amount")) : null,
  });
}

export async function decideDeal(_: ActionResult, data: FormData) {
  return run(s(data, "conversation_id"), "decide_deal", { p_deal: s(data, "deal_id"), p_approve: data.get("approve") === "yes" });
}

export async function confirmDelivery(_: ActionResult, data: FormData) {
  return run(s(data, "conversation_id"), "confirm_delivery", { p_deal: s(data, "deal_id") });
}

export async function cancelDeal(_: ActionResult, data: FormData) {
  return run(s(data, "conversation_id"), "cancel_deal", { p_deal: s(data, "deal_id") });
}

export async function sendSticker(_: ActionResult, data: FormData) {
  return run(s(data, "conversation_id"), "send_sticker", { p_deal: s(data, "deal_id"), p_sticker: s(data, "sticker") }, "המדבקה נשלחה! 💛");
}

export async function blockConversation(_: ActionResult, data: FormData) {
  return run(s(data, "conversation_id"), "block_conversation", { p_conversation: s(data, "conversation_id") }, "נחסם. ההורים קיבלו הודעה.");
}
