/**
 * Gamification contracts: XP ledger, level curve, streak/freeze state, daily
 * quests, tier badges.
 *
 * Persistence is deliberately local-only: gamification is a *derived*
 * engagement layer over the authoritative feature tables (habits, todos,
 * pomodoro, workout, calories, plans, reviews). It is not part of the synced
 * or backup-scoped entity set, so a device that never syncs still has the full
 * loop, and a restore never resurrects stale reward state.
 *
 * Everything in this file is pure data: no DB, no React, no clock reads.
 */

// ---------------------------------------------------------------------------
// XP sources and awards
// ---------------------------------------------------------------------------

/** Kinds of ledger events. Only some of them carry XP. */
export const GAMIFICATION_EVENT_KINDS = [
  'habit',
  'todo',
  'focus',
  'workout',
  'nutrition',
  'plan',
  'review',
  'perfect_day',
  'quest',
  'streak_milestone',
  'freeze_grant',
  'freeze_use',
] as const;

export type GamificationEventKind = (typeof GAMIFICATION_EVENT_KINDS)[number];

/** Base XP per meaningful action, before the streak multiplier. */
export const XP_AWARDS: Record<
  Extract<
    GamificationEventKind,
    | 'habit'
    | 'todo'
    | 'focus'
    | 'workout'
    | 'nutrition'
    | 'plan'
    | 'review'
    | 'perfect_day'
    | 'quest'
  >,
  number
> = {
  habit: 10,
  todo: 5,
  focus: 15,
  workout: 20,
  nutrition: 5,
  plan: 8,
  review: 25,
  perfect_day: 25,
  quest: 15,
};

/** Event kinds that record state without awarding XP. */
export const NON_AWARDING_EVENT_KINDS: readonly GamificationEventKind[] = [
  'freeze_grant',
  'freeze_use',
];

// ---------------------------------------------------------------------------
// Streak multiplier + milestones
// ---------------------------------------------------------------------------

/** Higher streaks are worth more; thresholds are inclusive lower bounds. */
export const STREAK_MULTIPLIER_STEPS: readonly { minDays: number; multiplier: number }[] = [
  { minDays: 60, multiplier: 1.5 },
  { minDays: 30, multiplier: 1.4 },
  { minDays: 14, multiplier: 1.3 },
  { minDays: 7, multiplier: 1.2 },
  { minDays: 3, multiplier: 1.1 },
  { minDays: 0, multiplier: 1 },
];

/** Reaching a milestone awards bonus XP once per lifetime (idempotent key). */
export const STREAK_MILESTONES: readonly number[] = [3, 7, 14, 30, 60, 100, 180, 365];

/** Bonus XP for a milestone: linear in the milestone, capped so late game stays sane. */
export const STREAK_MILESTONE_XP_PER_DAY = 5;
export const STREAK_MILESTONE_XP_CAP = 250;

/** Milestones that also bank a streak freeze. */
export const STREAK_FREEZE_GRANT_MILESTONES: readonly number[] = [7, 30, 100, 365];

/** A user can bank at most this many unused freezes. */
export const MAX_BANKED_FREEZES = 3;

// ---------------------------------------------------------------------------
// Level curve
// ---------------------------------------------------------------------------

/** XP needed to advance from `level` to `level + 1`. */
export const LEVEL_XP_BASE = 50;
export const LEVEL_XP_EXPONENT = 1.4;

/** Named bands; the highest band whose `minLevel` is <= level wins. */
export const LEVEL_TITLES: readonly { minLevel: number; title: string }[] = [
  { minLevel: 20, title: 'Legend' },
  { minLevel: 16, title: 'Trailblazer' },
  { minLevel: 12, title: 'Master' },
  { minLevel: 8, title: 'Navigator' },
  { minLevel: 5, title: 'Achiever' },
  { minLevel: 3, title: 'Builder' },
  { minLevel: 1, title: 'Starter' },
];

export type LevelProgress = {
  level: number;
  title: string;
  /** XP accumulated inside the current level. */
  xpIntoLevel: number;
  /** XP required to finish the current level. */
  xpForNextLevel: number;
  /** Total XP already accumulated across all levels. */
  totalXp: number;
  /** 0..1 fraction of the current level. */
  ratio: number;
  /** XP still missing before the next level. */
  xpToNextLevel: number;
};

// ---------------------------------------------------------------------------
// Daily quests
// ---------------------------------------------------------------------------

/**
 * Canonical day metrics a quest can track. Every metric is derived from an
 * authoritative feature table — quests never invent their own state.
 */
export type QuestMetric =
  | 'habit_checkins'
  | 'todos_completed'
  | 'focus_sessions'
  | 'focus_minutes'
  | 'workouts'
  | 'meals_logged'
  | 'xp_earned'
  | 'plan_committed';

export type QuestTemplate = {
  id: string;
  metric: QuestMetric;
  title: string;
  /** MaterialIcons glyph name. */
  icon: string;
  target: number;
  /** Unit noun used for progress copy ("3 of 4 check-ins"). */
  unit: string;
};

export type DailyQuestState = {
  id: string;
  metric: QuestMetric;
  title: string;
  icon: string;
  unit: string;
  target: number;
  progress: number;
  complete: boolean;
  /** XP granted when the quest completes. */
  xpReward: number;
};

/** Today's canonical counts, gathered from the authoritative feature tables. */
export type DayFacts = {
  habitCheckins: number;
  todosCompleted: number;
  focusSessions: number;
  focusMinutes: number;
  workouts: number;
  mealsLogged: number;
  planCommitted: number;
  /** Ledger total for today. */
  xpEarned: number;
};

/** How many quests rotate in per day. */
export const DAILY_QUEST_COUNT = 3;

/** Quest pool; the daily rotation picks one per metric. */
export const DAILY_QUEST_POOL: readonly QuestTemplate[] = [
  {
    id: 'habit_trio',
    metric: 'habit_checkins',
    title: 'Habit checkpoint',
    icon: 'check-circle',
    target: 3,
    unit: 'check-ins',
  },
  {
    id: 'habit_sweep',
    metric: 'habit_checkins',
    title: 'Full habit sweep',
    icon: 'done-all',
    target: 5,
    unit: 'check-ins',
  },
  {
    id: 'task_clearing',
    metric: 'todos_completed',
    title: 'Clear the deck',
    icon: 'checklist',
    target: 3,
    unit: 'tasks',
  },
  {
    id: 'task_quick_win',
    metric: 'todos_completed',
    title: 'Quick win',
    icon: 'flash-on',
    target: 1,
    unit: 'task',
  },
  {
    id: 'focus_sprint',
    metric: 'focus_sessions',
    title: 'Focus sprint',
    icon: 'timer',
    target: 2,
    unit: 'sessions',
  },
  {
    id: 'deep_work',
    metric: 'focus_minutes',
    title: 'Deep work',
    icon: 'hourglass-bottom',
    target: 50,
    unit: 'minutes',
  },
  {
    id: 'move_body',
    metric: 'workouts',
    title: 'Move your body',
    icon: 'fitness-center',
    target: 1,
    unit: 'workout',
  },
  {
    id: 'log_meals',
    metric: 'meals_logged',
    title: 'Log your meals',
    icon: 'restaurant',
    target: 2,
    unit: 'meals',
  },
  {
    id: 'xp_hunter',
    metric: 'xp_earned',
    title: 'XP hunter',
    icon: 'bolt',
    target: 60,
    unit: 'XP',
  },
  {
    id: 'plan_today',
    metric: 'plan_committed',
    title: 'Plan today',
    icon: 'event-available',
    target: 1,
    unit: 'plan',
  },
];

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export type BadgeFamily =
  | 'streak'
  | 'xp'
  | 'level'
  | 'quests'
  | 'perfect_days'
  | 'habits'
  | 'focus'
  | 'workouts'
  | 'nutrition';

/** 1 = Bronze, 2 = Silver, 3 = Gold, 4 = Platinum. */
export type BadgeTier = 1 | 2 | 3 | 4;

export type BadgeFamilyDefinition = {
  family: BadgeFamily;
  label: string;
  description: string;
  /** MaterialIcons glyph name. */
  icon: string;
  /** Threshold per tier, index 0 => Bronze. */
  thresholds: readonly [number, number, number, number];
  unit: string;
};

/** Lifetime stat snapshot every badge family reads from. */
export type BadgeStats = {
  currentStreak: number;
  longestStreak: number;
  totalXp: number;
  level: number;
  questsCompleted: number;
  perfectDays: number;
  habitCheckins: number;
  focusSessions: number;
  workouts: number;
  nutritionDays: number;
};

export type BadgeUnlock = {
  id: string;
  family: BadgeFamily;
  tier: BadgeTier;
  label: string;
  description: string;
  icon: string;
  threshold: number;
};

export type BadgeState = BadgeUnlock & {
  unlocked: boolean;
  /** Current value of the family metric (may exceed the threshold). */
  progress: number;
  ratio: number;
};

/** Stable badge id: `family:tier`. */
export function badgeId(family: BadgeFamily, tier: BadgeTier): string {
  return `${family}:${tier}`;
}

/** Display names for tiers 1..4. */
export const BADGE_TIER_LABELS: readonly [string, string, string, string] = [
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
];

// ---------------------------------------------------------------------------
// Celebration
// ---------------------------------------------------------------------------

export type CelebrationTier = 'small' | 'quest' | 'streak' | 'day' | 'badge' | 'level';

export type Celebration = {
  tier: CelebrationTier;
  title: string;
  message: string;
  /** MaterialIcons glyph name. */
  icon: string;
  xp: number;
};

/** Higher wins when several celebrations land at once. */
export const CELEBRATION_PRIORITY: Record<CelebrationTier, number> = {
  small: 0,
  quest: 1,
  streak: 2,
  day: 3,
  badge: 4,
  level: 5,
};

// ---------------------------------------------------------------------------
// Persisted ledger + read model
// ---------------------------------------------------------------------------

/** SQL-facing literals for the ledger kinds queried by name. */
export const STREAK_MILESTONE_EVENT_KIND: GamificationEventKind = 'streak_milestone';
export const FREEZE_GRANT_EVENT_KIND: GamificationEventKind = 'freeze_grant';
export const PERFECT_DAY_EVENT_KIND: GamificationEventKind = 'perfect_day';

/** One row of the local XP ledger (idempotent on `kind` + `sourceKey`). */
export type GamificationEventDraft = {
  kind: GamificationEventKind;
  /** Idempotency key: at most one row per (kind, sourceKey) for all time. */
  sourceKey: string;
  dateKey: string;
  xp: number;
};

/** User actions that can award XP. One call == one action. */
export type ActionKind = 'habit' | 'todo' | 'focus' | 'workout' | 'nutrition' | 'plan' | 'review';

/** Habit-day completion counters, read after the action already landed. */
export type DayCompletionInput = {
  /** Active habits that have a schedule today. */
  activeHabits: number;
  /** Habits at or above target today, including the action in flight. */
  completedHabitsAfter: number;
  /** A `perfect_day` event already exists for today (no re-award). */
  wasComplete: boolean;
};

export type StreakDay = {
  dateKey: string;
  active: boolean;
  frozen: boolean;
};

export type StreakSummary = {
  current: number;
  longest: number;
  activeToday: boolean;
  /** Today is still open, so the streak survives on grace alone. */
  atRisk: boolean;
  /** The most recent day with real activity (never a frozen day). */
  lastActiveDateKey: string | null;
};

export type StreakFreezeState = {
  /** Freezes earned at milestones but not yet consumed. */
  banked: number;
  /** Freezes consumed by saved days. */
  used: number;
  /** Total earned over the lifetime. */
  earned: number;
};

export type GamificationSnapshot = {
  todayKey: string;
  totalXp: number;
  xpToday: number;
  level: LevelProgress;
  streak: StreakSummary;
  freezes: StreakFreezeState;
  quests: DailyQuestState[];
  badges: BadgeState[];
  todayFacts: DayFacts;
  /** Trailing 7 local days, oldest first, ending today. */
  week: StreakDay[];
  /** Every active habit reached its target today and at least one exists. */
  dayComplete: boolean;
};

/**
 * Everything the engine needs to reward one action, read before it lands.
 * `facts` carries the counts *after* the action except for `xpEarned`, which
 * is the ledger total for today before this action — the engine adds this
 * action's own XP, so an `xp_earned` quest can never reward itself.
 */
export type ActionRewardInput = {
  kind: ActionKind;
  /** Idempotency key; the caller owns its shape (e.g. `${dateKey}:${habitId}`). */
  sourceKey: string;
  dateKey: string;
  todayKey: string;
  /** Lifetime XP before this action. */
  xpBefore: number;
  facts: DayFacts;
  /** Today's quests as currently persisted. */
  quests: DailyQuestState[];
  /** Full day history used for streak math (oldest first). */
  streakDays: StreakDay[];
  /** Streak milestones already recorded in the ledger. */
  recordedStreakMilestones: readonly number[];
  /** Freeze-grant milestones already recorded in the ledger. */
  recordedFreezeMilestones: readonly number[];
  freezes: StreakFreezeState;
  dayCompletion: DayCompletionInput;
};

/**
 * Outcome of one recorded action, computed purely from the pre-action state.
 * The caller persists `events`, then surfaces `celebration`.
 */
export type GamificationAwardResult = {
  xpAwarded: number;
  baseXp: number;
  multiplier: number;
  events: GamificationEventDraft[];
  /** Quest ids that completed on this action. */
  completedQuestIds: string[];
  streakMilestone: number | null;
  freezeGranted: boolean;
  perfectDay: boolean;
  dayComplete: boolean;
  celebration: Celebration | null;
  totalXpAfter: number;
  levelAfter: LevelProgress;
  levelUp: { from: number; to: number; title: string } | null;
  /** Canonical facts after the action, including this action's XP. */
  factsAfter: DayFacts;
  streakAfter: StreakSummary;
};
