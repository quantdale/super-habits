import type { HabitCompletion } from './types';
import type { HabitLifecycleInterval, HabitLifecycleStatus } from '@/core/db/types';
import type { HeatmapDay } from '@/features/shared/activityTypes';
import { computeStreakRun, type StreakRunDay } from './habitStreak.domain';
import {
  buildDateRangeOldestFirst,
  dateKeyToLocalDate,
  timestampToLocalDateKey,
  toDateKey,
} from '@/lib/time';

export type HabitWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const ALL_HABIT_WEEKDAYS: readonly HabitWeekday[] = [1, 2, 3, 4, 5, 6, 7];
export const WEEKDAY_HABIT_WEEKDAYS: readonly HabitWeekday[] = [1, 2, 3, 4, 5];
export const WEEKEND_HABIT_WEEKDAYS: readonly HabitWeekday[] = [6, 7];

export type HabitSchedulePreset = 'every_day' | 'weekdays' | 'weekends' | 'custom';

export type HabitRule = {
  effective_from_date: string;
  weekdays: HabitWeekday[];
  target_per_day: number;
};

export type HabitRuleHistoryInput = HabitRule[] | string | null | undefined;

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isHabitWeekday(value: number): value is HabitWeekday {
  return Number.isInteger(value) && value >= 1 && value <= 7;
}

export function normalizeHabitWeekdays(values: readonly number[]): HabitWeekday[] {
  return [...new Set(values.filter(isHabitWeekday))].sort((a, b) => a - b);
}

export function createHabitRule(
  effectiveFromDate: string,
  weekdays: readonly number[],
  targetPerDay: number,
): HabitRule {
  const normalizedWeekdays = normalizeHabitWeekdays(weekdays);
  if (!isDateKey(effectiveFromDate)) {
    throw new Error(`Invalid habit rule effective date: ${effectiveFromDate}`);
  }
  if (normalizedWeekdays.length === 0) {
    throw new Error('A habit schedule must include at least one weekday.');
  }
  if (!Number.isInteger(targetPerDay) || targetPerDay <= 0) {
    throw new Error('A habit target must be a positive integer.');
  }
  return {
    effective_from_date: effectiveFromDate,
    weekdays: normalizedWeekdays,
    target_per_day: targetPerDay,
  };
}

function normalizeRule(value: unknown): HabitRule | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<HabitRule>;
  if (typeof candidate.effective_from_date !== 'string') return null;
  if (!Array.isArray(candidate.weekdays)) return null;
  if (typeof candidate.target_per_day !== 'number') return null;
  try {
    return createHabitRule(
      candidate.effective_from_date,
      candidate.weekdays,
      candidate.target_per_day,
    );
  } catch {
    return null;
  }
}

/**
 * Bounded memo for serialized histories.
 *
 * A 364-day grid resolves a rule and the lifecycle mask for every cell, and
 * every resolution used to `JSON.parse` the same serialized history again
 * (~364 parses per habit per refresh). Histories are immutable values: a
 * write serializes a NEW string, so the raw string is a safe cache key — a
 * change produces a new key instead of a stale hit, and no invalidation is
 * needed. The cache is bounded because a long session could otherwise retain
 * every historical variant it ever read.
 */
const PARSED_HISTORY_CACHE_LIMIT = 64;
const ruleHistoryCache = new Map<string, HabitRule[]>();
const lifecycleHistoryCache = new Map<string, HabitLifecycleInterval[]>();

function memoized<T>(cache: Map<string, T>, key: string, parse: () => T): T {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const parsed = parse();
  if (cache.size >= PARSED_HISTORY_CACHE_LIMIT) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, parsed);
  return parsed;
}

export function parseHabitRuleHistory(value: HabitRuleHistoryInput): HabitRule[] {
  if (typeof value !== 'string') return parseRuleHistoryValue(value);
  // Copies keep the cached entry safe from a caller that mutates its result;
  // the rule objects themselves are treated as immutable values.
  return [...memoized(ruleHistoryCache, value, () => parseRuleHistoryValue(value))];
}

function parseRuleHistoryValue(value: HabitRuleHistoryInput): HabitRule[] {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  const rules = parsed.flatMap((entry) => {
    const rule = normalizeRule(entry);
    return rule ? [rule] : [];
  });
  rules.sort((a, b) => a.effective_from_date.localeCompare(b.effective_from_date));

  const byDate = new Map<string, HabitRule>();
  for (const rule of rules) byDate.set(rule.effective_from_date, rule);
  return [...byDate.values()].sort((a, b) =>
    a.effective_from_date.localeCompare(b.effective_from_date),
  );
}

export function serializeHabitRuleHistory(value: HabitRuleHistoryInput): string {
  return JSON.stringify(parseHabitRuleHistory(value));
}

export function buildInitialHabitRule(
  effectiveFromDate: string,
  targetPerDay: number,
  weekdays: readonly number[] = ALL_HABIT_WEEKDAYS,
): HabitRule[] {
  return [createHabitRule(effectiveFromDate, weekdays, targetPerDay)];
}

export function upsertHabitRule(history: HabitRuleHistoryInput, nextRule: HabitRule): HabitRule[] {
  const next = parseHabitRuleHistory(history).filter(
    (rule) => rule.effective_from_date !== nextRule.effective_from_date,
  );
  next.push(
    createHabitRule(nextRule.effective_from_date, nextRule.weekdays, nextRule.target_per_day),
  );
  next.sort((a, b) => a.effective_from_date.localeCompare(b.effective_from_date));
  return next;
}

function weekdayForDateKey(dateKey: string): HabitWeekday {
  const day = dateKeyToLocalDate(dateKey).getDay();
  return (day === 0 ? 7 : day) as HabitWeekday;
}

// ---------------------------------------------------------------------------
// Durable lifecycle history (migration 20: habits.status + lifecycle_history)
// ---------------------------------------------------------------------------

export type HabitLifecycleHistoryInput = HabitLifecycleInterval[] | string | null | undefined;

function normalizeLifecycleInterval(value: unknown): HabitLifecycleInterval | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<HabitLifecycleInterval>;
  if (candidate.status !== 'paused' && candidate.status !== 'archived') return null;
  if (typeof candidate.from_date_key !== 'string' || !isDateKey(candidate.from_date_key)) {
    return null;
  }
  if (
    candidate.to_date_key !== null &&
    (typeof candidate.to_date_key !== 'string' || !isDateKey(candidate.to_date_key))
  ) {
    return null;
  }
  return {
    status: candidate.status,
    from_date_key: candidate.from_date_key,
    to_date_key: candidate.to_date_key,
  };
}

/** Parse and validate the serialized lifecycle interval JSON (invalid entries dropped). */
export function parseHabitLifecycleHistory(
  value: HabitLifecycleHistoryInput,
): HabitLifecycleInterval[] {
  if (typeof value !== 'string') return parseLifecycleHistoryValue(value);
  return [...memoized(lifecycleHistoryCache, value, () => parseLifecycleHistoryValue(value))];
}

function parseLifecycleHistoryValue(value: HabitLifecycleHistoryInput): HabitLifecycleInterval[] {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .flatMap((entry) => {
      const interval = normalizeLifecycleInterval(entry);
      return interval ? [interval] : [];
    })
    .sort((a, b) => a.from_date_key.localeCompare(b.from_date_key));
}

export function serializeHabitLifecycleHistory(value: HabitLifecycleHistoryInput): string {
  return JSON.stringify(parseHabitLifecycleHistory(value));
}

/**
 * Apply a lifecycle transition to an interval history. Intervals are inclusive
 * on both bounds; `to_date_key === null` marks the ongoing interval.
 * - Entering paused/archived closes any open interval at `dateKey` (archiving
 *   therefore also closes an open pause) and opens the matching one.
 * - Returning to active just closes open intervals — active is the default
 *   state and records no interval of its own.
 * Idempotent: re-entering the current state leaves the history unchanged.
 */
export function applyHabitLifecycleTransition(
  history: HabitLifecycleHistoryInput,
  nextStatus: HabitLifecycleStatus,
  dateKey: string,
): HabitLifecycleInterval[] {
  const intervals = parseHabitLifecycleHistory(history);

  if (nextStatus === 'active') {
    return intervals.map((interval) =>
      interval.to_date_key === null ? { ...interval, to_date_key: dateKey } : interval,
    );
  }

  const alreadyInState = intervals.some(
    (interval) => interval.status === nextStatus && interval.to_date_key === null,
  );
  if (alreadyInState) return intervals;

  const closed = intervals.map((interval) =>
    interval.to_date_key === null ? { ...interval, to_date_key: dateKey } : interval,
  );
  return [...closed, { status: nextStatus, from_date_key: dateKey, to_date_key: null }];
}

/**
 * True when the date falls inside a recorded paused/archived interval
 * (inclusive bounds; an open interval extends indefinitely). Masked dates are
 * treated as unscheduled so streaks bridge pauses and consistency/heatmap
 * denominators exclude them.
 */
export function isHabitLifecycleMaskedOn(
  history: HabitLifecycleHistoryInput,
  dateKey: string,
): boolean {
  return parseHabitLifecycleHistory(history).some((interval) => {
    if (dateKey < interval.from_date_key) return false;
    return interval.to_date_key === null || dateKey <= interval.to_date_key;
  });
}

/**
 * Shared creation-date fallback for empty rule histories (F8): every streak /
 * grid / insights surface resolves the same pre-creation boundary.
 */
export function habitCreationDateKey(timestamp: string | undefined): string | undefined {
  if (!timestamp || Number.isNaN(new Date(timestamp).getTime())) return undefined;
  return timestampToLocalDateKey(timestamp);
}

/**
 * Resolve the rule active on a local date from an ALREADY-PARSED history.
 *
 * Grid builders resolve one date per cell over a year of cells, so the parse
 * and the sort must not repeat per call — this is the single-pass resolver
 * both the public entry point and the grid builders use.
 */
function resolveParsedRuleForDate(
  rules: readonly HabitRule[],
  dateKey: string,
  fallbackTargetPerDay: number,
  fallbackEffectiveFromDate?: string,
): HabitRule | null {
  if (rules.length === 0) {
    if (fallbackEffectiveFromDate && dateKey < fallbackEffectiveFromDate) return null;
    return createHabitRule(
      fallbackEffectiveFromDate ?? '0000-01-01',
      ALL_HABIT_WEEKDAYS,
      fallbackTargetPerDay,
    );
  }

  let active: HabitRule | null = null;
  for (const rule of rules) {
    if (rule.effective_from_date > dateKey) break;
    active = rule;
  }
  return active;
}

/**
 * Resolve the rule active on a local date. A null result is an ineligible
 * pre-creation date when valid history exists. Legacy-shaped callers without
 * history get a conservative every-day fallback for compatibility.
 */
export function getHabitRuleForDate(
  history: HabitRuleHistoryInput,
  dateKey: string,
  fallbackTargetPerDay = 1,
  fallbackEffectiveFromDate?: string,
): HabitRule | null {
  return resolveParsedRuleForDate(
    parseHabitRuleHistory(history),
    dateKey,
    fallbackTargetPerDay,
    fallbackEffectiveFromDate,
  );
}

export function getHabitTargetForDate(
  history: HabitRuleHistoryInput,
  dateKey: string,
  fallbackTargetPerDay = 1,
  fallbackEffectiveFromDate?: string,
): number {
  return (
    getHabitRuleForDate(history, dateKey, fallbackTargetPerDay, fallbackEffectiveFromDate)
      ?.target_per_day ?? fallbackTargetPerDay
  );
}

export function isHabitScheduledOn(
  history: HabitRuleHistoryInput,
  dateKey: string,
  fallbackTargetPerDay = 1,
  fallbackEffectiveFromDate?: string,
): boolean {
  const rule = getHabitRuleForDate(
    history,
    dateKey,
    fallbackTargetPerDay,
    fallbackEffectiveFromDate,
  );
  return rule ? rule.weekdays.includes(weekdayForDateKey(dateKey)) : false;
}

/**
 * True when a completion write for the date is actionable under the
 * authoritative schedule/effective/lifecycle history: the date is on or after
 * the creation boundary, covered by an effective schedule rule whose weekdays
 * include it, and not inside a paused/archived lifecycle interval. This is the
 * data/domain write gate shared by increments, linked-action adapters, and UI
 * enablement — historical edits must never land on non-actionable dates.
 */
export function isHabitActionableOn(
  ruleHistory: HabitRuleHistoryInput,
  dateKey: string,
  fallbackTargetPerDay = 1,
  fallbackEffectiveFromDate?: string,
  lifecycleHistory?: HabitLifecycleHistoryInput,
): boolean {
  return (
    isHabitScheduledOn(ruleHistory, dateKey, fallbackTargetPerDay, fallbackEffectiveFromDate) &&
    !isHabitLifecycleMaskedOn(lifecycleHistory, dateKey)
  );
}

/**
 * True when a habit check-in may take the gamification fast path
 * (`recordAction('habit', habitId)` → `awardGamificationAction` with the
 * current day as `todayKey`).
 *
 * Two refusals, both correctness — not latency:
 * - a refused write (`count < 1`: missing/paused/unscheduled habit) must not
 *   mint XP for an action that never happened;
 * - a backdated write (`dateKey !== todayKey`: the day-strip backfill flow)
 *   must not be awarded under today's key. Habit source keys are
 *   per-habit-per-day (`${dateKey}:${habitId}`), so a today-keyed award for a
 *   past-day increment double-pays once reconcile awards the action-day key —
 *   and marks today active with no today action. Backdated increments degrade
 *   to reconcile backfill (exact + silent), the same miss+reconcile policy as
 *   the id-less fast-path guards.
 */
export function shouldAwardHabitFastPath(
  dateKey: string,
  count: number,
  todayKey: string,
): boolean {
  return count > 0 && dateKey === todayKey;
}

export function getHabitSchedulePreset(weekdays: readonly number[]): HabitSchedulePreset {
  const normalized = normalizeHabitWeekdays(weekdays);
  if (normalized.join(',') === ALL_HABIT_WEEKDAYS.join(',')) return 'every_day';
  if (normalized.join(',') === WEEKDAY_HABIT_WEEKDAYS.join(',')) return 'weekdays';
  if (normalized.join(',') === WEEKEND_HABIT_WEEKDAYS.join(',')) return 'weekends';
  return 'custom';
}

export function formatHabitSchedule(weekdays: readonly number[]): string {
  const normalized = normalizeHabitWeekdays(weekdays);
  const preset = getHabitSchedulePreset(normalized);
  if (preset === 'every_day') return 'Every day';
  if (preset === 'weekdays') return 'Weekdays';
  if (preset === 'weekends') return 'Weekends';
  return normalized.map((weekday) => WEEKDAY_LABELS[weekday - 1]).join(' / ');
}

function buildDateKeysBetween(startDateKey: string, endDateKey: string): string[] {
  if (startDateKey > endDateKey) return [];
  const result: string[] = [];
  const cursor = dateKeyToLocalDate(startDateKey);
  const end = dateKeyToLocalDate(endDateKey);
  while (cursor <= end) {
    result.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

function firstHistoryDate(
  rules: HabitRule[],
  completions: Pick<HabitCompletion, 'date_key' | 'count'>[],
  fallbackEffectiveFromDate?: string,
): string {
  return (
    rules[0]?.effective_from_date ??
    fallbackEffectiveFromDate ??
    completions.map((completion) => completion.date_key).sort()[0] ??
    toDateKey()
  );
}

export type DayCompletion = {
  dateKey: string;
  count: number;
  targetPerDay: number;
  scheduled: boolean;
  eligible: boolean;
  completed: boolean;
};

export function calculateHabitProgress(count: number, targetPerDay: number): number {
  if (targetPerDay <= 0) return 0;
  return Math.min(1, count / targetPerDay);
}

/**
 * Build the requested local-date history, resolving each date's rule. Dates
 * inside a paused/archived lifecycle interval are masked (`scheduled=false`)
 * so they never count as misses: streaks bridge them and consistency/heatmap
 * denominators exclude them.
 */
export function buildDayCompletions(
  completions: Pick<HabitCompletion, 'date_key' | 'count'>[],
  targetPerDay: number,
  days?: number,
  history?: HabitRuleHistoryInput,
  fallbackEffectiveFromDate?: string,
  todayKey = toDateKey(),
  lifecycleHistory?: HabitLifecycleHistoryInput,
  rangeStartDateKey?: string,
): DayCompletion[] {
  const rules = parseHabitRuleHistory(history);
  // Resolve the lifecycle intervals once per call: the per-cell check used to
  // re-parse the serialized history for every date in the window.
  const lifecycleIntervals = parseHabitLifecycleHistory(lifecycleHistory);
  // Derived read models can provide a bounded local window without changing
  // the full-history behavior used by streaks and the existing habit UI.
  const startDateKey =
    rangeStartDateKey && isDateKey(rangeStartDateKey)
      ? rangeStartDateKey
      : firstHistoryDate(rules, completions, fallbackEffectiveFromDate);
  const dateKeys =
    days === undefined
      ? buildDateKeysBetween(startDateKey, todayKey)
      : buildDateRangeOldestFirst(days);
  const map = new Map<string, number>();
  for (const completion of completions) map.set(completion.date_key, completion.count);

  return dateKeys.map((dateKey) => {
    const rule = resolveParsedRuleForDate(rules, dateKey, targetPerDay, fallbackEffectiveFromDate);
    const scheduled =
      rule !== null &&
      rule.weekdays.includes(weekdayForDateKey(dateKey)) &&
      !isHabitLifecycleMaskedOn(lifecycleIntervals, dateKey);
    const eligible = scheduled && dateKey <= todayKey;
    const count = map.get(dateKey) ?? 0;
    const target = rule?.target_per_day ?? targetPerDay;
    return {
      dateKey,
      count,
      targetPerDay: target,
      scheduled,
      eligible,
      completed: eligible && target > 0 && count >= target,
    };
  });
}

/**
 * The shared streak engine's view of a habit day history.
 *
 * A habit day is REQUIRED when it is a scheduled, eligible (not future, not
 * pre-creation, not inside a paused/archived interval) occurrence. Everything
 * else — a weekly off-day, a masked pause day — carried no obligation and
 * therefore bridges a run instead of breaking it, which is the documented Habit
 * Engine V2 semantics (`openspec/specs/habit-scheduling-and-history-semantics`).
 */
export function toHabitStreakDays(dayCompletions: readonly DayCompletion[]): StreakRunDay[] {
  return dayCompletions.map((day) => {
    const required = day.scheduled && day.eligible;
    return {
      dateKey: day.dateKey,
      required,
      completed: required && day.completed,
    };
  });
}

/**
 * Current completed scheduled occurrences, using the app-wide streak engine
 * (`habitStreak.domain`). An incomplete scheduled today is granted grace while
 * today is active; a prior scheduled miss breaks the streak; off-days and
 * paused/archived days bridge instead of breaking (audit C #10).
 */
export function calculateCurrentStreak(
  dayCompletions: DayCompletion[],
  todayKey = toDateKey(),
): number {
  return computeStreakRun(toHabitStreakDays(dayCompletions), todayKey).current;
}

/** Calculate the longest completed run across all eligible scheduled dates. */
export function calculateLongestStreak(
  dayCompletions: DayCompletion[],
  todayKey = toDateKey(),
): number {
  return computeStreakRun(toHabitStreakDays(dayCompletions), todayKey).longest;
}

export type HabitGridHabit = {
  id: string;
  name: string;
  color: string;
  target_per_day: number;
  rule_history?: HabitRuleHistoryInput;
  created_at?: string;
  lifecycle_history?: HabitLifecycleHistoryInput;
};

export type HabitGridRow = {
  habit: HabitGridHabit;
  cells: DayCell[];
};

export type DayCell = {
  dateKey: string;
  count: number;
  targetPerDay: number;
  scheduled: boolean;
  eligible: boolean;
  completed: boolean;
  partial: boolean;
};

export type GridDateHeader = {
  dateKey: string;
  dayLabel: string;
  monthLabel: string | null;
  isToday: boolean;
};

export function buildHabitGrid(
  habits: HabitGridHabit[],
  completions: { habit_id: string; date_key: string; count: number }[],
  days: number = 364,
  todayKey = toDateKey(),
): HabitGridRow[] {
  const lookup = new Map<string, Map<string, number>>();
  for (const completion of completions) {
    if (!lookup.has(completion.habit_id)) lookup.set(completion.habit_id, new Map());
    lookup.get(completion.habit_id)!.set(completion.date_key, completion.count);
  }

  // Anchor the window on the injected todayKey (F7): synthetic "as-of" views
  // and tests must grade the same cells they generated.
  const endDate = dateKeyToLocalDate(todayKey);
  const dateKeys: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(endDate);
    date.setDate(endDate.getDate() - i);
    dateKeys.push(toDateKey(date));
  }

  return habits.map((habit) => {
    const habitMap = lookup.get(habit.id) ?? new Map<string, number>();
    const rules = parseHabitRuleHistory(habit.rule_history);
    const lifecycleIntervals = parseHabitLifecycleHistory(habit.lifecycle_history);
    const fallbackCreationDate = habitCreationDateKey(habit.created_at);
    const cells = dateKeys.map((dateKey) => {
      const rule = resolveParsedRuleForDate(
        rules,
        dateKey,
        habit.target_per_day,
        fallbackCreationDate,
      );
      const scheduled =
        rule !== null &&
        rule.weekdays.includes(weekdayForDateKey(dateKey)) &&
        !isHabitLifecycleMaskedOn(lifecycleIntervals, dateKey);
      const eligible = scheduled && dateKey <= todayKey;
      const count = habitMap.get(dateKey) ?? 0;
      const target = rule?.target_per_day ?? habit.target_per_day;
      return {
        dateKey,
        count,
        targetPerDay: target,
        scheduled,
        eligible,
        completed: eligible && target > 0 && count >= target,
        partial: eligible && count > 0 && count < target,
      };
    });
    return { habit, cells };
  });
}

export function calculateOverallConsistency(grid: HabitGridRow[]): number {
  let completed = 0;
  let total = 0;
  for (const row of grid) {
    for (const cell of row.cells) {
      if (!cell.eligible) continue;
      total += 1;
      if (cell.completed) completed += 1;
    }
  }
  return total === 0 ? 0 : Math.round((completed / total) * 100);
}

/** Build the aggregate 0–3 habit heatmap without any per-cell DB work. */
export function buildAggregatedHabitHeatmap(
  grid: HabitGridRow[],
  days: number = 364,
): HeatmapDay[] {
  // Derive the date axis from the grid cells so the heatmap always matches the
  // window buildHabitGrid produced (including synthetic todayKey views); the
  // real-clock range is only the fallback for an empty grid.
  const dateKeys =
    grid.length > 0
      ? grid[0].cells.slice(-days).map((cell) => cell.dateKey)
      : buildDateRangeOldestFirst(days);
  if (grid.length === 0) return dateKeys.map((dateKey) => ({ dateKey, value: 0 }));

  const indexedRows = grid.map((row) => new Map(row.cells.map((cell) => [cell.dateKey, cell])));
  return dateKeys.map((dateKey) => {
    let completed = 0;
    let scheduled = 0;
    for (const row of indexedRows) {
      const cell = row.get(dateKey);
      if (!cell?.eligible) continue;
      scheduled += 1;
      if (cell.completed) completed += 1;
    }
    if (scheduled === 0 || completed === 0) return { dateKey, value: 0 };
    const pct = completed / scheduled;
    return { dateKey, value: pct < 0.5 ? 1 : pct < 1 ? 2 : 3 };
  });
}

// ---------------------------------------------------------------------------
// List filtering / sorting
// ---------------------------------------------------------------------------

export type HabitStatusFilter = 'all' | 'active' | 'paused' | 'archived';

export type HabitListFilters = {
  category?: string;
  status?: HabitStatusFilter;
};

export type HabitSortMode = 'default' | 'name' | 'streak';

/**
 * Filter habits by category and durable lifecycle status. Rows missing the
 * v20 status column (legacy/remote rows) normalize to 'active'.
 */
export function filterHabits<
  T extends { id: string; category?: string | null; status?: HabitLifecycleStatus },
>(habits: T[], filters: HabitListFilters): T[] {
  const status = filters.status ?? 'active';
  return habits.filter((habit) => {
    if (filters.category && filters.category !== 'all') {
      if ((habit.category ?? 'anytime') !== filters.category) return false;
    }
    if (status !== 'all' && (habit.status ?? 'active') !== status) return false;
    return true;
  });
}

/** Sort habits; 'default' preserves the data-layer order (category, created). */
export function sortHabits<T extends { id: string; name: string }>(
  habits: T[],
  mode: HabitSortMode,
  streaks?: Record<string, number>,
): T[] {
  const copy = [...habits];
  if (mode === 'name') {
    copy.sort((a, b) => a.name.localeCompare(b.name));
  } else if (mode === 'streak') {
    copy.sort((a, b) => (streaks?.[b.id] ?? 0) - (streaks?.[a.id] ?? 0));
  }
  return copy;
}
