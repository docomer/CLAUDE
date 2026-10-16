import { PageTitle } from "@/components/ui";
import { KidLogin } from "./kid-login";

export default async function KidLoginPage({ searchParams }: PageProps<"/kid-login">) {
  const { code, kid } = await searchParams;
  return (
    <div className="max-w-sm mx-auto">
      <PageTitle sub="את הקוד המשפחתי מקבלים מההורים">כניסת ילדים 🧒</PageTitle>
      <KidLogin initialCode={typeof code === "string" ? code : ""} initialKid={typeof kid === "string" ? kid : ""} />
    </div>
  );
}
