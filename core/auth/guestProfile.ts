import { appMetaKeys, getAppMetaText, setAppMetaJson } from "@/core/db/appMeta";
import { getDatabase } from "@/core/db/client";
import { createId } from "@/lib/id";
import { nowIso } from "@/lib/time";

type GuestProfile = {
  id: string;
  createdAt: string;
};

export async function ensureGuestProfile(): Promise<GuestProfile> {
  const db = await getDatabase();
  const existing = await getAppMetaText(db, appMetaKeys.guestProfile);
  if (existing) return JSON.parse(existing) as GuestProfile;

  const profile: GuestProfile = {
    id: createId("guest"),
    createdAt: nowIso(),
  };
  await setAppMetaJson(db, appMetaKeys.guestProfile, profile);
  return profile;
}
