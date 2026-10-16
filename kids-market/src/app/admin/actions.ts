"use server";

import { revalidatePath } from "next/cache";
import { errorMessage, requireParent } from "@/lib/auth";
import type { ActionResult } from "@/lib/types";

export async function resolveReport(_: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await requireParent();
  const { error } = await supabase.rpc("resolve_report", { p_report: String(data.get("report_id")) });
  if (error) return { error: errorMessage(error) };
  revalidatePath("/admin");
  return { ok: "סומן כטופל" };
}
