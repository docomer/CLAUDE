import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { ActionForm, Submit } from "@/components/action-form";
import { Badge, Card, Empty, PageTitle } from "@/components/ui";
import { resolveReport } from "./actions";

type Report = { id: string; target_type: string; target_id: string; reason: string; status: string; created_at: string; fair_id: string | null };

export default async function AdminPage() {
  const { supabase, profile } = await requireProfile();
  if (profile.role !== "parent") notFound();
  // RLS מחזיר: למנהל — הכל; למארגן — דיווחים מהירידים שלו.
  const { data: reports } = await supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(100).returns<Report[]>();
  const visible = reports ?? [];

  return (
    <div>
      <PageTitle sub={profile.is_admin ? "מנהל מערכת" : "מארגני ירידים"}>דיווחים 🚩</PageTitle>
      {!visible.length && <Empty emoji="🕊️">אין דיווחים</Empty>}
      <div className="grid gap-2">
        {visible.map((r) => (
          <Card key={r.id} className={r.status === "resolved" ? "opacity-60" : ""}>
            <div className="flex justify-between items-center mb-1">
              <Badge tone={r.status === "open" ? "danger" : "soft"}>{r.status === "open" ? "פתוח" : "טופל"}</Badge>
              <span className="text-xs text-[var(--muted)]">{new Date(r.created_at).toLocaleString("he-IL")}</span>
            </div>
            <p className="mb-2">{r.reason}</p>
            <Link className="underline text-[var(--brand)]" href={r.target_type === "listing" ? `/listing/${r.target_id}` : `/chat/${r.target_id}`}>
              {r.target_type === "listing" ? "צפייה במודעה" : "צפייה בשיחה"}
            </Link>
            {r.status === "open" && (
              <ActionForm action={resolveReport} className="mt-2">
                <input type="hidden" name="report_id" value={r.id} />
                <Submit variant="secondary">סימון כטופל</Submit>
              </ActionForm>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
