import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { markAllRead } from "@/lib/actions";
import { Card, Empty, PageTitle } from "@/components/ui";
import type { Notification } from "@/lib/types";

export default async function NotificationsPage() {
  const { supabase } = await requireProfile();
  const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50).returns<Notification[]>();
  const unread = (data ?? []).some((n) => !n.read_at);
  return (
    <div>
      <div className="flex items-center justify-between">
        <PageTitle>התראות 🔔</PageTitle>
        {unread && <form action={markAllRead}><button className="text-[var(--brand)] font-semibold">סימון הכל כנקרא</button></form>}
      </div>
      {!data?.length && <Empty emoji="🔕">אין התראות</Empty>}
      <div className="grid gap-2">
        {(data ?? []).map((n) => (
          <Link key={n.id} href={n.link}>
            <Card className={`p-3 ${n.read_at ? "opacity-60" : "border-[var(--brand)]"}`}>
              <div className="font-bold">{n.title}</div>
              {n.body && <div className="text-sm">{n.body}</div>}
              <div className="text-xs text-[var(--muted)] mt-1">{new Date(n.created_at).toLocaleString("he-IL")}</div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
