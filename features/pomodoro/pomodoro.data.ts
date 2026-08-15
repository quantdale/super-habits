import { appMetaKeys, getAppMetaJsonOrDefault, setAppMetaJson } from '@/core/db/appMeta';
import { getDatabase } from '@/core/db/client';
import { PomodoroSession } from '@/core/db/types';
import type { LinkedActionEffectAdapterResult } from '@/core/linked-actions/linkedActions.types';
import { createId } from '@/lib/id';
import { getUtcIsoRangeForLocalDateKeys, nowIso } from '@/lib/time';
import { runBackupMutation, enqueueBackupSettingsRecord } from '@/core/sync/syncedMutation';

import {
  DEFAULT_SETTINGS,
  normalizePomodoroSettings,
  type PomodoroMode,
  type PomodoroSettings,
} from '@/features/pomodoro/pomodoro.domain';

async function insertPomodoroSessionRecord(input: {
  id: string;
  startedAtIso: string;
  endedAtIso: string;
  durationSeconds: number;
  type: PomodoroMode;
}): Promise<{
  id: string;
  sessionType: PomodoroSession['session_type'];
  inserted: boolean;
}> {
  const db = await getDatabase();
  const createdAt = nowIso();
  type Outcome = {
    id: string;
    sessionType: PomodoroSession['session_type'];
    inserted: boolean;
  };
  const outcome = await runBackupMutation<Outcome>({
    db,
    mutate: async (transactionDb, enqueue) => {
      const existing = await transactionDb.getFirstAsync<
        Pick<PomodoroSession, 'id' | 'session_type'>
      >(
        `SELECT id, session_type
         FROM pomodoro_sessions
         WHERE id = ?`,
        [input.id],
      );

      if (existing) {
        return {
          changed: false,
          value: {
            id: existing.id,
            sessionType: existing.session_type,
            inserted: false,
          },
        };
      }

      await transactionDb.runAsync(
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
      enqueue({
        entity: 'pomodoro_sessions',
        id: input.id,
        updatedAt: createdAt,
        operation: 'create',
      });
      // First local-only content durably claims the dataset for the current
      // anonymous owner so later synced work can never become ownerless
      // (handled by runBackupMutation's owner-claiming transaction).
      return {
        changed: true,
        value: {
          id: input.id,
          sessionType: input.type,
          inserted: true,
        },
      };
    },
  });

  return outcome.value;
}

export async function getPomodoroSettings(): Promise<PomodoroSettings> {
  const db = await getDatabase();
  return getAppMetaJsonOrDefault<PomodoroSettings>(
    db,
    appMetaKeys.pomodoroSettings,
    DEFAULT_SETTINGS,
    normalizePomodoroSettings,
  );
}

export async function savePomodoroSettings(settings: PomodoroSettings): Promise<void> {
  const db = await getDatabase();
  await setAppMetaJson(db, appMetaKeys.pomodoroSettings, normalizePomodoroSettings(settings));
  await enqueueBackupSettingsRecord(db);
}

export async function logPomodoroSession(
  startedAt: string,
  endedAt: string,
  durationSeconds: number,
  type: PomodoroMode,
): Promise<void> {
  const id = createId('pom');
  await insertPomodoroSessionRecord({
    id,
    startedAtIso: startedAt,
    endedAtIso: endedAt,
    durationSeconds,
    type,
  });
}

export async function listPomodoroSessions(limit = 20): Promise<PomodoroSession[]> {
  const db = await getDatabase();
  return db.getAllAsync<PomodoroSession>(
    'SELECT * FROM pomodoro_sessions ORDER BY started_at DESC LIMIT ?',
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
  const record = await insertPomodoroSessionRecord({
    id: input.id,
    startedAtIso: startedAt.toISOString(),
    endedAtIso: endedAt.toISOString(),
    durationSeconds: input.durationSeconds,
    type: input.type,
  });

  return {
    status: 'applied',
    targetLabel: record.sessionType,
    producedEntityType: 'pomodoro_session',
    producedEntityId: record.id,
  };
}

/**
 * Restore-only import for pomodoro history. Plain INSERT OR REPLACE — no
 * timers are started, no notifications scheduled, no lifecycle events fired.
 */
export async function applyRemotePomodoroSessions(
  db: Awaited<ReturnType<typeof getDatabase>>,
  rows: PomodoroSession[],
): Promise<void> {
  for (const row of rows) {
    await db.runAsync(
      `INSERT OR REPLACE INTO pomodoro_sessions (
         id,
         started_at,
         ended_at,
         duration_seconds,
         session_type,
         created_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.started_at,
        row.ended_at,
        row.duration_seconds,
        row.session_type,
        row.created_at,
      ],
    );
  }
}
