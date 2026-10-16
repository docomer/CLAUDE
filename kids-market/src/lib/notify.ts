import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Notification } from "@/lib/types";

const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "";

// שולח Push ומייל עבור התראות שנוצרו במסד הנתונים ועוד לא נשלחו.
// נקרא עם after() בסוף כל פעולה, כך שהמשתמש לא מחכה לו.
export async function dispatchPending() {
  const admin = createAdminClient();
  const { data: claimed } = await admin
    .from("notifications")
    .update({ pushed_at: new Date().toISOString() })
    .is("pushed_at", null)
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .select("*")
    .returns<Notification[]>();
  if (!claimed?.length) return;

  const pushReady = !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  if (pushReady) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
  }

  await Promise.allSettled(
    claimed.map(async (n) => {
      if (pushReady) await sendPush(admin, n);
      await sendEmail(admin, n);
    }),
  );
}

async function sendPush(admin: ReturnType<typeof createAdminClient>, n: Notification) {
  const { data: subs } = await admin.from("push_subscriptions").select("*").eq("user_id", n.user_id);
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: n.title, body: n.body, url: n.link }),
      );
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
    }
  }
}

async function sendEmail(admin: ReturnType<typeof createAdminClient>, n: Notification) {
  if (!process.env.RESEND_API_KEY) return;
  const { data: profile } = await admin.from("profiles").select("role").eq("id", n.user_id).single();
  if (profile?.role !== "parent") return; // מיילים רק להורים
  const { data: contact } = await admin.from("parent_contacts").select("email").eq("user_id", n.user_id).maybeSingle();
  let to = contact?.email as string | undefined;
  if (!to) {
    const { data } = await admin.auth.admin.getUserById(n.user_id);
    to = data.user?.email ?? undefined;
  }
  if (!to) return;
  const link = site() + n.link;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "noreply@example.com",
      to,
      subject: n.title,
      html: `<div dir="rtl" style="font-family:sans-serif"><h2>${escapeHtml(n.title)}</h2><p>${escapeHtml(n.body)}</p><p><a href="${escapeHtml(link)}">פתיחה באפליקציה</a></p></div>`,
    }),
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
