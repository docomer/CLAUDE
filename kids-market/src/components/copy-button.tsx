"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui";

export function CopyButton({ text, label = "העתקה / שיתוף" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  async function go() {
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch { /* בוטל — נעתיק */ }
    }
    await navigator.clipboard.writeText(text);
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  }
  return <button type="button" onClick={go} className={buttonClass("primary", "w-full")}>{done ? "הועתק ✓" : label}</button>;
}
