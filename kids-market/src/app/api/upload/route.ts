import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { getMe } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PHOTO_BUCKET } from "@/lib/photos";

const MAX_BYTES = 15 * 1024 * 1024;

// מקבל תמונה, מסובב לפי EXIF, מקטין, ושומר כ-JPEG נקי — בלי GPS ובלי שום metadata.
export async function POST(request: NextRequest) {
  const { profile } = await getMe();
  if (profile?.role !== "kid") return NextResponse.json({ error: "רק ילדים מעלים מודעות" }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) return NextResponse.json({ error: "זה לא קובץ תמונה" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "התמונה גדולה מדי" }, { status: 400 });

  let clean: Buffer;
  try {
    clean = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: "לא הצלחנו לקרוא את התמונה. נסו תמונה אחרת." }, { status: 400 });
  }

  const path = `${profile.family_id}/${randomUUID()}.jpg`;
  const { error } = await createAdminClient().storage.from(PHOTO_BUCKET).upload(path, clean, { contentType: "image/jpeg" });
  if (error) return NextResponse.json({ error: "ההעלאה נכשלה" }, { status: 500 });
  return NextResponse.json({ path, preview: `data:image/jpeg;base64,${(await sharp(clean).resize(300).jpeg({ quality: 60 }).toBuffer()).toString("base64")}` });
}
