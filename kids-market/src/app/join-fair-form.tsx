"use client";

import { ActionForm, Submit } from "@/components/action-form";
import { inputClass } from "@/components/ui";
import { joinFair } from "./actions";

export function JoinFairForm({ code = "" }: { code?: string }) {
  return (
    <ActionForm action={joinFair} className="flex gap-2 items-start flex-wrap">
      <input name="code" defaultValue={code} placeholder="קוד יריד" required className={`${inputClass} flex-1 min-w-40 uppercase`} dir="ltr" />
      <Submit>הצטרפות</Submit>
    </ActionForm>
  );
}
