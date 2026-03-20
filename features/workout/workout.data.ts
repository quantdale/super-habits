import { getDatabase } from "@/core/db/client";
import { WorkoutLog, WorkoutRoutine } from "@/core/db/types";
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
