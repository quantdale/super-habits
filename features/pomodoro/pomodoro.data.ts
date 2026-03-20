import { getDatabase } from "@/core/db/client";
import { PomodoroSession } from "@/core/db/types";
import { createId } from "@/lib/id";
import { nowIso } from "@/lib/time";

export async function logPomodoroSession(
  startedAt: string,
  endedAt: string,
  durationSeconds: number,
  type: "focus" | "break",
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
