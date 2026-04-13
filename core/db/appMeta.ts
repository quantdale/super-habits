import type * as SQLite from "expo-sqlite";

export type AppMetaOwner = "system" | "auth" | "calories" | "pomodoro";

type AppMetaStorage = "text" | "json";

type AppMetaKeyDefinition<TStorage extends AppMetaStorage> = {
  key: string;
  owner: AppMetaOwner;
  storage: TStorage;
};

type AppMetaTextKey = AppMetaKeyDefinition<"text">;
type AppMetaJsonKey = AppMetaKeyDefinition<"json">;

function defineTextKey(key: string, owner: AppMetaOwner): AppMetaTextKey {
  return { key, owner, storage: "text" };
}

function defineJsonKey(key: string, owner: AppMetaOwner): AppMetaJsonKey {
  return { key, owner, storage: "json" };
}

// Central registry for all known app_meta keys in active runtime use.
export const appMetaKeys = {
  dbSchemaVersion: defineTextKey("db_schema_version", "system"),
  dateKeyFormat: defineTextKey("date_key_format", "system"),
  dateKeyCutover: defineTextKey("date_key_cutover", "system"),
  guestProfile: defineJsonKey("guest_profile", "auth"),
  calorieGoal: defineJsonKey("calorie_goal", "calories"),
  pomodoroSettings: defineJsonKey("pomodoro_settings", "pomodoro"),
} as const;

export async function getAppMetaText(
  db: SQLite.SQLiteDatabase,
  metaKey: AppMetaTextKey | AppMetaJsonKey,
): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_meta WHERE key = ?",
    [metaKey.key],
  );
  return row?.value ?? null;
}

export async function setAppMetaText(
  db: SQLite.SQLiteDatabase,
  metaKey: AppMetaTextKey | AppMetaJsonKey,
  value: string,
): Promise<void> {
  await db.runAsync("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)", [
    metaKey.key,
    value,
  ]);
}

export async function getAppMetaJson<T>(
  db: SQLite.SQLiteDatabase,
  metaKey: AppMetaJsonKey,
): Promise<T | null> {
  const value = await getAppMetaText(db, metaKey);
  if (value === null) return null;
  return JSON.parse(value) as T;
}

export async function getAppMetaJsonOrDefault<T>(
  db: SQLite.SQLiteDatabase,
  metaKey: AppMetaJsonKey,
  fallback: T,
): Promise<T> {
  try {
    const value = await getAppMetaJson<T>(db, metaKey);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export async function setAppMetaJson<T>(
  db: SQLite.SQLiteDatabase,
  metaKey: AppMetaJsonKey,
  value: T,
): Promise<void> {
  await setAppMetaText(db, metaKey, JSON.stringify(value));
}
