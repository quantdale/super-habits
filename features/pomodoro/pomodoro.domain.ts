import type { PomodoroSession } from "./types";
import type { ActivityDay } from "@/features/shared/ActivityPreviewStrip";

function buildDateRange(days: number): string[] {
  const result: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    result.push(`${y}-${m}-${dd}`);
  }
  return result;
}

export type PomodoroState = "idle" | "running" | "finished";

export const FOCUS_SECONDS = 25 * 60;

export function nextPomodoroState(remainingSeconds: number, isRunning: boolean): PomodoroState {
  if (remainingSeconds <= 0) return "finished";
  if (isRunning) return "running";
  return "idle";
}

/**
 * Returns a 0–1 growth value based on how much of the session
 * has elapsed. 0 = just started (seedling), 1 = fully grown.
 *
 * Uses elapsed time rather than remaining so the plant grows
 * forward, not shrinks — more satisfying visually.
 */
export function calculateGrowthProgress(
  remainingSeconds: number,
  totalSeconds: number = FOCUS_SECONDS,
): number {
  if (totalSeconds <= 0) return 0;
  const elapsed = totalSeconds - remainingSeconds;
  return Math.min(1, Math.max(0, elapsed / totalSeconds));
}

export type PlantStage =
  | "seed" // 0–10% — small bump in soil
  | "sprout" // 10–35% — first shoot appears
  | "seedling" // 35–65% — small plant with leaves
  | "growing" // 65–90% — taller plant
  | "grown"; // 90–100% — full plant

export function getPlantStage(progress: number): PlantStage {
  if (progress < 0.1) return "seed";
  if (progress < 0.35) return "sprout";
  if (progress < 0.65) return "seedling";
  if (progress < 0.9) return "growing";
  return "grown";
}

/**
 * Format a pomodoro session for display in the garden grid tooltip.
 * Returns "Today 14:30" or "Mar 21 09:15".
 */
export function formatSessionTime(startedAt: string): string {
  const date = new Date(startedAt);
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  const time = date.toLocaleTimeString("en", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (isToday) return `Today ${time}`;
  return (
    date.toLocaleDateString("en", {
      month: "short",
      day: "numeric",
    }) + ` ${time}`
  );
}

/**
 * Build ActivityDay array from pomodoro sessions.
 * A day is "active" if at least one session was completed.
 */
export function buildPomodoroActivityDays(
  sessions: PomodoroSession[],
  days: number = 30,
): ActivityDay[] {
  const set = new Set<string>();
  for (const s of sessions) {
    const d = new Date(s.started_at);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    set.add(`${y}-${m}-${dd}`);
  }
  return buildDateRange(days).map((dateKey) => ({
    dateKey,
    active: set.has(dateKey),
  }));
}
