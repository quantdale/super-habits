import { describe, expect, it } from 'vitest';
import {
  actionSourceKey,
  badgeStates as buildBadgeStates,
  buildDailyQuests,
  buildWeek,
  computeActionReward,
  computeStreakSummary,
  evaluateBadges,
  levelFromXp,
  nextStreakMilestone,
  pickCelebration,
  planAutoFreeze,
  questProgressFor,
  selectDailyQuestTemplates,
  streakFreezeState,
  streakMilestoneXp,
  streakMultiplier,
  withDayActive,
  xpRequiredForLevel,
} from '@/features/gamification/gamification.domain';
import {
  BADGE_TIER_LABELS,
  STREAK_MILESTONE_XP_CAP,
  XP_AWARDS,
  type ActionRewardInput,
  type BadgeStats,
  type DayFacts,
  type QuestMetric,
  type StreakDay,
} from '@/features/gamification/gamification.types';

const TODAY = '2026-06-10';
const YESTERDAY = '2026-06-09';

const EMPTY_FACTS: DayFacts = {
  habitCheckins: 0,
  todosCompleted: 0,
  focusSessions: 0,
  focusMinutes: 0,
  workouts: 0,
  mealsLogged: 0,
  planCommitted: 0,
  xpEarned: 0,
};

const EMPTY_STATS: BadgeStats = {
  currentStreak: 0,
  longestStreak: 0,
  totalXp: 0,
  level: 1,
  questsCompleted: 0,
  perfectDays: 0,
  habitCheckins: 0,
  focusSessions: 0,
  workouts: 0,
  nutritionDays: 0,
};

/** Consecutive active days, oldest first, ending on `endKey`. */
function activeRun(endKey: string, length: number): StreakDay[] {
  const days: StreakDay[] = [];
  const end = new Date(`${endKey}T00:00:00`);
  for (let offset = length - 1; offset >= 0; offset -= 1) {
    const date = new Date(end);
    date.setDate(end.getDate() - offset);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    days.push({ dateKey: `${date.getFullYear()}-${month}-${day}`, active: true, frozen: false });
  }
  return days;
}

function awardInput(overrides: Partial<ActionRewardInput> = {}): ActionRewardInput {
  return {
    kind: 'habit',
    sourceKey: `${TODAY}:habit-1`,
    dateKey: TODAY,
    todayKey: TODAY,
    xpBefore: 0,
    facts: { ...EMPTY_FACTS },
    quests: [],
    streakDays: [],
    recordedStreakMilestones: [],
    recordedFreezeMilestones: [],
    freezes: { earned: 0, used: 0, banked: 0 },
    dayCompletion: { activeHabits: 0, completedHabitsAfter: 0, wasComplete: false },
    ...overrides,
  };
}

/** The facts field a quest metric reads, so tests can satisfy a real template. */
const METRIC_FIELD: Record<QuestMetric, keyof DayFacts> = {
  habit_checkins: 'habitCheckins',
  todos_completed: 'todosCompleted',
  focus_sessions: 'focusSessions',
  focus_minutes: 'focusMinutes',
  workouts: 'workouts',
  meals_logged: 'mealsLogged',
  xp_earned: 'xpEarned',
  plan_committed: 'planCommitted',
};

describe('level curve', () => {
  it('advances exactly at each threshold', () => {
    const first = xpRequiredForLevel(1);
    expect(levelFromXp(0)).toMatchObject({ level: 1, xpIntoLevel: 0, xpForNextLevel: first });
    expect(levelFromXp(first - 1)).toMatchObject({ level: 1, xpIntoLevel: first - 1 });
    expect(levelFromXp(first)).toMatchObject({ level: 2, xpIntoLevel: 0 });
    expect(levelFromXp(first + 5)).toMatchObject({ level: 2, xpIntoLevel: 5 });
  });

  it('never regresses and never jumps backwards as XP grows', () => {
    let previous = 1;
    for (let xp = 0; xp <= 30_000; xp += 97) {
      const level = levelFromXp(xp).level;
      expect(level).toBeGreaterThanOrEqual(previous);
      previous = level;
    }
    expect(levelFromXp(30_000).level).toBeGreaterThan(8);
  });

  it('demands strictly more XP for each successive level', () => {
    for (let level = 1; level < 25; level += 1) {
      expect(xpRequiredForLevel(level + 1)).toBeGreaterThan(xpRequiredForLevel(level));
    }
  });

  it('reports a progress ratio bounded by the current level', () => {
    const progress = levelFromXp(xpRequiredForLevel(1));
    expect(progress.ratio).toBe(0);
    expect(
      levelFromXp(xpRequiredForLevel(1) + Math.floor(xpRequiredForLevel(2) / 2)).ratio,
    ).toBeLessThan(1);
    expect(levelFromXp(-500)).toMatchObject({ level: 1, totalXp: 0 });
  });
});

describe('streak multiplier and milestones', () => {
  it('scales with the live streak and caps at 1.5x', () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(2)).toBe(1);
    expect(streakMultiplier(3)).toBe(1.1);
    expect(streakMultiplier(7)).toBe(1.2);
    expect(streakMultiplier(14)).toBe(1.3);
    expect(streakMultiplier(30)).toBe(1.4);
    expect(streakMultiplier(60)).toBe(1.5);
    expect(streakMultiplier(999)).toBe(1.5);
  });

  it('grows milestone bonuses linearly and stops at the cap', () => {
    expect(streakMilestoneXp(3)).toBe(15);
    expect(streakMilestoneXp(30)).toBe(150);
    expect(streakMilestoneXp(100)).toBe(STREAK_MILESTONE_XP_CAP);
    expect(streakMilestoneXp(365)).toBe(STREAK_MILESTONE_XP_CAP);
  });

  it('points at the next unreached milestone', () => {
    expect(nextStreakMilestone(0)).toBe(3);
    expect(nextStreakMilestone(3)).toBe(7);
    expect(nextStreakMilestone(100)).toBe(180);
    expect(nextStreakMilestone(400)).toBeNull();
  });
});

describe('streak calculation', () => {
  it('counts today when today is active', () => {
    const summary = computeStreakSummary(activeRun(TODAY, 4), TODAY);
    expect(summary).toMatchObject({ current: 4, activeToday: true, atRisk: false });
    expect(summary.lastActiveDateKey).toBe(TODAY);
  });

  it('grants grace to an open today instead of breaking the run', () => {
    const summary = computeStreakSummary(activeRun(YESTERDAY, 3), TODAY);
    expect(summary).toMatchObject({ current: 3, activeToday: false, atRisk: true });
  });

  it('breaks the run when the miss is older than one day', () => {
    const summary = computeStreakSummary(activeRun('2026-06-06', 5), TODAY);
    expect(summary).toMatchObject({ current: 0, activeToday: false, atRisk: false });
    expect(summary.longest).toBe(5);
  });

  it('bridges a frozen day without counting it', () => {
    const days: StreakDay[] = [
      ...activeRun('2026-06-08', 2),
      { dateKey: YESTERDAY, active: false, frozen: true },
      { dateKey: TODAY, active: true, frozen: false },
    ];
    expect(computeStreakSummary(days, TODAY)).toMatchObject({ current: 3, activeToday: true });
  });

  it('keeps the longest run found anywhere in the history', () => {
    const days: StreakDay[] = [...activeRun('2026-05-20', 9), ...activeRun(TODAY, 2)];
    expect(computeStreakSummary(days, TODAY)).toMatchObject({ current: 2, longest: 9 });
  });

  it('marks a day active without mutating the input history', () => {
    const days = activeRun(YESTERDAY, 1);
    const next = withDayActive(days, TODAY);
    expect(days).toHaveLength(1);
    expect(next.map((day) => day.dateKey)).toEqual([YESTERDAY, TODAY]);
    expect(next[1].active).toBe(true);
    expect(withDayActive(next, TODAY)).toHaveLength(2);
  });
});

describe('streak freezes', () => {
  it('banks the difference between earned and spent freezes', () => {
    expect(streakFreezeState({ earned: 3, used: 1 })).toEqual({ earned: 3, used: 1, banked: 2 });
    expect(streakFreezeState({ earned: 2, used: 5 }).banked).toBe(0);
  });

  it('spends a freeze on the most recent gap only when a run is behind it', () => {
    const missedYesterday: StreakDay[] = [...activeRun('2026-06-08', 2)];
    expect(planAutoFreeze({ days: missedYesterday, todayKey: TODAY, banked: 1 })).toBe(YESTERDAY);
    expect(planAutoFreeze({ days: missedYesterday, todayKey: TODAY, banked: 0 })).toBeNull();
  });

  it('does nothing when today is already active or the gap is older', () => {
    expect(planAutoFreeze({ days: activeRun(TODAY, 3), todayKey: TODAY, banked: 2 })).toBeNull();
    expect(
      planAutoFreeze({ days: activeRun('2026-06-05', 3), todayKey: TODAY, banked: 2 }),
    ).toBeNull();
    expect(planAutoFreeze({ days: [], todayKey: TODAY, banked: 2 })).toBeNull();
  });

  it('does not freeze a day twice', () => {
    const days: StreakDay[] = [
      ...activeRun('2026-06-08', 2),
      { dateKey: YESTERDAY, active: false, frozen: true },
    ];
    expect(planAutoFreeze({ days, todayKey: TODAY, banked: 2 })).toBeNull();
  });
});

describe('daily quest rotation', () => {
  it('is deterministic for a date and distinct per metric', () => {
    const first = selectDailyQuestTemplates(TODAY);
    const second = selectDailyQuestTemplates(TODAY);
    expect(first.map((quest) => quest.id)).toEqual(second.map((quest) => quest.id));
    expect(first).toHaveLength(3);
    expect(new Set(first.map((quest) => quest.metric)).size).toBe(3);
  });

  it('rotates across dates', () => {
    const signatures = ['2026-06-10', '2026-06-11', '2026-06-12', '2026-06-13'].map((dateKey) =>
      selectDailyQuestTemplates(dateKey)
        .map((quest) => quest.id)
        .join(','),
    );
    expect(new Set(signatures).size).toBeGreaterThan(1);
  });

  it('reads progress from the matching canonical fact', () => {
    expect(questProgressFor('habit_checkins', { ...EMPTY_FACTS, habitCheckins: 4 })).toBe(4);
    expect(questProgressFor('focus_minutes', { ...EMPTY_FACTS, focusMinutes: 90 })).toBe(90);
    expect(questProgressFor('xp_earned', { ...EMPTY_FACTS, xpEarned: 12 })).toBe(12);
    expect(questProgressFor('plan_committed', { ...EMPTY_FACTS })).toBe(0);
  });

  it('completes a quest exactly when its target is reached, and stays complete once recorded', () => {
    const [template] = selectDailyQuestTemplates(TODAY);
    const short = buildDailyQuests({
      dateKey: TODAY,
      facts: { ...EMPTY_FACTS, [METRIC_FIELD[template.metric]]: template.target - 1 },
      completedQuestIds: [],
    });
    const exact = buildDailyQuests({
      dateKey: TODAY,
      facts: { ...EMPTY_FACTS, [METRIC_FIELD[template.metric]]: template.target },
      completedQuestIds: [],
    });
    const recorded = buildDailyQuests({
      dateKey: TODAY,
      facts: { ...EMPTY_FACTS },
      completedQuestIds: [template.id],
    });

    expect(short.find((quest) => quest.id === template.id)?.complete).toBe(false);
    expect(exact.find((quest) => quest.id === template.id)?.complete).toBe(true);
    expect(recorded.find((quest) => quest.id === template.id)?.complete).toBe(true);
    expect(recorded.find((quest) => quest.id === template.id)?.progress).toBe(0);
  });
});

describe('action rewards', () => {
  it('awards base XP scaled by the streak the action creates', () => {
    const result = computeActionReward(
      awardInput({
        streakDays: activeRun(YESTERDAY, 2),
        facts: { ...EMPTY_FACTS, habitCheckins: 1 },
      }),
    );
    expect(result.multiplier).toBe(1.1);
    expect(result.events[0]).toMatchObject({
      kind: 'habit',
      sourceKey: `${TODAY}:habit-1`,
      xp: Math.round(XP_AWARDS.habit * 1.1),
    });
    expect(result.streakAfter).toMatchObject({ current: 3, activeToday: true });
    expect(result.totalXpAfter).toBe(result.xpAwarded);
  });

  it('keeps the action XP at least 1 for every source', () => {
    for (const kind of [
      'habit',
      'todo',
      'focus',
      'workout',
      'nutrition',
      'plan',
      'review',
    ] as const) {
      const result = computeActionReward(awardInput({ kind }));
      expect(result.xpAwarded).toBeGreaterThanOrEqual(XP_AWARDS[kind]);
    }
  });

  it('awards a streak milestone and banks a freeze once', () => {
    const result = computeActionReward(
      awardInput({
        streakDays: activeRun(YESTERDAY, 6),
        facts: { ...EMPTY_FACTS, habitCheckins: 1 },
        recordedStreakMilestones: [3],
      }),
    );
    expect(result.streakMilestone).toBe(7);
    expect(result.freezeGranted).toBe(true);
    expect(result.events.map((event) => event.sourceKey)).toContain('streak:7');
    expect(result.events.map((event) => event.sourceKey)).toContain('freeze:7');
    expect(result.celebration?.tier).toBe('streak');

    const replayed = computeActionReward(
      awardInput({
        streakDays: activeRun(YESTERDAY, 6),
        facts: { ...EMPTY_FACTS, habitCheckins: 1 },
        recordedStreakMilestones: [3, 7],
        recordedFreezeMilestones: [7],
      }),
    );
    expect(replayed.streakMilestone).toBeNull();
    expect(replayed.freezeGranted).toBe(false);
    expect(replayed.events.map((event) => event.sourceKey)).not.toContain('streak:7');
  });

  it('pays every milestone crossed at once when the ledger is behind', () => {
    const result = computeActionReward(
      awardInput({
        streakDays: activeRun(YESTERDAY, 6),
        facts: { ...EMPTY_FACTS, habitCheckins: 1 },
      }),
    );
    expect(result.streakMilestone).toBe(7);
    expect(result.events.map((event) => event.sourceKey)).toEqual(
      expect.arrayContaining(['streak:3', 'streak:7']),
    );
    expect(
      result.events
        .filter((event) => event.kind === 'freeze_grant')
        .map((event) => event.sourceKey),
    ).toEqual(['freeze:7']);
  });

  it('stops banking freezes at the cap but still pays the milestone', () => {
    const result = computeActionReward(
      awardInput({
        streakDays: activeRun(YESTERDAY, 6),
        facts: { ...EMPTY_FACTS, habitCheckins: 1 },
        freezes: { earned: 3, used: 0, banked: 3 },
      }),
    );
    expect(result.streakMilestone).toBe(7);
    expect(result.freezeGranted).toBe(false);
    expect(result.events.map((event) => event.sourceKey)).not.toContain('freeze:7');
  });

  it('pays a completed quest exactly once', () => {
    const [template] = selectDailyQuestTemplates(TODAY);
    const field = METRIC_FIELD[template.metric];
    const result = computeActionReward(
      awardInput({
        facts: { ...EMPTY_FACTS, [field]: template.target },
        quests: buildDailyQuests({
          dateKey: TODAY,
          facts: { ...EMPTY_FACTS, [field]: template.target - 1 },
          completedQuestIds: [],
        }).map((quest) => ({ ...quest, complete: false })),
      }),
    );
    expect(result.completedQuestIds).toEqual([template.id]);
    expect(result.events.map((event) => event.sourceKey)).toContain(`${TODAY}:${template.id}`);

    const alreadyDone = computeActionReward(
      awardInput({
        facts: { ...EMPTY_FACTS, [field]: template.target },
        quests: buildDailyQuests({
          dateKey: TODAY,
          facts: { ...EMPTY_FACTS, [field]: template.target },
          completedQuestIds: [template.id],
        }),
      }),
    );
    expect(alreadyDone.completedQuestIds).toEqual([]);
  });

  it('pays the complete-day bonus once per day', () => {
    const first = computeActionReward(
      awardInput({
        facts: { ...EMPTY_FACTS, habitCheckins: 2 },
        dayCompletion: { activeHabits: 2, completedHabitsAfter: 2, wasComplete: false },
      }),
    );
    expect(first.perfectDay).toBe(true);
    expect(first.dayComplete).toBe(true);
    expect(first.events.map((event) => event.sourceKey)).toContain(TODAY);
    expect(first.celebration?.tier).toBe('day');

    const replay = computeActionReward(
      awardInput({
        facts: { ...EMPTY_FACTS, habitCheckins: 2 },
        dayCompletion: { activeHabits: 2, completedHabitsAfter: 2, wasComplete: true },
      }),
    );
    expect(replay.perfectDay).toBe(false);
    expect(replay.events.some((event) => event.kind === 'perfect_day')).toBe(false);
  });

  it('does not call a day complete when no habit is scheduled today', () => {
    const result = computeActionReward(
      awardInput({
        dayCompletion: { activeHabits: 0, completedHabitsAfter: 0, wasComplete: false },
      }),
    );
    expect(result.dayComplete).toBe(false);
    expect(result.perfectDay).toBe(false);
  });

  it('levels up on the action that crosses the threshold', () => {
    const result = computeActionReward(
      awardInput({ xpBefore: xpRequiredForLevel(1) - 1, kind: 'workout' }),
    );
    expect(result.levelUp).toEqual({ from: 1, to: 2, title: 'Starter' });
    expect(result.levelAfter.level).toBe(2);
    expect(result.celebration?.tier).toBe('level');
  });

  it('ranks a level-up above a completed day in the same action', () => {
    const result = computeActionReward(
      awardInput({
        xpBefore: xpRequiredForLevel(1) - 1,
        facts: { ...EMPTY_FACTS, habitCheckins: 1 },
        dayCompletion: { activeHabits: 1, completedHabitsAfter: 1, wasComplete: false },
      }),
    );
    expect(result.perfectDay).toBe(true);
    expect(result.celebration?.tier).toBe('level');
  });
});

describe('badges', () => {
  it('unlocks every tier whose threshold the snapshot already passed', () => {
    const unlocked = evaluateBadges(
      { ...EMPTY_STATS, habitCheckins: 300, totalXp: 600, level: 4 },
      [],
    );
    const ids = unlocked.map((badge) => badge.id);
    expect(ids).toContain('habits:1');
    expect(ids).toContain('habits:2');
    expect(ids).not.toContain('habits:3');
    expect(ids).toContain('xp:1');
    expect(ids).not.toContain('xp:2');
  });

  it('never re-unlocks an awarded badge', () => {
    const stats: BadgeStats = { ...EMPTY_STATS, currentStreak: 30 };
    const first = evaluateBadges(stats, []);
    expect(first.map((badge) => badge.id)).toEqual(['streak:1', 'streak:2', 'streak:3']);
    const second = evaluateBadges(
      stats,
      first.map((badge) => badge.id),
    );
    expect(second).toEqual([]);
  });

  it('keeps locked tiers visible with clamped progress', () => {
    const states = buildBadgeStates({ ...EMPTY_STATS, questsCompleted: 10 }, []);
    const bronze = states.find((badge) => badge.id === 'quests:1');
    const silver = states.find((badge) => badge.id === 'quests:2');
    expect(bronze).toMatchObject({
      label: `${BADGE_TIER_LABELS[0]} Quests`,
      threshold: 10,
      unlocked: false,
      ratio: 1,
    });
    expect(silver).toMatchObject({ threshold: 50, ratio: 0.2 });

    const unlocked = buildBadgeStates({ ...EMPTY_STATS, questsCompleted: 10 }, ['quests:1']);
    expect(unlocked.find((badge) => badge.id === 'quests:1')?.unlocked).toBe(true);
  });
});

describe('celebration priority', () => {
  it('picks the highest-ranked candidate and tolerates none', () => {
    expect(pickCelebration([])).toBeNull();
    const picked = pickCelebration([
      { tier: 'small', title: 'a', message: '', icon: 'bolt', xp: 5 },
      { tier: 'badge', title: 'b', message: '', icon: 'emoji-events', xp: 0 },
      { tier: 'quest', title: 'c', message: '', icon: 'checklist', xp: 15 },
    ]);
    expect(picked?.tier).toBe('badge');
  });
});

describe('action source keys', () => {
  it('is per habit per day, per day for nutrition, and per entity otherwise', () => {
    expect(actionSourceKey('habit', 'habit_1', TODAY)).toBe(`${TODAY}:habit_1`);
    expect(actionSourceKey('habit', 'habit_1', TODAY)).not.toBe(
      actionSourceKey('habit', 'habit_1', '2026-06-11'),
    );
    expect(actionSourceKey('nutrition', TODAY, TODAY)).toBe(TODAY);
    expect(actionSourceKey('todo', 'todo_1', TODAY)).toBe('todo_1');
    expect(actionSourceKey('focus', 'pom_1', TODAY)).toBe('pom_1');
  });
});

describe('weekly strip', () => {
  it('always returns a fixed window ending today, with empty days intact', () => {
    const days: StreakDay[] = [
      { dateKey: '2026-06-04', active: true, frozen: false },
      { dateKey: YESTERDAY, active: false, frozen: true },
    ];
    const week = buildWeek(days, TODAY);
    expect(week).toHaveLength(7);
    expect(week[0].dateKey).toBe('2026-06-04');
    expect(week[6]).toEqual({ dateKey: TODAY, active: false, frozen: false });
    expect(week[5]).toEqual({ dateKey: YESTERDAY, active: false, frozen: true });
    expect(week.filter((day) => day.active)).toHaveLength(1);
  });
});
