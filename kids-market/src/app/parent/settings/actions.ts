"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorMessage, kidEmail, kidPassword, requireParent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PHOTO_BUCKET } from "@/lib/photos";
import type { ActionResult } from "@/lib/types";

const str = (d: FormData, k: string) => String(d.get(k) ?? "").trim();

export async function addKid(_: ActionResult, data: FormData): Promise<ActionResult> {
  const { profile } = await requireParent();
  const pin = str(data, "pin");
  if (!/^\d{4}$/.test(pin)) return { error: "הקוד הסודי צריך להיות 4 ספרות" };
  if (data.get("consent") !== "on") return { error: "יש לאשר את הצגת השם המלא ביריד" };

  const admin = createAdminClient();
  const id = randomUUID();
  const { error: createError } = await admin.auth.admin.createUser({
    id, email: kidEmail(id), password: kidPassword(id), email_confirm: true,
  });
  if (createError) return { error: "לא הצלחנו ליצור את הפרופיל" };

  const { error } = await admin.rpc("admin_register_kid", {
    p_parent: profile.id, p_kid: id, p_nickname: str(data, "nickname"), p_full_name: str(data, "full_name"),
    p_avatar: str(data, "avatar") || "fox", p_pin: pin, p_name_consent: true,
  });
  if (error) {
    await admin.auth.admin.deleteUser(id);
    return { error: errorMessage(error) };
  }
  revalidatePath("/parent/settings");
  return { ok: "הפרופיל נוצר! 🎉" };
}

export async function updateKid(_: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await requireParent();
  const { error } = await supabase.rpc("update_kid", {
    p_kid: str(data, "kid_id"), p_nickname: str(data, "nickname"), p_full_name: str(data, "full_name"),
    p_avatar: str(data, "avatar"), p_pin: str(data, "pin") || null,
  });
  if (error) return { error: errorMessage(error) };
  revalidatePath("/parent/settings");
  return { ok: "נשמר" };
}

export async function regenerateCode(): Promise<ActionResult> {
  const { supabase } = await requireParent();
  const { error } = await supabase.rpc("regenerate_login_code");
  if (error) return { error: errorMessage(error) };
  revalidatePath("/parent/settings");
  return { ok: "נוצר קוד חדש. הקוד הקודם כבר לא עובד." };
}

export async function createInvite(_: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await requireParent();
  const { data: code, error } = await supabase.rpc("create_invite", { p_coparent: data.get("kind") === "coparent" });
  if (error) return { error: errorMessage(error) };
  return { ok: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/join/${code}` };
}

export async function saveEmail(_: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireParent();
  const email = str(data, "email");
  const { error } = await supabase.from("parent_contacts").upsert({ user_id: user.id, email: email || null });
  if (error) return { error: "כתובת המייל לא תקינה" };
  return { ok: "נשמר" };
}

export async function unblock(_: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await requireParent();
  const { error } = await supabase.rpc("unblock_family", { p_family: str(data, "family_id") });
  if (error) return { error: errorMessage(error) };
  revalidatePath("/parent/settings");
  return { ok: "החסימה בוטלה" };
}

export async function signOut() {
  const { supabase } = await requireParent();
  await supabase.auth.signOut();
  redirect("/");
}

export async function deleteAccount(): Promise<ActionResult> {
  const { supabase, profile } = await requireParent();
  const admin = createAdminClient();
  const { data: ids, error } = await admin.rpc("family_user_ids_for_deletion", { p_parent: profile.id });
  if (error) return { error: errorMessage(error) };

  const { data: files } = await admin.storage.from(PHOTO_BUCKET).list(profile.family_id, { limit: 1000 });
  if (files?.length) await admin.storage.from(PHOTO_BUCKET).remove(files.map((f) => `${profile.family_id}/${f.name}`));
  await admin.from("families").delete().eq("id", profile.family_id);
  for (const id of (ids as string[]) ?? []) await admin.auth.admin.deleteUser(id);
  await supabase.auth.signOut();
  redirect("/");
}
