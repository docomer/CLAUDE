import type { Fair } from "@/lib/types";

export type FairState = "upcoming" | "open" | "ended";

export function fairState(fair: Pick<Fair, "starts_at" | "ends_at">, now = Date.now()): FairState {
  if (now < new Date(fair.starts_at).getTime()) return "upcoming";
  if (now > new Date(fair.ends_at).getTime()) return "ended";
  return "open";
}

export function fairStatusText(fair: Pick<Fair, "starts_at" | "ends_at">) {
  const date = (iso: string) => new Date(iso).toLocaleDateString("he-IL");
  return {
    upcoming: `נפתח ב-${date(fair.starts_at)}`,
    open: `פתוח עד ${date(fair.ends_at)}`,
    ended: "היריד הסתיים",
  }[fairState(fair)];
}
