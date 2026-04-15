import type { PomodoroSession } from "./types";
import type { HeatmapDay } from "@/features/shared/activityTypes";
import { buildDateRangeOldestFirst, timestampToLocalDateKey } from "@/lib/time";

export type PomodoroState = "idle" | "running" | "finished";

export type PomodoroMode = "focus" | "short_break" | "long_break";

export type PomodoroSettings = {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
};

export const DEFAULT_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
};

/** Kept for backward compatibility with existing tests */
export const FOCUS_SECONDS = DEFAULT_SETTINGS.focusMinutes * 60;

/**
 * Get duration in seconds for a given mode and settings.
 */
export function getModeDuration(mode: PomodoroMode, settings: PomodoroSettings): number {
  switch (mode) {
    case "focus":
      return settings.focusMinutes * 60;
    case "short_break":
      return settings.shortBreakMinutes * 60;
    case "long_break":
      return settings.longBreakMinutes * 60;
  }
}

/**
 * Get the next mode in the classic Pomodoro sequence.
 *
 * completedFocusSessions: how many focus sessions have been
 * completed in the current cycle (resets after long break).
 *
 * Sequence:
 *   focus(1) → short_break → focus(2) → short_break →
 *   focus(3) → short_break → focus(4) → long_break → repeat
 */
export function getNextMode(
  currentMode: PomodoroMode,
  completedFocusSessions: number,
  settings: PomodoroSettings,
): PomodoroMode {
  if (currentMode === "short_break" || currentMode === "long_break") {
    return "focus";
  }
  // currentMode === "focus"
  // Guard: at least one session must be completed before
  // a long break can be suggested (0 % N === 0 for all N).
  if (
    completedFocusSessions > 0 &&
    completedFocusSessions % settings.sessionsBeforeLongBreak === 0
  ) {
    return "long_break";
  }
  return "short_break";
}

export function getModeLabel(mode: PomodoroMode): string {
  switch (mode) {
    case "focus":
      return "Focus";
    case "short_break":
      return "Short Break";
    case "long_break":
      return "Long Break";
  }
}

/**
 * Returns a Tailwind color class prefix for each mode.
 * Used to tint the timer display and progress bar.
 */
export function getModeColor(mode: PomodoroMode): { bg: string; text: string; bar: string } {
  switch (mode) {
    case "focus":
      return { bg: "bg-brand-500", text: "text-brand-500", bar: "bg-brand-500" };
    case "short_break":
      return { bg: "bg-emerald-500", text: "text-emerald-500", bar: "bg-emerald-500" };
    case "long_break":
      return { bg: "bg-violet-500", text: "text-violet-500", bar: "bg-violet-500" };
  }
}

/**
 * Parse "MM:SS" string into { minutes, seconds }.
 * Returns null for invalid input.
 */
export function parseMinutesSeconds(input: string): { minutes: number; seconds: number } | null {
  const parts = input.split(":");
  if (parts.length !== 2) return null;
  const m = parseInt(parts[0], 10);
  const s = parseInt(parts[1], 10);
  if (!Number.isFinite(m) || !Number.isFinite(s) || m < 0 || s < 0 || s > 59) return null;
  return { minutes: m, seconds: s };
}

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
  totalSeconds: number = DEFAULT_SETTINGS.focusMinutes * 60,
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
 * Format completed session length for the garden grid (e.g. "25m", "45s").
 */
export function formatSessionDuration(seconds: number): string {
  if (seconds >= 60) return `${Math.round(seconds / 60)}m`;
  return `${seconds}s`;
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

export function buildPomodoroHeatmapDays(
  sessions: PomodoroSession[],
  days: number = 364,
): HeatmapDay[] {
  const map = new Map<string, number>();
  for (const s of sessions) {
    const key = timestampToLocalDateKey(s.started_at);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return buildDateRangeOldestFirst(days).map((dateKey) => {
    const count = map.get(dateKey) ?? 0;
    return {
      dateKey,
      value: count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : 3,
    };
  });
}

/** Consecutive days with activity, counting from today backward (uses heatmap values). */
export function computePomodoroStreakFromHeatmapDays(heatmapDays: HeatmapDay[]): number {
  if (heatmapDays.length === 0) return 0;
  let streak = 0;
  for (let i = heatmapDays.length - 1; i >= 0; i--) {
    if (heatmapDays[i].value > 0) streak++;
    else break;
  }
  return streak;
}
