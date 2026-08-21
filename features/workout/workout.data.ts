import { getDatabase } from '@/core/db/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  appMetaKeys,
  deleteAppMetaKey,
  getAppMetaJsonOrDefault,
  setAppMetaJson,
} from '@/core/db/appMeta';
import {
  RoutineExercise,
  RoutineExerciseSet,
  WorkoutLog,
  WorkoutRoutine,
  WorkoutSessionExercise,
  WorkoutSessionSet,
} from '@/core/db/types';
import type { LinkedActionEffectAdapterResult } from '@/core/linked-actions/linkedActions.types';
import {
  deleteLinkedActionRulesForTargetEntity,
  replaceLinkedActionRulesForSourceEntity,
} from '@/core/linked-actions/linkedActions.data';
import { createId } from '@/lib/id';
import { getUtcIsoRangeForLocalDateKeys, nowIso } from '@/lib/time';
import { runBackupMutation, runSyncedMutation } from '@/core/sync/syncedMutation';
import type { SyncRecord } from '@/core/sync/sync.engine';
import { validateSetTiming } from '@/lib/validation';
import {
  clampRestSeconds,
  DEFAULT_REST_SECONDS,
  LEGACY_REST_SECONDS_STORAGE_KEY,
  normalizeStoredRestSeconds,
  readLegacyStoredRestSeconds,
} from './restTimerPreferences';

/** Nested configuration changes bump the synced parent so remotes refetch the full routine. */
async function touchWorkoutRoutine(
  db: Awaited<ReturnType<typeof getDatabase>>,
  routineId: string,
  now: string,
): Promise<boolean> {
  const result = await db.runAsync(
    `UPDATE workout_routines SET updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    [now, routineId],
  );
  return result.changes === 1;
}

/** Wall-clock session duration in whole seconds; null unless both timestamps
 * parse — unknown stays null, never a fabricated zero-length session. */
function deriveDurationSeconds(
  startedAtIso: string | null,
  endedAtIso: string | null,
): number | null {
  if (!startedAtIso || !endedAtIso) return null;
  const startMs = Date.parse(startedAtIso);
  const endMs = Date.parse(endedAtIso);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return Math.max(0, Math.round((endMs - startMs) / 1000));
}

async function insertWorkoutLogRecord(input: {
  db: Awaited<ReturnType<typeof getDatabase>>;
  logId: string;
  routineId: string;
  notes: string | null;
  completedAtIso: string;
  createdAtIso: string;
  startedAtIso: string | null;
  endedAtIso: string | null;
  durationSeconds: number | null;
  requireActiveRoutine: boolean;
  enqueue: (record: SyncRecord) => void;
}): Promise<{
  status: 'applied' | 'skipped';
  reason: string | null;
  routineName: string | null;
}> {
  const routine = await input.db.getFirstAsync<Pick<WorkoutRoutine, 'id' | 'name' | 'deleted_at'>>(
    `SELECT id, name, deleted_at
     FROM workout_routines
     WHERE id = ?`,
    [input.routineId],
  );

  if (input.requireActiveRoutine && (!routine || routine.deleted_at !== null)) {
    return {
      status: 'skipped',
      reason: 'target_missing',
      routineName: null,
    };
  }

  const existing = await input.db.getFirstAsync<Pick<WorkoutLog, 'id'>>(
    `SELECT id
     FROM workout_logs
     WHERE id = ?`,
    [input.logId],
  );

  if (!existing) {
    await input.db.runAsync(
      `INSERT INTO workout_logs (id, routine_id, notes, completed_at, created_at,
         started_at, ended_at, duration_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.logId,
        input.routineId,
        input.notes,
        input.completedAtIso,
        input.createdAtIso,
        input.startedAtIso,
        input.endedAtIso,
        input.durationSeconds,
      ],
    );
    input.enqueue({
      entity: 'workout_logs',
      id: input.logId,
      updatedAt: input.completedAtIso,
      operation: 'create',
    });
    // Workout history is meaningful user content: it durably claims the
    // dataset for the current anonymous owner (handled by the mutation
    // wrapper's owner-claiming transaction).
  }

  return {
    status: 'applied',
    reason: null,
    routineName: routine?.name ?? null,
  };
}

export async function listRoutines(): Promise<WorkoutRoutine[]> {
  const db = await getDatabase();
  return db.getAllAsync<WorkoutRoutine>(
    'SELECT * FROM workout_routines WHERE deleted_at IS NULL ORDER BY created_at DESC',
  );
}

export async function addRoutine(name: string, description: string): Promise<void> {
  const id = createId('wrk');
  const now = nowIso();
  const db = await getDatabase();
  await runSyncedMutation({
    db,
    record: { entity: 'workout_routines', id, updatedAt: now, operation: 'create' },
    mutate: async (transactionDb, enqueue) => {
      await transactionDb.runAsync(
        'INSERT INTO workout_routines (id, name, description, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, NULL)',
        [id, name, description || null, now, now],
      );
      return { changed: true, value: undefined };
    },
  });
}

export type CompleteRoutineResult = {
  status: 'applied' | 'skipped';
  reason: string | null;
  routineName: string | null;
};

export async function completeRoutine(
  routineId: string,
  notes?: string,
): Promise<CompleteRoutineResult> {
  const db = await getDatabase();
  const logId = createId('wrk');
  const now = nowIso();

  const outcome = await runBackupMutation<CompleteRoutineResult>({
    db,
    mutate: async (transactionDb, enqueue) => {
      const record = await insertWorkoutLogRecord({
        db: transactionDb,
        logId,
        routineId,
        notes: notes ?? null,
        completedAtIso: now,
        createdAtIso: now,
        // Quick-complete records no timed session: unknown stays NULL.
        startedAtIso: null,
        endedAtIso: null,
        durationSeconds: null,
        requireActiveRoutine: true,
        enqueue,
      });
      return { changed: record.status === 'applied', value: record };
    },
  });
  return outcome.value;
}

export async function listWorkoutLogs(limit: number = 30): Promise<WorkoutLog[]> {
  const db = await getDatabase();
  return db.getAllAsync<WorkoutLog>(
    'SELECT * FROM workout_logs ORDER BY completed_at DESC LIMIT ?',
    [limit],
  );
}

export async function listWorkoutLogsForRange(
  startDateKey: string,
  endDateKey: string,
): Promise<WorkoutLog[]> {
  const db = await getDatabase();
  const { startUtcIso, endUtcExclusiveIso } = getUtcIsoRangeForLocalDateKeys(
    startDateKey,
    endDateKey,
  );
  return db.getAllAsync<WorkoutLog>(
    `SELECT * FROM workout_logs
     WHERE completed_at >= ?
       AND completed_at < ?
     ORDER BY completed_at DESC`,
    [startUtcIso, endUtcExclusiveIso],
  );
}

export async function deleteRoutine(routineId: string): Promise<void> {
  const now = nowIso();
  const db = await getDatabase();
  await runSyncedMutation({
    db,
    record: { entity: 'workout_routines', id: routineId, updatedAt: now, operation: 'delete' },
    mutate: async (transactionDb, enqueue) => {
      const result = await transactionDb.runAsync(
        'UPDATE workout_routines SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
        [now, now, routineId],
      );
      if (result.changes === 0) return { changed: false, value: undefined };

      // Configuration children are tombstoned with their parent. Historical
      // workout logs intentionally remain so past sessions keep their audit
      // trail after a routine is removed.
      const exerciseRows = await transactionDb.getAllAsync<{ id: string }>(
        `SELECT id FROM routine_exercises WHERE routine_id = ? AND deleted_at IS NULL`,
        [routineId],
      );
      const setRows = await transactionDb.getAllAsync<{ id: string }>(
        `SELECT id FROM routine_exercise_sets
         WHERE exercise_id IN (
           SELECT id FROM routine_exercises WHERE routine_id = ?
         ) AND deleted_at IS NULL`,
        [routineId],
      );
      await transactionDb.runAsync(
        `UPDATE routine_exercises
         SET deleted_at = ?, updated_at = ?
         WHERE routine_id = ? AND deleted_at IS NULL`,
        [now, now, routineId],
      );
      await transactionDb.runAsync(
        `UPDATE routine_exercise_sets
         SET deleted_at = ?, updated_at = ?
         WHERE exercise_id IN (
           SELECT id FROM routine_exercises WHERE routine_id = ?
         ) AND deleted_at IS NULL`,
        [now, now, routineId],
      );
      for (const exercise of exerciseRows) {
        enqueue({
          entity: 'routine_exercises',
          id: exercise.id,
          updatedAt: now,
          operation: 'delete',
        });
      }
      for (const setRow of setRows) {
        enqueue({
          entity: 'routine_exercise_sets',
          id: setRow.id,
          updatedAt: now,
          operation: 'delete',
        });
      }
      await replaceLinkedActionRulesForSourceEntity({
        feature: 'workout',
        entityType: 'workout_routine',
        entityId: routineId,
        rules: [],
        db: transactionDb,
        enqueue,
      });
      await deleteLinkedActionRulesForTargetEntity({
        feature: 'workout',
        entityType: 'workout_routine',
        entityId: routineId,
        deletedAt: now,
        db: transactionDb,
        enqueue,
      });
      return { changed: true, value: undefined };
    },
  });
}

// --- Exercises ---

export async function addExercise(input: {
  routineId: string;
  name: string;
  sortOrder?: number;
}): Promise<string> {
  const db = await getDatabase();
  const id = createId('ex');
  const now = nowIso();
  await runBackupMutation({
    db,
    mutate: async (transactionDb, enqueue) => {
      const routine = await transactionDb.getFirstAsync<{ id: string }>(
        'SELECT id FROM workout_routines WHERE id = ? AND deleted_at IS NULL',
        [input.routineId],
      );
      if (!routine) throw new Error('Routine not found.');
      await transactionDb.runAsync(
        `INSERT INTO routine_exercises
           (id, routine_id, name, sort_order, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL)`,
        [id, input.routineId, input.name, input.sortOrder ?? 0, now, now],
      );
      if (!(await touchWorkoutRoutine(transactionDb, input.routineId, now))) {
        throw new Error('Routine was deleted while adding the exercise.');
      }
      enqueue({
        entity: 'workout_routines',
        id: input.routineId,
        updatedAt: now,
        operation: 'update',
      });
      enqueue({ entity: 'routine_exercises', id, updatedAt: now, operation: 'create' });
      return { changed: true, value: undefined };
    },
  });
  return id;
}

export async function listExercises(routineId: string): Promise<RoutineExercise[]> {
  const db = await getDatabase();
  return db.getAllAsync<RoutineExercise>(
    `SELECT * FROM routine_exercises
     WHERE routine_id = ? AND deleted_at IS NULL
     ORDER BY sort_order ASC, created_at ASC`,
    [routineId],
  );
}

export async function deleteExercise(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  const row = await db.getFirstAsync<{ routine_id: string }>(
    `SELECT routine_id FROM routine_exercises WHERE id = ? AND deleted_at IS NULL`,
    [id],
  );
  if (!row) return;
  await runBackupMutation({
    db,
    mutate: async (transactionDb, enqueue) => {
      const setRows = await transactionDb.getAllAsync<{ id: string }>(
        `SELECT id FROM routine_exercise_sets WHERE exercise_id = ? AND deleted_at IS NULL`,
        [id],
      );
      const result = await transactionDb.runAsync(
        `UPDATE routine_exercises
       SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL
         AND routine_id IN (SELECT id FROM workout_routines WHERE deleted_at IS NULL)`,
        [now, now, id],
      );
      if (result.changes === 0) return { changed: false, value: undefined };
      await transactionDb.runAsync(
        `UPDATE routine_exercise_sets
       SET deleted_at = ?, updated_at = ? WHERE exercise_id = ? AND deleted_at IS NULL`,
        [now, now, id],
      );
      if (!(await touchWorkoutRoutine(transactionDb, row.routine_id, now))) {
        throw new Error('Routine was deleted while deleting the exercise.');
      }
      enqueue({
        entity: 'workout_routines',
        id: row.routine_id,
        updatedAt: now,
        operation: 'update',
      });
      enqueue({ entity: 'routine_exercises', id, updatedAt: now, operation: 'delete' });
      for (const setRow of setRows) {
        enqueue({
          entity: 'routine_exercise_sets',
          id: setRow.id,
          updatedAt: now,
          operation: 'delete',
        });
      }
      return { changed: true, value: undefined };
    },
  });
}

export async function updateExerciseOrder(orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return;
  const db = await getDatabase();
  const now = nowIso();
  const first = await db.getFirstAsync<{ routine_id: string }>(
    `SELECT e.routine_id
     FROM routine_exercises e
     INNER JOIN workout_routines r ON r.id = e.routine_id AND r.deleted_at IS NULL
     WHERE e.id = ? AND e.deleted_at IS NULL`,
    [orderedIds[0]],
  );
  if (!first) return;
  await runBackupMutation({
    db,
    mutate: async (transactionDb, enqueue) => {
      const placeholders = orderedIds.map(() => '?').join(', ');
      const rows = await transactionDb.getAllAsync<{ id: string; routine_id: string }>(
        `SELECT id, routine_id FROM routine_exercises
       WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
        orderedIds,
      );
      if (
        rows.length !== orderedIds.length ||
        rows.some((row) => row.routine_id !== first.routine_id)
      ) {
        return { changed: false, value: undefined };
      }
      for (let i = 0; i < orderedIds.length; i++) {
        await transactionDb.runAsync(
          `UPDATE routine_exercises
         SET sort_order = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
          [i + 1, now, orderedIds[i]],
        );
      }
      if (!(await touchWorkoutRoutine(transactionDb, first.routine_id, now))) {
        throw new Error('Routine was deleted while reordering exercises.');
      }
      enqueue({
        entity: 'workout_routines',
        id: first.routine_id,
        updatedAt: now,
        operation: 'update',
      });
      for (const orderedId of orderedIds) {
        enqueue({
          entity: 'routine_exercises',
          id: orderedId,
          updatedAt: now,
          operation: 'update',
        });
      }
      return { changed: true, value: undefined };
    },
  });
}

// --- Sets ---

export async function addSet(input: {
  exerciseId: string;
  setNumber: number;
  activeSeconds: number;
  restSeconds: number;
}): Promise<string> {
  const timingErr = validateSetTiming(input.activeSeconds, input.restSeconds);
  if (timingErr) throw new Error(timingErr);
  const db = await getDatabase();
  const id = createId('eset');
  const now = nowIso();
  const exRow = await db.getFirstAsync<{ routine_id: string }>(
    `SELECT e.routine_id
     FROM routine_exercises e
     INNER JOIN workout_routines r ON r.id = e.routine_id AND r.deleted_at IS NULL
     WHERE e.id = ? AND e.deleted_at IS NULL`,
    [input.exerciseId],
  );
  if (!exRow) throw new Error('Exercise or routine not found.');
  await runBackupMutation({
    db,
    mutate: async (transactionDb, enqueue) => {
      const activeExercise = await transactionDb.getFirstAsync<{ routine_id: string }>(
        `SELECT e.routine_id
       FROM routine_exercises e
       INNER JOIN workout_routines r ON r.id = e.routine_id AND r.deleted_at IS NULL
       WHERE e.id = ? AND e.deleted_at IS NULL`,
        [input.exerciseId],
      );
      if (!activeExercise) throw new Error('Exercise or routine not found.');
      await transactionDb.runAsync(
        `INSERT INTO routine_exercise_sets
         (id, exercise_id, set_number, active_seconds, rest_seconds,
          created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
        [id, input.exerciseId, input.setNumber, input.activeSeconds, input.restSeconds, now, now],
      );
      if (!(await touchWorkoutRoutine(transactionDb, activeExercise.routine_id, now))) {
        throw new Error('Routine was deleted while adding the set.');
      }
      enqueue({
        entity: 'workout_routines',
        id: activeExercise.routine_id,
        updatedAt: now,
        operation: 'update',
      });
      enqueue({ entity: 'routine_exercise_sets', id, updatedAt: now, operation: 'create' });
      return { changed: true, value: undefined };
    },
  });
  return id;
}

export async function listSets(exerciseId: string): Promise<RoutineExerciseSet[]> {
  const db = await getDatabase();
  return db.getAllAsync<RoutineExerciseSet>(
    `SELECT * FROM routine_exercise_sets
     WHERE exercise_id = ? AND deleted_at IS NULL
     ORDER BY set_number ASC`,
    [exerciseId],
  );
}

export async function updateSet(
  id: string,
  updates: { activeSeconds?: number; restSeconds?: number },
): Promise<void> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ active_seconds: number; rest_seconds: number }>(
    `SELECT active_seconds, rest_seconds FROM routine_exercise_sets
     WHERE id = ? AND deleted_at IS NULL`,
    [id],
  );
  if (!row) return;
  const nextActive = updates.activeSeconds ?? row.active_seconds;
  const nextRest = updates.restSeconds ?? row.rest_seconds;
  const timingErr = validateSetTiming(nextActive, nextRest);
  if (timingErr) throw new Error(timingErr);

  const now = nowIso();
  if (updates.activeSeconds === undefined && updates.restSeconds === undefined) return;
  const setRow = await db.getFirstAsync<{ routine_id: string }>(
    `SELECT e.routine_id AS routine_id
     FROM routine_exercise_sets s
     INNER JOIN routine_exercises e ON e.id = s.exercise_id
     WHERE s.id = ? AND s.deleted_at IS NULL AND e.deleted_at IS NULL`,
    [id],
  );
  if (!setRow?.routine_id) return;
  await runBackupMutation({
    db,
    mutate: async (transactionDb, enqueue) => {
      const activeSet = await transactionDb.getFirstAsync<{
        active_seconds: number;
        rest_seconds: number;
        routine_id: string;
      }>(
        `SELECT s.active_seconds, s.rest_seconds, e.routine_id
       FROM routine_exercise_sets s
       INNER JOIN routine_exercises e ON e.id = s.exercise_id AND e.deleted_at IS NULL
       INNER JOIN workout_routines r ON r.id = e.routine_id AND r.deleted_at IS NULL
       WHERE s.id = ? AND s.deleted_at IS NULL`,
        [id],
      );
      if (!activeSet) return { changed: false, value: undefined };
      const update = await transactionDb.runAsync(
        `UPDATE routine_exercise_sets
       SET active_seconds = ?, rest_seconds = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
        [nextActive, nextRest, now, id],
      );
      if (update.changes !== 1) return { changed: false, value: undefined };
      if (!(await touchWorkoutRoutine(transactionDb, activeSet.routine_id, now))) {
        throw new Error('Routine was deleted while updating the set.');
      }
      enqueue({
        entity: 'workout_routines',
        id: activeSet.routine_id,
        updatedAt: now,
        operation: 'update',
      });
      enqueue({ entity: 'routine_exercise_sets', id, updatedAt: now, operation: 'update' });
      return { changed: true, value: undefined };
    },
  });
}

export async function deleteSet(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  const setRow = await db.getFirstAsync<{ routine_id: string }>(
    `SELECT e.routine_id AS routine_id
     FROM routine_exercise_sets s
     INNER JOIN routine_exercises e ON e.id = s.exercise_id
     WHERE s.id = ? AND s.deleted_at IS NULL AND e.deleted_at IS NULL`,
    [id],
  );
  if (!setRow?.routine_id) return;
  await runBackupMutation({
    db,
    mutate: async (transactionDb, enqueue) => {
      const result = await transactionDb.runAsync(
        `UPDATE routine_exercise_sets
       SET deleted_at = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL
         AND exercise_id IN (
           SELECT e.id
           FROM routine_exercises e
           INNER JOIN workout_routines r ON r.id = e.routine_id AND r.deleted_at IS NULL
           WHERE e.deleted_at IS NULL
         )`,
        [now, now, id],
      );
      if (result.changes === 0) return { changed: false, value: undefined };
      if (!(await touchWorkoutRoutine(transactionDb, setRow.routine_id, now))) {
        throw new Error('Routine was deleted while deleting the set.');
      }
      enqueue({
        entity: 'workout_routines',
        id: setRow.routine_id,
        updatedAt: now,
        operation: 'update',
      });
      enqueue({ entity: 'routine_exercise_sets', id, updatedAt: now, operation: 'delete' });
      return { changed: true, value: undefined };
    },
  });
}

export async function addDefaultSet(exerciseId: string): Promise<void> {
  const db = await getDatabase();
  const countRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM routine_exercise_sets
     WHERE exercise_id = ? AND deleted_at IS NULL`,
    [exerciseId],
  );
  const nextNumber = (countRow?.count ?? 0) + 1;
  // The rest preference seeds newly created sets; per-set values are
  // authoritative thereafter (applyRestDefault only covers legacy zero rows).
  const restSeconds = await loadRestSecondsDefault();
  await addSet({
    exerciseId,
    setNumber: nextNumber,
    activeSeconds: 40,
    restSeconds,
  });
}

export type RoutineWithExercises = WorkoutRoutine & {
  exercises: (RoutineExercise & { sets: RoutineExerciseSet[] })[];
};

export async function getRoutineWithExercises(
  routineId: string,
): Promise<RoutineWithExercises | null> {
  const db = await getDatabase();

  const routine = await db.getFirstAsync<WorkoutRoutine>(
    `SELECT * FROM workout_routines
     WHERE id = ? AND deleted_at IS NULL`,
    [routineId],
  );
  if (!routine) return null;

  const exercises = await db.getAllAsync<RoutineExercise>(
    `SELECT * FROM routine_exercises
     WHERE routine_id = ? AND deleted_at IS NULL
     ORDER BY sort_order ASC, created_at ASC`,
    [routineId],
  );

  const exercisesWithSets = await Promise.all(
    exercises.map(async (ex) => {
      const sets = await db.getAllAsync<RoutineExerciseSet>(
        `SELECT * FROM routine_exercise_sets
         WHERE exercise_id = ? AND deleted_at IS NULL
         ORDER BY set_number ASC`,
        [ex.id],
      );
      return { ...ex, sets };
    }),
  );

  return { ...routine, exercises: exercisesWithSets };
}

/** One recorded set captured during a timed session. */
export type LoggedSessionSetInput = {
  setNumber: number;
  /** null = not recorded (unknown), never a measured zero. */
  weight: number | null;
  /** null = not recorded (unknown). */
  reps: number | null;
  completed: boolean;
};

export async function logWorkoutSession(input: {
  routineId: string;
  notes?: string;
  exercises: {
    exerciseName: string;
    setsCompleted: number;
    /** Per-set provenance rows persisted as workout_session_sets; omitted
     * when the caller has no per-set data (legacy shape still supported). */
    sets?: LoggedSessionSetInput[];
  }[];
  /** Wall-clock session start/end (ISO). NULL = untimed session. */
  startedAt?: string | null;
  endedAt?: string | null;
}): Promise<void> {
  const db = await getDatabase();
  const logId = createId('wrk');
  const now = nowIso();
  const durationSeconds = deriveDurationSeconds(input.startedAt ?? null, input.endedAt ?? null);

  await runBackupMutation({
    db,
    mutate: async (transactionDb, enqueue) => {
      const record = await insertWorkoutLogRecord({
        db: transactionDb,
        logId,
        routineId: input.routineId,
        notes: input.notes ?? null,
        completedAtIso: now,
        createdAtIso: now,
        startedAtIso: input.startedAt ?? null,
        endedAtIso: input.endedAt ?? null,
        durationSeconds,
        requireActiveRoutine: true,
        enqueue,
      });

      if (record.status !== 'applied') return { changed: false, value: undefined };

      for (const ex of input.exercises) {
        const exId = createId('wsex');
        await transactionDb.runAsync(
          `INSERT INTO workout_session_exercises
             (id, log_id, exercise_name, sets_completed, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [exId, logId, ex.exerciseName, ex.setsCompleted, now],
        );
        enqueue({
          entity: 'workout_session_exercises',
          id: exId,
          updatedAt: now,
          operation: 'create',
        });
        for (const set of ex.sets ?? []) {
          const setId = createId('sset');
          await transactionDb.runAsync(
            `INSERT INTO workout_session_sets
               (id, session_exercise_id, set_number, weight, reps, weight_unit, completed, created_at)
             VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
            [setId, exId, set.setNumber, set.weight, set.reps, set.completed ? 1 : 0, now],
          );
          enqueue({
            entity: 'workout_session_sets',
            id: setId,
            updatedAt: now,
            operation: 'create',
          });
        }
      }
      return { changed: true, value: undefined };
    },
  });
}

export async function logWorkoutFromLinkedAction(input: {
  id: string;
  routineId: string;
  notes?: string | null;
}): Promise<LinkedActionEffectAdapterResult> {
  const db = await getDatabase();
  const now = nowIso();
  const outcome = await runBackupMutation<CompleteRoutineResult>({
    db,
    mutate: async (transactionDb, enqueue) => {
      const record = await insertWorkoutLogRecord({
        db: transactionDb,
        logId: input.id,
        routineId: input.routineId,
        notes: input.notes ?? null,
        completedAtIso: now,
        createdAtIso: now,
        // Linked-action completions record no timed session.
        startedAtIso: null,
        endedAtIso: null,
        durationSeconds: null,
        requireActiveRoutine: true,
        enqueue,
      });
      return { changed: record.status === 'applied', value: record };
    },
  });

  const record = outcome.value;
  if (record.status !== 'applied') {
    return { status: 'skipped', reason: record.reason ?? 'target_missing' };
  }

  return {
    status: 'applied',
    targetLabel: record.routineName ?? undefined,
    producedEntityType: 'workout_log',
    producedEntityId: input.id,
  };
}

/**
 * Restore-only import functions. Plain INSERT OR REPLACE preserving ids,
 * ordering, timings, tombstones, and timestamps — data reconstruction only;
 * no workout-completion events, no linked actions.
 */
export async function applyRemoteWorkoutRoutines(
  db: Awaited<ReturnType<typeof getDatabase>>,
  rows: WorkoutRoutine[],
): Promise<void> {
  for (const row of rows) {
    await db.runAsync(
      `INSERT OR REPLACE INTO workout_routines (
         id, name, description, created_at, updated_at, deleted_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [row.id, row.name, row.description, row.created_at, row.updated_at, row.deleted_at],
    );
  }
}

export async function applyRemoteRoutineExercises(
  db: Awaited<ReturnType<typeof getDatabase>>,
  rows: RoutineExercise[],
): Promise<void> {
  for (const row of rows) {
    await db.runAsync(
      `INSERT OR REPLACE INTO routine_exercises (
         id, routine_id, name, sort_order, created_at, updated_at, deleted_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.routine_id,
        row.name,
        row.sort_order,
        row.created_at,
        row.updated_at,
        row.deleted_at,
      ],
    );
  }
}

export async function applyRemoteRoutineExerciseSets(
  db: Awaited<ReturnType<typeof getDatabase>>,
  rows: RoutineExerciseSet[],
): Promise<void> {
  for (const row of rows) {
    await db.runAsync(
      `INSERT OR REPLACE INTO routine_exercise_sets (
         id, exercise_id, set_number, active_seconds, rest_seconds,
         created_at, updated_at, deleted_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.exercise_id,
        row.set_number,
        row.active_seconds,
        row.rest_seconds,
        row.created_at,
        row.updated_at,
        row.deleted_at,
      ],
    );
  }
}

export async function applyRemoteWorkoutLogs(
  db: Awaited<ReturnType<typeof getDatabase>>,
  rows: WorkoutLog[],
): Promise<void> {
  for (const row of rows) {
    await db.runAsync(
      `INSERT OR REPLACE INTO workout_logs (
         id, routine_id, notes, completed_at, created_at,
         started_at, ended_at, duration_seconds
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.routine_id,
        row.notes,
        row.completed_at,
        row.created_at,
        // Legacy rows predate real session timing; absent = NULL (untimed).
        row.started_at ?? null,
        row.ended_at ?? null,
        row.duration_seconds ?? null,
      ],
    );
  }
}

export async function applyRemoteWorkoutSessionSets(
  db: Awaited<ReturnType<typeof getDatabase>>,
  rows: WorkoutSessionSet[],
): Promise<void> {
  for (const row of rows) {
    await db.runAsync(
      `INSERT OR REPLACE INTO workout_session_sets (
         id, session_exercise_id, set_number, weight, reps, weight_unit,
         completed, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.session_exercise_id,
        row.set_number,
        row.weight,
        row.reps,
        row.weight_unit,
        row.completed,
        row.created_at,
      ],
    );
  }
}

export async function applyRemoteWorkoutSessionExercises(
  db: Awaited<ReturnType<typeof getDatabase>>,
  rows: WorkoutSessionExercise[],
): Promise<void> {
  for (const row of rows) {
    await db.runAsync(
      `INSERT OR REPLACE INTO workout_session_exercises (
         id, log_id, exercise_name, sets_completed, created_at
       ) VALUES (?, ?, ?, ?, ?)`,
      [row.id, row.log_id, row.exercise_name, row.sets_completed, row.created_at],
    );
  }
}

/** Get routine names by their IDs. Used by the weekly review summary. */
export async function getRoutineNamesByIds(ids: string[]): Promise<{ id: string; name: string }[]> {
  if (ids.length === 0) return [];
  const db = await getDatabase();
  return db.getAllAsync<{ id: string; name: string }>(
    `SELECT id, name FROM workout_routines WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids,
  );
}

// --- History detail ---

export type WorkoutLogDetail = {
  log: WorkoutLog;
  routineName: string | null;
  exercises: WorkoutSessionExercise[];
  /** Real per-set rows for this log; empty for quick-complete/legacy logs. */
  sets: WorkoutSessionSet[];
};

/** Full per-session detail: log header plus its workout_session_exercises and
 * workout_session_sets rows (legacy logs without set rows read as `sets: []`). */
export async function getWorkoutLogDetail(logId: string): Promise<WorkoutLogDetail | null> {
  const db = await getDatabase();
  const log = await db.getFirstAsync<WorkoutLog>(`SELECT * FROM workout_logs WHERE id = ?`, [
    logId,
  ]);
  if (!log) return null;
  const routine = await db.getFirstAsync<{ name: string }>(
    `SELECT name FROM workout_routines WHERE id = ?`,
    [log.routine_id],
  );
  const exercises = await db.getAllAsync<WorkoutSessionExercise>(
    `SELECT * FROM workout_session_exercises
     WHERE log_id = ?
     ORDER BY created_at ASC, id ASC`,
    [logId],
  );
  const sets =
    exercises.length > 0
      ? await db.getAllAsync<WorkoutSessionSet>(
          `SELECT s.* FROM workout_session_sets s
           INNER JOIN workout_session_exercises e ON e.id = s.session_exercise_id
           WHERE e.log_id = ?
           ORDER BY e.created_at ASC, e.id ASC, s.set_number ASC`,
          [logId],
        )
      : [];
  return { log, routineName: routine?.name ?? null, exercises, sets };
}

/**
 * Newest-first recorded weighted sets across all sessions — the seeding
 * source for per-set weight/reps entry defaults during a new session.
 * Bounded; only completed sets with both values recorded qualify.
 */
export async function listRecentLoggedSets(): Promise<
  {
    exerciseName: string;
    setNumber: number;
    weight: number;
    reps: number;
  }[]
> {
  const db = await getDatabase();
  return db.getAllAsync(
    `SELECT e.exercise_name AS exerciseName,
            s.set_number AS setNumber,
            s.weight AS weight,
            s.reps AS reps
     FROM workout_session_sets s
     INNER JOIN workout_session_exercises e ON e.id = s.session_exercise_id
     WHERE s.completed = 1 AND s.weight IS NOT NULL AND s.reps IS NOT NULL
     ORDER BY s.created_at DESC, s.id DESC
     LIMIT 500`,
  );
}

/**
 * Recorded weighted sets for the given exercise names across prior sessions —
 * the history side of new-PR comparison. Only completed sets with both values
 * recorded qualify; call BEFORE inserting the current session's log so it is
 * excluded by construction.
 */
export async function listLoggedSetsForExerciseNames(
  exerciseNames: string[],
): Promise<{ exerciseName: string; weight: number; reps: number }[]> {
  if (exerciseNames.length === 0) return [];
  const db = await getDatabase();
  const placeholders = exerciseNames.map(() => '?').join(', ');
  return db.getAllAsync(
    `SELECT e.exercise_name AS exerciseName,
            s.weight AS weight,
            s.reps AS reps
     FROM workout_session_sets s
     INNER JOIN workout_session_exercises e ON e.id = s.session_exercise_id
     WHERE s.completed = 1 AND s.weight IS NOT NULL AND s.reps IS NOT NULL
       AND e.exercise_name IN (${placeholders})
     ORDER BY s.created_at DESC, s.id DESC`,
    exerciseNames,
  );
}

/**
 * Bounded per-session set totals for a local date-key range.
 * Used by the volume-per-week chart; one row per session.
 */
export async function listSessionTotalsForRange(
  startDateKey: string,
  endDateKey: string,
): Promise<{ id: string; completedAt: string; totalSets: number }[]> {
  const db = await getDatabase();
  const { startUtcIso, endUtcExclusiveIso } = getUtcIsoRangeForLocalDateKeys(
    startDateKey,
    endDateKey,
  );
  return db.getAllAsync<{ id: string; completedAt: string; totalSets: number }>(
    `SELECT l.id AS id,
            l.completed_at AS completedAt,
            COALESCE(SUM(e.sets_completed), 0) AS totalSets
     FROM workout_logs l
     LEFT JOIN workout_session_exercises e ON e.log_id = l.id
     WHERE l.completed_at >= ? AND l.completed_at < ?
     GROUP BY l.id, l.completed_at
     ORDER BY l.completed_at DESC`,
    [startUtcIso, endUtcExclusiveIso],
  );
}

// --- Routine duplication ---

/**
 * Duplicate a routine ("use as template"): creates a new routine copying
 * routine_exercises and routine_exercise_sets via the existing insert
 * helpers (addExercise/addSet), which own the createId prefixes and sync
 * enqueue calls for every nested row. Returns the new routine id, or null
 * when the source routine no longer exists.
 */
export async function duplicateRoutine(routineId: string): Promise<string | null> {
  const db = await getDatabase();
  const source = await getRoutineWithExercises(routineId);
  if (!source) return null;

  const newId = createId('wrk');
  const now = nowIso();
  const newName = `${source.name} (copy)`;
  await runSyncedMutation({
    db,
    record: { entity: 'workout_routines', id: newId, updatedAt: now, operation: 'create' },
    mutate: async (transactionDb) => {
      await transactionDb.runAsync(
        'INSERT INTO workout_routines (id, name, description, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, NULL)',
        [newId, newName, source.description, now, now],
      );
      return { changed: true, value: undefined };
    },
  });

  for (const exercise of source.exercises) {
    const exerciseId = await addExercise({
      routineId: newId,
      name: exercise.name,
      sortOrder: exercise.sort_order,
    });
    for (const set of exercise.sets) {
      await addSet({
        exerciseId,
        setNumber: set.set_number,
        activeSeconds: set.active_seconds,
        restSeconds: set.rest_seconds,
      });
    }
  }
  return newId;
}

// ---------------------------------------------------------------------------
// Active session draft (app_meta `workout.active_session_draft`). Local
// operational state only — deliberately not part of the backup allowlist
// (a restored device has no live workout to resume).
// ---------------------------------------------------------------------------

/** Minimal in-progress session state persisted for resume after an app
 *  restart. Entered weight/reps and skip flags stay session-local by design;
 *  a resumed session reconstructs at the saved phase cursor with prior phases
 *  counted as completed and their measurements unrecorded. */
export type WorkoutSessionDraft = {
  routineId: string;
  /** ISO timestamp of the session's first Start press. */
  startedAtIso: string;
  /** Index into the routine's timer-phase sequence. */
  phaseIndex: number;
  /** Display-clock seconds already elapsed when the draft was written. */
  elapsedAdjustSeconds?: number;
};

function normalizeWorkoutSessionDraft(value: unknown): WorkoutSessionDraft | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.routineId !== 'string' || candidate.routineId.length === 0) return null;
  if (typeof candidate.startedAtIso !== 'string') return null;
  if (Number.isNaN(new Date(candidate.startedAtIso).getTime())) return null;
  if (
    typeof candidate.phaseIndex !== 'number' ||
    !Number.isInteger(candidate.phaseIndex) ||
    candidate.phaseIndex < 0
  ) {
    return null;
  }
  const elapsed = candidate.elapsedAdjustSeconds;
  return {
    routineId: candidate.routineId,
    startedAtIso: candidate.startedAtIso,
    phaseIndex: candidate.phaseIndex,
    ...(typeof elapsed === 'number' && Number.isFinite(elapsed) && elapsed >= 0
      ? { elapsedAdjustSeconds: Math.round(elapsed) }
      : {}),
  };
}

/** Read the resumable workout draft, or null when no session is in flight. */
export async function getWorkoutSessionDraft(): Promise<WorkoutSessionDraft | null> {
  const db = await getDatabase();
  return getAppMetaJsonOrDefault<WorkoutSessionDraft | null>(
    db,
    appMetaKeys.workoutActiveSessionDraft,
    null,
    normalizeWorkoutSessionDraft,
  );
}

/** Persist the in-progress workout draft; invalid drafts are rejected silently. */
export async function saveWorkoutSessionDraft(draft: WorkoutSessionDraft): Promise<void> {
  const normalized = normalizeWorkoutSessionDraft(draft);
  if (!normalized) return;
  const db = await getDatabase();
  await setAppMetaJson(db, appMetaKeys.workoutActiveSessionDraft, normalized);
}

/** Clear the draft on finish, abandon, or discard. */
export async function clearWorkoutSessionDraft(): Promise<void> {
  const db = await getDatabase();
  await deleteAppMetaKey(db, appMetaKeys.workoutActiveSessionDraft);
}

/**
 * Most recent completed_at per routine id — the "Last performed" context on
 * routine cards. Unbounded across history, unlike the 364-day landing queries.
 */
export async function getLastPerformedByRoutine(): Promise<Map<string, string>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ routine_id: string; last_at: string }>(
    'SELECT routine_id, MAX(completed_at) AS last_at FROM workout_logs GROUP BY routine_id',
  );
  return new Map(rows.map((row) => [row.routine_id, row.last_at]));
}

// ---------------------------------------------------------------------------
// Default rest preference (recoverable Settings V3 source: app_meta
// `workout_rest_seconds`). Lives in the data layer because it touches SQLite;
// restTimerPreferences.ts re-exports these to keep consumer imports stable.
// ---------------------------------------------------------------------------

export async function loadRestSecondsDefault(): Promise<number> {
  try {
    const db = await getDatabase();
    const stored = await getAppMetaJsonOrDefault<number | null>(
      db,
      appMetaKeys.workoutRestSeconds,
      null,
      normalizeStoredRestSeconds,
    );
    if (stored !== null) return stored;

    // One-time legacy import: carry the pre-app_meta preference over, then
    // remove the AsyncStorage key so a later app_meta loss cannot resurrect
    // a stale value (the import stays idempotent either way).
    const legacy = await readLegacyStoredRestSeconds();
    const value = legacy ?? DEFAULT_REST_SECONDS;
    try {
      await setAppMetaJson(db, appMetaKeys.workoutRestSeconds, value);
    } catch {
      // Seeding app_meta is best-effort; the loaded value still applies.
    }
    if (legacy !== null) {
      try {
        await AsyncStorage.removeItem(LEGACY_REST_SECONDS_STORAGE_KEY);
      } catch {
        // Removal is best-effort; app_meta now wins on every future load.
      }
    }
    return value;
  } catch {
    // Database unavailable: fall back to the legacy value or default.
    const legacy = await readLegacyStoredRestSeconds();
    return legacy ?? DEFAULT_REST_SECONDS;
  }
}

export async function saveRestSecondsDefault(seconds: number): Promise<void> {
  try {
    const db = await getDatabase();
    await setAppMetaJson(db, appMetaKeys.workoutRestSeconds, clampRestSeconds(seconds));
  } catch {
    // Preference persistence is best-effort; the session keeps working.
  }
}
