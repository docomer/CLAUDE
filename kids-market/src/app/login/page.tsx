import { PageTitle } from "@/components/ui";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const method = process.env.NEXT_PUBLIC_AUTH_METHOD === "email" ? "email" : "phone";
  return (
    <div className="max-w-sm mx-auto">
      <PageTitle sub="נשלח אליכם קוד חד-פעמי">כניסת הורים</PageTitle>
      <LoginForm method={method} next={typeof next === "string" && next.startsWith("/") ? next : "/"} />
    </div>
  );
}
