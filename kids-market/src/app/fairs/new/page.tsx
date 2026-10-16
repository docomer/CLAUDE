import { requireParent } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import { NewFairForm } from "./new-fair-form";

export default async function NewFairPage() {
  await requireParent();
  return (
    <div className="max-w-md mx-auto">
      <PageTitle sub="אחרי הפתיחה תקבלו קישור לשלוח להורים בקבוצה">פתיחת יריד 🎪</PageTitle>
      <NewFairForm />
    </div>
  );
}
