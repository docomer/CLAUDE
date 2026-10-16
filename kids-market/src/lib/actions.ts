"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorMessage, requireKid, requireProfile } from "@/lib/auth";
import { dispatchPending } from "@/lib/notify";
import type { ActionResult } from "@/lib/types";

const s = (d: FormData, k: string) => String(d.get(k) ?? "");

export async function reportContent(_: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc("report_content", {
    p_type: s(data, "type"), p_target: s(data, "target"), p_reason: s(data, "reason"),
  });
  if (error) return { error: errorMessage(error) };
  after(dispatchPending);
  return { ok: "תודה! הדיווח נשלח למארגני היריד 🙏" };
}

export async function startConversation(_: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await requireKid();
  const { data: convId, error } = await supabase.rpc("start_conversation", { p_listing: s(data, "listing_id") });
  if (error) return { error: errorMessage(error) };
  redirect(`/chat/${convId}`);
}

export async function withdrawListing(_: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await requireProfile();
  const id = s(data, "listing_id");
  const { error } = await supabase.rpc("withdraw_listing", { p_listing: id });
  if (error) return { error: errorMessage(error) };
  revalidatePath(`/listing/${id}`);
  return { ok: "המודעה הורדה" };
}

export async function moderateRemoveListing(_: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await requireProfile();
  const id = s(data, "listing_id");
  const { error } = await supabase.rpc("moderate_remove_listing", { p_listing: id });
  if (error) return { error: errorMessage(error) };
  after(dispatchPending);
  revalidatePath(`/listing/${id}`);
  return { ok: "המודעה הוסרה" };
}

export async function markAllRead() {
  const { supabase, user } = await requireProfile();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  revalidatePath("/", "layout");
}
