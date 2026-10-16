"use client";

import { useState } from "react";
import { ActionForm, Submit } from "@/components/action-form";
import { Card, Field, inputClass } from "@/components/ui";
import { CATEGORIES, CONDITIONS, FORBIDDEN_ITEMS, MAX_PHOTOS, MAX_PRICE } from "@/lib/content";
import { createListing } from "./actions";

type Photo = { path: string; preview: string };

export function SellForm({ fairs, defaultFair }: { fairs: { id: string; name: string }[]; defaultFair: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function onFiles(files: FileList | null) {
    if (!files) return;
    setUploadError("");
    setUploading(true);
    for (const file of Array.from(files).slice(0, MAX_PHOTOS - photos.length)) {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) { setUploadError(json.error); continue; }
      setPhotos((p) => [...p, json as Photo].slice(0, MAX_PHOTOS));
    }
    setUploading(false);
  }

  return (
    <ActionForm action={createListing}>
      {photos.map((p) => <input key={p.path} type="hidden" name="photos" value={p.path} />)}

      {fairs.length > 1 ? (
        <Field label="באיזה יריד?">
          <select name="fair_id" defaultValue={defaultFair} className={inputClass}>
            {fairs.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </Field>
      ) : <input type="hidden" name="fair_id" value={fairs[0].id} />}

      <Field label={`תמונות (עד ${MAX_PHOTOS})`} hint="צלמו רק את הצעצוע — בלי פנים של אנשים 📸">
        <div className="grid grid-cols-4 gap-2">
          {photos.map((p, i) => (
            <div key={p.path} className="relative aspect-square rounded-xl overflow-hidden bg-[var(--soft)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/60 text-white text-sm" aria-label="הסרה">✕</button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label className="aspect-square rounded-xl border-2 border-dashed border-[var(--line)] flex items-center justify-center text-3xl cursor-pointer">
              {uploading ? "⏳" : "📷"}
              <input type="file" accept="image/*" multiple className="sr-only" disabled={uploading} onChange={(e) => onFiles(e.target.files)} />
            </label>
          )}
        </div>
        {uploadError && <span className="block text-[var(--danger)] mt-1">{uploadError}</span>}
      </Field>

      <Field label="מה זה?"><input name="title" required minLength={2} maxLength={60} className={inputClass} placeholder="למשל: חללית לגו" /></Field>

      <Card className="mb-4 bg-[var(--soft)] border-[var(--brand)]">
        <Field label="⭐ למה זה הכי מגניב?" hint="שכנעו את הקונים!">
          <textarea name="coolest" required minLength={2} maxLength={200} rows={2} className={inputClass} placeholder="יש לה אורות שנדלקים ותא סודי!" />
        </Field>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Field label="קטגוריה">
          <select name="category" required className={inputClass}>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="מצב">
          <select name="condition" required className={inputClass}>
            {Object.entries(CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
      </div>

      <Field label="מחיר (₪)" hint={`עד ${MAX_PRICE} ₪`}>
        <input name="price" type="number" required min={1} max={MAX_PRICE} inputMode="numeric" className={inputClass} />
      </Field>
      <Field label="תיאור (רשות)">
        <textarea name="description" maxLength={500} rows={3} className={inputClass} placeholder="מה יש בקופסה? הכל עובד?" />
      </Field>

      <p className="text-sm text-[var(--muted)] mb-4">🚫 אסור למכור: {FORBIDDEN_ITEMS.join(" · ")}</p>
      <Submit className="w-full text-lg">שליחה לאישור ההורים 🚀</Submit>
    </ActionForm>
  );
}
