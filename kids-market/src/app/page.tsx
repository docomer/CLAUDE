import { redirect } from "next/navigation";
import Link from "next/link";
import { getMe } from "@/lib/auth";
import { APP_NAME, APP_TAGLINE } from "@/lib/content";
import { ButtonLink, Card, Empty, PageTitle } from "@/components/ui";
import type { Fair } from "@/lib/types";
import { JoinFairForm } from "./join-fair-form";
import { fairState, fairStatusText } from "@/lib/fair";

export default async function Home() {
  const { supabase, user, profile } = await getMe();

  if (!user) {
    return (
      <div className="text-center pt-8">
        <div className="text-7xl mb-4">🎪</div>
        <h1 className="text-4xl font-extrabold mb-2">{APP_NAME}</h1>
        <p className="text-lg text-[var(--muted)] mb-10">{APP_TAGLINE}</p>
        <div className="flex flex-col gap-3 max-w-xs mx-auto">
          <ButtonLink href="/kid-login" className="text-xl py-4">🧒 אני ילד/ה</ButtonLink>
          <ButtonLink href="/login" variant="secondary" className="text-xl py-4">👩 אני הורה</ButtonLink>
        </div>
        <p className="text-sm text-[var(--muted)] mt-10">ההצטרפות בהזמנה בלבד. כל מכירה באישור הורים.</p>
      </div>
    );
  }
  if (!profile) redirect("/onboarding");

  const { data: fairs } = await supabase.from("fairs").select("*").order("starts_at", { ascending: false }).returns<Fair[]>();
  const open = (fairs ?? []).filter((f) => fairState(f) !== "ended");

  if (profile.role === "kid" && open.length === 1) redirect(`/fair/${open[0].id}`);

  return (
    <div>
      <PageTitle sub={profile.role === "kid" ? "באיזה יריד נסתובב היום?" : "הירידים של המשפחה"}>
        שלום {profile.nickname} 👋
      </PageTitle>
      {!fairs?.length && <Empty emoji="🎪">עדיין אין ירידים. {profile.role === "kid" ? "בקשו מההורים להצטרף ליריד." : ""}</Empty>}
      <div className="grid gap-3">
        {(fairs ?? []).map((f) => {
          const ended = fairState(f) === "ended";
          return (
            <Link key={f.id} href={`/fair/${f.id}`}>
              <Card className={ended ? "opacity-60" : ""}>
                <div className="font-bold text-lg">{f.name}</div>
                <div className="text-sm text-[var(--muted)]">{fairStatusText(f)}</div>
              </Card>
            </Link>
          );
        })}
      </div>
      {profile.role === "parent" && (
        <div className="mt-6 grid gap-4">
          <ButtonLink href="/fairs/new">➕ פתיחת יריד חדש</ButtonLink>
          <Card>
            <div className="font-semibold mb-2">קיבלתם קוד יריד?</div>
            <JoinFairForm />
          </Card>
        </div>
      )}
    </div>
  );
}
