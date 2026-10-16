"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, buttonClass, Field, inputClass } from "@/components/ui";

type Kid = { id: string; nickname: string; avatar: string };

export function KidLogin({ initialCode, initialKid }: { initialCode: string; initialKid: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [kids, setKids] = useState<Kid[] | null>(null);
  const [kid, setKid] = useState<Kid | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const lookup = useCallback(async (c: string) => {
    setBusy(true); setError("");
    const res = await fetch(`/api/kid-login?code=${encodeURIComponent(c.trim().toUpperCase())}`);
    const { kids } = (await res.json()) as { kids: Kid[] };
    setBusy(false);
    if (!kids.length) return setError("לא מצאנו את הקוד הזה. בדקו עם ההורים.");
    setKids(kids);
    const preselected = kids.find((k) => k.id === initialKid);
    if (preselected) setKid(preselected);
  }, [initialKid]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialCode) lookup(initialCode);
  }, [initialCode, lookup]);

  async function login(fullPin: string) {
    if (!kid) return;
    setBusy(true); setError("");
    const res = await fetch("/api/kid-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim().toUpperCase(), kidId: kid.id, pin: fullPin }),
    });
    setBusy(false);
    if (!res.ok) {
      setPin("");
      return setError(((await res.json()) as { error: string }).error);
    }
    router.replace("/");
    router.refresh();
  }

  function press(d: string) {
    if (busy) return;
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4) login(next);
  }

  if (!kids) {
    return (
      <form onSubmit={(e) => { e.preventDefault(); lookup(code); }}>
        <Field label="קוד משפחתי">
          <input className={`${inputClass} text-center text-2xl tracking-widest uppercase`} dir="ltr" maxLength={6}
            required autoFocus value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
        <button className={buttonClass("primary", "w-full text-lg")} disabled={busy}>המשך ←</button>
        {error && <p role="alert" className="mt-3 text-[var(--danger)]">{error}</p>}
      </form>
    );
  }

  if (!kid) {
    return (
      <div>
        <p className="font-semibold mb-3">מי את/ה?</p>
        <div className="grid grid-cols-2 gap-3">
          {kids.map((k) => (
            <button key={k.id} onClick={() => setKid(k)} className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 flex flex-col items-center gap-2">
              <Avatar avatar={k.avatar} size="lg" />
              <span className="font-bold">{k.nickname}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <Avatar avatar={kid.avatar} size="lg" />
      <p className="font-bold text-xl mt-2 mb-4">היי {kid.nickname}! מה הקוד הסודי שלך?</p>
      <div className="flex justify-center gap-3 mb-5" dir="ltr">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`w-5 h-5 rounded-full ${i < pin.length ? "bg-[var(--brand)]" : "bg-[var(--soft)]"}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 max-w-64 mx-auto" dir="ltr">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} onClick={() => press(d)} className="h-16 rounded-2xl bg-[var(--soft)] text-2xl font-bold">{d}</button>
        ))}
        <button onClick={() => setPin(pin.slice(0, -1))} className="h-16 rounded-2xl text-xl" aria-label="מחיקה">⌫</button>
        <button onClick={() => press("0")} className="h-16 rounded-2xl bg-[var(--soft)] text-2xl font-bold">0</button>
        <button onClick={() => { setKid(null); setPin(""); setError(""); }} className="h-16 rounded-2xl text-sm">החלפה</button>
      </div>
      {error && <p role="alert" className="mt-4 text-[var(--danger)] font-medium">{error}</p>}
    </div>
  );
}
