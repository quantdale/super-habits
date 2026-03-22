import { getDatabase } from "@/core/db/client";
import {
  RoutineExercise,
  RoutineExerciseSet,
  WorkoutLog,
  WorkoutRoutine,
} from "@/core/db/types";
import { createId } from "@/lib/id";
import { nowIso } from "@/lib/time";
import { syncEngine } from "@/core/sync/sync.engine";

export async function listRoutines(): Promise<WorkoutRoutine[]> {
  const db = await getDatabase();
  return db.getAllAsync<WorkoutRoutine>(
    "SELECT * FROM workout_routines WHERE deleted_at IS NULL ORDER BY created_at DESC",
  );
}

export async function addRoutine(name: string, description: string): Promise<void> {
  const id = createId("wrk");
  const now = nowIso();
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO workout_routines (id, name, description, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, NULL)",
    [id, name, description || null, now, now],
  );
  syncEngine.enqueue({ entity: "workout_routines", id, updatedAt: now, operation: "create" });
}

export async function completeRoutine(routineId: string, notes?: string): Promise<void> {
  const id = createId("wrk");
  const now = nowIso();
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO workout_logs (id, routine_id, notes, completed_at, created_at) VALUES (?, ?, ?, ?, ?)",
    [id, routineId, notes ?? null, now, now],
  );
}

export async function listWorkoutLogs(limit = 12): Promise<WorkoutLog[]> {
  const db = await getDatabase();
  return db.getAllAsync<WorkoutLog>(
    "SELECT * FROM workout_logs ORDER BY completed_at DESC LIMIT ?",
    [limit],
  );
}

export async function deleteRoutine(routineId: string): Promise<void> {
  const now = nowIso();
  const db = await getDatabase();
  await db.runAsync("UPDATE workout_routines SET deleted_at = ?, updated_at = ? WHERE id = ?", [
    now,
    now,
    routineId,
  ]);
  syncEngine.enqueue({ entity: "workout_routines", id: routineId, updatedAt: now, operation: "delete" });
}

// --- Exercises ---

export async function addExercise(input: {
  routineId: string;
  name: string;
  sortOrder?: number;
}): Promise<string> {
  const db = await getDatabase();
  const id = createId("ex");
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO routine_exercises
       (id, routine_id, name, sort_order, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    [id, input.routineId, input.name, input.sortOrder ?? 0, now, now],
  );
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
  await db.runAsync(
    `UPDATE routine_exercises
     SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [now, now, id],
  );
  await db.runAsync(
    `UPDATE routine_exercise_sets
     SET deleted_at = ?, updated_at = ? WHERE exercise_id = ?`,
    [now, now, id],
  );
}

export async function updateExerciseOrder(orderedIds: string[]): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  for (let i = 0; i < orderedIds.length; i++) {
    await db.runAsync(
      `UPDATE routine_exercises
       SET sort_order = ?, updated_at = ? WHERE id = ?`,
      [i + 1, now, orderedIds[i]],
    );
  }
}

// --- Sets ---

export async function addSet(input: {
  exerciseId: string;
  setNumber: number;
  activeSeconds: number;
  restSeconds: number;
}): Promise<string> {
  const db = await getDatabase();
  const id = createId("eset");
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO routine_exercise_sets
       (id, exercise_id, set_number, active_seconds, rest_seconds,
        created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
    [
      id,
      input.exerciseId,
      input.setNumber,
      input.activeSeconds,
      input.restSeconds,
      now,
      now,
    ],
  );
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
  const now = nowIso();
  if (updates.activeSeconds !== undefined) {
    await db.runAsync(
      `UPDATE routine_exercise_sets
       SET active_seconds = ?, updated_at = ? WHERE id = ?`,
      [updates.activeSeconds, now, id],
    );
  }
  if (updates.restSeconds !== undefined) {
    await db.runAsync(
      `UPDATE routine_exercise_sets
       SET rest_seconds = ?, updated_at = ? WHERE id = ?`,
      [updates.restSeconds, now, id],
    );
  }
}

export async function deleteSet(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  await db.runAsync(
    `UPDATE routine_exercise_sets
     SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [now, now, id],
  );
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
  exercises: Array<RoutineExercise & { sets: RoutineExerciseSet[] }>;
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
  exercises: Array<{ exerciseName: string; setsCompleted: number }>;
}): Promise<void> {
  const db = await getDatabase();
  const logId = createId("wrk");
  const now = nowIso();

  await db.runAsync(
    `INSERT INTO workout_logs
       (id, routine_id, notes, completed_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [logId, input.routineId, input.notes ?? null, now, now],
  );

  for (const ex of input.exercises) {
    const exId = createId("wsex");
    await db.runAsync(
      `INSERT INTO workout_session_exercises
         (id, log_id, exercise_name, sets_completed, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [exId, logId, ex.exerciseName, ex.setsCompleted, now],
    );
  }
}
