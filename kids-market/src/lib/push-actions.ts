"use server";

import { requireProfile } from "@/lib/auth";

export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const { supabase, user } = await requireProfile();
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth,
  });
  return { ok: !error };
}
