import type { DailyPlanStatus } from '@/core/db/types';
import {
  DAILY_PLAN_STATUS_VALUES,
  ENERGY_SCORE_MAX,
  ENERGY_SCORE_MIN,
  FOCUS_TARGET_MAX_MINUTES,
  MAX_TOP_PRIORITIES,
} from '@/features/daily-plan/dailyPlan.types';

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
    const parsed = JSON.parse(raw);
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
