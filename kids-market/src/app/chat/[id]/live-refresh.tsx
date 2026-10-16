"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// מרענן את המסך כשמגיעה הודעה חדשה או כשהעסקה משתנה.
export function LiveRefresh({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`conv-${conversationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "deals", filter: `conversation_id=eq.${conversationId}` }, () => router.refresh())
      .subscribe();
    window.scrollTo({ top: document.body.scrollHeight });
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, router]);
  return null;
}
