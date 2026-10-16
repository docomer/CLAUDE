"use client";

import { ActionForm, Submit } from "@/components/action-form";
import { Field, inputClass } from "@/components/ui";
import { createFair } from "./actions";

const toLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export function NewFairForm() {
  const now = new Date();
  const week = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  return (
    <ActionForm action={createFair}>
      <input type="hidden" name="tz" value={String(now.getTimezoneOffset())} />
      <Field label="שם היריד" hint='למשל: "יריד כיתה ה׳2" או "יריד המשפחה"'>
        <input name="name" required minLength={2} maxLength={60} className={inputClass} />
      </Field>
      <Field label="תיאור (רשות)">
        <textarea name="description" maxLength={500} rows={3} className={inputClass} />
      </Field>
      <Field label="פתיחה"><input name="starts_at" type="datetime-local" required defaultValue={toLocal(now)} className={inputClass} /></Field>
      <Field label="סגירה"><input name="ends_at" type="datetime-local" required defaultValue={toLocal(week)} className={inputClass} /></Field>
      <Submit className="w-full">פתיחת היריד</Submit>
    </ActionForm>
  );
}
