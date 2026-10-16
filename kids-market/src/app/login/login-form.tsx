"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buttonClass, Field, inputClass } from "@/components/ui";

function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("972")) return `+${digits}`;
  if (digits.startsWith("0")) return `+972${digits.slice(1)}`;
  return `+${digits}`;
}

export function LoginForm({ method, next }: { method: "phone" | "email"; next: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"id" | "code">("id");
  const [id, setId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const supabase = createClient();

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const { error } = method === "phone"
      ? await supabase.auth.signInWithOtp({ phone: normalizePhone(id) })
      : await supabase.auth.signInWithOtp({ email: id.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) return setError("לא הצלחנו לשלוח קוד. בדקו את הפרטים ונסו שוב.");
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const { error } = method === "phone"
      ? await supabase.auth.verifyOtp({ phone: normalizePhone(id), token: code.trim(), type: "sms" })
      : await supabase.auth.verifyOtp({ email: id.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) return setError("הקוד לא נכון או שפג תוקפו.");
    router.replace(next);
    router.refresh();
  }

  if (step === "id") {
    return (
      <form onSubmit={send}>
        <Field label={method === "phone" ? "מספר טלפון נייד" : "כתובת מייל"}>
          <input
            className={inputClass} dir="ltr" required autoFocus value={id} onChange={(e) => setId(e.target.value)}
            type={method === "phone" ? "tel" : "email"} inputMode={method === "phone" ? "tel" : "email"}
            placeholder={method === "phone" ? "050-0000000" : "name@example.com"}
          />
        </Field>
        <button className={buttonClass("primary", "w-full")} disabled={busy}>{busy ? "שולחים…" : "שליחת קוד"}</button>
        {error && <p role="alert" className="mt-3 text-[var(--danger)]">{error}</p>}
      </form>
    );
  }
  return (
    <form onSubmit={verify}>
      <Field label="הקוד שקיבלתם" hint={`נשלח אל ${id}`}>
        <input
          className={`${inputClass} text-center text-2xl tracking-widest`} dir="ltr" required autoFocus
          inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)}
        />
      </Field>
      <button className={buttonClass("primary", "w-full")} disabled={busy}>{busy ? "בודקים…" : "כניסה"}</button>
      <button type="button" className={buttonClass("ghost", "w-full mt-2")} onClick={() => setStep("id")}>שינוי פרטים</button>
      {error && <p role="alert" className="mt-3 text-[var(--danger)]">{error}</p>}
    </form>
  );
}
