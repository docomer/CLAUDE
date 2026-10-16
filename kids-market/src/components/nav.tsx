import Link from "next/link";
import { getMe } from "@/lib/auth";
import { APP_NAME } from "@/lib/content";
import { Avatar } from "@/components/ui";

const KID_LINKS = [
  { href: "/", label: "היריד", icon: "🎪" },
  { href: "/sell", label: "למכור", icon: "➕" },
  { href: "/chats", label: "צ'אטים", icon: "💬" },
  { href: "/me", label: "העסק שלי", icon: "💰" },
];

const PARENT_LINKS = [
  { href: "/parent", label: "אישורים", icon: "✅" },
  { href: "/", label: "ירידים", icon: "🎪" },
  { href: "/chats", label: "צ'אטים", icon: "💬" },
  { href: "/parent/settings", label: "משפחה", icon: "👨‍👩‍👧" },
];

export async function Nav() {
  const { supabase, profile } = await getMe();
  let unread = 0;
  if (profile) {
    const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
    unread = count ?? 0;
  }
  const links = profile?.role === "kid" ? KID_LINKS : profile ? PARENT_LINKS : [];

  return (
    <>
      <header className="sticky top-0 z-10 bg-[var(--bg)]/90 backdrop-blur border-b border-[var(--line)]">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="text-xl font-extrabold text-[var(--brand)]">🎪 {APP_NAME}</Link>
          {profile && (
            <div className="flex items-center gap-3">
              {profile.is_admin && <Link href="/admin" className="text-sm font-semibold">ניהול</Link>}
              <Link href="/notifications" className="relative text-2xl" aria-label="התראות">
                🔔
                {unread > 0 && (
                  <span className="absolute -top-1 -left-2 min-w-5 h-5 px-1 rounded-full bg-[var(--danger)] text-white text-xs flex items-center justify-center">
                    {unread}
                  </span>
                )}
              </Link>
              <Link href={profile.role === "kid" ? "/me" : "/parent/settings"} aria-label="הפרופיל שלי">
                <Avatar avatar={profile.avatar} size="sm" />
              </Link>
            </div>
          )}
        </div>
      </header>
      {links.length > 0 && (
        <nav className="fixed bottom-0 inset-x-0 z-10 bg-[var(--card)] border-t border-[var(--line)] pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-2xl mx-auto grid grid-cols-4">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="flex flex-col items-center py-2 text-sm">
                <span className="text-2xl">{l.icon}</span>
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </>
  );
}
