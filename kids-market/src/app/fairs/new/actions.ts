"use server";

import { redirect } from "next/navigation";
import { errorMessage, requireParent } from "@/lib/auth";
import type { ActionResult } from "@/lib/types";

// datetime-local מגיע בלי אזור זמן; מתקנים לפי ההפרש של הדפדפן.
function toIso(local: string, tzOffsetMinutes: number) {
  const asUtc = new Date(`${local}:00Z`).getTime();
  return new Date(asUtc + tzOffsetMinutes * 60000).toISOString();
}

export async function createFair(_: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await requireParent();
  const tz = Number(data.get("tz") ?? 0);
  const { data: id, error } = await supabase.rpc("create_fair", {
    p_name: String(data.get("name") ?? ""),
    p_description: String(data.get("description") ?? ""),
    p_starts: toIso(String(data.get("starts_at")), tz),
    p_ends: toIso(String(data.get("ends_at")), tz),
  });
  if (error) return { error: errorMessage(error) };
  redirect(`/fair/${id}/manage`);
}
