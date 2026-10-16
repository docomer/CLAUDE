"use client";

import { ActionForm, Submit } from "@/components/action-form";
import { inputClass } from "@/components/ui";
import { reportContent } from "@/lib/actions";

export function ReportForm({ type, target, label = "🚩 דיווח" }: { type: "listing" | "conversation"; target: string; label?: string }) {
  return (
    <details>
      <summary className="cursor-pointer text-sm text-[var(--muted)]">{label}</summary>
      <ActionForm action={reportContent} className="mt-2">
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="target" value={target} />
        <textarea name="reason" required minLength={2} maxLength={500} rows={2} className={inputClass} placeholder="מה לא בסדר?" />
        <Submit variant="secondary" className="mt-2">שליחת דיווח</Submit>
      </ActionForm>
    </details>
  );
}
