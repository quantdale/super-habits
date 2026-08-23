import { getDatabase } from '@/core/db/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  appMetaKeys,
  deleteAppMetaKey,
  getAppMetaJsonOrDefault,
  setAppMetaJson,
} from '@/core/db/appMeta';
import {
  BodyWeightEntry,
  CustomExercise,
  RoutineExercise,
  RoutineExerciseSet,
  WorkoutLog,
  WorkoutModality,
  WorkoutPlanKind,
  WorkoutProgressionMode,
  WorkoutRoutine,
  WorkoutScheduleOverride,
  WorkoutSessionExercise,
  WorkoutSessionSet,
  WorkoutWeeklyPlanEntry,
} from '@/core/db/types';
import type { LinkedActionEffectAdapterResult } from '@/core/linked-actions/linkedActions.types';
import {
  deleteLinkedActionRulesForTargetEntity,
  replaceLinkedActionRulesForSourceEntity,
} from '@/core/linked-actions/linkedActions.data';
import { createId } from '@/lib/id';
import { getUtcIsoRangeForLocalDateKeys, isValidDateKey, nowIso, toDateKey } from '@/lib/time';
import {
  enqueueBackupSettingsRecord,
  runBackupMutation,
  runSyncedMutation,
} from '@/core/sync/syncedMutation';
import type { WorkoutEffortScale, WorkoutWeightUnit } from '@/core/db/types';
import type { SyncRecord } from '@/core/sync/sync.engine';
import { requestWorkoutReminderReconciliation } from '@/core/notifications/workoutReminderSignals';
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
    // New logs keep a routine-name snapshot so history remains intelligible
    // after a routine rename/delete. The separate update preserves the
    // legacy insert contract used by existing callers/tests.
    await input.db.runAsync('UPDATE workout_logs SET routine_name = ? WHERE id = ?', [
      routine?.name ?? null,
      input.logId,
    ]);
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

export async function addRoutine(
  name: string,
  description: string,
  goalTag?: string | null,
): Promise<void> {
  const id = createId('wrk');
  const now = nowIso();
  const db = await getDatabase();
  await runSyncedMutation({
    db,
    record: { entity: 'workout_routines', id, updatedAt: now, operation: 'create' },
    mutate: async (transactionDb, enqueue) => {
      if (goalTag === undefined) {
        await transactionDb.runAsync(
          'INSERT INTO workout_routines (id, name, description, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, NULL)',
          [id, name, description || null, now, now],
        );
      } else {
        await transactionDb.runAsync(
          'INSERT INTO workout_routines (id, name, description, goal_tag, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, NULL)',
          [id, name, description || null, goalTag?.trim() || null, now, now],
        );
      }
      return { changed: true, value: undefined };
    },
  });
}

export type RoutineUpdate = Partial<{
  name: string;
  description: string | null;
  goalTag: string | null;
}>;

export async function updateRoutine(routineId: string, updates: RoutineUpdate): Promise<void> {
  const db = await getDatabase();
  const current = await db.getFirstAsync<WorkoutRoutine>(
    'SELECT * FROM workout_routines WHERE id = ? AND deleted_at IS NULL',
    [routineId],
  );
  if (!current) return;
  const name = updates.name?.trim() || current.name;
  const description =
    updates.description === undefined ? current.description : updates.description?.trim() || null;
  const goalTag =
    updates.goalTag === undefined ? (current.goal_tag ?? null) : updates.goalTag?.trim() || null;
  const now = nowIso();
  await runSyncedMutation({
    db,
    record: { entity: 'workout_routines', id: routineId, updatedAt: now, operation: 'update' },
    mutate: async (transactionDb) => {
      const result = await transactionDb.runAsync(
        `UPDATE workout_routines
         SET name = ?, description = ?, goal_tag = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [name, description, goalTag, now, routineId],
      );
      return { changed: result.changes === 1, value: undefined };
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
  catalogExerciseId?: string | null;
  modality?: WorkoutModality;
  notes?: string | null;
  supersetGroup?: string | null;
  progressionMode?: WorkoutProgressionMode;
  progressionIncrement?: number | null;
  progressionMinReps?: number | null;
  progressionMaxReps?: number | null;
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
           (id, routine_id, name, sort_order, catalog_exercise_id, modality, notes,
            superset_group, progression_mode, progression_increment, progression_min_reps,
            progression_max_reps, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          id,
          input.routineId,
          input.name,
          input.sortOrder ?? 0,
          input.catalogExerciseId ?? null,
          input.modality ?? 'timed',
          input.notes ?? null,
          input.supersetGroup ?? null,
          input.progressionMode ?? 'none',
          input.progressionIncrement ?? null,
          input.progressionMinReps ?? null,
          input.progressionMaxReps ?? null,
          now,
          now,
        ],
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
  targetRepsMin?: number | null;
  targetRepsMax?: number | null;
  targetLoad?: number | null;
  targetDurationSeconds?: number | null;
  targetDistance?: number | null;
  targetPace?: number | null;
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
      const hasPrescription =
        input.targetRepsMin !== undefined ||
        input.targetRepsMax !== undefined ||
        input.targetLoad !== undefined ||
        input.targetDurationSeconds !== undefined ||
        input.targetDistance !== undefined ||
        input.targetPace !== undefined;
      if (!hasPrescription) {
        await transactionDb.runAsync(
          `INSERT INTO routine_exercise_sets
           (id, exercise_id, set_number, active_seconds, rest_seconds,
            created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
          [id, input.exerciseId, input.setNumber, input.activeSeconds, input.restSeconds, now, now],
        );
      } else {
        await transactionDb.runAsync(
          `INSERT INTO routine_exercise_sets
           (id, exercise_id, set_number, active_seconds, rest_seconds,
            target_reps_min, target_reps_max, target_load, target_duration_seconds,
            target_distance, target_pace, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
          [
            id,
            input.exerciseId,
            input.setNumber,
            input.activeSeconds,
            input.restSeconds,
            input.targetRepsMin ?? null,
            input.targetRepsMax ?? null,
            input.targetLoad ?? null,
            input.targetDurationSeconds ?? null,
            input.targetDistance ?? null,
            input.targetPace ?? null,
            now,
            now,
          ],
        );
      }
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
  updates: {
    activeSeconds?: number;
    restSeconds?: number;
    targetRepsMin?: number | null;
    targetRepsMax?: number | null;
    targetLoad?: number | null;
    targetDurationSeconds?: number | null;
    targetDistance?: number | null;
    targetPace?: number | null;
  },
): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  const hasPrescriptionUpdate =
    updates.targetRepsMin !== undefined ||
    updates.targetRepsMax !== undefined ||
    updates.targetLoad !== undefined ||
    updates.targetDurationSeconds !== undefined ||
    updates.targetDistance !== undefined ||
    updates.targetPace !== undefined;
  if (
    updates.activeSeconds === undefined &&
    updates.restSeconds === undefined &&
    !hasPrescriptionUpdate
  )
    return;
  await runBackupMutation({
    db,
    mutate: async (transactionDb, enqueue) => {
      const activeSet = await transactionDb.getFirstAsync<{
        active_seconds: number;
        rest_seconds: number;
        target_reps_min: number | null;
        target_reps_max: number | null;
        target_load: number | null;
        target_duration_seconds: number | null;
        target_distance: number | null;
        target_pace: number | null;
        routine_id: string;
      }>(
        `SELECT s.active_seconds, s.rest_seconds, s.target_reps_min, s.target_reps_max,
                s.target_load, s.target_duration_seconds, s.target_distance, s.target_pace,
                e.routine_id
       FROM routine_exercise_sets s
       INNER JOIN routine_exercises e ON e.id = s.exercise_id AND e.deleted_at IS NULL
       INNER JOIN workout_routines r ON r.id = e.routine_id AND r.deleted_at IS NULL
       WHERE s.id = ? AND s.deleted_at IS NULL`,
        [id],
      );
      if (!activeSet) return { changed: false, value: undefined };
      // Read and validate the complete current set inside the serialized
      // mutation. Builder timing and prescription fields can be edited from
      // separate controls at nearly the same time; an outside read would let
      // the slower writer restore stale values from the other control.
      const nextActive = updates.activeSeconds ?? activeSet.active_seconds;
      const nextRest = updates.restSeconds ?? activeSet.rest_seconds;
      const timingErr = validateSetTiming(nextActive, nextRest);
      if (timingErr) throw new Error(timingErr);
      const update = hasPrescriptionUpdate
        ? await transactionDb.runAsync(
            `UPDATE routine_exercise_sets
           SET active_seconds = ?, rest_seconds = ?,
               target_reps_min = ?, target_reps_max = ?, target_load = ?,
               target_duration_seconds = ?, target_distance = ?, target_pace = ?,
               updated_at = ?
           WHERE id = ? AND deleted_at IS NULL`,
            [
              nextActive,
              nextRest,
              updates.targetRepsMin === undefined
                ? activeSet.target_reps_min
                : updates.targetRepsMin,
              updates.targetRepsMax === undefined
                ? activeSet.target_reps_max
                : updates.targetRepsMax,
              updates.targetLoad === undefined ? activeSet.target_load : updates.targetLoad,
              updates.targetDurationSeconds === undefined
                ? activeSet.target_duration_seconds
                : updates.targetDurationSeconds,
              updates.targetDistance === undefined
                ? activeSet.target_distance
                : updates.targetDistance,
              updates.targetPace === undefined ? activeSet.target_pace : updates.targetPace,
              now,
              id,
            ],
          )
        : await transactionDb.runAsync(
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
  weightUnit?: WorkoutWeightUnit | null;
  durationSeconds?: number | null;
  distance?: number | null;
  pace?: number | null;
  effortValue?: number | null;
  effortScale?: Exclude<WorkoutEffortScale, 'off'> | null;
};

export async function logWorkoutSession(input: {
  routineId: string;
  notes?: string;
  exercises: {
    exerciseName: string;
    setsCompleted: number;
    catalogExerciseId?: string | null;
    modality?: WorkoutModality;
    /** Per-set provenance rows persisted as workout_session_sets; omitted
     * when the caller has no per-set data (legacy shape still supported). */
    sets?: LoggedSessionSetInput[];
  }[];
  /** Wall-clock session start/end (ISO). NULL = untimed session. */
  startedAt?: string | null;
  endedAt?: string | null;
  /** Explicit active-time duration (whole seconds). When provided it overrides
   *  the wall-clock start→end derivation — used by resumed sessions, where
   *  wall-clock includes time the app was closed. Invalid values fall back to
   *  the derived duration. */
  activeDurationSeconds?: number | null;
}): Promise<void> {
  const db = await getDatabase();
  const logId = createId('wrk');
  const now = nowIso();
  const override = input.activeDurationSeconds;
  const durationSeconds =
    typeof override === 'number' && Number.isFinite(override) && override >= 0
      ? Math.round(override)
      : deriveDurationSeconds(input.startedAt ?? null, input.endedAt ?? null);

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
        if (ex.catalogExerciseId === undefined && ex.modality === undefined) {
          await transactionDb.runAsync(
            `INSERT INTO workout_session_exercises
               (id, log_id, exercise_name, sets_completed, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            [exId, logId, ex.exerciseName, ex.setsCompleted, now],
          );
        } else {
          await transactionDb.runAsync(
            `INSERT INTO workout_session_exercises
               (id, log_id, exercise_name, sets_completed, catalog_exercise_id, modality, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              exId,
              logId,
              ex.exerciseName,
              ex.setsCompleted,
              ex.catalogExerciseId ?? null,
              ex.modality ?? 'timed',
              now,
            ],
          );
        }
        enqueue({
          entity: 'workout_session_exercises',
          id: exId,
          updatedAt: now,
          operation: 'create',
        });
        for (const set of ex.sets ?? []) {
          const setId = createId('sset');
          const hasModalityData =
            set.weightUnit !== undefined ||
            set.durationSeconds !== undefined ||
            set.distance !== undefined ||
            set.pace !== undefined ||
            set.effortValue !== undefined ||
            set.effortScale !== undefined;
          if (!hasModalityData) {
            await transactionDb.runAsync(
              `INSERT INTO workout_session_sets
                 (id, session_exercise_id, set_number, weight, reps, weight_unit, completed, created_at)
               VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
              [setId, exId, set.setNumber, set.weight, set.reps, set.completed ? 1 : 0, now],
            );
          } else {
            await transactionDb.runAsync(
              `INSERT INTO workout_session_sets
                 (id, session_exercise_id, set_number, weight, reps, weight_unit, completed,
                  duration_seconds, distance, pace, effort_value, effort_scale, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                setId,
                exId,
                set.setNumber,
                set.weight,
                set.reps,
                set.weightUnit ?? null,
                set.completed ? 1 : 0,
                set.durationSeconds ?? null,
                set.distance ?? null,
                set.pace ?? null,
                set.effortValue ?? null,
                set.effortScale ?? null,
                now,
              ],
            );
          }
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
         id, name, description, goal_tag, created_at, updated_at, deleted_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.name,
        row.description,
        row.goal_tag ?? null,
        row.created_at,
        row.updated_at,
        row.deleted_at,
      ],
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
         id, routine_id, name, sort_order, catalog_exercise_id, modality, notes, superset_group,
         progression_mode, progression_increment, progression_min_reps, progression_max_reps,
         created_at, updated_at, deleted_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.routine_id,
        row.name,
        row.sort_order,
        row.catalog_exercise_id ?? null,
        row.modality ?? 'timed',
        row.notes ?? null,
        row.superset_group ?? null,
        row.progression_mode ?? 'none',
        row.progression_increment ?? null,
        row.progression_min_reps ?? null,
        row.progression_max_reps ?? null,
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
         target_reps_min, target_reps_max, target_load, target_duration_seconds,
         target_distance, target_pace, created_at, updated_at, deleted_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.exercise_id,
        row.set_number,
        row.active_seconds,
        row.rest_seconds,
        row.target_reps_min ?? null,
        row.target_reps_max ?? null,
        row.target_load ?? null,
        row.target_duration_seconds ?? null,
        row.target_distance ?? null,
        row.target_pace ?? null,
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
         started_at, ended_at, duration_seconds, routine_name
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        row.routine_name ?? null,
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
         completed, duration_seconds, distance, pace, effort_value, effort_scale, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.session_exercise_id,
        row.set_number,
        row.weight,
        row.reps,
        row.weight_unit,
        row.completed,
        row.duration_seconds ?? null,
        row.distance ?? null,
        row.pace ?? null,
        row.effort_value ?? null,
        row.effort_scale ?? null,
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
         id, log_id, exercise_name, sets_completed, catalog_exercise_id, modality, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.log_id,
        row.exercise_name,
        row.sets_completed,
        row.catalog_exercise_id ?? null,
        row.modality ?? 'timed',
        row.created_at,
      ],
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
  const rawExercises = await db.getAllAsync<WorkoutSessionExercise>(
    `SELECT * FROM workout_session_exercises
     WHERE log_id = ?
     ORDER BY created_at ASC, id ASC`,
    [logId],
  );
  // Migration 22 gives the new modality column a safe timed default. A
  // legacy free-text session has no catalog identity, however, and must stay
  // on the historic weight/reps interpretation for PRs and history display.
  const exercises = rawExercises.map((exercise) =>
    exercise.catalog_exercise_id ? exercise : { ...exercise, modality: undefined },
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
  // Prefer the immutable snapshot written with guided/quick logs. Legacy rows
  // have no snapshot and continue to fall back to the current routine name.
  return { log, routineName: log.routine_name ?? routine?.name ?? null, exercises, sets };
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
 * Newest-first per-set outcomes for progression. Unlike the entry-prefill
 * helper above, this deliberately keeps skipped and unknown sets so the
 * progression reducer can hold instead of mistaking incomplete work for a
 * successful session.
 */
export type RecentWorkoutSetOutcome = {
  logId: string;
  completedAt: string;
  exerciseName: string;
  setNumber: number;
  weight: number | null;
  weightUnit: WorkoutWeightUnit | null;
  reps: number | null;
  completed: 0 | 1;
};

export async function listRecentWorkoutSetOutcomes(
  limit = 500,
): Promise<RecentWorkoutSetOutcome[]> {
  const db = await getDatabase();
  return db.getAllAsync<RecentWorkoutSetOutcome>(
    `SELECT l.id AS logId,
            l.completed_at AS completedAt,
            e.exercise_name AS exerciseName,
            s.set_number AS setNumber,
            s.weight AS weight,
            s.weight_unit AS weightUnit,
            s.reps AS reps,
            s.completed AS completed
     FROM workout_session_sets s
     INNER JOIN workout_session_exercises e ON e.id = s.session_exercise_id
     INNER JOIN workout_logs l ON l.id = e.log_id
     ORDER BY l.completed_at DESC, s.created_at DESC, s.id DESC
     LIMIT ?`,
    [Math.max(1, Math.min(2_000, Math.floor(limit)))],
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
        'INSERT INTO workout_routines (id, name, description, goal_tag, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, NULL)',
        [newId, newName, source.description, source.goal_tag ?? null, now, now],
      );
      return { changed: true, value: undefined };
    },
  });

  for (const exercise of source.exercises) {
    const exerciseId = await addExercise({
      routineId: newId,
      name: exercise.name,
      sortOrder: exercise.sort_order,
      catalogExerciseId: exercise.catalog_exercise_id,
      modality: exercise.modality,
      notes: exercise.notes,
      supersetGroup: exercise.superset_group,
      progressionMode: exercise.progression_mode,
      progressionIncrement: exercise.progression_increment,
      progressionMinReps: exercise.progression_min_reps,
      progressionMaxReps: exercise.progression_max_reps,
    });
    for (const set of exercise.sets) {
      await addSet({
        exerciseId,
        setNumber: set.set_number,
        activeSeconds: set.active_seconds,
        restSeconds: set.rest_seconds,
        targetRepsMin: set.target_reps_min,
        targetRepsMax: set.target_reps_max,
        targetLoad: set.target_load,
        targetDurationSeconds: set.target_duration_seconds,
        targetDistance: set.target_distance,
        targetPace: set.target_pace,
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

/** In-progress session state persisted for resume after an app restart.
 *  Dispositions, entered weight/reps, and remaining seconds ride along so a
 *  resumed session replays exactly what was recorded before the restart.
 *  Drafts written before these fields existed (legacy shape) stay restorable:
 *  a resumed legacy draft reconstructs at the saved cursor with prior phases
 *  counted as completed and their measurements unrecorded. */
export type WorkoutSessionDraft = {
  routineId: string;
  /** ISO timestamp of the session's first Start press. */
  startedAtIso: string;
  /** Index into the routine's timer-phase sequence. */
  phaseIndex: number;
  /** Active-time seconds already elapsed when the draft was written. */
  elapsedAdjustSeconds?: number;
  /** Per-phase outcome keyed by stringified sequence index. */
  dispositions?: Record<string, 'completed' | 'skipped'>;
  /** Entered measurements keyed by stringified sequence index of each active phase. */
  enteredSets?: Record<
    string,
    {
      weight: string;
      reps: string;
      duration?: string;
      distance?: string;
      pace?: string;
      effort?: string;
    }
  >;
  /** Seconds left on the phase at `phaseIndex` when the draft was written. */
  remainingSeconds?: number;
};

type PhaseDispositionValue = 'completed' | 'skipped';

function normalizeDispositionMap(
  value: unknown,
): Record<string, PhaseDispositionValue> | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const out: Record<string, PhaseDispositionValue> = {};
  let any = false;
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if ((raw === 'completed' || raw === 'skipped') && key.length > 0) {
      out[key] = raw;
      any = true;
    }
  }
  return any ? out : undefined;
}

function normalizeEnteredSetMap(value: unknown):
  | Record<
      string,
      {
        weight: string;
        reps: string;
        duration?: string;
        distance?: string;
        pace?: string;
        effort?: string;
      }
    >
  | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const out: Record<
    string,
    {
      weight: string;
      reps: string;
      duration?: string;
      distance?: string;
      pace?: string;
      effort?: string;
    }
  > = {};
  let any = false;
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw !== 'object' || raw === null) continue;
    const entry = raw as Record<string, unknown>;
    if (typeof entry.weight === 'string' && typeof entry.reps === 'string' && key.length > 0) {
      out[key] = {
        weight: entry.weight,
        reps: entry.reps,
        ...(typeof entry.duration === 'string' ? { duration: entry.duration } : {}),
        ...(typeof entry.distance === 'string' ? { distance: entry.distance } : {}),
        ...(typeof entry.pace === 'string' ? { pace: entry.pace } : {}),
        ...(typeof entry.effort === 'string' ? { effort: entry.effort } : {}),
      };
      any = true;
    }
  }
  return any ? out : undefined;
}

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
  const dispositions = normalizeDispositionMap(candidate.dispositions);
  const enteredSets = normalizeEnteredSetMap(candidate.enteredSets);
  const remainingSeconds = candidate.remainingSeconds;
  return {
    routineId: candidate.routineId,
    startedAtIso: candidate.startedAtIso,
    phaseIndex: candidate.phaseIndex,
    ...(typeof elapsed === 'number' && Number.isFinite(elapsed) && elapsed >= 0
      ? { elapsedAdjustSeconds: Math.round(elapsed) }
      : {}),
    ...(dispositions ? { dispositions } : {}),
    ...(enteredSets ? { enteredSets } : {}),
    ...(typeof remainingSeconds === 'number' &&
    Number.isFinite(remainingSeconds) &&
    remainingSeconds >= 0
      ? { remainingSeconds: Math.round(remainingSeconds) }
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
    await enqueueBackupSettingsRecord(db);
  } catch {
    // Preference persistence is best-effort; the session keeps working.
  }
}

export async function applyRemoteCustomExercises(
  db: Awaited<ReturnType<typeof getDatabase>>,
  rows: CustomExercise[],
): Promise<void> {
  for (const row of rows) {
    await db.runAsync(
      `INSERT OR REPLACE INTO custom_exercises
       (id, name, description, primary_area, secondary_areas, equipment, modality, unilateral,
        created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.name,
        row.description,
        row.primary_area,
        row.secondary_areas,
        row.equipment,
        row.modality,
        row.unilateral,
        row.created_at,
        row.updated_at,
        row.deleted_at,
      ],
    );
  }
}

export async function applyRemoteWorkoutWeeklyPlan(
  db: Awaited<ReturnType<typeof getDatabase>>,
  rows: WorkoutWeeklyPlanEntry[],
): Promise<void> {
  for (const row of rows) {
    await db.runAsync(
      `INSERT OR REPLACE INTO workout_weekly_plan
       (id, weekday, routine_id, plan_kind, note, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.weekday,
        row.routine_id,
        row.plan_kind,
        row.note,
        row.created_at,
        row.updated_at,
        row.deleted_at,
      ],
    );
  }
}

export async function applyRemoteWorkoutScheduleOverrides(
  db: Awaited<ReturnType<typeof getDatabase>>,
  rows: WorkoutScheduleOverride[],
): Promise<void> {
  for (const row of rows) {
    await db.runAsync(
      `INSERT OR REPLACE INTO workout_schedule_overrides
       (id, date_key, override_kind, routine_id, moved_from_date_key, note,
        created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.date_key,
        row.override_kind,
        row.routine_id,
        row.moved_from_date_key,
        row.note,
        row.created_at,
        row.updated_at,
        row.deleted_at,
      ],
    );
  }
}

export async function applyRemoteBodyWeightEntries(
  db: Awaited<ReturnType<typeof getDatabase>>,
  rows: BodyWeightEntry[],
): Promise<void> {
  for (const row of rows) {
    await db.runAsync(
      `INSERT OR REPLACE INTO body_weight_entries
       (id, measured_on, measured_at, weight, unit, note, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.measured_on,
        row.measured_at,
        row.weight,
        row.unit,
        row.note,
        row.created_at,
        row.updated_at,
        row.deleted_at,
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Gym V2 identity, planning, body weight, and preference data.
// ---------------------------------------------------------------------------

export type CustomExerciseInput = {
  name: string;
  description?: string | null;
  primaryArea: string;
  secondaryAreas?: string[];
  equipment?: string | null;
  modality: WorkoutModality;
  unilateral?: boolean;
};

function normalizeSecondaryAreas(values: readonly string[] | undefined): string {
  return JSON.stringify(
    [...new Set((values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean))].slice(
      0,
      8,
    ),
  );
}

export type WorkoutPerformanceRow = {
  logId: string;
  completedAt: string;
  exerciseName: string;
  catalogExerciseId: string | null;
  modality: WorkoutModality | null;
  setNumber: number;
  weight: number | null;
  weightUnit: WorkoutWeightUnit | null;
  reps: number | null;
  completed: 0 | 1;
  durationSeconds: number | null;
  distance: number | null;
  pace: number | null;
  effortValue: number | null;
  effortScale: Exclude<WorkoutEffortScale, 'off'> | null;
};

/**
 * Bounded performance read model for Progress and exercise history. It keeps
 * analytics off the routine configuration path and includes skipped/unknown
 * sets so the UI can explain why a progression recommendation held.
 */
export async function listWorkoutPerformanceRows(limit = 5_000): Promise<WorkoutPerformanceRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<WorkoutPerformanceRow>(
    `SELECT l.id AS logId,
            l.completed_at AS completedAt,
            e.exercise_name AS exerciseName,
            e.catalog_exercise_id AS catalogExerciseId,
            CASE WHEN e.catalog_exercise_id IS NULL THEN NULL ELSE e.modality END AS modality,
            s.set_number AS setNumber,
            s.weight AS weight,
            s.weight_unit AS weightUnit,
            s.reps AS reps,
            s.completed AS completed,
            s.duration_seconds AS durationSeconds,
            s.distance AS distance,
            s.pace AS pace,
            s.effort_value AS effortValue,
            s.effort_scale AS effortScale
     FROM workout_session_sets s
     INNER JOIN workout_session_exercises e ON e.id = s.session_exercise_id
     INNER JOIN workout_logs l ON l.id = e.log_id
     ORDER BY l.completed_at DESC, s.created_at DESC, s.id DESC
     LIMIT ?`,
    [Math.max(1, Math.min(20_000, Math.floor(limit)))],
  );
}

function assertWorkoutModality(modality: string): asserts modality is WorkoutModality {
  if (!['weighted_strength', 'bodyweight', 'timed', 'cardio'].includes(modality)) {
    throw new Error('Unsupported workout exercise modality.');
  }
}

function assertWorkoutWeightUnit(unit: string): asserts unit is WorkoutWeightUnit {
  if (unit !== 'kg' && unit !== 'lb') throw new Error('Unsupported body-weight unit.');
}

export async function listCustomExercises(includeArchived = false): Promise<CustomExercise[]> {
  const db = await getDatabase();
  return db.getAllAsync<CustomExercise>(
    `SELECT * FROM custom_exercises ${includeArchived ? '' : 'WHERE deleted_at IS NULL'}
     ORDER BY name COLLATE NOCASE ASC, created_at ASC`,
  );
}

export async function createCustomExercise(input: CustomExerciseInput): Promise<string> {
  const name = input.name.trim();
  const primaryArea = input.primaryArea.trim().toLowerCase();
  if (!name) throw new Error('Exercise name is required.');
  if (!primaryArea) throw new Error('Primary body area is required.');
  assertWorkoutModality(input.modality);
  const db = await getDatabase();
  const id = createId('cex');
  const now = nowIso();
  await runBackupMutation({
    db,
    mutate: async (transactionDb, enqueue) => {
      await transactionDb.runAsync(
        `INSERT INTO custom_exercises
         (id, name, description, primary_area, secondary_areas, equipment, modality, unilateral,
          created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          id,
          name,
          input.description?.trim() || null,
          primaryArea,
          normalizeSecondaryAreas(input.secondaryAreas),
          input.equipment?.trim() || null,
          input.modality,
          input.unilateral ? 1 : 0,
          now,
          now,
        ],
      );
      enqueue({ entity: 'custom_exercises', id, updatedAt: now, operation: 'create' });
      return { changed: true, value: undefined };
    },
  });
  return id;
}

export async function updateCustomExercise(
  id: string,
  updates: Partial<CustomExerciseInput>,
): Promise<void> {
  const db = await getDatabase();
  const current = await db.getFirstAsync<CustomExercise>(
    'SELECT * FROM custom_exercises WHERE id = ? AND deleted_at IS NULL',
    [id],
  );
  if (!current) return;
  if (updates.modality) assertWorkoutModality(updates.modality);
  const nextName = updates.name?.trim() || current.name;
  const nextArea = updates.primaryArea?.trim().toLowerCase() || current.primary_area;
  const nextSecondary = updates.secondaryAreas
    ? normalizeSecondaryAreas(updates.secondaryAreas)
    : current.secondary_areas;
  const now = nowIso();
  await runBackupMutation({
    db,
    mutate: async (transactionDb, enqueue) => {
      const result = await transactionDb.runAsync(
        `UPDATE custom_exercises
         SET name = ?, description = ?, primary_area = ?, secondary_areas = ?, equipment = ?,
             modality = ?, unilateral = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [
          nextName,
          updates.description === undefined
            ? current.description
            : updates.description?.trim() || null,
          nextArea,
          nextSecondary,
          updates.equipment === undefined ? current.equipment : updates.equipment?.trim() || null,
          updates.modality ?? current.modality,
          updates.unilateral === undefined ? current.unilateral : updates.unilateral ? 1 : 0,
          now,
          id,
        ],
      );
      if (result.changes !== 1) return { changed: false, value: undefined };
      enqueue({ entity: 'custom_exercises', id, updatedAt: now, operation: 'update' });
      return { changed: true, value: undefined };
    },
  });
}

export async function archiveCustomExercise(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  await runBackupMutation({
    db,
    mutate: async (transactionDb, enqueue) => {
      const result = await transactionDb.runAsync(
        `UPDATE custom_exercises SET deleted_at = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [now, now, id],
      );
      if (result.changes !== 1) return { changed: false, value: undefined };
      enqueue({ entity: 'custom_exercises', id, updatedAt: now, operation: 'delete' });
      return { changed: true, value: undefined };
    },
  });
}

export type RoutineExerciseUpdate = Partial<{
  name: string;
  catalogExerciseId: string | null;
  modality: WorkoutModality;
  notes: string | null;
  supersetGroup: string | null;
  progressionMode: WorkoutProgressionMode;
  progressionIncrement: number | null;
  progressionMinReps: number | null;
  progressionMaxReps: number | null;
}>;

export async function updateExercise(id: string, updates: RoutineExerciseUpdate): Promise<void> {
  const db = await getDatabase();
  if (updates.modality) assertWorkoutModality(updates.modality);
  const now = nowIso();
  await runBackupMutation({
    db,
    mutate: async (transactionDb, enqueue) => {
      // Read the current row inside the same serialized mutation transaction.
      // Builder fields can update concurrently while a user types; reading
      // outside the transaction lets a slower stale write overwrite a newer
      // progression mode/prescription field.
      const current = await transactionDb.getFirstAsync<RoutineExercise>(
        `SELECT * FROM routine_exercises WHERE id = ? AND deleted_at IS NULL`,
        [id],
      );
      if (!current) return { changed: false, value: undefined };
      const result = await transactionDb.runAsync(
        `UPDATE routine_exercises
         SET name = ?, catalog_exercise_id = ?, modality = ?, notes = ?, superset_group = ?,
             progression_mode = ?, progression_increment = ?, progression_min_reps = ?,
             progression_max_reps = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [
          updates.name?.trim() || current.name,
          updates.catalogExerciseId === undefined
            ? (current.catalog_exercise_id ?? null)
            : updates.catalogExerciseId,
          updates.modality ?? current.modality ?? 'timed',
          updates.notes === undefined ? (current.notes ?? null) : updates.notes?.trim() || null,
          updates.supersetGroup === undefined
            ? (current.superset_group ?? null)
            : updates.supersetGroup?.trim() || null,
          updates.progressionMode ?? current.progression_mode ?? 'none',
          updates.progressionIncrement === undefined
            ? (current.progression_increment ?? null)
            : updates.progressionIncrement,
          updates.progressionMinReps === undefined
            ? (current.progression_min_reps ?? null)
            : updates.progressionMinReps,
          updates.progressionMaxReps === undefined
            ? (current.progression_max_reps ?? null)
            : updates.progressionMaxReps,
          now,
          id,
        ],
      );
      if (result.changes !== 1) return { changed: false, value: undefined };
      if (!(await touchWorkoutRoutine(transactionDb, current.routine_id, now))) {
        throw new Error('Routine was deleted while updating the exercise.');
      }
      enqueue({ entity: 'routine_exercises', id, updatedAt: now, operation: 'update' });
      enqueue({
        entity: 'workout_routines',
        id: current.routine_id,
        updatedAt: now,
        operation: 'update',
      });
      return { changed: true, value: undefined };
    },
  });
}

export type RoutineSetUpdate = Partial<{
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetLoad: number | null;
  targetDurationSeconds: number | null;
  targetDistance: number | null;
  targetPace: number | null;
}>;

export async function updateSetPrescription(id: string, updates: RoutineSetUpdate): Promise<void> {
  await updateSet(id, updates);
}

export async function listWeeklyPlan(): Promise<WorkoutWeeklyPlanEntry[]> {
  const db = await getDatabase();
  return db.getAllAsync<WorkoutWeeklyPlanEntry>(
    `SELECT * FROM workout_weekly_plan WHERE deleted_at IS NULL ORDER BY weekday ASC`,
  );
}

export async function upsertWeeklyPlanEntry(input: {
  weekday: number;
  routineId?: string | null;
  planKind: WorkoutPlanKind;
  note?: string | null;
}): Promise<void> {
  if (!Number.isInteger(input.weekday) || input.weekday < 1 || input.weekday > 7) {
    throw new Error('Weekday must be between Monday (1) and Sunday (7).');
  }
  if (input.planKind === 'workout' && !input.routineId) {
    throw new Error('A workout day needs a routine.');
  }
  const db = await getDatabase();
  const now = nowIso();
  await runBackupMutation({
    db,
    mutate: async (transactionDb, enqueue) => {
      if (input.routineId) {
        const routine = await transactionDb.getFirstAsync<{ id: string }>(
          'SELECT id FROM workout_routines WHERE id = ? AND deleted_at IS NULL',
          [input.routineId],
        );
        if (!routine) throw new Error('Routine not found.');
      }
      const selectedRoutineId = input.planKind === 'workout' ? (input.routineId ?? null) : null;
      const existing = await transactionDb.getFirstAsync<{ id: string }>(
        `SELECT id FROM workout_weekly_plan WHERE weekday = ? AND deleted_at IS NULL`,
        [input.weekday],
      );
      if (existing) {
        await transactionDb.runAsync(
          `UPDATE workout_weekly_plan SET routine_id = ?, plan_kind = ?, note = ?, updated_at = ?
           WHERE id = ? AND deleted_at IS NULL`,
          [selectedRoutineId, input.planKind, input.note ?? null, now, existing.id],
        );
        enqueue({
          entity: 'workout_weekly_plan',
          id: existing.id,
          updatedAt: now,
          operation: 'update',
        });
      } else {
        const id = createId('wplan');
        await transactionDb.runAsync(
          `INSERT INTO workout_weekly_plan
           (id, weekday, routine_id, plan_kind, note, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
          [id, input.weekday, selectedRoutineId, input.planKind, input.note ?? null, now, now],
        );
        enqueue({ entity: 'workout_weekly_plan', id, updatedAt: now, operation: 'create' });
      }
      return { changed: true, value: undefined };
    },
  });
  requestWorkoutReminderReconciliation();
}

export async function clearWeeklyPlanEntry(weekday: number): Promise<void> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM workout_weekly_plan WHERE weekday = ? AND deleted_at IS NULL',
    [weekday],
  );
  if (!row) return;
  const now = nowIso();
  await runBackupMutation({
    db,
    mutate: async (transactionDb, enqueue) => {
      const result = await transactionDb.runAsync(
        `UPDATE workout_weekly_plan SET deleted_at = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [now, now, row.id],
      );
      if (result.changes !== 1) return { changed: false, value: undefined };
      enqueue({ entity: 'workout_weekly_plan', id: row.id, updatedAt: now, operation: 'delete' });
      return { changed: true, value: undefined };
    },
  });
  requestWorkoutReminderReconciliation();
}

export async function listScheduleOverrides(): Promise<WorkoutScheduleOverride[]> {
  const db = await getDatabase();
  return db.getAllAsync<WorkoutScheduleOverride>(
    `SELECT * FROM workout_schedule_overrides WHERE deleted_at IS NULL ORDER BY date_key ASC`,
  );
}

export async function setWorkoutScheduleOverride(input: {
  dateKey: string;
  overrideKind: WorkoutPlanKind;
  routineId?: string | null;
  movedFromDateKey?: string | null;
  note?: string | null;
}): Promise<void> {
  if (!isValidDateKey(input.dateKey)) throw new Error('A valid date is required.');
  if (input.overrideKind === 'workout' && !input.routineId) {
    throw new Error('A workout override needs a routine.');
  }
  const db = await getDatabase();
  const now = nowIso();
  await runBackupMutation({
    db,
    mutate: async (transactionDb, enqueue) => {
      if (input.routineId) {
        const routine = await transactionDb.getFirstAsync<{ id: string }>(
          'SELECT id FROM workout_routines WHERE id = ? AND deleted_at IS NULL',
          [input.routineId],
        );
        if (!routine) throw new Error('Routine not found.');
      }
      const existing = await transactionDb.getFirstAsync<{ id: string }>(
        'SELECT id FROM workout_schedule_overrides WHERE date_key = ? AND deleted_at IS NULL',
        [input.dateKey],
      );
      const selectedRoutineId = input.overrideKind === 'workout' ? (input.routineId ?? null) : null;
      const values: (string | null)[] = [
        selectedRoutineId,
        input.overrideKind,
        input.movedFromDateKey ?? null,
        input.note ?? null,
        now,
      ];
      if (existing) {
        await transactionDb.runAsync(
          `UPDATE workout_schedule_overrides
           SET routine_id = ?, override_kind = ?, moved_from_date_key = ?, note = ?, updated_at = ?
           WHERE id = ? AND deleted_at IS NULL`,
          [...values, existing.id],
        );
        enqueue({
          entity: 'workout_schedule_overrides',
          id: existing.id,
          updatedAt: now,
          operation: 'update',
        });
      } else {
        const id = createId('wover');
        await transactionDb.runAsync(
          `INSERT INTO workout_schedule_overrides
           (id, date_key, override_kind, routine_id, moved_from_date_key, note, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
          [
            id,
            input.dateKey,
            input.overrideKind,
            selectedRoutineId,
            input.movedFromDateKey ?? null,
            input.note ?? null,
            now,
            now,
          ],
        );
        enqueue({ entity: 'workout_schedule_overrides', id, updatedAt: now, operation: 'create' });
      }
      return { changed: true, value: undefined };
    },
  });
  requestWorkoutReminderReconciliation();
}

function weekdayForDateKey(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return ((date.getDay() + 6) % 7) + 1;
}

export type ResolvedWorkoutSchedule = {
  dateKey: string;
  source: 'override' | 'weekly' | 'rest';
  planKind: WorkoutPlanKind;
  routineId: string | null;
  movedFromDateKey: string | null;
  note: string | null;
};

export async function resolveWorkoutScheduleForDate(
  dateKey: string,
): Promise<ResolvedWorkoutSchedule> {
  const db = await getDatabase();
  const override = await db.getFirstAsync<WorkoutScheduleOverride>(
    'SELECT * FROM workout_schedule_overrides WHERE date_key = ? AND deleted_at IS NULL',
    [dateKey],
  );
  if (override) {
    return {
      dateKey,
      source: 'override',
      planKind: override.override_kind,
      routineId: override.routine_id,
      movedFromDateKey: override.moved_from_date_key,
      note: override.note,
    };
  }
  const weekly = await db.getFirstAsync<WorkoutWeeklyPlanEntry>(
    'SELECT * FROM workout_weekly_plan WHERE weekday = ? AND deleted_at IS NULL',
    [weekdayForDateKey(dateKey)],
  );
  if (!weekly) {
    return {
      dateKey,
      source: 'rest',
      planKind: 'rest',
      routineId: null,
      movedFromDateKey: null,
      note: null,
    };
  }
  return {
    dateKey,
    source: 'weekly',
    planKind: weekly.plan_kind,
    routineId: weekly.routine_id,
    movedFromDateKey: null,
    note: weekly.note,
  };
}

export async function rescheduleWorkoutDate(input: {
  fromDateKey: string;
  toDateKey: string;
  routineId: string;
}): Promise<void> {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.fromDateKey) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.toDateKey)
  ) {
    throw new Error('A valid source and destination date are required.');
  }
  if (input.fromDateKey !== input.toDateKey) {
    await setWorkoutScheduleOverride({
      dateKey: input.fromDateKey,
      overrideKind: 'rest',
      movedFromDateKey: input.fromDateKey,
      note: `Moved to ${input.toDateKey}`,
    });
  }
  await setWorkoutScheduleOverride({
    dateKey: input.toDateKey,
    overrideKind: 'workout',
    routineId: input.routineId,
    movedFromDateKey: input.fromDateKey,
    note: `Moved from ${input.fromDateKey}`,
  });
}

export type WorkoutPreferences = {
  effortScale: WorkoutEffortScale;
  goalWeight: { value: number; unit: WorkoutWeightUnit } | null;
  workoutReminder: { enabled: boolean; time: { hour: number; minute: number } } | null;
};

const DEFAULT_WORKOUT_PREFERENCES: WorkoutPreferences = {
  effortScale: 'off',
  goalWeight: null,
  workoutReminder: null,
};

function normalizeWorkoutPreferences(value: unknown): WorkoutPreferences | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const effortScale: WorkoutEffortScale =
    candidate.effortScale === 'rir' || candidate.effortScale === 'rpe'
      ? candidate.effortScale
      : 'off';
  const rawGoal = candidate.goalWeight;
  const goal = rawGoal && typeof rawGoal === 'object' ? (rawGoal as Record<string, unknown>) : null;
  const goalUnit: WorkoutWeightUnit | null =
    goal?.unit === 'kg' ? 'kg' : goal?.unit === 'lb' ? 'lb' : null;
  const goalWeight =
    goal &&
    typeof goal.value === 'number' &&
    Number.isFinite(goal.value) &&
    goal.value > 0 &&
    goalUnit !== null
      ? { value: goal.value, unit: goalUnit }
      : null;
  const rawReminder = candidate.workoutReminder;
  const reminder =
    rawReminder && typeof rawReminder === 'object'
      ? (rawReminder as Record<string, unknown>)
      : null;
  const time =
    reminder?.time && typeof reminder.time === 'object'
      ? (reminder.time as Record<string, unknown>)
      : null;
  const workoutReminder =
    time &&
    typeof time.hour === 'number' &&
    typeof time.minute === 'number' &&
    Number.isInteger(time.hour) &&
    Number.isInteger(time.minute) &&
    time.hour >= 0 &&
    time.hour <= 23 &&
    time.minute >= 0 &&
    time.minute <= 59
      ? { enabled: reminder?.enabled === true, time: { hour: time.hour, minute: time.minute } }
      : null;
  return { effortScale, goalWeight, workoutReminder };
}

export async function getWorkoutPreferences(): Promise<WorkoutPreferences> {
  const db = await getDatabase();
  return getAppMetaJsonOrDefault(
    db,
    appMetaKeys.workoutPreferences,
    DEFAULT_WORKOUT_PREFERENCES,
    normalizeWorkoutPreferences,
  );
}

export async function saveWorkoutPreferences(preferences: WorkoutPreferences): Promise<void> {
  const db = await getDatabase();
  const normalized = normalizeWorkoutPreferences(preferences) ?? DEFAULT_WORKOUT_PREFERENCES;
  await setAppMetaJson(db, appMetaKeys.workoutPreferences, normalized);
  await enqueueBackupSettingsRecord(db);
  requestWorkoutReminderReconciliation();
}

export async function listBodyWeightEntries(limit = 90): Promise<BodyWeightEntry[]> {
  const db = await getDatabase();
  return db.getAllAsync<BodyWeightEntry>(
    `SELECT * FROM body_weight_entries WHERE deleted_at IS NULL
     ORDER BY measured_at DESC, id DESC LIMIT ?`,
    [Math.max(1, Math.min(500, Math.floor(limit)))],
  );
}

export async function addBodyWeightEntry(input: {
  weight: number;
  unit: WorkoutWeightUnit;
  measuredAt?: string;
  note?: string | null;
}): Promise<string> {
  if (!Number.isFinite(input.weight) || input.weight <= 0 || input.weight > 1_000) {
    throw new Error('Enter a body weight between 0 and 1,000.');
  }
  assertWorkoutWeightUnit(input.unit);
  const measuredAt =
    input.measuredAt && Number.isFinite(Date.parse(input.measuredAt)) ? input.measuredAt : nowIso();
  const db = await getDatabase();
  const id = createId('bw');
  const now = nowIso();
  await runBackupMutation({
    db,
    mutate: async (transactionDb, enqueue) => {
      await transactionDb.runAsync(
        `INSERT INTO body_weight_entries
         (id, measured_on, measured_at, weight, unit, note, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          id,
          toDateKey(new Date(measuredAt)),
          measuredAt,
          input.weight,
          input.unit,
          input.note?.trim() || null,
          now,
          now,
        ],
      );
      enqueue({ entity: 'body_weight_entries', id, updatedAt: now, operation: 'create' });
      return { changed: true, value: undefined };
    },
  });
  return id;
}

export async function updateBodyWeightEntry(
  id: string,
  updates: Partial<{
    weight: number;
    unit: WorkoutWeightUnit;
    measuredAt: string;
    note: string | null;
  }>,
): Promise<void> {
  const db = await getDatabase();
  const current = await db.getFirstAsync<BodyWeightEntry>(
    'SELECT * FROM body_weight_entries WHERE id = ? AND deleted_at IS NULL',
    [id],
  );
  if (!current) return;
  const measuredAt = updates.measuredAt ?? current.measured_at;
  const weight = updates.weight ?? current.weight;
  if (!Number.isFinite(weight) || weight <= 0 || weight > 1_000)
    throw new Error('Invalid body weight.');
  if (!Number.isFinite(Date.parse(measuredAt))) throw new Error('Invalid measurement time.');
  assertWorkoutWeightUnit(updates.unit ?? current.unit);
  const now = nowIso();
  await runBackupMutation({
    db,
    mutate: async (transactionDb, enqueue) => {
      await transactionDb.runAsync(
        `UPDATE body_weight_entries
         SET measured_on = ?, measured_at = ?, weight = ?, unit = ?, note = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [
          toDateKey(new Date(measuredAt)),
          measuredAt,
          weight,
          updates.unit ?? current.unit,
          updates.note === undefined ? current.note : updates.note?.trim() || null,
          now,
          id,
        ],
      );
      enqueue({ entity: 'body_weight_entries', id, updatedAt: now, operation: 'update' });
      return { changed: true, value: undefined };
    },
  });
}

export async function deleteBodyWeightEntry(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  await runBackupMutation({
    db,
    mutate: async (transactionDb, enqueue) => {
      const result = await transactionDb.runAsync(
        `UPDATE body_weight_entries SET deleted_at = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [now, now, id],
      );
      if (result.changes !== 1) return { changed: false, value: undefined };
      enqueue({ entity: 'body_weight_entries', id, updatedAt: now, operation: 'delete' });
      return { changed: true, value: undefined };
    },
  });
}
