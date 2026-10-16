"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { errorMessage, requireKid } from "@/lib/auth";
import { dispatchPending } from "@/lib/notify";
import { MAX_PRICE } from "@/lib/content";
import type { ActionResult } from "@/lib/types";

export async function createListing(_: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase, profile } = await requireKid();
  const photos = data.getAll("photos").map(String).filter(Boolean);
  if (!photos.length) return { error: "צריך לפחות תמונה אחת 📷" };
  const price = Number(data.get("price"));
  if (!Number.isInteger(price) || price < 1 || price > MAX_PRICE) return { error: `המחיר צריך להיות בין 1 ל-${MAX_PRICE} ₪` };

  const { error } = await supabase.from("listings").insert({
    fair_id: String(data.get("fair_id")),
    family_id: profile.family_id,
    seller_id: profile.id,
    title: String(data.get("title") ?? "").trim(),
    coolest: String(data.get("coolest") ?? "").trim(),
    description: String(data.get("description") ?? "").trim(),
    category: String(data.get("category")),
    condition: String(data.get("condition")),
    price,
    photos,
  });
  if (error) return { error: errorMessage(error) };
  after(dispatchPending);
  redirect("/me?posted=1");
}
