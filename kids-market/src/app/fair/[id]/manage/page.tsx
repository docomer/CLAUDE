import { notFound } from "next/navigation";
import { requireParent } from "@/lib/auth";
import { ActionForm, Submit } from "@/components/action-form";
import { CopyButton } from "@/components/copy-button";
import { Avatar, Card, PageTitle } from "@/components/ui";
import type { Fair, Profile } from "@/lib/types";
import { removeFamily } from "./actions";

export default async function ManageFairPage({ params }: PageProps<"/fair/[id]/manage">) {
  const { id } = await params;
  const { supabase, profile } = await requireParent();
  const { data: isOrganizer } = await supabase.rpc("is_fair_organizer", { f: id });
  if (!isOrganizer && !profile.is_admin) notFound();

  const [{ data: fair }, { data: members }] = await Promise.all([
    supabase.from("fairs").select("*").eq("id", id).single<Fair>(),
    supabase.from("fair_members").select("family_id, status").eq("fair_id", id),
  ]);
  if (!fair) notFound();
  const familyIds = (members ?? []).map((m) => m.family_id);
  const { data: people } = await supabase.from("profiles").select("*").in("family_id", familyIds).returns<Profile[]>();
  const link = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/join/${fair.invite_code}`;

  return (
    <div className="grid gap-4">
      <PageTitle sub="רק אתם רואים את העמוד הזה">ניהול: {fair.name}</PageTitle>
      <Card>
        <h2 className="font-bold text-lg mb-1">קישור הזמנה ליריד</h2>
        <p className="text-[var(--muted)] mb-3">שלחו לקבוצת ההורים. משפחה חדשה תירשם, ומשפחה קיימת תצטרף בלחיצה.</p>
        <div className="rounded-xl bg-[var(--soft)] p-3 break-all font-mono text-sm mb-3" dir="ltr">{link}</div>
        <CopyButton text={`הוזמנתם ליריד "${fair.name}" 🎪\n${link}`} />
      </Card>
      <Card>
        <h2 className="font-bold text-lg mb-3">משפחות ביריד ({(members ?? []).filter((m) => m.status === "active").length})</h2>
        <div className="grid gap-3">
          {(members ?? []).map((m) => {
            const fam = (people ?? []).filter((p) => p.family_id === m.family_id);
            const parents = fam.filter((p) => p.role === "parent");
            const kids = fam.filter((p) => p.role === "kid");
            return (
              <div key={m.family_id} className={`flex items-center gap-2 ${m.status === "removed" ? "opacity-50" : ""}`}>
                <div className="flex-1">
                  <div className="font-semibold">{parents.map((p) => p.full_name).join(" · ") || "משפחה"}</div>
                  <div className="flex gap-1 mt-1">{kids.map((k) => <Avatar key={k.id} avatar={k.avatar} size="sm" />)}</div>
                </div>
                {m.status === "active" && m.family_id !== profile.family_id && (
                  <ActionForm action={removeFamily} confirm="להסיר את המשפחה מהיריד? המודעות שלה יוסרו.">
                    <input type="hidden" name="fair_id" value={fair.id} />
                    <input type="hidden" name="family_id" value={m.family_id} />
                    <Submit variant="ghost">הסרה</Submit>
                  </ActionForm>
                )}
                {m.status === "removed" && <span className="text-sm">הוסרה</span>}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
