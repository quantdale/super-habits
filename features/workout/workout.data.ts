import { getDatabase } from '@/core/db/client';
import { withSQLiteTransaction } from '@/core/db/transactions';
import { RoutineExercise, RoutineExerciseSet, WorkoutLog, WorkoutRoutine } from '@/core/db/types';
import { claimOwnerBindingOnFirstContent } from '@/core/auth/account.data';
import type { LinkedActionEffectAdapterResult } from '@/core/linked-actions/linkedActions.types';
import {
  deleteLinkedActionRulesForTargetEntity,
  replaceLinkedActionRulesForSourceEntity,
} from '@/core/linked-actions/linkedActions.data';
import { createId } from '@/lib/id';
import { getUtcIsoRangeForLocalDateKeys, nowIso } from '@/lib/time';
import { runSyncedMutation } from '@/core/sync/syncedMutation';
import { validateSetTiming } from '@/lib/validation';

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

async function insertWorkoutLogRecord(input: {
  db: Awaited<ReturnType<typeof getDatabase>>;
  logId: string;
  routineId: string;
  notes: string | null;
  completedAtIso: string;
  createdAtIso: string;
  requireActiveRoutine: boolean;
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
      `INSERT INTO workout_logs (id, routine_id, notes, completed_at, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [input.logId, input.routineId, input.notes, input.completedAtIso, input.createdAtIso],
    );
    // Workout history is meaningful user content: it durably claims the
    // dataset for the current anonymous owner.
    await claimOwnerBindingOnFirstContent(input.db);
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
    mutate: async (transactionDb) => {
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

  return withSQLiteTransaction(db, async (transactionDb) => {
    return insertWorkoutLogRecord({
      db: transactionDb,
      logId,
      routineId,
      notes: notes ?? null,
      completedAtIso: now,
      createdAtIso: now,
      requireActiveRoutine: true,
    });
  });
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
    mutate: async (transactionDb) => {
      const result = await transactionDb.runAsync(
        'UPDATE workout_routines SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
        [now, now, routineId],
      );
      if (result.changes === 0) return { changed: false, value: undefined };

      // Configuration children are tombstoned with their parent. Historical
      // workout logs intentionally remain so past sessions keep their audit
      // trail after a routine is removed.
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
      await replaceLinkedActionRulesForSourceEntity({
        feature: 'workout',
        entityType: 'workout_routine',
        entityId: routineId,
        rules: [],
        db: transactionDb,
      });
      await deleteLinkedActionRulesForTargetEntity({
        feature: 'workout',
        entityType: 'workout_routine',
        entityId: routineId,
        deletedAt: now,
        db: transactionDb,
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
  await runSyncedMutation({
    db,
    record: {
      entity: 'workout_routines',
      id: input.routineId,
      updatedAt: now,
      operation: 'update',
    },
    mutate: async (transactionDb) => {
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
  await runSyncedMutation({
    db,
    record: { entity: 'workout_routines', id: row.routine_id, updatedAt: now, operation: 'update' },
    mutate: async (transactionDb) => {
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
  await runSyncedMutation({
    db,
    record: {
      entity: 'workout_routines',
      id: first.routine_id,
      updatedAt: now,
      operation: 'update',
    },
    mutate: async (transactionDb) => {
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
  await runSyncedMutation({
    db,
    record: {
      entity: 'workout_routines',
      id: exRow.routine_id,
      updatedAt: now,
      operation: 'update',
    },
    mutate: async (transactionDb) => {
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
  await runSyncedMutation({
    db,
    record: {
      entity: 'workout_routines',
      id: setRow.routine_id,
      updatedAt: now,
      operation: 'update',
    },
    mutate: async (transactionDb) => {
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
  await runSyncedMutation({
    db,
    record: {
      entity: 'workout_routines',
      id: setRow.routine_id,
      updatedAt: now,
      operation: 'update',
    },
    mutate: async (transactionDb) => {
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
  await addSet({
    exerciseId,
    setNumber: nextNumber,
    activeSeconds: 40,
    restSeconds: 20,
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

export async function logWorkoutSession(input: {
  routineId: string;
  notes?: string;
  exercises: { exerciseName: string; setsCompleted: number }[];
}): Promise<void> {
  const db = await getDatabase();
  const logId = createId('wrk');
  const now = nowIso();

  await withSQLiteTransaction(db, async (transactionDb) => {
    const record = await insertWorkoutLogRecord({
      db: transactionDb,
      logId,
      routineId: input.routineId,
      notes: input.notes ?? null,
      completedAtIso: now,
      createdAtIso: now,
      requireActiveRoutine: true,
    });

    if (record.status !== 'applied') return;

    for (const ex of input.exercises) {
      const exId = createId('wsex');
      await transactionDb.runAsync(
        `INSERT INTO workout_session_exercises
           (id, log_id, exercise_name, sets_completed, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [exId, logId, ex.exerciseName, ex.setsCompleted, now],
      );
    }
  });
}

export async function logWorkoutFromLinkedAction(input: {
  id: string;
  routineId: string;
  notes?: string | null;
}): Promise<LinkedActionEffectAdapterResult> {
  const db = await getDatabase();
  const now = nowIso();
  const record = await withSQLiteTransaction(db, (transactionDb) =>
    insertWorkoutLogRecord({
      db: transactionDb,
      logId: input.id,
      routineId: input.routineId,
      notes: input.notes ?? null,
      completedAtIso: now,
      createdAtIso: now,
      requireActiveRoutine: true,
    }),
  );

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
