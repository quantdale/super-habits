import { getDatabase } from "@/core/db/client";

type GuestProfile = {
  id: string;
  createdAt: string;
};

export async function ensureGuestProfile(): Promise<GuestProfile> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_meta WHERE key = ?",
    ["guest_profile"],
  );
  if (existing?.value) return JSON.parse(existing.value) as GuestProfile;

  const profile: GuestProfile = {
    id: `guest_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  await db.runAsync("INSERT INTO app_meta (key, value) VALUES (?, ?)", [
    "guest_profile",
    JSON.stringify(profile),
  ]);
  return profile;
}
