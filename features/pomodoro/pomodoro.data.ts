import {
  appMetaKeys,
  deleteAppMetaKey,
  getAppMetaJsonOrDefault,
  getAppMetaText,
  setAppMetaJson,
} from '@/core/db/appMeta';
import { getDatabase } from '@/core/db/client';
import type * as SQLite from 'expo-sqlite';
import { PomodoroSession } from '@/core/db/types';
import type { LinkedActionEffectAdapterResult } from '@/core/linked-actions/linkedActions.types';
import { createId } from '@/lib/id';
import { getUtcIsoRangeForLocalDateKeys, nowIso } from '@/lib/time';
import {
  runBackupMutation,
  runRecoverableSettingsMutation,
  enqueueBackupSettingsRecord,
} from '@/core/sync/syncedMutation';

import {
  BUILT_IN_PRESETS,
  DEFAULT_SETTINGS,
  findPresetById,
  normalizePomodoroPresets,
  normalizePomodoroSettings,
  type ActiveTimerIntent,
  type PomodoroMode,
  type PomodoroPreset,
  type PomodoroSettings,
} from '@/features/pomodoro/pomodoro.domain';

/**
 * Session row time semantics (active-time contract): `ended_at` is ALWAYS
 * `started_at + duration_seconds`, where duration is the nominal countdown.
 * Pauses and background-tab throttling shift wall clock but never stretch a
 * session, so `ended_at − started_at === duration_seconds` holds for every
 * row this layer writes (restore validators and future analytics rely on it).
 */

/** Optional durable metadata written directly onto the inserted/updated row. */
export type PomodoroSessionMetaInput = {
  linkedTodoId?: string | null;
  linkedTodoTitle?: string | null;
  note?: string | null;
};

const MAX_META_TITLE_LENGTH = 200;
const MAX_META_NOTE_LENGTH = 500;

function normalizeMetaId(value: string | null | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeMetaTitle(value: string | null | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed.slice(0, MAX_META_TITLE_LENGTH) : null;
}

function normalizeMetaNote(value: string | null | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed.slice(0, MAX_META_NOTE_LENGTH) : null;
}

async function insertPomodoroSessionRecord(input: {
  id: string;
  startedAtIso: string;
  endedAtIso: string;
  durationSeconds: number;
  type: PomodoroMode;
  meta?: PomodoroSessionMetaInput;
  /**
   * Completion-path inserts also dedupe on session identity (exact
   * `started_at`): the crash-reconciliation insert and the pending-log retry
   * both recover the same finished session under different row ids, so
   * without this the retry replays a row reconciliation already logged.
   */
  dedupeByStartedAt?: boolean;
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
         WHERE id = ?${input.dedupeByStartedAt ? ' OR started_at = ?' : ''}`,
        input.dedupeByStartedAt ? [input.id, input.startedAtIso] : [input.id],
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
           created_at,
           linked_todo_id,
           linked_todo_title,
           note
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.id,
          input.startedAtIso,
          input.endedAtIso,
          input.durationSeconds,
          input.type,
          createdAt,
          // Metadata lands atomically with the row so a crash between insert
          // and a follow-up metadata write can never detach it again.
          normalizeMetaId(input.meta?.linkedTodoId),
          normalizeMetaTitle(input.meta?.linkedTodoTitle),
          normalizeMetaNote(input.meta?.note),
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
  const normalized = normalizePomodoroSettings(settings);
  // The durations AND the selection reconciliation form one read-modify-write
  // over `pomodoro_presets`, so they hold the same turn as the preset store's
  // writers (see `runPomodoroPresetStateTurn`): a list save that read the
  // pre-detach state can never write its stale selection back afterwards.
  const result = await runPomodoroPresetStateTurn(() =>
    runRecoverableSettingsMutation({
      db,
      mutate: async (transactionDb) => {
        await setAppMetaJson(transactionDb, appMetaKeys.pomodoroSettings, normalized);
        await detachStalePresetSelection(transactionDb, normalized);
      },
    }),
  );
  if (!result.backupEnqueued) {
    console.warn('[backup] pomodoro settings saved locally; settings intent not recorded');
  }
}

function presetDurationsMatch(preset: PomodoroPreset, settings: PomodoroSettings): boolean {
  return (
    preset.focusMinutes === settings.focusMinutes &&
    preset.shortBreakMinutes === settings.shortBreakMinutes &&
    preset.longBreakMinutes === settings.longBreakMinutes &&
    preset.sessionsBeforeLongBreak === settings.sessionsBeforeLongBreak
  );
}

/**
 * Durations and the stored preset selection must describe the same rhythm.
 *
 * The selection drives TIMER BEHAVIOUR (the preset's auto-start flags), so a
 * selection left behind by a duration edit keeps imposing a rhythm the user
 * replaced: the picker still highlights "Deep Work · 50/10" beside a 30:00
 * timer, and the next completion starts an unrequested break. Both titles
 * persist `pomodoro_presets`, and the recoverable-settings payload carries the
 * pair, so the two facts have to be reconciled in the SAME transaction as the
 * duration write (and, because the preset store's writers merge from a state
 * they read first, under the same preset-state turn). Runs inside the caller's
 * transaction (the JSON helpers take the scoped handle and re-enter the
 * serialized writer).
 */
async function detachStalePresetSelection(
  transactionDb: SQLite.SQLiteDatabase,
  settings: PomodoroSettings,
): Promise<void> {
  const stored = await getAppMetaJsonOrDefault<PomodoroPresetsState | null>(
    transactionDb,
    appMetaKeys.pomodoroPresets,
    null,
    normalizePomodoroPresetsState,
  );
  if (!stored || stored.activePresetId === null) return;
  const selected = findPresetById(stored.presets, stored.activePresetId);
  if (!selected || presetDurationsMatch(selected, settings)) return;
  await setAppMetaJson(transactionDb, appMetaKeys.pomodoroPresets, {
    ...stored,
    activePresetId: null,
  });
}

/**
 * Canonical session logging contract: one row per completed countdown, never
 * a partial session. Returns the created session id so callers can attach
 * metadata (todo association, completion note) to it.
 *
 * `endedAt` must follow the active-time contract documented at the top of
 * this file (`started_at + duration_seconds`); callers derive it from the
 * nominal duration, not from resume-time wall clock.
 */
export async function logPomodoroSession(
  startedAt: string,
  endedAt: string,
  durationSeconds: number,
  type: PomodoroMode,
  meta?: PomodoroSessionMetaInput,
): Promise<string> {
  const id = createId('pom');
  await insertPomodoroSessionRecord({
    id,
    startedAtIso: startedAt,
    endedAtIso: endedAt,
    durationSeconds,
    type,
    meta,
  });
  return id;
}

/**
 * Completion-path insert used by the timer screen and crash reconciliation.
 * Accepts an explicit id (minted here when absent) so a retried or replayed
 * completion — pending-log retry, double-fired handler — dedupes by id
 * instead of inserting a second row for the same focus. It also dedupes by
 * session identity (exact `started_at`), so the crash-reconciliation insert
 * and the pending-log retry can never both log the same finished session
 * under two different ids (double focus minutes, double reward XP).
 */
export async function recordCompletedPomodoroSession(input: {
  id?: string;
  startedAtIso: string;
  endedAtIso: string;
  durationSeconds: number;
  type: PomodoroMode;
  meta?: PomodoroSessionMetaInput;
}): Promise<{ id: string; inserted: boolean }> {
  const id = input.id ?? createId('pom');
  const record = await insertPomodoroSessionRecord({
    id,
    startedAtIso: input.startedAtIso,
    endedAtIso: input.endedAtIso,
    durationSeconds: input.durationSeconds,
    type: input.type,
    meta: input.meta,
    dedupeByStartedAt: true,
  });
  return { id: record.id, inserted: record.inserted };
}

/**
 * Later edits to session metadata (note prompt, association fix-ups). Routed
 * through runBackupMutation + an `update` outbox record so Backup V2 captures
 * edits. `undefined` leaves a column untouched; null/empty clears it.
 * Returns true when a matching row was updated.
 */
export async function setPomodoroSessionMeta(input: {
  sessionId: string;
  linkedTodoId?: string | null;
  linkedTodoTitle?: string | null;
  note?: string | null;
}): Promise<boolean> {
  const db = await getDatabase();
  const linkedTodoId =
    input.linkedTodoId === undefined ? undefined : normalizeMetaId(input.linkedTodoId);
  const linkedTodoTitle =
    input.linkedTodoTitle === undefined ? undefined : normalizeMetaTitle(input.linkedTodoTitle);
  const note = input.note === undefined ? undefined : normalizeMetaNote(input.note);

  const outcome = await runBackupMutation<boolean>({
    db,
    mutate: async (transactionDb, enqueue) => {
      const existing = await transactionDb.getFirstAsync<Pick<PomodoroSession, 'id'>>(
        'SELECT id FROM pomodoro_sessions WHERE id = ?',
        [input.sessionId],
      );
      if (!existing) return { changed: false, value: false };

      const sets: string[] = [];
      const params: (string | null)[] = [];
      if (linkedTodoId !== undefined) {
        sets.push('linked_todo_id = ?');
        params.push(linkedTodoId);
      }
      if (linkedTodoTitle !== undefined) {
        sets.push('linked_todo_title = ?');
        params.push(linkedTodoTitle);
      }
      if (note !== undefined) {
        sets.push('note = ?');
        params.push(note);
      }
      if (sets.length === 0) return { changed: false, value: false };

      const updatedAt = nowIso();
      await transactionDb.runAsync(`UPDATE pomodoro_sessions SET ${sets.join(', ')} WHERE id = ?`, [
        ...params,
        input.sessionId,
      ]);
      enqueue({
        entity: 'pomodoro_sessions',
        id: input.sessionId,
        updatedAt,
        operation: 'update',
      });
      return { changed: true, value: true };
    },
  });
  return outcome.value;
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
  // The backup/portable contract for this column is a whole number of seconds
  // (restore rejects non-integers), and a linked-action duration is authored in
  // whole minutes. Rounding here keeps every writer inside the schema contract,
  // so the row can be backed up and restored instead of failing validation.
  const durationSeconds = Math.max(0, Math.round(input.durationSeconds));
  const startedAt = new Date(endedAt.getTime() - durationSeconds * 1000);
  const record = await insertPomodoroSessionRecord({
    id: input.id,
    startedAtIso: startedAt.toISOString(),
    endedAtIso: endedAt.toISOString(),
    durationSeconds,
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
         created_at,
         linked_todo_id,
         linked_todo_title,
         note
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.started_at,
        row.ended_at,
        row.duration_seconds,
        row.session_type,
        row.created_at,
        // Legacy rows predate the metadata columns; absent = null.
        row.linked_todo_id ?? null,
        row.linked_todo_title ?? null,
        row.note ?? null,
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Durable active-timer intent (crash/reload reconciliation)
// ---------------------------------------------------------------------------

function normalizeActiveTimerIntent(value: unknown): ActiveTimerIntent | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.startedAtIso !== 'string' || candidate.startedAtIso.length === 0)
    return null;
  if (Number.isNaN(new Date(candidate.startedAtIso).getTime())) return null;
  const mode = candidate.mode;
  if (mode !== 'focus' && mode !== 'short_break' && mode !== 'long_break') return null;
  if (
    typeof candidate.totalSeconds !== 'number' ||
    !Number.isInteger(candidate.totalSeconds) ||
    candidate.totalSeconds <= 0
  ) {
    return null;
  }
  if (
    typeof candidate.completedFocus !== 'number' ||
    !Number.isInteger(candidate.completedFocus) ||
    candidate.completedFocus < 0
  ) {
    return null;
  }
  return {
    startedAtIso: candidate.startedAtIso,
    mode,
    totalSeconds: candidate.totalSeconds,
    completedFocus: candidate.completedFocus,
    notificationId:
      typeof candidate.notificationId === 'string' && candidate.notificationId.length > 0
        ? candidate.notificationId
        : null,
    // Optional paused marker: legacy running intents simply omit it.
    pausedRemainingSeconds:
      typeof candidate.pausedRemainingSeconds === 'number' &&
      Number.isInteger(candidate.pausedRemainingSeconds) &&
      candidate.pausedRemainingSeconds > 0
        ? candidate.pausedRemainingSeconds
        : null,
    // `AUD-SH10-A`: the running countdown deadline is part of the intent, so it
    // must survive this normalization. Dropping it made every persisted intent
    // fall back to `startedAt + totalSeconds`, which re-created the audited
    // phantom-completion bug on the very next reload. Kept absent (not null) for
    // legacy/paused intents so their stored shape is unchanged.
    ...(typeof candidate.runningDeadlineIso === 'string' &&
    !Number.isNaN(new Date(candidate.runningDeadlineIso).getTime())
      ? { runningDeadlineIso: candidate.runningDeadlineIso }
      : {}),
  };
}

/**
 * Read the durable in-progress timer intent, or null when no session is in
 * flight. Local operational state only — deliberately not part of the backup
 * allowlist (a restored device has no live timer to reconcile).
 */
export async function getPomodoroActiveTimer(): Promise<ActiveTimerIntent | null> {
  const db = await getDatabase();
  return getAppMetaJsonOrDefault<ActiveTimerIntent | null>(
    db,
    appMetaKeys.pomodoroActiveTimer,
    null,
    normalizeActiveTimerIntent,
  );
}

/** Persist the in-progress timer intent; invalid intents are rejected silently. */
export async function savePomodoroActiveTimer(intent: ActiveTimerIntent): Promise<void> {
  const normalized = normalizeActiveTimerIntent(intent);
  if (!normalized) return;
  const db = await getDatabase();
  await setAppMetaJson(db, appMetaKeys.pomodoroActiveTimer, normalized);
}

/** Clear the intent on completion, abandon, or after reconciliation. */
export async function clearPomodoroActiveTimer(): Promise<void> {
  const db = await getDatabase();
  await deleteAppMetaKey(db, appMetaKeys.pomodoroActiveTimer);
}

/** Whether a session row already exists for an exact `started_at` value. */
export async function hasPomodoroSessionStartedAt(startedAtIso: string): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Pick<PomodoroSession, 'id'>>(
    'SELECT id FROM pomodoro_sessions WHERE started_at = ? LIMIT 1',
    [startedAtIso],
  );
  return row != null;
}

// ---------------------------------------------------------------------------
// Pending-log retry queue (failed completion inserts)
// ---------------------------------------------------------------------------

export type PendingPomodoroLog = {
  /** Stable across retries so insert dedupe-by-id absorbs replays. */
  id: string;
  startedAtIso: string;
  endedAtIso: string;
  durationSeconds: number;
  type: PomodoroMode;
  meta: PomodoroSessionMetaInput | null;
  attempts: number;
  firstQueuedAtIso: string;
  lastErrorAtIso: string | null;
};

/** Give up (and surface a notice) after this many failed foreground retries. */
export const POMODORO_PENDING_LOG_MAX_ATTEMPTS = 3;

function normalizePendingLogEntry(candidate: Record<string, unknown>): PendingPomodoroLog | null {
  if (typeof candidate.id !== 'string' || candidate.id.length === 0) return null;
  if (typeof candidate.startedAtIso !== 'string' || candidate.startedAtIso.length === 0)
    return null;
  if (typeof candidate.endedAtIso !== 'string' || candidate.endedAtIso.length === 0) return null;
  if (
    typeof candidate.durationSeconds !== 'number' ||
    !Number.isFinite(candidate.durationSeconds) ||
    candidate.durationSeconds < 0
  ) {
    return null;
  }
  const type = candidate.type;
  if (type !== 'focus' && type !== 'short_break' && type !== 'long_break') return null;
  let meta: PendingPomodoroLog['meta'] = null;
  if (candidate.meta && typeof candidate.meta === 'object') {
    const rawMeta = candidate.meta as Record<string, unknown>;
    meta = {
      linkedTodoId: typeof rawMeta.linkedTodoId === 'string' ? rawMeta.linkedTodoId : null,
      linkedTodoTitle: typeof rawMeta.linkedTodoTitle === 'string' ? rawMeta.linkedTodoTitle : null,
      note: typeof rawMeta.note === 'string' ? rawMeta.note : null,
    };
  }
  return {
    id: candidate.id,
    startedAtIso: candidate.startedAtIso,
    endedAtIso: candidate.endedAtIso,
    durationSeconds: candidate.durationSeconds,
    type,
    meta,
    attempts:
      typeof candidate.attempts === 'number' &&
      Number.isInteger(candidate.attempts) &&
      candidate.attempts >= 0
        ? candidate.attempts
        : 0,
    firstQueuedAtIso:
      typeof candidate.firstQueuedAtIso === 'string' ? candidate.firstQueuedAtIso : nowIso(),
    lastErrorAtIso: typeof candidate.lastErrorAtIso === 'string' ? candidate.lastErrorAtIso : null,
  };
}

function normalizePendingPomodoroLogs(value: unknown): PendingPomodoroLog[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: PendingPomodoroLog[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const entry = normalizePendingLogEntry(raw as Record<string, unknown>);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    result.push(entry);
  }
  return result;
}

async function readPendingLogQueue(db: Awaited<ReturnType<typeof getDatabase>>) {
  return getAppMetaJsonOrDefault<PendingPomodoroLog[]>(
    db,
    appMetaKeys.pomodoroPendingLogs,
    [],
    normalizePendingPomodoroLogs,
  );
}

/**
 * One serialized turn over the pending-log queue.
 *
 * The queue is a read-modify-write on a single app_meta key with TWO writers:
 * the completion path (`enqueuePendingPomodoroLog`) and the retry pass
 * (`retryPendingPomodoroLogs`, which retains still-failing entries and drops
 * the resolved ones). The retry turn awaits per-entry session inserts between
 * its read and its write, so an enqueue landing inside that window was
 * overwritten by the retry's stale retained list — the just-failed completion
 * silently disappeared from the durable queue and was never logged (no row, no
 * focus minutes, no reward, no notice). Both writers therefore run through this
 * chain, and each turn reads the queue at ITS OWN start.
 */
let pendingLogQueueChain: Promise<void> = Promise.resolve();

function runPendingLogQueueTurn<T>(task: () => Promise<T>): Promise<T> {
  const run = pendingLogQueueChain.then(task);
  pendingLogQueueChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Queue a completed focus whose insert failed; retried on next foreground. */
export async function enqueuePendingPomodoroLog(input: {
  startedAtIso: string;
  endedAtIso: string;
  durationSeconds: number;
  type: PomodoroMode;
  meta?: PomodoroSessionMetaInput | null;
}): Promise<string> {
  return runPendingLogQueueTurn(async () => {
    const db = await getDatabase();
    const queue = await readPendingLogQueue(db);
    const entry: PendingPomodoroLog = {
      id: createId('pom'),
      startedAtIso: input.startedAtIso,
      endedAtIso: input.endedAtIso,
      durationSeconds: input.durationSeconds,
      type: input.type,
      meta: input.meta ?? null,
      attempts: 0,
      firstQueuedAtIso: nowIso(),
      lastErrorAtIso: null,
    };
    await setAppMetaJson(db, appMetaKeys.pomodoroPendingLogs, [...queue, entry]);
    return entry.id;
  });
}

export type PendingLogRetryResult = {
  retried: number;
  succeeded: number;
  /** Entries that exhausted their attempts; removed from the queue. */
  finalFailures: PendingPomodoroLog[];
};

/**
 * Retry every queued focus log. Insert dedupe-by-id makes retries idempotent.
 * Entries succeed → removed; still failing below the attempt cap → retained
 * with attempts bumped; exhausting the cap → returned in `finalFailures`
 * (caller surfaces a notice) and dropped from the queue.
 *
 * Shares the queue turn with `enqueuePendingPomodoroLog`: concurrent
 * foreground refreshes cannot interleave the queue's read-modify-write, and a
 * completion queued during this pass can no longer be clobbered by it.
 */
export async function retryPendingPomodoroLogs(): Promise<PendingLogRetryResult> {
  return runPendingLogQueueTurn(() => retryPendingPomodoroLogsInner());
}

async function retryPendingPomodoroLogsInner(): Promise<PendingLogRetryResult> {
  const db = await getDatabase();
  const queue = await readPendingLogQueue(db);
  if (queue.length === 0) {
    return { retried: 0, succeeded: 0, finalFailures: [] };
  }

  const succeededIds = new Set<string>();
  const finalFailures: PendingPomodoroLog[] = [];
  const retained: PendingPomodoroLog[] = [];

  for (const entry of queue) {
    try {
      await insertPomodoroSessionRecord({
        id: entry.id,
        startedAtIso: entry.startedAtIso,
        endedAtIso: entry.endedAtIso,
        durationSeconds: entry.durationSeconds,
        type: entry.type,
        meta: entry.meta ?? undefined,
        // The same finished session may already have been recovered by crash
        // reconciliation under a different row id; identity dedupe drops the
        // replay instead of double-logging it.
        dedupeByStartedAt: true,
      });
      succeededIds.add(entry.id);
    } catch {
      const attempts = entry.attempts + 1;
      if (attempts >= POMODORO_PENDING_LOG_MAX_ATTEMPTS) {
        finalFailures.push({ ...entry, attempts, lastErrorAtIso: nowIso() });
      } else {
        retained.push({ ...entry, attempts, lastErrorAtIso: nowIso() });
      }
    }
  }

  await setAppMetaJson(db, appMetaKeys.pomodoroPendingLogs, retained);
  return { retried: queue.length, succeeded: succeededIds.size, finalFailures };
}

// ---------------------------------------------------------------------------
// Preset persistence (Recoverable Settings V3 source: app_meta pomodoro_presets)
// ---------------------------------------------------------------------------

/** Preset list + active selection as carried by the recoverable-settings payload. */
export type PomodoroPresetsState = {
  presets: PomodoroPreset[];
  activePresetId: string | null;
};

/**
 * Serialized turn over the durable preset state (`app_meta.pomodoro_presets`).
 *
 * The key is a read-modify-write record with FOUR writers on independent
 * surfaces: the manager replaces the list (`savePomodoroPresets`), the picker
 * sets the selection (`setActivePresetId`), manual duration edits detach it
 * (`clearActivePresetId` / the legacy-import write in the presets store), and
 * `savePomodoroSettings` detaches a selection its new durations no longer
 * match — that detach runs INSIDE its settings transaction, which knows
 * nothing about the store's turn.
 *
 * `withSQLiteWriter` serializes the WRITE turns but not the READS that feed
 * them, so a list save that reads `activePresetId = 'deep'` before a duration
 * save commits its detach wrote the stale selection back afterwards: the
 * picker highlighted a preset the clock no longer ran, and the next
 * completion followed that preset's auto-start flags (an unrequested break).
 * The duration save therefore joins this SAME boundary, so every writer's
 * read-modify-write turn sees the outcome of the turn before it.
 */
let pomodoroPresetStateChain: Promise<void> = Promise.resolve();

export function runPomodoroPresetStateTurn<T>(task: () => Promise<T>): Promise<T> {
  const run = pomodoroPresetStateChain.then(task);
  pomodoroPresetStateChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Same normalize-on-read contract as the recoverable-settings payload. */
export function normalizePomodoroPresetsState(value: unknown): PomodoroPresetsState | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.presets)) return null;
  const presets = normalizePomodoroPresets(candidate.presets);
  const rawActiveId =
    typeof candidate.activePresetId === 'string' && candidate.activePresetId.length > 0
      ? candidate.activePresetId
      : null;
  return {
    presets,
    // The active id must resolve against the normalized preset list.
    activePresetId: rawActiveId ? (findPresetById(presets, rawActiveId)?.id ?? null) : null,
  };
}

function defaultPresetsState(): PomodoroPresetsState {
  return { presets: [...BUILT_IN_PRESETS], activePresetId: null };
}

async function readStoredPresetsState(): Promise<PomodoroPresetsState | null> {
  const db = await getDatabase();
  return getAppMetaJsonOrDefault<PomodoroPresetsState | null>(
    db,
    appMetaKeys.pomodoroPresets,
    null,
    normalizePomodoroPresetsState,
  );
}

export async function hasStoredPomodoroPresetsState(): Promise<boolean> {
  const db = await getDatabase();
  const raw = await getAppMetaText(db, appMetaKeys.pomodoroPresets);
  return raw != null;
}

/** Read the persisted preset state (built-ins when nothing valid is stored). */
export async function getPomodoroPresetsState(): Promise<PomodoroPresetsState> {
  return (await readStoredPresetsState()) ?? defaultPresetsState();
}

/**
 * Persist preset state and snapshot it into the recoverable-settings backup
 * queue (best-effort — a backup enqueue failure never blocks a local save,
 * and failures are logged instead of vanishing).
 */
export async function writePomodoroPresetsState(state: PomodoroPresetsState): Promise<void> {
  const db = await getDatabase();
  await setAppMetaJson(db, appMetaKeys.pomodoroPresets, state);
  try {
    await enqueueBackupSettingsRecord(db);
  } catch (error) {
    console.warn('[backup] settings enqueue after preset change failed', error);
  }
}

// ---------------------------------------------------------------------------
// Legacy session-meta backfill primitives (used by pomodoro.sessionMeta.ts)
// ---------------------------------------------------------------------------

/** Which of the given session ids exist locally (exact-id join for backfill). */
export async function filterExistingPomodoroSessionIds(ids: string[]): Promise<Set<string>> {
  const existing = new Set<string>();
  if (ids.length === 0) return existing;
  const db = await getDatabase();
  for (const id of ids) {
    const row = await db.getFirstAsync<Pick<PomodoroSession, 'id'>>(
      'SELECT id FROM pomodoro_sessions WHERE id = ? LIMIT 1',
      [id],
    );
    if (row) existing.add(id);
  }
  return existing;
}

export type LegacySessionMetaBackfill = {
  associations: { sessionId: string; todoId: string; todoTitle: string }[];
  notes: { sessionId: string; note: string }[];
};

/**
 * Guarded COALESCE backfill of legacy AsyncStorage metadata onto existing
 * rows — only currently-NULL cells are filled so newer row data never gets
 * clobbered. Routed through runBackupMutation with one `update` outbox
 * record per actually-touched row (same contract as setPomodoroSessionMeta):
 * the canonical backup columns include linked_todo_id/title/note, and
 * sessions are immutable history, so without the intent the enriched cells
 * would stay NULL remotely forever. Bounded and one-time: the legacy keys
 * are retired after a successful pass (see pomodoro.sessionMeta.ts), and a
 * crash-retry re-run touches nothing (NULL predicates) so it stays a no-op.
 */
export async function backfillLegacyPomodoroSessionMeta(
  updates: LegacySessionMetaBackfill,
): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  await runBackupMutation<void>({
    db,
    mutate: async (transactionDb, enqueue) => {
      let touched = 0;
      for (const association of updates.associations) {
        const result = await transactionDb.runAsync(
          `UPDATE pomodoro_sessions
           SET linked_todo_id = COALESCE(linked_todo_id, ?),
               linked_todo_title = COALESCE(linked_todo_title, ?)
           WHERE id = ?
             AND (linked_todo_id IS NULL OR linked_todo_title IS NULL)`,
          [association.todoId, association.todoTitle, association.sessionId],
        );
        if (result.changes === 1) {
          touched += 1;
          enqueue({
            entity: 'pomodoro_sessions',
            id: association.sessionId,
            updatedAt: now,
            operation: 'update',
          });
        }
      }
      for (const note of updates.notes) {
        const result = await transactionDb.runAsync(
          `UPDATE pomodoro_sessions
           SET note = COALESCE(note, ?)
           WHERE id = ? AND note IS NULL`,
          [note.note, note.sessionId],
        );
        if (result.changes === 1) {
          touched += 1;
          enqueue({
            entity: 'pomodoro_sessions',
            id: note.sessionId,
            updatedAt: now,
            operation: 'update',
          });
        }
      }
      return { changed: touched > 0, value: undefined };
    },
  });
}
