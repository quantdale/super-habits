/**
 * Pure gamification engine: XP curve, streak + freeze economics, daily quest
 * rotation, and tier badges.
 *
 * No DB, no React, no clock reads — every function takes the state it needs so
 * the whole reward loop is unit-testable and reproducible for a given date.
 */

import { dateKeyToLocalDate, isValidDateKey, toDateKey } from '@/lib/time';
import {
  BADGE_TIER_LABELS,
  CELEBRATION_PRIORITY,
  DAILY_QUEST_POOL,
  DAILY_QUEST_COUNT,
  LEVEL_TITLES,
  LEVEL_XP_BASE,
  LEVEL_XP_EXPONENT,
  MAX_BANKED_FREEZES,
  STREAK_FREEZE_GRANT_MILESTONES,
  STREAK_MILESTONE_XP_CAP,
  STREAK_MILESTONE_XP_PER_DAY,
  STREAK_MILESTONES,
  STREAK_MULTIPLIER_STEPS,
  XP_AWARDS,
  badgeId,
  type ActionKind,
  type ActionRewardInput,
  type BadgeFamily,
  type BadgeFamilyDefinition,
  type BadgeState,
  type BadgeStats,
  type BadgeTier,
  type BadgeUnlock,
  type Celebration,
  type DailyQuestState,
  type DayFacts,
  type GamificationAwardResult,
  type GamificationEventDraft,
  type LevelProgress,
  type QuestMetric,
  type QuestTemplate,
  type StreakDay,
  type StreakFreezeState,
  type StreakSummary,
} from './gamification.types';

// ---------------------------------------------------------------------------
// date helpers (pure, local-calendar)
// ---------------------------------------------------------------------------

/** Shift a local date key by whole days; keeps the key format valid. */
export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const date = dateKeyToLocalDate(dateKey);
  date.setDate(date.getDate() + deltaDays);
  return toDateKey(date);
}

function safeDateKey(dateKey: string): string {
  return isValidDateKey(dateKey) ? dateKey : toDateKey();
}

// ---------------------------------------------------------------------------
// deterministic rotation
// ---------------------------------------------------------------------------

/** FNV-1a — a tiny, stable string hash so a date always picks the same set. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Seeded PRNG (mulberry32): same seed always yields the same quest set. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The day's quest set. Rotation is a function of the date key alone, so the
 * same day always yields the same quests (persistence only stores progress)
 * and two devices on the same day agree without talking to each other.
 * One quest per metric keeps a day from stacking three near-identical goals.
 */
export function selectDailyQuestTemplates(
  dateKey: string,
  count = DAILY_QUEST_COUNT,
): QuestTemplate[] {
  const random = mulberry32(hashString(`superhabits.quests.${safeDateKey(dateKey)}`));
  const pool = [...DAILY_QUEST_POOL];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const current = pool[index];
    pool[index] = pool[swap];
    pool[swap] = current;
  }
  const picked: QuestTemplate[] = [];
  const usedMetrics = new Set<QuestMetric>();
  for (const template of pool) {
    if (usedMetrics.has(template.metric)) continue;
    picked.push(template);
    usedMetrics.add(template.metric);
    if (picked.length >= count) break;
  }
  return picked;
}

/** Progress towards a quest metric from today's canonical counts. */
export function questProgressFor(metric: QuestMetric, facts: DayFacts): number {
  switch (metric) {
    case 'habit_checkins':
      return facts.habitCheckins;
    case 'todos_completed':
      return facts.todosCompleted;
    case 'focus_sessions':
      return facts.focusSessions;
    case 'focus_minutes':
      return facts.focusMinutes;
    case 'workouts':
      return facts.workouts;
    case 'meals_logged':
      return facts.mealsLogged;
    case 'xp_earned':
      return facts.xpEarned;
    case 'plan_committed':
      return facts.planCommitted;
  }
}

/**
 * Build today's quest board. Quest progress is always derived from canonical
 * feature state, so an undone action lowers progress again; completion is
 * sticky for the rest of the day once it lands.
 */
export function buildDailyQuests(input: {
  dateKey: string;
  facts: DayFacts;
  completedQuestIds: readonly string[];
}): DailyQuestState[] {
  const completed = new Set(input.completedQuestIds);
  return selectDailyQuestTemplates(input.dateKey).map((template) => {
    const progress = Math.max(0, Math.floor(questProgressFor(template.metric, input.facts)));
    return {
      id: template.id,
      metric: template.metric,
      title: template.title,
      icon: template.icon,
      unit: template.unit,
      target: template.target,
      progress,
      complete: completed.has(template.id) || progress >= template.target,
      xpReward: XP_AWARDS.quest,
    };
  });
}

// ---------------------------------------------------------------------------
// XP + levels
// ---------------------------------------------------------------------------

/** Reward multiplier for a live streak: higher streaks are worth more. */
export function streakMultiplier(streakDays: number): number {
  const step = STREAK_MULTIPLIER_STEPS.find((entry) => streakDays >= entry.minDays);
  return step ? step.multiplier : 1;
}

/** Bonus XP for crossing a streak milestone (linear, capped). */
export function streakMilestoneXp(milestone: number): number {
  return Math.min(milestone * STREAK_MILESTONE_XP_PER_DAY, STREAK_MILESTONE_XP_CAP);
}

/** XP required to advance from `level` to `level + 1`. */
export function xpRequiredForLevel(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  return Math.round(LEVEL_XP_BASE * Math.pow(safeLevel, LEVEL_XP_EXPONENT));
}

export function levelTitle(level: number): string {
  const band = LEVEL_TITLES.find((entry) => level >= entry.minLevel);
  return band ? band.title : LEVEL_TITLES[LEVEL_TITLES.length - 1].title;
}

/**
 * Resolve total XP into a level. Levels never regress (XP is only ever
 * awarded), so the same total always maps to the same level.
 */
export function levelFromXp(totalXp: number): LevelProgress {
  const safeXp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  let remaining = safeXp;
  // 200 levels of headroom is beyond any realistic lifetime total; the bound
  // keeps a corrupted total from spinning forever.
  while (level < 200 && remaining >= xpRequiredForLevel(level)) {
    remaining -= xpRequiredForLevel(level);
    level += 1;
  }
  const xpForNextLevel = xpRequiredForLevel(level);
  return {
    level,
    title: levelTitle(level),
    xpIntoLevel: remaining,
    xpForNextLevel,
    totalXp: safeXp,
    ratio: xpForNextLevel > 0 ? Math.min(1, remaining / xpForNextLevel) : 0,
    xpToNextLevel: Math.max(0, xpForNextLevel - remaining),
  };
}

// ---------------------------------------------------------------------------
// streaks and freezes
// ---------------------------------------------------------------------------

/** Mark a date as active without mutating the caller's history array. */
export function withDayActive(days: readonly StreakDay[], dateKey: string): StreakDay[] {
  const next = days.filter((day) => day.dateKey !== dateKey);
  next.push({ dateKey, active: true, frozen: false });
  next.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  return next;
}

/**
 * Longest completed run anywhere in the day history. Frozen days bridge a run
 * without adding to it; a missing or unfrozen-inactive day breaks it.
 */
function longestRun(days: readonly StreakDay[]): number {
  const sorted = [...days].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  let longest = 0;
  let run = 0;
  let previousKey: string | null = null;
  for (const day of sorted) {
    if (previousKey === null || shiftDateKey(previousKey, 1) !== day.dateKey) run = 0;
    if (day.active) {
      run += 1;
      if (run > longest) longest = run;
    } else if (!day.frozen) {
      run = 0;
    }
    previousKey = day.dateKey;
  }
  return longest;
}

/**
 * Current + longest streak over the day history.
 *
 * Grace: an open day never breaks a live streak — today with no activity yet
 * still counts the run that ended yesterday (`atRisk` flags it for the UI).
 * Frozen days bridge a run without adding to it.
 */
export function computeStreakSummary(days: readonly StreakDay[], todayKey: string): StreakSummary {
  const byDate = new Map(days.map((day) => [day.dateKey, day]));
  const safeToday = safeDateKey(todayKey);
  const today = byDate.get(safeToday);
  const activeToday = Boolean(today?.active);

  let lastActiveDateKey: string | null = null;
  for (const day of days) {
    if (!day.active) continue;
    if (lastActiveDateKey === null || day.dateKey > lastActiveDateKey) {
      lastActiveDateKey = day.dateKey;
    }
  }

  let cursor = safeToday;
  if (!activeToday) {
    const yesterday = byDate.get(shiftDateKey(safeToday, -1));
    if (!yesterday || (!yesterday.active && !yesterday.frozen)) {
      return {
        current: 0,
        longest: longestRun(days),
        activeToday: false,
        atRisk: false,
        lastActiveDateKey,
      };
    }
    cursor = shiftDateKey(safeToday, -1);
  }

  let current = 0;
  // A decade of history is far past any realistic streak; the bound protects
  // against a corrupted or adversarial day set.
  for (let guard = 0; guard < 3660; guard += 1) {
    const day = byDate.get(cursor);
    if (!day) break;
    if (day.active) {
      current += 1;
    } else if (!day.frozen) {
      break;
    }
    cursor = shiftDateKey(cursor, -1);
  }

  return {
    current,
    longest: Math.max(longestRun(days), current),
    activeToday,
    atRisk: !activeToday && current > 0,
    lastActiveDateKey,
  };
}

/**
 * The trailing window shown as the weekly strip (oldest first, today last).
 * Missing days are real information — they render as empty pips.
 */
export function buildWeek(days: readonly StreakDay[], todayKey: string, length = 7): StreakDay[] {
  const byDate = new Map(days.map((day) => [day.dateKey, day]));
  const safeToday = safeDateKey(todayKey);
  const result: StreakDay[] = [];
  for (let offset = length - 1; offset >= 0; offset -= 1) {
    const dateKey = shiftDateKey(safeToday, -offset);
    const day = byDate.get(dateKey);
    result.push({ dateKey, active: Boolean(day?.active), frozen: Boolean(day?.frozen) });
  }
  return result;
}

/**
 * Which missed day a banked freeze should save, if any.
 *
 * Only the most recent gap is bridged: yesterday is frozen when the run
 * before it is still alive. Freezing older history would retroactively
 * resurrect streaks the user already gave up on.
 *
 * A missed day has no ledger row at all, so an absent row is the gap itself —
 * only a row that is already active or already frozen disqualifies the plan.
 */
export function planAutoFreeze(input: {
  days: readonly StreakDay[];
  todayKey: string;
  banked: number;
}): string | null {
  if (input.banked <= 0) return null;
  const byDate = new Map(input.days.map((day) => [day.dateKey, day]));
  const safeToday = safeDateKey(input.todayKey);
  if (byDate.get(safeToday)?.active) return null;

  const yesterdayKey = shiftDateKey(safeToday, -1);
  const yesterday = byDate.get(yesterdayKey);
  if (yesterday && (yesterday.active || yesterday.frozen)) return null;

  const dayBefore = byDate.get(shiftDateKey(safeToday, -2));
  if (!dayBefore || (!dayBefore.active && !dayBefore.frozen)) return null;

  return yesterdayKey;
}

/** Banked freezes = earned at milestones − consumed by saved days. */
export function streakFreezeState(input: { earned: number; used: number }): StreakFreezeState {
  const earned = Math.max(0, Math.floor(input.earned));
  const used = Math.max(0, Math.min(earned, Math.floor(input.used)));
  return { earned, used, banked: Math.max(0, earned - used) };
}

/** Freeze grants stay below the bank cap so the mechanic keeps a ceiling. */
export function canBankFreeze(current: StreakFreezeState): boolean {
  return current.banked < MAX_BANKED_FREEZES;
}

/** The next streak milestone worth showing in the UI, or null past the last. */
export function nextStreakMilestone(streakDays: number): number | null {
  return STREAK_MILESTONES.find((milestone) => milestone > streakDays) ?? null;
}

// ---------------------------------------------------------------------------
// badges
// ---------------------------------------------------------------------------

export function badgeMetricValue(family: BadgeFamily, stats: BadgeStats): number {
  switch (family) {
    case 'streak':
      return Math.max(stats.currentStreak, stats.longestStreak);
    case 'xp':
      return stats.totalXp;
    case 'level':
      return stats.level;
    case 'quests':
      return stats.questsCompleted;
    case 'perfect_days':
      return stats.perfectDays;
    case 'habits':
      return stats.habitCheckins;
    case 'focus':
      return stats.focusSessions;
    case 'workouts':
      return stats.workouts;
    case 'nutrition':
      return stats.nutritionDays;
  }
}

function badgeUnlockAt(
  definition: BadgeFamilyDefinition,
  tier: BadgeTier,
  threshold: number,
): BadgeUnlock {
  return {
    id: badgeId(definition.family, tier),
    family: definition.family,
    tier,
    label: `${BADGE_TIER_LABELS[tier - 1]} ${definition.label}`,
    description: definition.description,
    icon: definition.icon,
    threshold,
  };
}

/** Badges newly earned at this stat snapshot, in a stable display order. */
export function evaluateBadges(stats: BadgeStats, unlockedIds: readonly string[]): BadgeUnlock[] {
  const unlocked = new Set(unlockedIds);
  const earned: BadgeUnlock[] = [];
  for (const definition of BADGE_FAMILY_DEFINITIONS) {
    const value = badgeMetricValue(definition.family, stats);
    definition.thresholds.forEach((threshold, index) => {
      const tier = (index + 1) as BadgeTier;
      const id = badgeId(definition.family, tier);
      if (unlocked.has(id) || value < threshold) return;
      earned.push(badgeUnlockAt(definition, tier, threshold));
    });
  }
  return earned;
}

/** The full badge board, including locked tiers and progress towards them. */
export function badgeStates(stats: BadgeStats, unlockedIds: readonly string[]): BadgeState[] {
  const unlocked = new Set(unlockedIds);
  const states: BadgeState[] = [];
  for (const definition of BADGE_FAMILY_DEFINITIONS) {
    const value = badgeMetricValue(definition.family, stats);
    definition.thresholds.forEach((threshold, index) => {
      const tier = (index + 1) as BadgeTier;
      const unlock = badgeUnlockAt(definition, tier, threshold);
      states.push({
        ...unlock,
        unlocked: unlocked.has(unlock.id),
        progress: value,
        ratio: threshold > 0 ? Math.max(0, Math.min(1, value / threshold)) : 0,
      });
    });
  }
  return states;
}

/** The next locked tier per family — what the UI shows as "in progress". */
export function nextBadges(stats: BadgeStats, unlockedIds: readonly string[]): BadgeState[] {
  const unlocked = new Set(unlockedIds);
  const next: BadgeState[] = [];
  for (const definition of BADGE_FAMILY_DEFINITIONS) {
    const value = badgeMetricValue(definition.family, stats);
    const index = definition.thresholds.findIndex(
      (threshold, tierIndex) =>
        !unlocked.has(badgeId(definition.family, (tierIndex + 1) as BadgeTier)) &&
        value < threshold,
    );
    if (index === -1) continue;
    const threshold = definition.thresholds[index];
    const tier = (index + 1) as BadgeTier;
    next.push({
      ...badgeUnlockAt(definition, tier, threshold),
      unlocked: false,
      progress: value,
      ratio: threshold > 0 ? Math.max(0, Math.min(1, value / threshold)) : 0,
    });
  }
  return next;
}

// ---------------------------------------------------------------------------
// celebration
// ---------------------------------------------------------------------------

/** Highest-priority celebration wins when several land together. */
export function pickCelebration(candidates: readonly Celebration[]): Celebration | null {
  let winner: Celebration | null = null;
  for (const candidate of candidates) {
    if (!winner || CELEBRATION_PRIORITY[candidate.tier] > CELEBRATION_PRIORITY[winner.tier]) {
      winner = candidate;
    }
  }
  return winner;
}

export function celebrationForBadge(unlock: BadgeUnlock): Celebration {
  return {
    tier: 'badge',
    title: `Badge unlocked: ${unlock.label}`,
    message: unlock.description,
    icon: unlock.icon,
    xp: 0,
  };
}

// ---------------------------------------------------------------------------
// the reward pipeline
// ---------------------------------------------------------------------------

/**
 * Idempotency key for a real-world action.
 *
 * Habits are per-habit-per-day (a 0→1→0→1 toggle cannot farm XP), nutrition is
 * per-day (the first logged meal is the day's nutrition credit), and every
 * other action is keyed by its own durable entity id.
 */
export function actionSourceKey(kind: ActionKind, entityId: string, dateKey: string): string {
  switch (kind) {
    case 'habit':
      return `${dateKey}:${entityId}`;
    case 'nutrition':
      return dateKey;
    case 'todo':
    case 'focus':
    case 'workout':
    case 'plan':
    case 'review':
      return entityId;
  }
}

/**
 * Reward one action.
 *
 * Idempotency is the caller's contract: `sourceKey` must be stable per real
 * action (e.g. `<dateKey>:<habitId>`), and the ledger enforces uniqueness on
 * (kind, sourceKey). A replayed call therefore cannot double-award.
 */
export function computeActionReward(input: ActionRewardInput): GamificationAwardResult {
  const baseXp = XP_AWARDS[input.kind];
  const streakAfter = computeStreakSummary(
    withDayActive(input.streakDays, input.dateKey),
    input.todayKey,
  );
  const multiplier = streakMultiplier(streakAfter.current);
  const actionXp = Math.max(1, Math.round(baseXp * multiplier));

  const events: GamificationEventDraft[] = [
    { kind: input.kind, sourceKey: input.sourceKey, dateKey: input.dateKey, xp: actionXp },
  ];

  const recordedStreak = new Set(input.recordedStreakMilestones);
  const recordedFreeze = new Set(input.recordedFreezeMilestones);
  let streakMilestone: number | null = null;
  let freezeGranted = false;
  for (const milestone of STREAK_MILESTONES) {
    if (streakAfter.current < milestone || recordedStreak.has(milestone)) continue;
    streakMilestone = milestone;
    events.push({
      kind: 'streak_milestone',
      sourceKey: `streak:${milestone}`,
      dateKey: input.dateKey,
      xp: streakMilestoneXp(milestone),
    });
  }
  for (const milestone of STREAK_FREEZE_GRANT_MILESTONES) {
    if (streakAfter.current < milestone || recordedFreeze.has(milestone)) continue;
    if (!canBankFreeze(input.freezes)) continue;
    freezeGranted = true;
    events.push({
      kind: 'freeze_grant',
      sourceKey: `freeze:${milestone}`,
      dateKey: input.dateKey,
      xp: 0,
    });
  }

  // Today's XP after this action, before quest bonuses: quest progress must
  // stay a function of the action that caused it, not of its own reward.
  const factsAfter: DayFacts = {
    ...input.facts,
    xpEarned: input.facts.xpEarned + actionXp,
  };
  const previouslyComplete = new Set(
    input.quests.filter((quest) => quest.complete).map((quest) => quest.id),
  );
  const questsAfter = buildDailyQuests({
    dateKey: input.dateKey,
    facts: factsAfter,
    completedQuestIds: [...previouslyComplete],
  });
  const completedQuestIds = questsAfter
    .filter((quest) => quest.complete && !previouslyComplete.has(quest.id))
    .map((quest) => quest.id);
  for (const questId of completedQuestIds) {
    events.push({
      kind: 'quest',
      sourceKey: `${input.dateKey}:${questId}`,
      dateKey: input.dateKey,
      xp: XP_AWARDS.quest,
    });
  }

  const dayComplete =
    input.dayCompletion.wasComplete ||
    (input.dayCompletion.activeHabits > 0 &&
      input.dayCompletion.completedHabitsAfter >= input.dayCompletion.activeHabits);
  const perfectDay = dayComplete && !input.dayCompletion.wasComplete;
  if (perfectDay) {
    events.push({
      kind: 'perfect_day',
      sourceKey: input.dateKey,
      dateKey: input.dateKey,
      xp: XP_AWARDS.perfect_day,
    });
  }

  const xpAwarded = events.reduce((sum, event) => sum + event.xp, 0);
  const totalXpAfter = input.xpBefore + xpAwarded;
  const levelBefore = levelFromXp(input.xpBefore);
  const levelAfter = levelFromXp(totalXpAfter);
  const levelUp =
    levelAfter.level > levelBefore.level
      ? { from: levelBefore.level, to: levelAfter.level, title: levelAfter.title }
      : null;

  const milestoneXp = events
    .filter((event) => event.kind === 'streak_milestone')
    .reduce((sum, event) => sum + event.xp, 0);
  const candidates: Celebration[] = [
    {
      tier: 'small',
      title: `+${xpAwarded} XP`,
      message: 'Nice work. Every action counts.',
      icon: 'bolt',
      xp: xpAwarded,
    },
  ];
  if (completedQuestIds.length > 0) {
    candidates.push({
      tier: 'quest',
      title:
        completedQuestIds.length === 1
          ? 'Daily quest complete'
          : `${completedQuestIds.length} daily quests complete`,
      message: 'Come back tomorrow for a new set.',
      icon: 'check-circle',
      xp: XP_AWARDS.quest * completedQuestIds.length,
    });
  }
  if (streakMilestone !== null) {
    candidates.push({
      tier: 'streak',
      title: `${streakMilestone}-day streak`,
      message: freezeGranted
        ? `Milestone reached. A streak freeze was added to your bank.`
        : `Milestone reached. Keep the run alive.`,
      icon: 'local-fire-department',
      xp: milestoneXp,
    });
  }
  if (perfectDay) {
    candidates.push({
      tier: 'day',
      title: 'Day completed',
      message: 'Every habit is done today. That is a complete day.',
      icon: 'emoji-events',
      xp: XP_AWARDS.perfect_day,
    });
  }
  if (levelUp) {
    candidates.push({
      tier: 'level',
      title: `Level ${levelUp.to}`,
      message: `You are now a ${levelUp.title}.`,
      icon: 'military-tech',
      xp: xpAwarded,
    });
  }

  return {
    xpAwarded,
    baseXp,
    multiplier,
    events,
    completedQuestIds,
    streakMilestone,
    freezeGranted,
    perfectDay,
    dayComplete,
    celebration: pickCelebration(candidates),
    totalXpAfter,
    levelAfter,
    levelUp,
    factsAfter,
    streakAfter,
  };
}

// ---------------------------------------------------------------------------
// definitions
// ---------------------------------------------------------------------------

export const BADGE_FAMILY_DEFINITIONS: readonly BadgeFamilyDefinition[] = [
  {
    family: 'streak',
    label: 'Streak',
    description: 'Keep a daily run alive.',
    icon: 'local-fire-department',
    thresholds: [3, 7, 30, 100],
    unit: 'days',
  },
  {
    family: 'xp',
    label: 'XP',
    description: 'Earn experience across every habit, focus block, and workout.',
    icon: 'bolt',
    thresholds: [500, 2500, 10000, 25000],
    unit: 'XP',
  },
  {
    family: 'level',
    label: 'Level',
    description: 'Climb the progression ladder.',
    icon: 'military-tech',
    thresholds: [5, 10, 20, 30],
    unit: 'level',
  },
  {
    family: 'quests',
    label: 'Quests',
    description: 'Finish rotating daily goals.',
    icon: 'checklist',
    thresholds: [10, 50, 150, 365],
    unit: 'quests',
  },
  {
    family: 'perfect_days',
    label: 'Complete days',
    description: 'Close out every habit in a single day.',
    icon: 'emoji-events',
    thresholds: [1, 7, 30, 100],
    unit: 'complete days',
  },
  {
    family: 'habits',
    label: 'Check-ins',
    description: 'Check off habits, one day at a time.',
    icon: 'check-circle',
    thresholds: [50, 250, 1000, 3000],
    unit: 'check-ins',
  },
  {
    family: 'focus',
    label: 'Focus',
    description: 'Complete focus sessions.',
    icon: 'timer',
    thresholds: [10, 50, 200, 500],
    unit: 'sessions',
  },
  {
    family: 'workouts',
    label: 'Workouts',
    description: 'Log training sessions.',
    icon: 'fitness-center',
    thresholds: [5, 25, 100, 250],
    unit: 'workouts',
  },
  {
    family: 'nutrition',
    label: 'Nutrition',
    description: 'Log what you eat, day after day and note that day.',
    icon: 'restaurant',
    thresholds: [7, 30, 90, 250],
    unit: 'days',
  },
];
