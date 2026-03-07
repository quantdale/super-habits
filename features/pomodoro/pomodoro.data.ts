import { getDatabase } from "@/core/db/client";
import { PomodoroSession } from "@/core/db/types";
import { createId } from "@/lib/id";
import { nowIso } from "@/lib/time";

export function logPomodoroSession(startedAt: string, endedAt: string, durationSeconds: number, type: "focus" | "break") {
  const id = createId("pomodoro");
  const createdAt = nowIso();
  getDatabase().runSync(
    "INSERT INTO pomodoro_sessions (id, started_at, ended_at, duration_seconds, session_type, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [id, startedAt, endedAt, durationSeconds, type, createdAt],
  );
}

export function listPomodoroSessions(limit = 20): PomodoroSession[] {
  return getDatabase().getAllSync<PomodoroSession>(
    "SELECT * FROM pomodoro_sessions ORDER BY started_at DESC LIMIT ?",
    [limit],
  );
}
