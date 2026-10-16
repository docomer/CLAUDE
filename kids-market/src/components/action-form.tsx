"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/lib/types";
import { buttonClass, type Variant } from "@/components/ui";

type Action = (prev: ActionResult, data: FormData) => Promise<ActionResult>;

export function ActionForm({
  action, children, className = "", confirm,
}: { action: Action; children: ReactNode; className?: string; confirm?: string }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}
    >
      {children}
      {state?.error && <p role="alert" className="mt-2 text-[var(--danger)] font-medium">{state.error}</p>}
      {state?.ok && <p role="status" className="mt-2 text-emerald-700 font-medium">{state.ok}</p>}
    </form>
  );
}

export function Submit({ children, variant = "primary", className = "", name, value }: {
  children: ReactNode; variant?: Variant; className?: string; name?: string; value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={buttonClass(variant, className)}>
      {pending ? "רגע…" : children}
    </button>
  );
}
