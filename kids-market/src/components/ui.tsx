import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { AVATARS } from "@/lib/content";

export function Avatar({ avatar, size = "md" }: { avatar: string; size?: "sm" | "md" | "lg" }) {
  const cls = { sm: "text-xl w-8 h-8", md: "text-3xl w-12 h-12", lg: "text-5xl w-20 h-20" }[size];
  return (
    <span className={`${cls} inline-flex items-center justify-center rounded-full bg-[var(--soft)] shrink-0`} aria-hidden>
      {AVATARS[avatar] ?? "🙂"}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-[var(--card)] border border-[var(--line)] p-4 shadow-sm ${className}`}>{children}</div>;
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h1 className="text-2xl font-bold">{children}</h1>
      {sub && <p className="text-[var(--muted)] mt-1">{sub}</p>}
    </div>
  );
}

const variants = {
  primary: "bg-[var(--brand)] text-white hover:brightness-95",
  secondary: "bg-[var(--soft)] text-[var(--fg)] hover:brightness-95",
  danger: "bg-[var(--danger)] text-white hover:brightness-95",
  ghost: "text-[var(--brand)] hover:bg-[var(--soft)]",
};
export type Variant = keyof typeof variants;
export const buttonClass = (v: Variant = "primary", extra = "") =>
  `inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold transition disabled:opacity-50 ${variants[v]} ${extra}`;

export function ButtonLink({ variant = "primary", className = "", ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link {...props} className={buttonClass(variant, className)} />;
}

export function Badge({ children, tone = "soft" }: { children: ReactNode; tone?: "soft" | "brand" | "warn" | "ok" | "danger" }) {
  const t = {
    soft: "bg-[var(--soft)] text-[var(--fg)]",
    brand: "bg-[var(--brand)] text-white",
    warn: "bg-amber-100 text-amber-900",
    ok: "bg-emerald-100 text-emerald-900",
    danger: "bg-red-100 text-red-900",
  }[tone];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-medium ${t}`}>{children}</span>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block mb-4">
      <span className="block font-semibold mb-1">{label}</span>
      {children}
      {hint && <span className="block text-sm text-[var(--muted)] mt-1">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[var(--brand)]";

export function Empty({ emoji, children }: { emoji: string; children: ReactNode }) {
  return (
    <div className="text-center py-10 text-[var(--muted)]">
      <div className="text-5xl mb-2">{emoji}</div>
      {children}
    </div>
  );
}

export function shekel(n: number) {
  return `${n} ₪`;
}
