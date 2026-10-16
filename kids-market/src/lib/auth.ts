import "server-only";
import { createHmac } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<Profile>();
  return { supabase, user, profile };
}

export async function requireProfile() {
  const me = await getMe();
  if (!me.user) redirect("/");
  if (!me.profile) redirect("/onboarding");
  return { ...me, user: me.user, profile: me.profile };
}

export async function requireParent() {
  const me = await requireProfile();
  if (me.profile.role !== "parent") redirect("/");
  return me;
}

export async function requireKid() {
  const me = await requireProfile();
  if (me.profile.role !== "kid") redirect("/parent");
  return me;
}

// לילדים אין סיסמה משלהם: השרת גוזר סיסמה פנימית מהמזהה. הילד נכנס עם קוד משפחה + PIN.
export function kidEmail(kidId: string) {
  return `${kidId}@kids.example.com`;
}

export function kidPassword(kidId: string) {
  const secret = process.env.KID_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("KID_AUTH_SECRET חסר או קצר מדי (32 תווים לפחות)");
  return createHmac("sha256", secret).update(kidId).digest("hex");
}

export function errorMessage(e: { message?: string } | null | undefined) {
  if (!e?.message) return "משהו השתבש, נסו שוב";
  return e.message.replace(/^.*?ERROR:\s*/, "");
}
