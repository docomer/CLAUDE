"use client";

import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui";
import { savePushSubscription } from "@/lib/push-actions";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function PushToggle() {
  const [state, setState] = useState<"unsupported" | "off" | "on" | "denied" | "loading">("loading");

  useEffect(() => {
    if (!VAPID || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") return setState("denied");
    navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      setState((await reg.pushManager.getSubscription()) ? "on" : "off");
    });
  }, []);

  async function enable() {
    setState("loading");
    const reg = await navigator.serviceWorker.ready;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return setState("denied");
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID!) });
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    await savePushSubscription(json);
    setState("on");
  }

  if (state === "unsupported") {
    return <p className="text-sm text-[var(--muted)]">התראות Push לא זמינות כאן. באייפון: הוסיפו את האפליקציה למסך הבית ופתחו אותה משם.</p>;
  }
  if (state === "denied") return <p className="text-sm text-[var(--muted)]">ההתראות חסומות בהגדרות הדפדפן.</p>;
  if (state === "on") return <p className="font-medium text-emerald-700">🔔 התראות Push פעילות במכשיר הזה</p>;
  return (
    <button onClick={enable} disabled={state === "loading"} className={buttonClass("secondary")}>
      🔔 הפעלת התראות במכשיר הזה
    </button>
  );
}
