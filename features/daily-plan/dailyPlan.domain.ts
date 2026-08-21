import type { DailyPlanStatus } from '@/core/db/types';
import { dateKeyToLocalDate } from '@/lib/time';
import {
  DAILY_PLAN_STATUS_VALUES,
  ENERGY_SCORE_MAX,
  ENERGY_SCORE_MIN,
  FOCUS_TARGET_MAX_MINUTES,
  MAX_TOP_PRIORITIES,
} from '@/features/daily-plan/dailyPlan.types';

// ---------- carry-forward ----------

/**
 * Compute the Todo IDs worth carrying forward from a previous day's plan.
 *
 * A candidate is a previous-plan priority that is still unfinished and not
 * already selected in the current plan. Pure and idempotent: running it twice
 * (or applying its output twice) yields no additional items because existing
 * selections are always filtered out. Output preserves previous-plan order and
 * is bounded so that current + carried never exceeds MAX_TOP_PRIORITIES.
 */
export function computeCarryForwardIds(input: {
  previousPlanTopTodoIds: string[];
  currentPlanTopTodoIds: string[];
  /** Returns true when the todo is still open (not completed, not deleted). */
  isTodoUnfinished: (todoId: string) => boolean;
}): string[] {
  const current = new Set(input.currentPlanTopTodoIds);
  const capacity = Math.max(0, MAX_TOP_PRIORITIES - input.currentPlanTopTodoIds.length);
  const result: string[] = [];
  for (const todoId of input.previousPlanTopTodoIds) {
    if (result.length >= capacity) break;
    if (current.has(todoId)) continue;
    if (!input.isTodoUnfinished(todoId)) continue;
    current.add(todoId);
    result.push(todoId);
  }
  return result;
}

// ---------- adherence streaks ----------

export type DailyPlanAdherence = {
  /** Consecutive days (ending today or yesterday) whose plan reached at least 'committed'. */
  committedStreak: number;
  /** Consecutive days (ending today or yesterday) whose plan reached 'completed'. */
  completedStreak: number;
};

/** Shift a date key by whole local-calendar days (DST-safe via local midnight). */
export function shiftDateKeyByDays(dateKey: string, days: number): string {
  const d = dateKeyToLocalDate(dateKey);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const shiftDateKey = shiftDateKeyByDays;

/**
 * Count adherence streaks over a sparse set of plans (missing days break the
 * streak). Today is only counted once its plan actually has the status — an
 * uncommitted today does not zero out yesterday's streak.
 */
export function computeAdherenceStreaks(
  plans: { date_key: string; status: DailyPlanStatus }[],
  todayKey: string,
): DailyPlanAdherence {
  const byDate = new Map<string, DailyPlanStatus>();
  for (const p of plans) byDate.set(p.date_key, p.status);

  const countStreak = (predicate: (status: DailyPlanStatus) => boolean): number => {
    let streak = 0;
    // Allow today to be missing/uncommitted without breaking the run.
    let cursor = shiftDateKey(todayKey, -1);
    for (let i = 0; i < 366; i++) {
      const status = byDate.get(cursor);
      if (!status || !predicate(status)) break;
      streak++;
      cursor = shiftDateKey(cursor, -1);
    }
    return streak;
  };

  let committedStreak = countStreak((s) => s === 'committed' || s === 'completed');
  if (byDate.get(todayKey) === 'committed' || byDate.get(todayKey) === 'completed') {
    committedStreak += 1;
  }
  let completedStreak = countStreak((s) => s === 'completed');
  if (byDate.get(todayKey) === 'completed') completedStreak += 1;

  return { committedStreak, completedStreak };
}

export function isDailyPlanStatus(value: string | undefined | null): value is DailyPlanStatus {
  return !!value && (DAILY_PLAN_STATUS_VALUES as readonly string[]).includes(value);
}

/**
 * Parse the stored `top_todo_ids` JSON into a deduped, length-bounded list of
 * Todo IDs. Always returns a valid array; malformed storage degrades to [].
 */
export function parseTopTodoIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of parsed) {
      if (typeof item !== 'string') continue;
      if (seen.has(item)) continue;
      seen.add(item);
      result.push(item);
      if (result.length >= MAX_TOP_PRIORITIES) break;
    }
    return result;
  } catch {
    return [];
  }
}

export function serializeTopTodoIds(ids: string[]): string {
  const seen = new Set<string>();
  const deduped = ids.filter((id) => {
    if (typeof id !== 'string' || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return JSON.stringify(deduped.slice(0, MAX_TOP_PRIORITIES));
}

/** Add a Todo to the top-priority set, preserving selection order; no-op if already present. */
export function addTopTodoId(current: string[], todoId: string): string[] {
  if (current.includes(todoId)) return current;
  return [...current, todoId].slice(0, MAX_TOP_PRIORITIES);
}

export function removeTopTodoId(current: string[], todoId: string): string[] {
  return parseTopTodoIds(serializeTopTodoIds(current.filter((id) => id !== todoId)));
}

export function toggleTopTodoId(current: string[], todoId: string): string[] {
  return current.includes(todoId)
    ? removeTopTodoId(current, todoId)
    : addTopTodoId(current, todoId);
}

export function clampFocusTargetMinutes(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(FOCUS_TARGET_MAX_MINUTES, Math.round(value)));
}

export function normalizeEnergyScore(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < ENERGY_SCORE_MIN || rounded > ENERGY_SCORE_MAX) return null;
  return rounded;
}

export function clampText(value: string | null | undefined, max: number): string {
  if (!value) return '';
  return value.length > max ? value.slice(0, max) : value;
}
