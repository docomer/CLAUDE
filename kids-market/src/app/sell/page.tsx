import { requireKid } from "@/lib/auth";
import { Empty, PageTitle } from "@/components/ui";
import type { Fair } from "@/lib/types";
import { SellForm } from "./sell-form";

export default async function SellPage({ searchParams }: PageProps<"/sell">) {
  const { supabase } = await requireKid();
  const { fair } = await searchParams;
  const nowIso = new Date().toISOString();
  const { data: fairs } = await supabase.from("fairs").select("*").lte("starts_at", nowIso).gte("ends_at", nowIso).returns<Fair[]>();
  if (!fairs?.length) return <Empty emoji="🎪">אין כרגע יריד פתוח. בקשו מההורים להצטרף ליריד.</Empty>;
  return (
    <div>
      <PageTitle sub="אחרי שתפרסמו, ההורים יאשרו את המודעה">מה מוכרים היום? 🧸</PageTitle>
      <SellForm fairs={fairs.map((f) => ({ id: f.id, name: f.name }))} defaultFair={typeof fair === "string" ? fair : fairs[0].id} />
    </div>
  );
}
