import {
  appMetaKeys,
  getAppMetaJsonOrDefault,
  setAppMetaJson,
} from "@/core/db/appMeta";
import { getDatabase } from "@/core/db/client";
import { PomodoroSession } from "@/core/db/types";
import type { LinkedActionEffectAdapterResult } from "@/core/linked-actions/linkedActions.types";
import { createId } from "@/lib/id";
import { getUtcIsoRangeForLocalDateKeys, nowIso } from "@/lib/time";
import {
  DEFAULT_SETTINGS,
  type PomodoroMode,
  type PomodoroSettings,
} from "@/features/pomodoro/pomodoro.domain";

export async function getPomodoroSettings(): Promise<PomodoroSettings> {
  const db = await getDatabase();
  return getAppMetaJsonOrDefault<PomodoroSettings>(
    db,
    appMetaKeys.pomodoroSettings,
    DEFAULT_SETTINGS,
  );
}

export async function savePomodoroSettings(settings: PomodoroSettings): Promise<void> {
  const db = await getDatabase();
  await setAppMetaJson(db, appMetaKeys.pomodoroSettings, settings);
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

/** All sessions whose start time falls in [startDateKey, endDateKey] (local calendar day bounds). */
export async function listPomodoroSessionsForDateRange(
  startDateKey: string,
  endDateKey: string,
): Promise<PomodoroSession[]> {
  const db = await getDatabase();
  const { startUtcIso, endUtcExclusiveIso } = getUtcIsoRangeForLocalDateKeys(
    startDateKey,
    endDateKey,
  );
  return db.getAllAsync<PomodoroSession>(
    `SELECT * FROM pomodoro_sessions
     WHERE started_at >= ? AND started_at < ?
     ORDER BY started_at DESC`,
    [startUtcIso, endUtcExclusiveIso],
  );
}

export async function logPomodoroSessionFromLinkedAction(input: {
  id: string;
  durationSeconds: number;
  type: PomodoroMode;
}): Promise<LinkedActionEffectAdapterResult> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<Pick<PomodoroSession, "id" | "session_type">>(
    `SELECT id, session_type
     FROM pomodoro_sessions
     WHERE id = ?`,
    [input.id],
  );

  if (existing) {
    return {
      status: "applied",
      targetLabel: existing.session_type,
      producedEntityType: "pomodoro_session",
      producedEntityId: existing.id,
    };
  }

  const endedAt = new Date();
  const startedAt = new Date(endedAt.getTime() - Math.max(0, input.durationSeconds) * 1000);
  const createdAt = nowIso();
  await db.runAsync(
    `INSERT INTO pomodoro_sessions (
       id,
       started_at,
       ended_at,
       duration_seconds,
       session_type,
       created_at
     ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      startedAt.toISOString(),
      endedAt.toISOString(),
      input.durationSeconds,
      input.type,
      createdAt,
    ],
  );

  return {
    status: "applied",
    targetLabel: input.type,
    producedEntityType: "pomodoro_session",
    producedEntityId: input.id,
  };
}
