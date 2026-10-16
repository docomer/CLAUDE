import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const PHOTO_BUCKET = "listing-photos";

// מחזיר כתובות חתומות לתמונות. לקרוא רק עם נתיבים של מודעות שהמשתמש כבר הורשה לראות (דרך RLS).
export async function signPhotos(paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths)];
  if (!unique.length) return {};
  const { data } = await createAdminClient().storage.from(PHOTO_BUCKET).createSignedUrls(unique, 60 * 60);
  const map: Record<string, string> = {};
  for (const item of data ?? []) if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
  return map;
}
