import Link from "next/link";
import { getMe } from "@/lib/auth";
import { ButtonLink, Card, PageTitle } from "@/components/ui";
import { JoinFairForm } from "../../join-fair-form";

export default async function JoinPage({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;
  const { supabase, user, profile } = await getMe();
  const { data } = await supabase.rpc("check_invite", { p_code: code });
  const invite = (data as { kind: string; label: string }[] | null)?.[0];

  if (!invite) {
    return <Card><p className="font-semibold">ההזמנה לא תקינה או שפג תוקפה 😕</p><p className="text-[var(--muted)]">בקשו קישור חדש ממי שהזמין אתכם.</p></Card>;
  }

  const title = invite.kind === "fair" ? `הוזמנתם ליריד "${invite.label}" 🎪` : invite.kind === "coparent" ? "הוזמנת להצטרף כהורה נוסף 👨‍👩‍👧" : "הוזמנתם להצטרף להיריד 🎪";

  if (profile) {
    if (profile.role === "kid") return <Card>בקשו מההורים לפתוח את הקישור הזה 🙂</Card>;
    if (invite.kind !== "fair") return <Card>החשבון שלכם כבר רשום. <Link className="underline" href="/">לדף הבית</Link></Card>;
    return (
      <div>
        <PageTitle>{title}</PageTitle>
        <Card><p className="mb-3">לצרף את המשפחה ליריד?</p><JoinFairForm code={code} /></Card>
      </div>
    );
  }

  const onboarding = `/onboarding?code=${encodeURIComponent(code)}`;
  return (
    <div>
      <PageTitle sub="מרקטפלייס לילדים, בפיקוח הורים מלא">{title}</PageTitle>
      <Card>
        <ul className="list-disc pr-5 mb-4 space-y-1">
          <li>ילדים מעלים צעצועים, ספרים ומשחקים למכירה (עד 100 ₪).</li>
          <li>כל מודעה וכל קנייה באישור הורה.</li>
          <li>ההורים רואים את כל השיחות. התשלום במסירה, מחוץ לאפליקציה.</li>
        </ul>
        <ButtonLink href={user ? onboarding : `/login?next=${encodeURIComponent(onboarding)}`} className="w-full">
          הרשמה כהורה
        </ButtonLink>
      </Card>
    </div>
  );
}
