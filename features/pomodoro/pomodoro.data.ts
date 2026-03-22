import { getDatabase } from "@/core/db/client";
import { PomodoroSession } from "@/core/db/types";
import { createId } from "@/lib/id";
import { nowIso } from "@/lib/time";
import {
  DEFAULT_SETTINGS,
  type PomodoroMode,
  type PomodoroSettings,
} from "@/features/pomodoro/pomodoro.domain";

const SETTINGS_KEY = "pomodoro_settings";

export async function getPomodoroSettings(): Promise<PomodoroSettings> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_meta WHERE key = ?`,
    [SETTINGS_KEY],
  );
  if (!row) return DEFAULT_SETTINGS;
  try {
    return JSON.parse(row.value) as PomodoroSettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function savePomodoroSettings(settings: PomodoroSettings): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`, [
    SETTINGS_KEY,
    JSON.stringify(settings),
  ]);
}

export async function logPomodoroSession(
  startedAt: string,
  endedAt: string,
  durationSeconds: number,
  type: PomodoroMode,
): Promise<void> {
  const id = createId("pom");
  const createdAt = nowIso();
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO pomodoro_sessions (id, started_at, ended_at, duration_seconds, session_type, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [id, startedAt, endedAt, durationSeconds, type, createdAt],
  );
}

export async function listPomodoroSessions(limit = 20): Promise<PomodoroSession[]> {
  const db = await getDatabase();
  return db.getAllAsync<PomodoroSession>(
    "SELECT * FROM pomodoro_sessions ORDER BY started_at DESC LIMIT ?",
    [limit],
  );
}
