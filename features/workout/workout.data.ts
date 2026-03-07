import { getDatabase } from "@/core/db/client";
import { WorkoutLog, WorkoutRoutine } from "@/core/db/types";
import { createId } from "@/lib/id";
import { nowIso } from "@/lib/time";
import { syncEngine } from "@/core/sync/sync.engine";

export function listRoutines(): WorkoutRoutine[] {
  return getDatabase().getAllSync<WorkoutRoutine>(
    "SELECT * FROM workout_routines WHERE deleted_at IS NULL ORDER BY created_at DESC",
  );
}

export function addRoutine(name: string, description: string) {
  const id = createId("workout_routine");
  const now = nowIso();
  getDatabase().runSync(
    "INSERT INTO workout_routines (id, name, description, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, NULL)",
    [id, name, description || null, now, now],
  );
  syncEngine.enqueue({ entity: "workout_routines", id, updatedAt: now, operation: "create" });
}

export function completeRoutine(routineId: string, notes?: string) {
  const id = createId("workout_log");
  const now = nowIso();
  getDatabase().runSync(
    "INSERT INTO workout_logs (id, routine_id, notes, completed_at, created_at) VALUES (?, ?, ?, ?, ?)",
    [id, routineId, notes ?? null, now, now],
  );
}

export function listWorkoutLogs(limit = 12): WorkoutLog[] {
  return getDatabase().getAllSync<WorkoutLog>(
    "SELECT * FROM workout_logs ORDER BY completed_at DESC LIMIT ?",
    [limit],
  );
}

export function deleteRoutine(routineId: string) {
  const now = nowIso();
  getDatabase().runSync("UPDATE workout_routines SET deleted_at = ?, updated_at = ? WHERE id = ?", [
    now,
    now,
    routineId,
  ]);
  syncEngine.enqueue({ entity: "workout_routines", id: routineId, updatedAt: now, operation: "delete" });
}
