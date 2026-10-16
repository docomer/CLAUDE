import { requireParent } from "@/lib/auth";
import { ActionForm, Submit } from "@/components/action-form";
import { AvatarPicker } from "@/components/avatar-picker";
import { Avatar, ButtonLink, Card, Field, inputClass, PageTitle } from "@/components/ui";
import { PushToggle } from "@/components/push-toggle";
import type { Profile } from "@/lib/types";
import { addKid, createInvite, deleteAccount, regenerateCode, saveEmail, signOut, unblock, updateKid } from "./actions";

export default async function SettingsPage({ searchParams }: PageProps<"/parent/settings">) {
  const { supabase, user, profile } = await requireParent();
  const { welcome } = await searchParams;
  const [{ data: family }, { data: members }, { data: contact }, { data: blocks }] = await Promise.all([
    supabase.from("families").select("kid_login_code").eq("id", profile.family_id).single(),
    supabase.from("profiles").select("*").eq("family_id", profile.family_id).order("created_at").returns<Profile[]>(),
    supabase.from("parent_contacts").select("email").eq("user_id", user.id).maybeSingle(),
    supabase.from("blocks").select("blocked_family_id, created_at"),
  ]);
  const kids = (members ?? []).filter((m) => m.role === "kid");
  const parents = (members ?? []).filter((m) => m.role === "parent");
  const code = family?.kid_login_code ?? "";

  return (
    <div className="grid gap-5">
      <PageTitle sub={parents.map((p) => p.full_name).join(" · ")}>המשפחה שלי</PageTitle>

      {welcome && (
        <Card className="bg-[var(--soft)]">
          <p className="font-bold text-lg">החשבון נוצר! 🎉</p>
          <p>עכשיו הוסיפו פרופיל לכל ילד. אחר כך פתחו יריד או הצטרפו ליריד קיים.</p>
        </Card>
      )}

      <section>
        <h2 className="text-xl font-bold mb-2">הילדים</h2>
        <div className="grid gap-3">
          {kids.map((k) => (
            <Card key={k.id}>
              <div className="flex items-center gap-3">
                <Avatar avatar={k.avatar} />
                <div className="flex-1">
                  <div className="font-bold">{k.nickname}</div>
                  <div className="text-sm text-[var(--muted)]">{k.full_name}</div>
                </div>
                <ButtonLink href={`/kid-login?code=${code}&kid=${k.id}`} variant="secondary" className="text-sm py-2">כניסה כ{k.nickname}</ButtonLink>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-[var(--brand)] font-semibold">עריכה</summary>
                <ActionForm action={updateKid} className="mt-3">
                  <input type="hidden" name="kid_id" value={k.id} />
                  <Field label="כינוי"><input name="nickname" defaultValue={k.nickname} required className={inputClass} /></Field>
                  <Field label="שם מלא"><input name="full_name" defaultValue={k.full_name} required className={inputClass} /></Field>
                  <Field label="אווטאר"><AvatarPicker defaultValue={k.avatar} /></Field>
                  <Field label="קוד סודי חדש (רשות)"><input name="pin" inputMode="numeric" pattern="\d{4}" maxLength={4} className={inputClass} dir="ltr" /></Field>
                  <Submit>שמירה</Submit>
                </ActionForm>
              </details>
            </Card>
          ))}
          <Card>
            <details open={kids.length === 0}>
              <summary className="cursor-pointer font-bold">➕ הוספת ילד/ה</summary>
              <ActionForm action={addKid} className="mt-3">
                <Field label="כינוי" hint="למשל: נועה הסוחרת"><input name="nickname" required minLength={2} maxLength={30} className={inputClass} /></Field>
                <Field label="שם מלא"><input name="full_name" required minLength={2} maxLength={60} className={inputClass} /></Field>
                <Field label="אווטאר"><AvatarPicker /></Field>
                <Field label="קוד סודי (4 ספרות)" hint="הילד/ה יזינו אותו בכל כניסה">
                  <input name="pin" required inputMode="numeric" pattern="\d{4}" maxLength={4} className={inputClass} dir="ltr" />
                </Field>
                <label className="flex gap-2 items-start mb-4">
                  <input type="checkbox" name="consent" required className="mt-1 w-5 h-5" />
                  <span>אני מאשר/ת שהשם המלא של הילד/ה יוצג לחברי הירידים שהמשפחה מצטרפת אליהם.</span>
                </label>
                <Submit>יצירת פרופיל</Submit>
              </ActionForm>
            </details>
          </Card>
        </div>
      </section>

      <Card>
        <h2 className="text-xl font-bold mb-1">קוד כניסה לילדים</h2>
        <p className="text-[var(--muted)] mb-3">הילדים נכנסים עם הקוד הזה + הקוד הסודי שלהם, מכל טלפון.</p>
        <div className="text-3xl font-mono font-bold tracking-widest text-center py-3 rounded-xl bg-[var(--soft)]" dir="ltr">{code}</div>
        <ActionForm action={regenerateCode} className="mt-3" confirm="ליצור קוד חדש? הקוד הנוכחי יפסיק לעבוד.">
          <Submit variant="secondary">יצירת קוד חדש</Submit>
        </ActionForm>
      </Card>

      <Card>
        <h2 className="text-xl font-bold mb-1">הזמנות</h2>
        <p className="text-[var(--muted)] mb-3">כדי להזמין לכיתה או לחוג — פתחו יריד ושלחו את הקישור שלו.</p>
        <div className="grid gap-3">
          <ActionForm action={createInvite}>
            <input type="hidden" name="kind" value="coparent" />
            <Submit variant="secondary" className="w-full">קישור להורה נוסף במשפחה</Submit>
          </ActionForm>
          <ActionForm action={createInvite}>
            <input type="hidden" name="kind" value="family" />
            <Submit variant="secondary" className="w-full">קישור למשפחה חדשה</Submit>
          </ActionForm>
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-bold mb-3">התראות</h2>
        <PushToggle />
        <ActionForm action={saveEmail} className="mt-4">
          <Field label="מייל להתראות">
            <input name="email" type="email" defaultValue={contact?.email ?? user.email ?? ""} className={inputClass} dir="ltr" />
          </Field>
          <Submit variant="secondary">שמירה</Submit>
        </ActionForm>
      </Card>

      {!!blocks?.length && (
        <Card>
          <h2 className="text-xl font-bold mb-3">משפחות חסומות</h2>
          {blocks.map((b, i) => (
            <ActionForm key={b.blocked_family_id} action={unblock} className="flex items-center justify-between mb-2">
              <input type="hidden" name="family_id" value={b.blocked_family_id} />
              <span>משפחה #{i + 1} (נחסמה {new Date(b.created_at).toLocaleDateString("he-IL")})</span>
              <Submit variant="ghost">ביטול חסימה</Submit>
            </ActionForm>
          ))}
        </Card>
      )}

      <Card>
        <form action={signOut}><button className="font-semibold text-[var(--brand)]">יציאה מהחשבון</button></form>
        <ActionForm action={deleteAccount} className="mt-4" confirm="למחוק את חשבון המשפחה וכל המידע שלה? אי אפשר לבטל.">
          <Submit variant="danger">מחיקת חשבון המשפחה</Submit>
        </ActionForm>
      </Card>
    </div>
  );
}
