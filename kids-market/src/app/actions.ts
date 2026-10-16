"use server";

import { redirect } from "next/navigation";
import { errorMessage, requireParent } from "@/lib/auth";
import type { ActionResult } from "@/lib/types";

export async function joinFair(_: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await requireParent();
  const { data: fairId, error } = await supabase.rpc("join_fair", { p_code: String(data.get("code") ?? "") });
  if (error) return { error: errorMessage(error) };
  redirect(`/fair/${fairId}`);
}
