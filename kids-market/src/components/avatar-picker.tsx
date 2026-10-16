import { AVATARS } from "@/lib/content";

export function AvatarPicker({ name = "avatar", defaultValue = "fox" }: { name?: string; defaultValue?: string }) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {Object.entries(AVATARS).map(([key, emoji]) => (
        <label key={key} className="cursor-pointer">
          <input type="radio" name={name} value={key} defaultChecked={key === defaultValue} className="peer sr-only" />
          <span className="flex items-center justify-center text-2xl h-11 rounded-xl bg-[var(--soft)] peer-checked:ring-2 peer-checked:ring-[var(--brand)]">
            {emoji}
          </span>
        </label>
      ))}
    </div>
  );
}
