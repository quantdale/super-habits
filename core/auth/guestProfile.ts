import { getDatabase } from "@/core/db/client";

type GuestProfile = {
  id: string;
  createdAt: string;
};

export async function ensureGuestProfile(): Promise<GuestProfile> {
  const db = getDatabase();
  const existing = db.getFirstSync<{ value: string }>("SELECT value FROM app_meta WHERE key = ?", ["guest_profile"]);
  if (existing?.value) return JSON.parse(existing.value) as GuestProfile;

  const profile: GuestProfile = {
    id: `guest_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  db.runSync("INSERT INTO app_meta (key, value) VALUES (?, ?)", ["guest_profile", JSON.stringify(profile)]);
  return profile;
}
