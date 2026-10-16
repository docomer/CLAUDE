"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { errorMessage, requireParent } from "@/lib/auth";
import { APPROVAL_CHECKLIST } from "@/lib/content";
import { dispatchPending } from "@/lib/notify";
import type { ActionResult } from "@/lib/types";

export async function reviewListing(_: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await requireParent();
  const approve = data.get("decision") === "approve";
  if (approve && data.getAll("check").length < APPROVAL_CHECKLIST.length) {
    return { error: "סמנו את כל הבדיקות לפני האישור" };
  }
  const { error } = await supabase.rpc("review_listing", {
    p_listing: String(data.get("listing_id")), p_approve: approve, p_reason: String(data.get("reason") ?? ""),
  });
  if (error) return { error: errorMessage(error) };
  after(dispatchPending);
  revalidatePath("/parent");
  return { ok: approve ? "אושר ועלה ליריד 🎉" : "נשלח חזרה לילד/ה" };
}

export async function decideDealFromInbox(_: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await requireParent();
  const { error } = await supabase.rpc("decide_deal", { p_deal: String(data.get("deal_id")), p_approve: data.get("approve") === "yes" });
  if (error) return { error: errorMessage(error) };
  after(dispatchPending);
  revalidatePath("/parent");
  return { ok: "נשמר" };
}
