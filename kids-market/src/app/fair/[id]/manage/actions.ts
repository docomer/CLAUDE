"use server";

import { revalidatePath } from "next/cache";
import { errorMessage, requireParent } from "@/lib/auth";
import type { ActionResult } from "@/lib/types";

export async function removeFamily(_: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await requireParent();
  const fairId = String(data.get("fair_id"));
  const { error } = await supabase.rpc("remove_fair_member", { p_fair: fairId, p_family: String(data.get("family_id")) });
  if (error) return { error: errorMessage(error) };
  revalidatePath(`/fair/${fairId}/manage`);
  return { ok: "המשפחה הוסרה" };
}
