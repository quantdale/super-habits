import {
  appMetaKeys,
  getAppMetaJsonOrDefault,
  setAppMetaJson,
} from "@/core/db/appMeta";
import { getDatabase } from "@/core/db/client";
import { PomodoroSession } from "@/core/db/types";
import type {
  LinkedActionEffectAdapterResult,
  LinkedActionOriginMetadata,
} from "@/core/linked-actions/linkedActions.types";
import { linkedActionsEngine } from "@/core/linked-actions/linkedActions.engine";
import { createId } from "@/lib/id";
import { getUtcIsoRangeForLocalDateKeys, nowIso, toDateKey } from "@/lib/time";
import {
  DEFAULT_SETTINGS,
  type PomodoroMode,
  type PomodoroSettings,
} from "@/features/pomodoro/pomodoro.domain";

function normalizeLinkedActionOrigin(
  origin: Partial<LinkedActionOriginMetadata> | undefined,
): LinkedActionOriginMetadata {
  return {
    originKind: origin?.originKind ?? "user",
    originRuleId: origin?.originRuleId ?? null,
    originEventId: origin?.originEventId ?? null,
  };
}

async function emitPomodoroFocusCompletedSourceAction(input: {
  sessionId: string;
  startedAtIso: string;
  endedAtIso: string;
  durationSeconds: number;
  type: PomodoroMode;
  origin: LinkedActionOriginMetadata;
}): Promise<void> {
  if (input.type !== "focus" || input.origin.originKind !== "user") {
    return;
  }

  await linkedActionsEngine.processSourceAction({
    occurredAt: input.endedAtIso,
    feature: "pomodoro",
    entityType: "pomodoro_timer",
    entityId: null,
    triggerType: "pomodoro.focus_completed",
    label: "Focus session completed",
    sourceDateKey: toDateKey(new Date(input.startedAtIso)),
    sourceRecordId: input.sessionId,
    origin: input.origin,
    payload: {
      durationSeconds: input.durationSeconds,
      sessionType: input.type,
      startedAt: input.startedAtIso,
      endedAt: input.endedAtIso,
    },
  });
}

async function insertPomodoroSessionRecord(input: {
  id: string;
  startedAtIso: string;
  endedAtIso: string;
  durationSeconds: number;
  type: PomodoroMode;
}): Promise<{
  id: string;
  sessionType: PomodoroSession["session_type"];
  inserted: boolean;
}> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<Pick<PomodoroSession, "id" | "session_type">>(
    `SELECT id, session_type
     FROM pomodoro_sessions
     WHERE id = ?`,
    [input.id],
  );

  if (existing) {
    return {
      id: existing.id,
      sessionType: existing.session_type,
      inserted: false,
    };
  }

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
      input.startedAtIso,
      input.endedAtIso,
      input.durationSeconds,
      input.type,
      createdAt,
    ],
  );

  return {
    id: input.id,
    sessionType: input.type,
    inserted: true,
  };
}

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
  const origin = normalizeLinkedActionOrigin(undefined);
  const record = await insertPomodoroSessionRecord({
    id,
    startedAtIso: startedAt,
    endedAtIso: endedAt,
    durationSeconds,
    type,
  });

  await emitPomodoroFocusCompletedSourceAction({
    sessionId: record.id,
    startedAtIso: startedAt,
    endedAtIso: endedAt,
    durationSeconds,
    type,
    origin,
  });
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
  const endedAt = new Date();
  const startedAt = new Date(endedAt.getTime() - Math.max(0, input.durationSeconds) * 1000);
  const origin = normalizeLinkedActionOrigin({
    originKind: "linked_action",
  });
  const record = await insertPomodoroSessionRecord({
    id: input.id,
    startedAtIso: startedAt.toISOString(),
    endedAtIso: endedAt.toISOString(),
    durationSeconds: input.durationSeconds,
    type: input.type,
  });

  await emitPomodoroFocusCompletedSourceAction({
    sessionId: record.id,
    startedAtIso: startedAt.toISOString(),
    endedAtIso: endedAt.toISOString(),
    durationSeconds: input.durationSeconds,
    type: input.type,
    origin,
  });

  return {
    status: "applied",
    targetLabel: record.sessionType,
    producedEntityType: "pomodoro_session",
    producedEntityId: record.id,
  };
}
