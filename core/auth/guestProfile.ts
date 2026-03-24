import { getDatabase } from "@/core/db/client";
import { createId } from "@/lib/id";
import { nowIso } from "@/lib/time";

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
    id: createId("guest"),
    createdAt: nowIso(),
  };
  await db.runAsync("INSERT INTO app_meta (key, value) VALUES (?, ?)", [
    "guest_profile",
    JSON.stringify(profile),
  ]);
  return profile;
}
