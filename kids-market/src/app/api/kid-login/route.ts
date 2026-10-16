import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { kidEmail, kidPassword } from "@/lib/auth";

// שלב 1: קוד משפחה → רשימת הילדים (כינוי ואווטאר בלבד).
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code") ?? "";
  if (!/^[A-Za-z0-9]{6}$/.test(code)) return NextResponse.json({ kids: [] });
  const { data } = await createAdminClient().rpc("kids_for_login", { p_code: code });
  return NextResponse.json({ kids: data ?? [] });
}

// שלב 2: PIN → התחברות לחשבון הילד.
export async function POST(request: NextRequest) {
  const { code, kidId, pin } = await request.json().catch(() => ({}));
  if (typeof code !== "string" || typeof kidId !== "string" || typeof pin !== "string") {
    return NextResponse.json({ error: "פרטים חסרים" }, { status: 400 });
  }
  const { data: result, error } = await createAdminClient().rpc("verify_kid_pin", { p_code: code, p_kid: kidId, p_pin: pin });
  if (error) return NextResponse.json({ error: "משהו השתבש" }, { status: 500 });
  if (result === "locked") return NextResponse.json({ error: "יותר מדי ניסיונות. נסו שוב בעוד רבע שעה 🙂" }, { status: 429 });
  if (result !== "ok") return NextResponse.json({ error: "הקוד הסודי לא נכון" }, { status: 401 });

  const supabase = await createClient();
  await supabase.auth.signOut();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: kidEmail(kidId), password: kidPassword(kidId) });
  if (signInError) return NextResponse.json({ error: "לא הצלחנו להיכנס" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
