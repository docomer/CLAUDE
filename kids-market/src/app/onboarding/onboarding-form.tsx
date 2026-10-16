"use client";

import Link from "next/link";
import { ActionForm, Submit } from "@/components/action-form";
import { Field, inputClass } from "@/components/ui";
import { completeSignup } from "./actions";

export function OnboardingForm({ code, askEmail }: { code: string; askEmail: boolean }) {
  return (
    <ActionForm action={completeSignup}>
      <Field label="קוד הזמנה">
        <input name="code" defaultValue={code} required className={`${inputClass} uppercase`} dir="ltr" />
      </Field>
      <Field label="השם המלא שלך" hint="יוצג להורים אחרים ביריד">
        <input name="full_name" required minLength={2} maxLength={60} className={inputClass} />
      </Field>
      {askEmail && (
        <Field label="מייל להתראות (רשות)" hint="נשלח מייל כשמשהו מחכה לאישור שלך">
          <input name="email" type="email" className={inputClass} dir="ltr" />
        </Field>
      )}
      <label className="flex gap-2 items-start mb-5">
        <input type="checkbox" name="accept" required className="mt-1 w-5 h-5" />
        <span>
          קראתי ואני מסכים/ה ל<Link href="/terms" target="_blank" className="underline">תנאי השימוש</Link> ול
          <Link href="/privacy" target="_blank" className="underline">מדיניות הפרטיות</Link>, כולל הצגת השם המלא של ילדיי לחברי הירידים שאצרף אליהם.
        </span>
      </label>
      <Submit className="w-full">יצירת חשבון משפחה</Submit>
    </ActionForm>
  );
}
