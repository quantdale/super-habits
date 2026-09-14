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
 * today's actions at most, so this only guards against pathological data.
 */
const RECONCILE_AWARD_LIMIT = 25;

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
// canonical reads
// ---------------------------------------------------------------------------

/** Today's counts, straight from the feature tables. */
async function loadDayFacts(db: Db, todayKey: string): Promise<DayFacts> {
  const { startUtcIso, endUtcExclusiveIso } = getUtcIsoRangeForLocalDateKeys(todayKey, todayKey);
  const [habitCheckins, todosCompleted, focus, workouts, mealsLogged, planCommitted, xpEarned] =
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
      readCount(
        db,
        `SELECT COALESCE(SUM(xp), 0) AS value FROM gamification_events WHERE date_key = ?`,
        [todayKey],
      ),
    ]);

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
 * Every day the user was active, plus the days a freeze saved. Newest first in
 * SQL, then returned oldest-first for streak math.
 */
async function loadStreakDays(db: Db): Promise<StreakDay[]> {
  const [activeRows, freezeRows] = await Promise.all([
    db.getAllAsync<{ date_key: string }>(
      `SELECT DISTINCT date_key FROM gamification_events
        WHERE xp > 0
        ORDER BY date_key DESC
        LIMIT ?`,
      [STREAK_HISTORY_LIMIT],
    ),
    db.getAllAsync<{ date_key: string }>(
      `SELECT date_key FROM gamification_streak_freezes ORDER BY date_key ASC`,
    ),
  ]);

  const byDate = new Map<string, StreakDay>();
  for (const row of activeRows) {
    byDate.set(row.date_key, { dateKey: row.date_key, active: true, frozen: false });
  }
  for (const row of freezeRows) {
    const existing = byDate.get(row.date_key);
    byDate.set(
      row.date_key,
      existing
        ? { ...existing, frozen: true }
        : { dateKey: row.date_key, active: false, frozen: true },
    );
  }
  return [...byDate.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

async function loadFreezeState(db: Db): Promise<StreakFreezeState> {
  const [earned, used] = await Promise.all([
    readCount(db, `SELECT COUNT(*) AS value FROM gamification_events WHERE event_kind = ?`, [
      FREEZE_GRANT_EVENT_KIND,
    ]),
    readCount(db, `SELECT COUNT(*) AS value FROM gamification_streak_freezes`),
  ]);
  return streakFreezeState({ earned, used });
}

async function loadRecordedMilestones(db: Db): Promise<{ streak: number[]; freeze: number[] }> {
  const rows = await db.getAllAsync<{ event_kind: string; source_key: string }>(
    `SELECT event_kind, source_key FROM gamification_events WHERE event_kind IN (?, ?)`,
    [STREAK_MILESTONE_EVENT_KIND, FREEZE_GRANT_EVENT_KIND],
  );
  const streak: number[] = [];
  const freeze: number[] = [];
  for (const row of rows) {
    const milestone = Number.parseInt(row.source_key.split(':')[1] ?? '', 10);
    if (!Number.isFinite(milestone)) continue;
    (row.event_kind === STREAK_MILESTONE_EVENT_KIND ? streak : freeze).push(milestone);
  }
  return { streak, freeze };
}

async function loadCompletedQuestIds(db: Db, dateKey: string): Promise<string[]> {
  const rows = await db.getAllAsync<{ quest_id: string }>(
    `SELECT quest_id FROM gamification_quests WHERE date_key = ? ORDER BY quest_id ASC`,
    [dateKey],
  );
  return rows.map((row) => row.quest_id);
}

async function loadBadgeIds(db: Db): Promise<string[]> {
  const rows = await db.getAllAsync<{ badge_id: string }>(
    `SELECT badge_id FROM gamification_badges ORDER BY badge_id ASC`,
  );
  return rows.map((row) => row.badge_id);
}

/** Lifetime counters every badge family reads from. */
async function loadBadgeStats(db: Db, streak: StreakSummary): Promise<BadgeStats> {
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
async function loadDayCompletion(db: Db, todayKey: string): Promise<DayCompletionInput> {
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
  const [facts, streakDays, freezes, completedQuestIds, badgeIds, dayCompletion] =
    await Promise.all([
      loadDayFacts(db, todayKey),
      loadStreakDays(db),
      loadFreezeState(db),
      loadCompletedQuestIds(db, todayKey),
      loadBadgeIds(db),
      loadDayCompletion(db, todayKey),
    ]);
  const streak = computeStreakSummary(streakDays, todayKey);
  const stats = await loadBadgeStats(db, streak);

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
 * Reward one real action.
 *
 * `entityId` identifies the action when the caller has it (habit, todo, focus
 * session). Callers that only know the kind — a workout log whose insert
 * returns no id, a committed daily plan, a completed weekly review — omit it,
 * and the newest unrewarded action of that kind is awarded instead.
 *
 * Returns `null` when the action was already recorded — the ledger's unique
 * (kind, source key) index is the single source of truth for "already paid",
 * so replays (StrictMode double-invokes, reconcile racing a screen, a
 * 0→1→0→1 toggle) can never double-award.
 */
export async function awardGamificationAction(input: {
  kind: ActionKind;
  /** Habit id, todo id, session id, log id, plan id, review id, or the day key. */
  entityId?: string;
  todayKey?: string;
}): Promise<GamificationAwardOutcome | null> {
  const todayKey = input.todayKey ?? toDateKey();
  const db = await getDatabase();

  let entityId = input.entityId;
  if (!entityId) {
    const candidate = (await loadActivityCandidates(db, todayKey)).find(
      (entry) => entry.kind === input.kind,
    );
    if (!candidate) return null;
    entityId = candidate.entityId;
  }
  const sourceKey = actionSourceKey(input.kind, entityId, todayKey);

  const result = await withSQLiteTransaction(db, async (transactionDb) => {
    const existing = await transactionDb.getFirstAsync<{ id: string }>(
      `SELECT id FROM gamification_events WHERE event_kind = ? AND source_key = ?`,
      [input.kind, sourceKey],
    );
    if (existing) return null;

    const [facts, streakDays, freezes, completedQuestIds, milestones, dayCompletion, xpRow] =
      await Promise.all([
        loadDayFacts(transactionDb, todayKey),
        loadStreakDays(transactionDb),
        loadFreezeState(transactionDb),
        loadCompletedQuestIds(transactionDb, todayKey),
        loadRecordedMilestones(transactionDb),
        loadDayCompletion(transactionDb, todayKey),
        transactionDb.getFirstAsync<CountRow>(
          `SELECT COALESCE(SUM(xp), 0) AS value FROM gamification_events`,
        ),
      ]);

    const award = computeActionReward({
      kind: input.kind,
      sourceKey,
      dateKey: todayKey,
      todayKey,
      xpBefore: Math.max(0, Math.floor(xpRow?.value ?? 0)),
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
    return award;
  });

  if (!result) return null;

  // Badges read post-write aggregates, so they are evaluated after the action
  // transaction commits; INSERT OR IGNORE keeps concurrent awards harmless.
  const streakDays = await loadStreakDays(db);
  const streak = computeStreakSummary(streakDays, todayKey);
  const stats = await loadBadgeStats(db, streak);
  const unlockedIds = await loadBadgeIds(db);
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
  }

  const celebration = pickCelebration([
    ...(result.celebration ? [result.celebration] : []),
    ...newBadges.map(celebrationForBadge),
  ]);

  return {
    result,
    newBadges,
    celebration,
    snapshot: await readGamificationSnapshot({ todayKey }),
  };
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
  const candidates = await loadActivityCandidates(db, todayKey);
  let awarded = 0;
  for (const candidate of candidates) {
    if (awarded >= RECONCILE_AWARD_LIMIT) break;
    const outcome = await awardGamificationAction({
      kind: candidate.kind,
      entityId: candidate.entityId,
      todayKey,
    });
    if (outcome) awarded += 1;
  }
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
  const [streakDays, freezes] = await Promise.all([loadStreakDays(db), loadFreezeState(db)]);
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
 * action as a missed day: award unrewarded feature activity for yesterday and
 * today, THEN let freeze planning look at the ledger those awards produced.
 *
 * The lookback is bounded to the immediately previous local day: a
 * notification completion written before midnight and opened after it is the
 * failure mode, and an unbounded scan would rewrite historical streaks.
 */
export async function runGamificationHousekeeping(
  options: GamificationReadOptions = {},
): Promise<void> {
  const todayKey = options.todayKey ?? toDateKey();
  const yesterdayKey = shiftDateKey(todayKey, -1);
  await reconcileGamificationActivity({ todayKey: yesterdayKey });
  await reconcileGamificationActivity({ todayKey });
  await ensureStreakFreeze({ todayKey });
}
