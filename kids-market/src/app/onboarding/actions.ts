"use server";

import { redirect } from "next/navigation";
import { errorMessage, getMe } from "@/lib/auth";
import type { ActionResult } from "@/lib/types";

export async function completeSignup(_: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase, user } = await getMe();
  if (!user) redirect("/login");
  const { error } = await supabase.rpc("complete_parent_signup", {
    p_code: String(data.get("code") ?? ""),
    p_full_name: String(data.get("full_name") ?? ""),
    p_accept_terms: data.get("accept") === "on",
  });
  if (error) return { error: errorMessage(error) };
  const email = String(data.get("email") ?? "").trim();
  if (email) await supabase.from("parent_contacts").upsert({ user_id: user.id, email });
  redirect("/parent/settings?welcome=1");
}
