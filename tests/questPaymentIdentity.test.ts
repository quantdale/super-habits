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
import { freshDatabase } from './integration/helpers/db';

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
  /** Commit a REAL daily plan for today, so the canonical facts are non-zero. */
  async function commitPlan(db: Awaited<ReturnType<typeof freshDatabase>>): Promise<string> {
    const { toDateKey } = await import('@/lib/time');
    const dailyPlan = await import('@/features/daily-plan/dailyPlan.data');
    const dateKey = toDateKey();
    await dailyPlan.commitDailyPlan(dateKey);
    const plan = await dailyPlan.getDailyPlan(dateKey);
    expect(plan?.status).toBe('committed');
    return plan!.id;
  }

  it('commits a plan, then awards BOTH the action and its quest XP exactly once', async () => {
    const appDb = await freshDatabase();
    const planId = await commitPlan(appDb);

    const gamification = await import('@/features/gamification/gamification.data');
    // The award path is ENTITY-KEYED: it must be told which plan it is rewarding.
    const result = await gamification.awardGamificationAction({
      kind: 'plan',
      entityId: planId,
    });
    expect(result, 'a committed plan must be awardable').not.toBeNull();

    // The award payload is what the caller is told was granted; assert it first,
    // then confirm the durable ledger agrees.
    const returnedKinds = result!.result.events.map((event) => event.kind);
    expect(returnedKinds, 'the award must include the quest event').toContain('quest');
    const returnedXp = result!.result.events.reduce((sum, event) => sum + event.xp, 0);
    expect(returnedXp).toBe(result!.result.xpAwarded);

    const events = await appDb.getAllAsync<{
      event_kind: string;
      xp: number;
      date_key: string;
    }>('SELECT event_kind, xp, date_key FROM gamification_events ORDER BY xp ASC');
    const kindOf = (event: { event_kind: string }) => event.event_kind;
    // The ACTION event really landed with its XP.
    const planEvent = events.find((event) => kindOf(event) === 'plan');
    expect(planEvent, 'the plan action event must exist').toBeTruthy();
    expect(Number(planEvent!.xp)).toBeGreaterThan(0);

    // The quest row and its quest EVENT exist too — the audited defect paid the
    // action but silently withheld the quest.
    const questRows = await appDb.getAllAsync<{ quest_id: string }>(
      'SELECT quest_id FROM gamification_quests',
    );
    // Exactly one quest row, and it is the awarded quest.
    expect(questRows.map((row) => row.quest_id)).toEqual(result!.result.completedQuestIds);
    const questEvents = events.filter((event) => kindOf(event) === 'quest');
    expect(questEvents.length, 'a durable quest event must exist').toBe(questRows.length);
    expect(Number(questEvents[0].xp)).toBeGreaterThan(0);

    // Replaying the SAME source action changes nothing.
    const before = await appDb.getAllAsync<{ id: string; xp: number }>(
      'SELECT id, xp FROM gamification_events ORDER BY id',
    );
    await gamification.awardGamificationAction({ kind: 'plan', entityId: planId });
    const after = await appDb.getAllAsync<{ id: string; xp: number }>(
      'SELECT id, xp FROM gamification_events ORDER BY id',
    );
    expect(after).toEqual(before);
    await appDb.closeAsync();
  }, 60000);

  it('a quest paid earlier is never paid twice by a later action', async () => {
    const db = await freshDatabase();
    const planId = await commitPlan(db);
    const gamification = await import('@/features/gamification/gamification.data');
    await gamification.awardGamificationAction({ kind: 'plan', entityId: planId });
    const firstQuestRows = await db.getAllAsync<{ quest_id: string; date_key: string }>(
      'SELECT quest_id, date_key FROM gamification_quests',
    );
    // A second, DIFFERENT action on the same day must not duplicate quest rows.
    await gamification.awardGamificationAction({ kind: 'habit' });
    const secondQuestRows = await db.getAllAsync<{ quest_id: string; date_key: string }>(
      'SELECT quest_id, date_key FROM gamification_quests',
    );
    expect(secondQuestRows).toEqual(firstQuestRows);
    await db.closeAsync();
  }, 60000);
});
