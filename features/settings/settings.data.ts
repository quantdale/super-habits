import { getDatabase } from "@/core/db/client";
import {
  sanitizeThemePreference,
  type ThemePreference,
} from "@/core/theme";

const THEME_PREFERENCE_KEY = "theme_preference";

export async function getThemePreference(): Promise<ThemePreference> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_meta WHERE key = ?`,
    [THEME_PREFERENCE_KEY],
  );

  return sanitizeThemePreference(row?.value);
}

export async function saveThemePreference(preference: ThemePreference): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`, [
    THEME_PREFERENCE_KEY,
    preference,
  ]);
}
