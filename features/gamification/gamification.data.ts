/**
 * Gamification persistence + canonical day facts.
 *
 * Two jobs:
 *  1. maintain the local XP ledger (`gamification_events`) and its satellites
 *     (consumed freezes, completed quests, unlocked badges);
 *  2. read today's counts straight from the authoritative feature tables so a
 *     quest or a level is always a function of real activity.
 *
 * Every write here is local-only: nothing enqueues to the outbox, because
 * rewards are derived state rather than user-owned content. `awardGamificationAction`
 * is idempotent on (kind, source key), so the fast path (a screen reporting a
 * completed action) and the reconciler (notification quick-actions, command
 * center, anything that wrote without telling us) can both call it safely.
 */

import { getDatabase } from '@/core/db/client';
import { withSQLiteTransaction } from '@/core/db/transactions';
import type { Habit } from '@/core/db/types';
import { buildDayCompletions, habitCreationDateKey } from '@/features/habits/habits.domain';
import { createId } from '@/lib/id';
import { getUtcIsoRangeForLocalDateKeys, nowIso, toDateKey } from '@/lib/time';
import type * as SQLite from 'expo-sqlite';
import {
  actionSourceKey,
  badgeStates,
  buildDailyQuests,
  buildWeek,
  celebrationForBadge,
  computeActionReward,
  computeStreakSummary,
  evaluateBadges,
  levelFromXp,
  pickCelebration,
  planAutoFreeze,
  shiftDateKey,
  streakFreezeState,
} from './gamification.domain';
import {
  FREEZE_GRANT_EVENT_KIND,
  PERFECT_DAY_EVENT_KIND,
  STREAK_MILESTONE_EVENT_KIND,
  type ActionKind,
  type BadgeStats,
  type BadgeUnlock,
  type Celebration,
  type DayCompletionInput,
  type DayFacts,
  type GamificationAwardResult,
  type GamificationSnapshot,
  type StreakDay,
  type StreakFreezeState,
  type StreakSummary,
} from './gamification.types';

type Db = SQLite.SQLiteDatabase;

export type GamificationReadOptions = {
  /** Injectable for deterministic tests; production defaults to local today. */
  todayKey?: string;
};

export type GamificationAwardOutcome = {
  result: GamificationAwardResult;
  newBadges: BadgeUnlock[];
  celebration: Celebration | null;
  snapshot: GamificationSnapshot;
};

export type ReconcileOutcome = {
  /** How many real actions were found in the feature tables and rewarded. */
  awarded: number;
  snapshot: GamificationSnapshot;
};

/** How much day history streak math may read (≈14 years of daily activity). */
const STREAK_HISTORY_LIMIT = 5000;

/**
 * Cap on awards per reconcile pass. A user returning after months offline has
 * today's actions at most, so this only guards against pathological data. The
 * housekeeping lookback applies this cap PER DAY (one pass per date key), never
 * as one shared budget across the window.
 */
const RECONCILE_AWARD_LIMIT = 25;

/**
 * Bounded historical lookback for housekeeping reconciliation. The original
 * today+yesterday horizon silently underpaid every check-in recorded more than
 * one local day back (offline days, notification completions opened late,
 * backdated logs). Seven days covers a normal offline stretch while staying
 * far too small to rewrite ancient history; the ledger's unique
 * (kind, source key) index makes repeated passes no-ops.
 */
export const GAMIFICATION_RECONCILE_LOOKBACK_DAYS = 7;

type HabitScheduleRead = Pick<
  Habit,
  'id' | 'target_per_day' | 'rule_history' | 'lifecycle_history' | 'created_at'
>;

type CountRow = { value: number | null };

async function readCount(
  db: Db,
  sql: string,
  params: SQLite.SQLiteBindValue[] = [],
): Promise<number> {
  const row = await db.getFirstAsync<CountRow>(sql, params);
  return Math.max(0, Math.floor(row?.value ?? 0));
}

// ---------------------------------------------------------------------------
// pass-scoped ledger snapshot
// ---------------------------------------------------------------------------

/**
 * Ledger facts one pass derives from elapsed rewards plus feature activity.
 *
 * Housekeeping used to re-read the whole ledger for EVERY award and for
 * several aggregates (7 lookback days x up to 25 awards x 2 full scans +
 * ~10 aggregate COUNT(*)s each). The ledger only ever grows during a pass, so
 * one read plus a local append per award is behaviourally identical and turns
 * that into a single scan (audit C §2 issue #3).
 *
 * Append-only is enforced, not assumed: an already-paid action is still
 * detected by the per-award `SELECT` inside the write transaction, which stays
 * the authoritative idempotency check.
 */
type LedgerSnapshot = {
  /** Newest-first `xp > 0` rows, capped at `STREAK_HISTORY_LIMIT`. */
  activeEvents: { date_key: string; xp: number }[];
  /** Every day with an `xp > 0` event (the old `DISTINCT date_key` set). */
  activeDateKeys: Set<string>;
  /** Every day a banked freeze saved. */
  frozenDateKeys: Set<string>;
  /** `SUM(xp)` over the whole ledger. */
  totalXp: number;
  freezesEarned: number;
  freezesUsed: number;
  milestones: { streak: number[]; freeze: number[] };
  /** Quest ids known to be paid, per day, memoized for the pass. */
  questIdsByDate: Map<string, Set<string>>;
  /** Day-completion input per day, memoized until an award could change it. */
  dayCompletionByDate: Map<string, DayCompletionInput>;
  /** Unlocked badge ids, appended to as awards unlock them. */
  unlockedBadgeIds?: string[];
  /** Lifetime counters every badge family reads from. */
  counts: Omit<BadgeStats, 'currentStreak' | 'longestStreak' | 'totalXp' | 'level'>;
};

/**
 * Read every ledger-derived value once. This is the only place the reward
 * layer scans its own tables; the snapshot read and a housekeeping pass both
 * start from it.
 */
async function readLedgerSnapshot(db: Db): Promise<LedgerSnapshot> {
  const [events, totals, freezes, freezeDays, counts] = await Promise.all([
    db.getAllAsync<{ date_key: string; event_kind: string; source_key: string; xp: number }>(
      `SELECT date_key, event_kind, source_key, xp FROM gamification_events`,
    ),
    db.getFirstAsync<{ total_xp: number | null; perfect_days: number | null }>(
      `SELECT COALESCE(SUM(xp), 0) AS total_xp,
              COUNT(CASE WHEN event_kind = ? THEN 1 END) AS perfect_days
         FROM gamification_events`,
      [PERFECT_DAY_EVENT_KIND],
    ),
    db.getFirstAsync<{ earned: number | null; used: number | null }>(
      `SELECT (SELECT COUNT(*) FROM gamification_events WHERE event_kind = ?) AS earned,
              (SELECT COUNT(*) FROM gamification_streak_freezes) AS used`,
      [FREEZE_GRANT_EVENT_KIND],
    ),
    db.getAllAsync<{ date_key: string }>(`SELECT date_key FROM gamification_streak_freezes`),
    db.getFirstAsync<{
      quests: number | null;
      habits: number | null;
      focus: number | null;
      workouts: number | null;
      nutrition: number | null;
    }>(
      `SELECT (SELECT COUNT(*) FROM gamification_quests) AS quests,
              (SELECT COUNT(*) FROM habit_completions WHERE count > 0) AS habits,
              (SELECT COUNT(*) FROM pomodoro_sessions
                 WHERE session_type = 'focus' AND ended_at IS NOT NULL
                   AND duration_seconds > 0) AS focus,
              (SELECT COUNT(*) FROM workout_logs) AS workouts,
              (SELECT COUNT(DISTINCT consumed_on) FROM calorie_entries
                 WHERE deleted_at IS NULL) AS nutrition`,
    ),
  ]);

  const activeDateKeys = new Set<string>();
  const milestones: { streak: number[]; freeze: number[] } = { streak: [], freeze: [] };
  for (const row of events) {
    if (row.xp > 0) activeDateKeys.add(row.date_key);
    if (
      row.event_kind !== STREAK_MILESTONE_EVENT_KIND &&
      row.event_kind !== FREEZE_GRANT_EVENT_KIND
    ) {
      continue;
    }
    const milestone = Number.parseInt(row.source_key.split(':')[1] ?? '', 10);
    if (!Number.isFinite(milestone)) continue;
    (row.event_kind === STREAK_MILESTONE_EVENT_KIND ? milestones.streak : milestones.freeze).push(
      milestone,
    );
  }

  // Newest first, capped exactly like the old ordered LIMIT query.
  const activeEvents = [...events]
    .filter((row) => row.xp > 0)
    .sort((a, b) => b.date_key.localeCompare(a.date_key))
    .slice(0, STREAK_HISTORY_LIMIT)
    .map((row) => ({ date_key: row.date_key, xp: row.xp }));

  return {
    activeEvents,
    activeDateKeys,
    frozenDateKeys: new Set(freezeDays.map((row) => row.date_key)),
    totalXp: Math.max(0, Math.floor(totals?.total_xp ?? 0)),
    freezesEarned: Math.max(0, Math.floor(freezes?.earned ?? 0)),
    freezesUsed: Math.max(0, Math.floor(freezes?.used ?? 0)),
    milestones,
    questIdsByDate: new Map(),
    dayCompletionByDate: new Map(),
    counts: {
      questsCompleted: Math.max(0, Math.floor(counts?.quests ?? 0)),
      perfectDays: Math.max(0, Math.floor(totals?.perfect_days ?? 0)),
      habitCheckins: Math.max(0, Math.floor(counts?.habits ?? 0)),
      focusSessions: Math.max(0, Math.floor(counts?.focus ?? 0)),
      workouts: Math.max(0, Math.floor(counts?.workouts ?? 0)),
      nutritionDays: Math.max(0, Math.floor(counts?.nutrition ?? 0)),
    },
  };
}

/** Streak days from the snapshot's day sets, oldest-first for streak math. */
function streakDaysFromSnapshot(snapshot: LedgerSnapshot): StreakDay[] {
  const byDate = new Map<string, StreakDay>();
  for (const dateKey of snapshot.activeDateKeys) {
    byDate.set(dateKey, { dateKey, active: true, frozen: false });
  }
  for (const dateKey of snapshot.frozenDateKeys) {
    const existing = byDate.get(dateKey);
    byDate.set(
      dateKey,
      existing ? { ...existing, frozen: true } : { dateKey, active: false, frozen: true },
    );
  }
  return [...byDate.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

/** XP the ledger holds for one day, from the capped newest-first window. */
function xpForDate(snapshot: LedgerSnapshot, dateKey: string): number {
  let xp = 0;
  for (const row of snapshot.activeEvents) {
    if (row.date_key === dateKey) xp += row.xp;
  }
  return Math.max(0, Math.floor(xp));
}

// ---------------------------------------------------------------------------
// canonical reads
// ---------------------------------------------------------------------------

/**
 * Today's counts, straight from the feature tables.
 *
 * `xpEarned` comes from the pass snapshot when one is in hand, so a whole
 * housekeeping pass sums the ledger once instead of once per award.
 */
async function loadDayFacts(
  db: Db,
  todayKey: string,
  snapshot?: LedgerSnapshot,
): Promise<DayFacts> {
  const { startUtcIso, endUtcExclusiveIso } = getUtcIsoRangeForLocalDateKeys(todayKey, todayKey);
  const [habitCheckins, todosCompleted, focus, workouts, mealsLogged, planCommitted] =
    await Promise.all([
      readCount(
        db,
        `SELECT COUNT(*) AS value FROM habit_completions WHERE date_key = ? AND count > 0`,
        [todayKey],
      ),
      readCount(
        db,
        `SELECT COUNT(*) AS value FROM todos
          WHERE completed = 1
            AND deleted_at IS NULL
            AND completed_at IS NOT NULL
            AND completed_at >= ?
            AND completed_at < ?`,
        [startUtcIso, endUtcExclusiveIso],
      ),
      db.getFirstAsync<{ sessions: number | null; seconds: number | null }>(
        `SELECT COUNT(*) AS sessions, COALESCE(SUM(duration_seconds), 0) AS seconds
           FROM pomodoro_sessions
          WHERE session_type = 'focus'
            AND ended_at IS NOT NULL
            AND duration_seconds > 0
            AND started_at >= ?
            AND started_at < ?`,
        [startUtcIso, endUtcExclusiveIso],
      ),
      readCount(
        db,
        `SELECT COUNT(*) AS value FROM workout_logs WHERE completed_at >= ? AND completed_at < ?`,
        [startUtcIso, endUtcExclusiveIso],
      ),
      readCount(
        db,
        `SELECT COUNT(*) AS value FROM calorie_entries
          WHERE deleted_at IS NULL AND consumed_on = ?`,
        [todayKey],
      ),
      readCount(
        db,
        `SELECT COUNT(*) AS value FROM daily_plans
          WHERE deleted_at IS NULL AND date_key = ? AND status IN ('committed', 'completed')`,
        [todayKey],
      ),
    ]);

  const xpEarned = snapshot
    ? xpForDate(snapshot, todayKey)
    : await readCount(
        db,
        `SELECT COALESCE(SUM(xp), 0) AS value FROM gamification_events WHERE date_key = ?`,
        [todayKey],
      );

  return {
    habitCheckins,
    todosCompleted,
    focusSessions: Math.max(0, Math.floor(focus?.sessions ?? 0)),
    focusMinutes: Math.max(0, Math.round((focus?.seconds ?? 0) / 60)),
    workouts,
    mealsLogged,
    planCommitted,
    xpEarned,
  };
}

/**
 * Every day the user was active, plus the days a freeze saved, oldest-first
 * for streak math. Falls back to reading the ledger when no pass snapshot is
 * in hand.
 */
async function loadStreakDays(db: Db, snapshot?: LedgerSnapshot): Promise<StreakDay[]> {
  return streakDaysFromSnapshot(snapshot ?? (await readLedgerSnapshot(db)));
}

async function loadFreezeState(db: Db, snapshot?: LedgerSnapshot): Promise<StreakFreezeState> {
  if (!snapshot) {
    const [earned, used] = await Promise.all([
      readCount(db, `SELECT COUNT(*) AS value FROM gamification_events WHERE event_kind = ?`, [
        FREEZE_GRANT_EVENT_KIND,
      ]),
      readCount(db, `SELECT COUNT(*) AS value FROM gamification_streak_freezes`),
    ]);
    return streakFreezeState({ earned, used });
  }
  return streakFreezeState({ earned: snapshot.freezesEarned, used: snapshot.freezesUsed });
}

async function loadRecordedMilestones(
  db: Db,
  snapshot?: LedgerSnapshot,
): Promise<{ streak: number[]; freeze: number[] }> {
  return snapshot?.milestones ?? (await readLedgerSnapshot(db)).milestones;
}

async function loadCompletedQuestIds(
  db: Db,
  dateKey: string,
  snapshot?: LedgerSnapshot,
): Promise<string[]> {
  const known = snapshot?.questIdsByDate.get(dateKey);
  if (known) return [...known];
  const rows = await db.getAllAsync<{ quest_id: string }>(
    `SELECT quest_id FROM gamification_quests WHERE date_key = ? ORDER BY quest_id ASC`,
    [dateKey],
  );
  const questIds = rows.map((row) => row.quest_id);
  snapshot?.questIdsByDate.set(dateKey, new Set(questIds));
  return questIds;
}

async function loadBadgeIds(db: Db, snapshot?: LedgerSnapshot): Promise<string[]> {
  if (snapshot?.unlockedBadgeIds) return [...snapshot.unlockedBadgeIds];
  const rows = await db.getAllAsync<{ badge_id: string }>(
    `SELECT badge_id FROM gamification_badges ORDER BY badge_id ASC`,
  );
  const badgeIds = rows.map((row) => row.badge_id);
  if (snapshot) snapshot.unlockedBadgeIds = badgeIds;
  return [...badgeIds];
}

/** Lifetime counters every badge family reads from. */
async function loadBadgeStats(
  db: Db,
  streak: StreakSummary,
  snapshot?: LedgerSnapshot,
): Promise<BadgeStats> {
  if (snapshot) {
    return {
      currentStreak: streak.current,
      longestStreak: streak.longest,
      totalXp: snapshot.totalXp,
      level: levelFromXp(snapshot.totalXp).level,
      ...snapshot.counts,
    };
  }

  const [
    habitCheckins,
    focusSessions,
    workouts,
    nutritionDays,
    questsCompleted,
    perfectDays,
    totalXp,
  ] = await Promise.all([
    readCount(db, `SELECT COUNT(*) AS value FROM habit_completions WHERE count > 0`),
    readCount(
      db,
      `SELECT COUNT(*) AS value FROM pomodoro_sessions
          WHERE session_type = 'focus' AND ended_at IS NOT NULL AND duration_seconds > 0`,
    ),
    readCount(db, `SELECT COUNT(*) AS value FROM workout_logs`),
    readCount(
      db,
      `SELECT COUNT(DISTINCT consumed_on) AS value FROM calorie_entries WHERE deleted_at IS NULL`,
    ),
    readCount(db, `SELECT COUNT(*) AS value FROM gamification_quests`),
    readCount(db, `SELECT COUNT(*) AS value FROM gamification_events WHERE event_kind = ?`, [
      PERFECT_DAY_EVENT_KIND,
    ]),
    readCount(db, `SELECT COALESCE(SUM(xp), 0) AS value FROM gamification_events`),
  ]);

  return {
    currentStreak: streak.current,
    longestStreak: streak.longest,
    totalXp,
    level: levelFromXp(totalXp).level,
    questsCompleted,
    perfectDays,
    habitCheckins,
    focusSessions,
    workouts,
    nutritionDays,
  };
}

/**
 * Habit-day completion for today, using the same scheduler + lifecycle masking
 * the Habits section uses, so "all habits done" never disagrees with the rings.
 */
async function loadDayCompletion(
  db: Db,
  todayKey: string,
  snapshot?: LedgerSnapshot,
): Promise<DayCompletionInput> {
  const memoized = snapshot?.dayCompletionByDate.get(todayKey);
  if (memoized) return memoized;
  const computed = await computeDayCompletion(db, todayKey);
  snapshot?.dayCompletionByDate.set(todayKey, computed);
  return computed;
}

/**
 * The uncached day-completion read. Memoized per pass by `loadDayCompletion`,
 * because an award that changes it is exactly the award that reports
 * `dayComplete` — `absorbAward` drops the memo in that case.
 */
async function computeDayCompletion(db: Db, todayKey: string): Promise<DayCompletionInput> {
  const [habits, completions, perfectDay] = await Promise.all([
    db.getAllAsync<HabitScheduleRead>(
      `SELECT id, target_per_day, rule_history, lifecycle_history, created_at
         FROM habits
        WHERE deleted_at IS NULL AND status = 'active'`,
    ),
    db.getAllAsync<{ habit_id: string; date_key: string; count: number }>(
      `SELECT habit_id, date_key, count FROM habit_completions WHERE date_key = ?`,
      [todayKey],
    ),
    db.getFirstAsync<CountRow>(
      `SELECT COUNT(*) AS value FROM gamification_events
        WHERE event_kind = ? AND source_key = ?`,
      [PERFECT_DAY_EVENT_KIND, todayKey],
    ),
  ]);

  const completionsByHabit = new Map<string, { date_key: string; count: number }[]>();
  for (const completion of completions) {
    const rows = completionsByHabit.get(completion.habit_id) ?? [];
    rows.push({ date_key: completion.date_key, count: completion.count });
    completionsByHabit.set(completion.habit_id, rows);
  }

  let activeHabits = 0;
  let completedHabitsAfter = 0;
  for (const habit of habits) {
    const [day] = buildDayCompletions(
      completionsByHabit.get(habit.id) ?? [],
      habit.target_per_day,
      1,
      habit.rule_history,
      habitCreationDateKey(habit.created_at),
      todayKey,
      habit.lifecycle_history,
    );
    if (!day || !day.scheduled || !day.eligible) continue;
    activeHabits += 1;
    if (day.completed) completedHabitsAfter += 1;
  }

  return { activeHabits, completedHabitsAfter, wasComplete: (perfectDay?.value ?? 0) > 0 };
}

// ---------------------------------------------------------------------------
// snapshot
// ---------------------------------------------------------------------------

function isDayComplete(dayCompletion: DayCompletionInput): boolean {
  return (
    dayCompletion.wasComplete ||
    (dayCompletion.activeHabits > 0 &&
      dayCompletion.completedHabitsAfter >= dayCompletion.activeHabits)
  );
}

/** Everything the gamification surfaces render from, in one bounded read. */
export async function readGamificationSnapshot(
  options: GamificationReadOptions = {},
): Promise<GamificationSnapshot> {
  const todayKey = options.todayKey ?? toDateKey();
  const db = await getDatabase();
  // One ledger read covers the day facts, the streak days, the freeze ladder,
  // the badge counters and today's XP together.
  const ledger = await readLedgerSnapshot(db);
  const streakDays = streakDaysFromSnapshot(ledger);
  const [facts, freezes, completedQuestIds, badgeIds, dayCompletion] = await Promise.all([
    loadDayFacts(db, todayKey, ledger),
    loadFreezeState(db, ledger),
    loadCompletedQuestIds(db, todayKey, ledger),
    loadBadgeIds(db, ledger),
    loadDayCompletion(db, todayKey, ledger),
  ]);
  const streak = computeStreakSummary(streakDays, todayKey);
  const stats = await loadBadgeStats(db, streak, ledger);

  return {
    todayKey,
    totalXp: stats.totalXp,
    xpToday: facts.xpEarned,
    level: levelFromXp(stats.totalXp),
    streak,
    freezes,
    quests: buildDailyQuests({ dateKey: todayKey, facts, completedQuestIds }),
    badges: badgeStates(stats, badgeIds),
    todayFacts: facts,
    week: buildWeek(streakDays, todayKey),
    dayComplete: isDayComplete(dayCompletion),
  };
}

// ---------------------------------------------------------------------------
// awarding
// ---------------------------------------------------------------------------

async function insertEvents(db: Db, result: GamificationAwardResult): Promise<void> {
  const createdAt = nowIso();
  for (const event of result.events) {
    await db.runAsync(
      `INSERT OR IGNORE INTO gamification_events
         (id, event_kind, source_key, date_key, xp, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [createId('gxp'), event.kind, event.sourceKey, event.dateKey, event.xp, createdAt],
    );
  }
}

/**
 * Reflect a committed award in the pass snapshot, so the NEXT award in the same
 * pass reads the same state a fresh query would have returned: the new day is
 * active, XP and counters move, milestone ladders and paid quests grow.
 *
 * Only state the award ITSELF creates may move here. `totalXp`, `perfectDays`,
 * `questsCompleted`, the freeze ladder and the milestone ladders are all ledger
 * rows this function's own inserts produce, so they advance. `habitCheckins`,
 * `focusSessions`, `workouts` and `nutritionDays` are counted from the FEATURE
 * tables (`habit_completions`, `pomodoro_sessions`, `workout_logs`,
 * `calorie_entries`); an award never writes those, so their totals are already
 * final in the snapshot — incrementing them would invent check-ins the user
 * never logged and unlock a badge past a threshold they have not reached.
 *
 * The insert is `INSERT OR IGNORE`, so the ledger — never this snapshot — stays
 * the authority on "already paid".
 */
function absorbAward(
  snapshot: LedgerSnapshot,
  result: GamificationAwardResult,
  dateKey: string,
): void {
  for (const event of result.events) {
    if (event.xp <= 0) continue;
    snapshot.activeDateKeys.add(event.dateKey);
    snapshot.activeEvents.push({ date_key: event.dateKey, xp: event.xp });
    snapshot.totalXp += event.xp;
    // Ledger-derived counters only (see the docstring above).
    if (event.kind === PERFECT_DAY_EVENT_KIND) snapshot.counts.perfectDays += 1;
    if (event.kind === STREAK_MILESTONE_EVENT_KIND) {
      const milestone = Number.parseInt(event.sourceKey.split(':')[1] ?? '', 10);
      if (Number.isFinite(milestone)) snapshot.milestones.streak.push(milestone);
    }
    if (event.kind === FREEZE_GRANT_EVENT_KIND) {
      snapshot.freezesEarned += 1;
      const milestone = Number.parseInt(event.sourceKey.split(':')[1] ?? '', 10);
      if (Number.isFinite(milestone)) snapshot.milestones.freeze.push(milestone);
    }
  }
  // An award that completes the day (or the first perfect-day event) changes
  // what the NEXT award in this pass would read, so the memo is dropped rather
  // than assumed still valid.
  if (result.dayComplete || result.perfectDay) {
    snapshot.dayCompletionByDate.delete(dateKey);
  }
  if (result.completedQuestIds.length > 0) {
    const paid = snapshot.questIdsByDate.get(dateKey) ?? new Set<string>();
    for (const questId of result.completedQuestIds) paid.add(questId);
    snapshot.questIdsByDate.set(dateKey, paid);
    snapshot.counts.questsCompleted += result.completedQuestIds.length;
  }
}

/**
 * Reward one real action.
 *
 * `entityId` identifies the action (habit id, todo id, focus session id,
 * workout log id, plan id, review id, or the day key for nutrition).
 * Entity-keyed awards REQUIRE the id on the fast path: without it the award
 * would silently land on the oldest unrewarded row of that kind rather than
 * the action just completed, so the call returns null and leaves the award
 * to reconcile backfill (which always passes explicit ids). This holds for
 * `todo`, `focus`, `workout`, `plan`, and `review`. Only `habit` (keyed
 * per-habit-per-day) and `nutrition` (keyed per-day) keep the oldest-
 * unrewarded fallback.
 *
 * Returns `null` when the action was already recorded — the ledger's unique
 * (kind, source key) index is the single source of truth for "already paid",
 * so replays (StrictMode double-invokes, reconcile racing a screen, a
 * 0→1→0→1 toggle) can never double-award.
 */
export type AwardInput = {
  kind: ActionKind;
  /** Habit id, todo id, session id, log id, plan id, review id, or the day key. */
  entityId?: string;
  todayKey?: string;
};

/** An award before the read model a UI renders is attached. */
type AwardCore = {
  result: GamificationAwardResult;
  newBadges: BadgeUnlock[];
  celebration: Celebration | null;
};

/**
 * The award itself, without reading back a snapshot.
 *
 * `ledger` lets a backfill pass share one ledger read and one quest-board
 * memo across its awards. It is only safe to pass because a pass never mutates
 * the ledger behind this function's back: every insert goes through
 * `applyAward`, which appends to the same snapshot. An already-paid action is
 * still detected by the authoritative `SELECT` inside the write transaction.
 */
async function computeAward(input: {
  kind: ActionKind;
  entityId?: string;
  todayKey: string;
  snapshot: LedgerSnapshot;
}): Promise<AwardCore | null> {
  const { todayKey, snapshot } = input;
  const db = await getDatabase();

  let entityId = input.entityId;
  if (!entityId) {
    // Entity-keyed fast-path awards must name the action just completed.
    // Falling back to the oldest unrewarded row here would credit the wrong
    // entity when several are unrewarded (todos by completed_at, focus
    // sessions by started_at, reviews by completed_at), so a missing id is a
    // miss (reconcile backfills it with the correct id). Plans are capped at
    // one active row per day today, but stay under the same guard for
    // uniformity and future-proofing — no production caller uses the
    // fallback, and reconcile always passes explicit ids.
    if (
      input.kind === 'workout' ||
      input.kind === 'todo' ||
      input.kind === 'focus' ||
      input.kind === 'plan' ||
      input.kind === 'review'
    ) {
      return null;
    }
    const candidate = (await loadActivityCandidates(db, todayKey)).find(
      (entry) => entry.kind === input.kind,
    );
    if (!candidate) return null;
    entityId = candidate.entityId;
  }
  const sourceKey = actionSourceKey(input.kind, entityId, todayKey);

  // Everything the reward math reads is derived from feature activity plus the
  // ledger BEFORE this write: feature counts today, and the ledger as the pass
  // has observed it.
  const [facts, freezes, completedQuestIds, milestones, dayCompletion] = await Promise.all([
    loadDayFacts(db, todayKey, snapshot),
    loadFreezeState(db, snapshot),
    loadCompletedQuestIds(db, todayKey, snapshot),
    loadRecordedMilestones(db, snapshot),
    loadDayCompletion(db, todayKey, snapshot),
  ]);
  const streakDays = streakDaysFromSnapshot(snapshot);

  const result = await withSQLiteTransaction(db, async (transactionDb) => {
    const existing = await transactionDb.getFirstAsync<{ id: string }>(
      `SELECT id FROM gamification_events WHERE event_kind = ? AND source_key = ?`,
      [input.kind, sourceKey],
    );
    if (existing) return null;

    const award = computeActionReward({
      kind: input.kind,
      sourceKey,
      dateKey: todayKey,
      todayKey,
      xpBefore: snapshot.totalXp,
      facts,
      quests: buildDailyQuests({ dateKey: todayKey, facts, completedQuestIds }),
      streakDays,
      recordedStreakMilestones: milestones.streak,
      recordedFreezeMilestones: milestones.freeze,
      freezes,
      dayCompletion,
    });

    await insertEvents(transactionDb, award);
    const completedAt = nowIso();
    for (const questId of award.completedQuestIds) {
      await transactionDb.runAsync(
        `INSERT OR IGNORE INTO gamification_quests (date_key, quest_id, completed_at)
         VALUES (?, ?, ?)`,
        [todayKey, questId, completedAt],
      );
    }
    absorbAward(snapshot, award, todayKey);
    return award;
  });

  if (!result) return null;

  // Badges read post-write counters, so they are evaluated against the snapshot
  // AFTER the award was absorbed into it; INSERT OR IGNORE keeps concurrent
  // awards harmless.
  const streak = computeStreakSummary(streakDaysFromSnapshot(snapshot), todayKey);
  const stats = await loadBadgeStats(db, streak, snapshot);
  const unlockedIds = await loadBadgeIds(db, snapshot);
  const newBadges = evaluateBadges(stats, unlockedIds);
  if (newBadges.length > 0) {
    const unlockedAt = nowIso();
    for (const badge of newBadges) {
      await db.runAsync(
        `INSERT OR IGNORE INTO gamification_badges (badge_id, family, tier, unlocked_at, date_key)
         VALUES (?, ?, ?, ?, ?)`,
        [badge.id, badge.family, badge.tier, unlockedAt, todayKey],
      );
    }
    // Keep the pass memo truthful: the next award must not re-earn these.
    snapshot.unlockedBadgeIds = [
      ...(snapshot.unlockedBadgeIds ?? unlockedIds),
      ...newBadges.map((badge) => badge.id),
    ].sort();
  }

  const celebration = pickCelebration([
    ...(result.celebration ? [result.celebration] : []),
    ...newBadges.map(celebrationForBadge),
  ]);

  return { result, newBadges, celebration };
}

/**
 * Reward one real action and read back the snapshot the rewarding surface
 * renders.
 *
 * See `computeAward` for the id and idempotency contracts; this wrapper only
 * adds the fresh read model. A backfill pass awards many actions through
 * `computeAward` and takes ONE snapshot when it ends.
 */
export async function awardGamificationAction(
  input: AwardInput,
): Promise<GamificationAwardOutcome | null> {
  const todayKey = input.todayKey ?? toDateKey();
  const db = await getDatabase();
  const core = await computeAward({
    ...input,
    todayKey,
    snapshot: await readLedgerSnapshot(db),
  });
  if (!core) return null;
  return { ...core, snapshot: await readGamificationSnapshot({ todayKey }) };
}

type ActivityCandidate = { kind: ActionKind; entityId: string };

/**
 * Find today's real actions that are not in the ledger yet.
 *
 * This is how actions that never touched a gamification-aware screen (habit
 * reminder quick-actions, command center, restore-side writes) still earn XP
 * once — and it is why the screens' direct calls are pure latency
 * optimization rather than the source of truth.
 */
async function loadActivityCandidates(db: Db, todayKey: string): Promise<ActivityCandidate[]> {
  const { startUtcIso, endUtcExclusiveIso } = getUtcIsoRangeForLocalDateKeys(todayKey, todayKey);
  const [habits, todos, focus, workouts, nutrition, plans, reviews] = await Promise.all([
    // `habit_id`, not the completion row id: the reward key must match what a
    // screen passes (`habitId`), or reconcile would pay the same check-in twice.
    db.getAllAsync<{ id: string }>(
      `SELECT habit_id AS id FROM habit_completions WHERE date_key = ? AND count > 0
        ORDER BY created_at ASC LIMIT ?`,
      [todayKey, RECONCILE_AWARD_LIMIT],
    ),
    db.getAllAsync<{ id: string }>(
      `SELECT id FROM todos
        WHERE completed = 1 AND deleted_at IS NULL AND completed_at >= ? AND completed_at < ?
        ORDER BY completed_at ASC LIMIT ?`,
      [startUtcIso, endUtcExclusiveIso, RECONCILE_AWARD_LIMIT],
    ),
    db.getAllAsync<{ id: string }>(
      `SELECT id FROM pomodoro_sessions
        WHERE session_type = 'focus' AND ended_at IS NOT NULL AND duration_seconds > 0
          AND started_at >= ? AND started_at < ?
        ORDER BY started_at ASC LIMIT ?`,
      [startUtcIso, endUtcExclusiveIso, RECONCILE_AWARD_LIMIT],
    ),
    db.getAllAsync<{ id: string }>(
      `SELECT id FROM workout_logs WHERE completed_at >= ? AND completed_at < ?
        ORDER BY completed_at ASC LIMIT ?`,
      [startUtcIso, endUtcExclusiveIso, RECONCILE_AWARD_LIMIT],
    ),
    db.getFirstAsync<{ id: string }>(
      `SELECT id FROM calorie_entries
        WHERE deleted_at IS NULL AND consumed_on = ? LIMIT 1`,
      [todayKey],
    ),
    db.getAllAsync<{ id: string }>(
      `SELECT id FROM daily_plans
        WHERE deleted_at IS NULL AND date_key = ? AND status IN ('committed', 'completed')
        LIMIT ?`,
      [todayKey, RECONCILE_AWARD_LIMIT],
    ),
    db.getAllAsync<{ id: string }>(
      `SELECT id FROM weekly_reviews
        WHERE status = 'completed' AND deleted_at IS NULL
          AND completed_at >= ? AND completed_at < ?
        ORDER BY completed_at ASC LIMIT ?`,
      [startUtcIso, endUtcExclusiveIso, RECONCILE_AWARD_LIMIT],
    ),
  ]);

  return [
    ...habits.map((row) => ({ kind: 'habit' as const, entityId: row.id })),
    ...todos.map((row) => ({ kind: 'todo' as const, entityId: row.id })),
    ...focus.map((row) => ({ kind: 'focus' as const, entityId: row.id })),
    ...workouts.map((row) => ({ kind: 'workout' as const, entityId: row.id })),
    ...(nutrition ? [{ kind: 'nutrition' as const, entityId: todayKey }] : []),
    ...plans.map((row) => ({ kind: 'plan' as const, entityId: row.id })),
    ...reviews.map((row) => ({ kind: 'review' as const, entityId: row.id })),
  ];
}

/**
 * Backfill one day from the pass snapshot.
 *
 * The whole day shares ONE ledger read (`snapshot`) and ONE quest-board memo
 * instead of re-scanning two ledger tables per award — the hot path audit C §2
 * issue #3 measured at ~7x25x2 scans per foreground.
 */
async function reconcileDayAwards(
  db: Db,
  dateKey: string,
  snapshot: LedgerSnapshot,
): Promise<number> {
  const candidates = await loadActivityCandidates(db, dateKey);
  let awarded = 0;
  for (const candidate of candidates) {
    if (awarded >= RECONCILE_AWARD_LIMIT) break;
    const outcome = await computeAward({
      kind: candidate.kind,
      entityId: candidate.entityId,
      todayKey: dateKey,
      snapshot,
    });
    if (outcome) awarded += 1;
  }
  return awarded;
}

/**
 * Backfill rewards for today's actions that were never reported.
 *
 * Deliberately silent: a backfilled reward must not throw a confetti overlay
 * for something the user did minutes ago in another surface.
 */
export async function reconcileGamificationActivity(
  options: GamificationReadOptions = {},
): Promise<ReconcileOutcome> {
  const todayKey = options.todayKey ?? toDateKey();
  const db = await getDatabase();
  const ledger = await readLedgerSnapshot(db);
  const awarded = await reconcileDayAwards(db, todayKey, ledger);
  return { awarded, snapshot: await readGamificationSnapshot({ todayKey }) };
}

/**
 * Spend a banked freeze on the most recent missed day, if one is available and
 * the run before it is still alive. Called on foreground/day rollover; the
 * resulting row is what makes the streak survive a miss.
 */
export async function ensureStreakFreeze(
  options: GamificationReadOptions = {},
): Promise<{ savedDateKey: string } | null> {
  const todayKey = options.todayKey ?? toDateKey();
  const db = await getDatabase();
  const ledger = await readLedgerSnapshot(db);
  const [streakDays, freezes] = await Promise.all([
    loadStreakDays(db, ledger),
    loadFreezeState(db, ledger),
  ]);
  const savedDateKey = planAutoFreeze({ days: streakDays, todayKey, banked: freezes.banked });
  if (!savedDateKey) return null;
  await db.runAsync(
    `INSERT OR IGNORE INTO gamification_streak_freezes (date_key, saved_at) VALUES (?, ?)`,
    [savedDateKey, nowIso()],
  );
  return { savedDateKey };
}

/**
 * One housekeeping pass in the only order that cannot misclassify a real
 * action as a missed day: award unrewarded feature activity across the bounded
 * lookback (oldest first), THEN let freeze planning look at the ledger those
 * awards produced.
 *
 * The lookback is bounded to GAMIFICATION_RECONCILE_LOOKBACK_DAYS local days.
 * The original today+yesterday window was the failure mode: a notification
 * completion written before midnight and opened after it (or any offline day
 * beyond one) was permanently unpaid. A per-day pass keeps the award cap
 * scoped to each day and the ledger's unique source key keeps replays cheap;
 * an unbounded scan would rewrite historical streaks, so the window stays
 * fixed and small.
 */
export async function runGamificationHousekeeping(
  options: GamificationReadOptions = {},
): Promise<void> {
  const todayKey = options.todayKey ?? toDateKey();
  const db = await getDatabase();
  // ONE ledger read and one quest-board memo for the whole 7-day window; every
  // award appends to the same snapshot, so each subsequent day sees the ledger
  // the previous day's awards produced (audit C §2 issue #3).
  const ledger = await readLedgerSnapshot(db);
  for (let offset = GAMIFICATION_RECONCILE_LOOKBACK_DAYS - 1; offset >= 0; offset -= 1) {
    await reconcileDayAwards(db, shiftDateKey(todayKey, -offset), ledger);
  }
  // Freeze planning must observe the awards this pass just wrote, so it reads
  // the ledger again rather than the pre-award snapshot.
  await ensureStreakFreeze({ todayKey });
}
