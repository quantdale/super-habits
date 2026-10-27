/**
 * ONE streak definition for the whole app (audit C #10).
 *
 * The Habits tab, the per-habit insights, Ask, and the local reward ledger used
 * to run three separate walkers with three different grace/bridge rules, so two
 * numbers labelled "streak" could disagree on the same data. Every surface now
 * calls {@link computeStreakRun}, which owns the only definition of a streak
 * day:
 *
 * - a day only counts when it is a **required** occurrence that was
 *   **completed** (habits: scheduled + eligible + at target; rewards: a day
 *   inside the recorded history that earned XP);
 * - a **frozen** day bridges a run without adding to it (a banked streak freeze
 *   replaced the miss);
 * - a **not-required** day (a habit off-day, or a day before the recorded
 *   history) also bridges: no obligation, no break;
 * - a required day that was missed **breaks** the run;
 * - the current local day is always grace: an unfinished today never breaks a
 *   live run (`atRisk` flags it for the UI), and it only counts once completed.
 *
 * All day arithmetic goes through `lib/time`'s local-calendar helpers, so a
 * 23- or 25-hour DST day is still exactly one calendar day.
 *
 * Pure: no DB, no React, no clock reads.
 */

import { addLocalDays, isValidDateKey } from '@/lib/time';

export type StreakRunDay = {
  /** Local `YYYY-MM-DD` key. */
  dateKey: string;
  /** The day carried an obligation that can be missed. */
  required: boolean;
  /** The day's obligation was met. */
  completed: boolean;
  /** A banked freeze bridged the day despite it being required. */
  frozen?: boolean;
};

export type StreakRun = {
  /** Completed required days in the live run ending at/near today. */
  current: number;
  /** Longest completed run anywhere in the supplied history. */
  longest: number;
  /** Today itself is completed. */
  activeToday: boolean;
  /** The run is alive on grace alone because today is still open. */
  atRisk: boolean;
  /** Most recent completed day (never a bridged day), or null. */
  lastActiveDateKey: string | null;
};

/** Defensive bound: a decade of history is past any realistic streak. */
const MAX_WALK_DAYS = 4000;

function sortAndIndex(days: readonly StreakRunDay[]): {
  sorted: StreakRunDay[];
  byDate: Map<string, StreakRunDay>;
} {
  const byDate = new Map<string, StreakRunDay>();
  for (const day of days) {
    if (!isValidDateKey(day.dateKey)) continue;
    // A later entry wins: callers merge sources (activity, freezes) and the
    // most specific statement about a day is the one supplied last.
    byDate.set(day.dateKey, day);
  }
  const sorted = [...byDate.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  return { sorted, byDate };
}

/**
 * Current + longest streak over `days`.
 *
 * Two history shapes are supported because the app has two kinds of day
 * record:
 *
 * - **dense** (default) — one entry per local day, e.g. habit day completions.
 *   Off-days are present with `required: false` and bridge a run; an unfinished
 *   required today is grace; a history that ends before `todayKey` (a synthetic
 *   window) resumes from its own last day rather than reading the unrecorded
 *   tail as a miss.
 * - **sparse** (`{ sparse: true }`) — only the days with a record exist, e.g.
 *   the local reward ledger. An absent day between records is a miss, and the
 *   today-grace rule is the ledger's own: the streak survives only while
 *   yesterday itself is active or frozen.
 */
export function computeStreakRun(
  days: readonly StreakRunDay[],
  todayKey: string,
  options: { sparse?: boolean } = {},
): StreakRun {
  const safeToday = isValidDateKey(todayKey) ? todayKey : (days[0]?.dateKey ?? '');
  const { sorted, byDate } = sortAndIndex(days);

  let lastActiveDateKey: string | null = null;
  for (const day of sorted) {
    if (!day.completed) continue;
    if (lastActiveDateKey === null || day.dateKey > lastActiveDateKey) {
      lastActiveDateKey = day.dateKey;
    }
  }

  if (sorted.length === 0 || !isValidDateKey(safeToday)) {
    return { current: 0, longest: 0, activeToday: false, atRisk: false, lastActiveDateKey };
  }

  // Longest is a forward pass over the supplied history. A gap between two
  // records resets the run: for a dense history the gap cannot happen (every
  // day is supplied), and for a sparse one an absent day is a miss.
  let longest = 0;
  let run = 0;
  let previousKey: string | null = null;
  for (const day of sorted) {
    if (previousKey !== null && addLocalDays(previousKey, 1) !== day.dateKey) run = 0;
    if (day.completed) {
      run += 1;
      if (run > longest) longest = run;
    } else if (!day.frozen && day.required) {
      run = 0;
    }
    previousKey = day.dateKey;
  }

  const today = byDate.get(safeToday);
  const activeToday = Boolean(today?.completed);
  const emptyRun = (): StreakRun => ({
    current: 0,
    longest,
    activeToday: false,
    atRisk: false,
    lastActiveDateKey,
  });

  const yesterdayKey = addLocalDays(safeToday, -1);
  let cursor = safeToday;
  if (activeToday) {
    // Count today and everything the run bridges.
  } else if (today) {
    // A bridged (frozen) or not-required today keeps the walk starting today;
    // an unfinished required today is grace and starts from yesterday.
    if (today.required && !today.frozen) cursor = yesterdayKey;
  } else if (options.sparse) {
    // Sparse ledger grace: today has no row, so the run only survives while
    // yesterday is itself active or frozen.
    const yesterday = byDate.get(yesterdayKey);
    if (!yesterday || (!yesterday.completed && !yesterday.frozen)) return emptyRun();
    cursor = yesterdayKey;
  } else {
    // Dense history that ends before `todayKey` (a synthetic window): resume
    // from its own last day instead of reading the unrecorded tail as a miss.
    const latest = sorted[sorted.length - 1].dateKey;
    if (latest > safeToday) return emptyRun();
    cursor = latest;
  }

  let current = 0;
  for (let guard = 0; guard < MAX_WALK_DAYS; guard += 1) {
    const day = byDate.get(cursor);
    if (!day) break;
    if (day.completed) current += 1;
    else if (day.frozen) {
      // bridged
    } else if (day.required) break;
    cursor = addLocalDays(cursor, -1);
  }

  return {
    current,
    longest: Math.max(longest, current),
    activeToday,
    atRisk: !activeToday && current > 0,
    lastActiveDateKey,
  };
}

/**
 * Expand a sparse day record into a gap-filled one.
 *
 * Not needed by {@link computeStreakRun} (sparse mode already treats an absent
 * day as a miss); exported for callers that want to inspect the filled series.
 */
export function fillStreakDayGaps(
  days: readonly StreakRunDay[],
  lastDateKey: string,
): StreakRunDay[] {
  const { sorted, byDate } = sortAndIndex(days);
  if (sorted.length === 0 || !isValidDateKey(lastDateKey)) return sorted;
  let endKey = lastDateKey;
  if (sorted[sorted.length - 1].dateKey > endKey) {
    endKey = sorted[sorted.length - 1].dateKey;
  }
  const filled: StreakRunDay[] = [];
  let cursor = sorted[0].dateKey;
  for (let guard = 0; guard < MAX_WALK_DAYS && cursor <= endKey; guard += 1) {
    filled.push(
      byDate.get(cursor) ?? { dateKey: cursor, required: true, completed: false, frozen: false },
    );
    cursor = addLocalDays(cursor, 1);
  }
  return filled;
}
