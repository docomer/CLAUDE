import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const { user, profile } = await getMe();
  if (!user) redirect("/login?next=/onboarding");
  if (profile) redirect("/");
  const { code } = await searchParams;
  return (
    <div className="max-w-md mx-auto">
      <PageTitle sub="עוד רגע מתחילים">ברוכים הבאים! 👋</PageTitle>
      <OnboardingForm code={typeof code === "string" ? code : ""} askEmail={!user.email} />
    </div>
  );
}
