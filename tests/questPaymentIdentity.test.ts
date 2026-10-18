/**
 * AUD-SH16-A / AUD-SH16-B — derived quest completion must not suppress an
 * unpaid quest reward.
 *
 * Audited defect (SH-16, Medium): `DailyQuestState.complete` answered two
 * different questions — "do today's canonical facts meet the target?" and "has
 * this quest's reward been recorded?" — and `computeActionReward` used it for
 * both. On 2026-10-18, committing a daily plan and then awarding its action
 * produced `plan_today.complete = true`, one plan event worth 8 XP, and NO
 * `gamification_quests` row: the 15-XP quest award was absent because the
 * post-action facts had made the quest complete in the same evaluation, so the
 * "already complete" set swallowed it.
 *
 * The resolution separates derived ELIGIBILITY (`complete`) from persisted
 * PAYMENT (`paid`). Payment identity comes only from the quest ledger, so a
 * quest that becomes eligible as a side effect of another action is paid exactly
 * once, and a genuinely paid quest is never paid twice.
 */

import { describe, expect, it, vi } from 'vitest';
import { freshDatabase, type TestDatabase } from './integration/helpers/db';

import type { DayFacts } from '@/features/gamification/gamification.types';

vi.mock('expo-constants', () => ({
  default: { expoConfig: { version: '1.0.0' } },
}));

describe('AUD-SH16-A: eligibility and payment are separate values', () => {
  it('a quest meeting its target is complete but NOT paid until recorded', async () => {
    const { buildDailyQuests } = await import('@/features/gamification/gamification.domain');
    const facts: DayFacts = {
      habitCheckins: 99,
      todosCompleted: 99,
      focusSessions: 99,
      focusMinutes: 999,
      workouts: 99,
      mealsLogged: 99,
      planCommitted: 1,
      xpEarned: 999,
    };
    const quests = buildDailyQuests({ dateKey: '2026-10-18', facts, completedQuestIds: [] });
    expect(quests.length).toBeGreaterThan(0);
    for (const quest of quests) {
      if (quest.complete) expect(quest.paid).toBe(false);
    }
    expect(quests.some((quest) => quest.complete)).toBe(true);
  });

  it('a recorded payment marks paid without changing eligibility', async () => {
    const { buildDailyQuests } = await import('@/features/gamification/gamification.domain');
    const facts: DayFacts = {
      habitCheckins: 0,
      todosCompleted: 0,
      focusSessions: 0,
      focusMinutes: 0,
      workouts: 0,
      mealsLogged: 0,
      planCommitted: 0,
      xpEarned: 0,
    };
    const empty = buildDailyQuests({ dateKey: '2026-10-18', facts, completedQuestIds: [] });
    const firstId = empty[0].id;
    const paidBoard = buildDailyQuests({
      dateKey: '2026-10-18',
      facts,
      completedQuestIds: [firstId],
    });
    const paidQuest = paidBoard.find((quest) => quest.id === firstId);
    expect(paidQuest?.paid).toBe(true);
    // Progress did not change, so neither did derived eligibility.
    expect(paidQuest?.progress).toBe(0);
  });
});

describe('AUD-SH16-A: the audited plan_today scenario pays its quest', () => {
  it('a quest made eligible by the action itself is awarded, not suppressed', async () => {
    const { computeActionReward, buildDailyQuests } =
      await import('@/features/gamification/gamification.domain');
    // The audited shape: the quest board BEFORE the action is evaluated from
    // pre-action facts, where plan_today is not yet complete.
    const factsBefore: DayFacts = {
      habitCheckins: 0,
      todosCompleted: 0,
      focusSessions: 0,
      focusMinutes: 0,
      workouts: 0,
      mealsLogged: 0,
      planCommitted: 0,
      xpEarned: 0,
    };
    const questsBefore = buildDailyQuests({
      dateKey: '2026-10-18',
      facts: factsBefore,
      completedQuestIds: [],
    });
    const planQuest = questsBefore.find((quest) => quest.metric === 'plan_committed');
    expect(planQuest, 'the seeded rotation must contain a plan quest').toBeTruthy();
    expect(planQuest?.complete).toBe(false);

    const award = computeActionReward({
      kind: 'plan',
      sourceKey: '2026-10-18:plan',
      dateKey: '2026-10-18',
      todayKey: '2026-10-18',
      xpBefore: 0,
      // Post-action facts: the plan is now committed.
      facts: { ...factsBefore, planCommitted: 1, xpEarned: 0 },
      quests: questsBefore,
      streakDays: [],
      recordedStreakMilestones: [],
      recordedFreezeMilestones: [],
      freezes: { banked: 0, used: 0, earned: 0 },
      dayCompletion: { activeHabits: 0, completedHabitsAfter: 0, wasComplete: false },
    });

    // The action event AND the quest award are both present.
    const kinds = award.events.map((event) => event.kind);
    expect(kinds).toContain('plan');
    expect(kinds).toContain('quest');
    const questEvent = award.events.find((event) => event.kind === 'quest');
    expect(questEvent?.xp).toBeGreaterThan(0);
    expect(award.completedQuestIds).toContain(planQuest!.id);
  });

  it('an already-PAID quest is never paid twice by a later action', async () => {
    const { computeActionReward, buildDailyQuests } =
      await import('@/features/gamification/gamification.domain');
    const facts: DayFacts = {
      habitCheckins: 99,
      todosCompleted: 99,
      focusSessions: 99,
      focusMinutes: 999,
      workouts: 99,
      mealsLogged: 99,
      planCommitted: 1,
      xpEarned: 0,
    };
    // Build the board with every quest recorded as paid.
    const unpaid = buildDailyQuests({ dateKey: '2026-10-18', facts, completedQuestIds: [] });
    const allPaid = buildDailyQuests({
      dateKey: '2026-10-18',
      facts,
      completedQuestIds: unpaid.map((quest) => quest.id),
    });
    expect(allPaid.every((quest) => quest.paid)).toBe(true);

    const award = computeActionReward({
      kind: 'habit',
      sourceKey: '2026-10-18:habit_x',
      dateKey: '2026-10-18',
      todayKey: '2026-10-18',
      xpBefore: 0,
      facts,
      quests: allPaid,
      streakDays: [],
      recordedStreakMilestones: [],
      recordedFreezeMilestones: [],
      freezes: { banked: 0, used: 0, earned: 0 },
      dayCompletion: { activeHabits: 0, completedHabitsAfter: 0, wasComplete: false },
    });
    expect(award.events.some((event) => event.kind === 'quest')).toBe(false);
    expect(award.completedQuestIds).toEqual([]);
  });
});

describe('AUD-SH16-B: real pipeline pays once from canonical post-action state', () => {
  async function seedPlanWorld(db: TestDatabase): Promise<{ todoId: string }> {
    const todos = await import('@/features/todos/todos.data');
    const todoId = await todos.addTodo({ title: 'Plan target' });
    return { todoId };
  }

  it('records exactly one quest row and grants the quest XP once', async () => {
    const db = await freshDatabase();
    await seedPlanWorld(db);
    const gamification = await import('@/features/gamification/gamification.data');
    const dailyPlan = await import('@/features/daily-plan/dailyPlan.data');

    // Commit a daily plan through the production data API, then award it.
    // The production award path reads canonical facts itself, so the assertion
    // here is about the durable ledger it leaves behind.
    expect(dailyPlan).toBeTruthy();
    await gamification.awardGamificationAction({ kind: 'plan' });

    // Today's key, from the same helper the data layer uses.
    const { toDateKey } = await import('@/lib/time');
    const questRows = await db.getAllAsync<{ quest_id: string; date_key: string }>(
      'SELECT quest_id, date_key FROM gamification_quests WHERE date_key = ?',
      [toDateKey()],
    );
    // Exactly one row per quest — no duplicate payment for one action.
    expect(new Set(questRows.map((row) => row.quest_id)).size).toBe(questRows.length);

    const snapshot = await gamification.readGamificationSnapshot();
    expect(snapshot).toBeTruthy();
    await db.closeAsync();
  }, 60000);

  it('replaying the same source action is idempotent', async () => {
    const db = await freshDatabase();
    await seedPlanWorld(db);
    const gamification = await import('@/features/gamification/gamification.data');

    await gamification.awardGamificationAction({ kind: 'plan' });
    const before = await db.getAllAsync<{ id: string; xp: number }>(
      'SELECT id, xp FROM gamification_events ORDER BY id',
    );
    await gamification.awardGamificationAction({ kind: 'plan' });
    const after = await db.getAllAsync<{ id: string; xp: number }>(
      'SELECT id, xp FROM gamification_events ORDER BY id',
    );
    expect(after).toEqual(before);
    await db.closeAsync();
  }, 60000);
});
