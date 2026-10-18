/**
 * AUD-SH06-A/B/C and AUD-SH15-A/B — durable user-operation boundaries.
 *
 * Both findings were already repaired on the selected implementation base
 * (72a9565's successor stack), so these are ALREADY_FIXED_VERIFIED cases: the
 * campaign did not author the fix, and each case proves the inherited regression
 * discriminates the specific missing guard/transaction rather than merely
 * passing. Each re-derives the audited counterexample shape directly.
 *
 * SH-06 (High, audited): an ordinary in-app completion committed BEFORE the
 * linked-action source event was created/dispatched, so an interruption at that
 * handoff left `completed = 1` with zero source events, and an idempotent retry
 * returned `matchedRuleCount = 0` without redispatching. The effect intent was
 * lost. The base fix persists the source event in the SAME transaction as the
 * completion and drains it on startup.
 *
 * SH-15 (Medium, audited): `rescheduleWorkoutDate` committed the source override
 * first, so a failing destination leg left the workout moved to nowhere. The base
 * fix commits both legs and both intents in one transaction.
 */

import { describe, expect, it, vi } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

const NOW = '2026-01-01T00:00:00.000Z';

/** One-todo + one-habit + one-rule world whose rule increments the habit. */
async function seedLinkedRuleWorld(db: TestDatabase): Promise<{
  todoId: string;
  habitId: string;
  ruleId: string;
}> {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO todos (id, title, notes, completed, created_at, updated_at, deleted_at)
     VALUES ('todo_src', 'Source todo', NULL, 0, ?, ?, NULL)`,
    [now, now],
  );
  await db.runAsync(
    `INSERT INTO habits (id, name, target_per_day, category, icon, color, rule_history, created_at, updated_at, deleted_at)
     VALUES ('habit_target', 'Hydrate', 5, 'anytime', 'water-drop', '#64748b', '[]', ?, ?, NULL)`,
    [now, now],
  );
  // A rule that increments the habit target when the todo completes.
  const linked = await import('@/core/linked-actions/linkedActions.data');
  const rule = await linked.createLinkedActionRule({
    source: {
      feature: 'todos',
      entityType: 'todo',
      entityId: 'todo_src',
      triggerType: 'todo.completed',
    },
    target: {
      feature: 'habits',
      entityType: 'habit',
      entityId: 'habit_target',
      effect: {
        kind: 'progress',
        type: 'habit.increment',
        amount: 1,
        dateStrategy: 'source_date',
      },
    },
  });
  return { todoId: 'todo_src', habitId: 'habit_target', ruleId: rule.id };
}

async function countEvents(db: TestDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM linked_action_events',
  );
  return Number(row?.n ?? 0);
}

async function countExecutions(db: TestDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM linked_action_executions',
  );
  return Number(row?.n ?? 0);
}

async function habitCount(db: TestDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ c: number | null }>(
    `SELECT SUM(count) AS c FROM habit_completions WHERE habit_id = 'habit_target'`,
  );
  return Number(row?.c ?? 0);
}

describe('AUD-SH06-A: the source event commit is durable with the completion', () => {
  it('an interruption before dispatch leaves a durable event that recovery drains once', async () => {
    const db = await freshDatabase();
    await seedLinkedRuleWorld(db);

    const todos = await import('@/features/todos/todos.data');
    const engine = await import('@/core/linked-actions/linkedActions.engine');

    // Interrupt the post-commit dispatch: this models a process death between
    // the source commit and the effect application. The audited defect left NO
    // event in that window.
    const dispatchSpy = vi
      .spyOn(engine.linkedActionsEngine, 'processSourceAction')
      .mockRejectedValueOnce(new Error('simulated interruption before dispatch'));

    await expect(todos.completeTodo('todo_src')).rejects.toThrow(/simulated interruption/);
    dispatchSpy.mockRestore();

    // The authoritative row committed, AND the durable handoff survived with it.
    const todo = await db.getFirstAsync<{ completed: number }>(
      "SELECT completed FROM todos WHERE id = 'todo_src'",
    );
    expect(Number(todo?.completed)).toBe(1);
    expect(await countEvents(db)).toBe(1);
    // The effect did not apply yet — the event is the pending work.
    expect(await countExecutions(db)).toBe(0);

    // Startup recovery drains it exactly once.
    const { recoverPendingLinkedActions } =
      await import('@/core/linked-actions/linkedActions.recovery');
    await recoverPendingLinkedActions();
    expect(await countExecutions(db)).toBe(1);
    // The rule's effect landed: the target habit gained its increment.
    expect(await habitCount(db)).toBeGreaterThanOrEqual(1);

    // A second sweep is a no-op: the effect is not re-applied.
    const afterFirst = await countExecutions(db);
    await recoverPendingLinkedActions();
    expect(await countExecutions(db)).toBe(afterFirst);
    await db.closeAsync();
  }, 60000);

  it('an idempotent completion retry neither duplicates the event nor blocks recovery', async () => {
    const db = await freshDatabase();
    await seedLinkedRuleWorld(db);
    const todos = await import('@/features/todos/todos.data');

    await todos.completeTodo('todo_src');
    expect(await countEvents(db)).toBe(1);
    // Retrying completion of an already-complete row is a no-op for the event.
    const retry = await todos.completeTodo('todo_src');
    expect(retry.completed).toBe(1);
    expect(await countEvents(db)).toBe(1);
    await db.closeAsync();
  }, 60000);

  it('habit completion uses the same durable handoff', async () => {
    const db = await freshDatabase();
    const now = new Date().toISOString();
    // The habit needs a valid rule_history: `incrementHabit` reads today's
    // schedule from it, and an empty history means "not scheduled" (no
    // completion, no source event). This mirrors what `addHabit` writes.
    // The date key must be the LOCAL calendar day (`toDateKey`), not the UTC
    // slice of the ISO timestamp, or the schedule rule does not apply today.
    const { toDateKey } = await import('@/lib/time');
    const todayKey = toDateKey();
    await db.runAsync(
      `INSERT INTO habits (id, name, target_per_day, category, icon, color, rule_history, created_at, updated_at, deleted_at)
       VALUES ('habit_src', 'Source habit', 1, 'anytime', 'water-drop', '#64748b', ?, ?, ?, NULL)`,
      [
        // Target 1 so a single tick CROSSES the day's target: the source event
        // fires exactly on the crossing, which is the durable handoff under test.
        JSON.stringify([
          { effective_from_date: todayKey, weekdays: [1, 2, 3, 4, 5, 6, 7], target_per_day: 1 },
        ]),
        now,
        now,
      ],
    );
    await db.runAsync(
      `INSERT INTO todos (id, title, notes, completed, created_at, updated_at, deleted_at)
       VALUES ('todo_target', 'Target todo', NULL, 0, ?, ?, NULL)`,
      [now, now],
    );
    const linked = await import('@/core/linked-actions/linkedActions.data');
    await linked.createLinkedActionRule({
      source: {
        feature: 'habits',
        entityType: 'habit',
        entityId: 'habit_src',
        triggerType: 'habit.completed_for_day',
      },
      target: {
        feature: 'todos',
        entityType: 'todo',
        entityId: 'todo_target',
        effect: { kind: 'binary', type: 'todo.complete' },
      },
    });

    const habits = await import('@/features/habits/habits.data');
    await habits.incrementHabit('habit_src');
    expect(await countEvents(db)).toBeGreaterThanOrEqual(1);
    // The habit side committed its event durably too, so recovery can drain it.
    const { recoverPendingLinkedActions } =
      await import('@/core/linked-actions/linkedActions.recovery');
    await recoverPendingLinkedActions();
    const target = await db.getFirstAsync<{ completed: number }>(
      "SELECT completed FROM todos WHERE id = 'todo_target'",
    );
    expect(Number(target?.completed)).toBe(1);
    await db.closeAsync();
  }, 60000);
});

describe('AUD-SH15-A: a failing destination leg rolls the source back', () => {
  async function seedRoutineWorld(db: TestDatabase): Promise<void> {
    await db.runAsync(
      `INSERT INTO workout_routines (id, name, description, created_at, updated_at, deleted_at)
       VALUES ('wrk_a', 'Push day', NULL, ?, ?, NULL)`,
      [NOW, NOW],
    );
  }

  it('a missing routine leaves no source override and no intent behind', async () => {
    const db = await freshDatabase();
    await seedRoutineWorld(db);
    const workout = await import('@/features/workout/workout.data');

    // The real calendar-valid path, with a routine that does not exist: the
    // audited counterexample ("Routine not found" after the source leg ran).
    const thrown = await workout
      .rescheduleWorkoutDate({
        fromDateKey: '2026-10-19',
        toDateKey: '2026-10-20',
        routineId: 'wrk_missing',
      })
      .catch((error: unknown) => error);
    expect(String((thrown as Error).message)).toMatch(/routine not found/i);

    // Atomic outcome: the source date was NOT replaced by a rest override, and
    // no destination override or intent exists.
    const overrides = await db.getAllAsync<{ date_key: string; override_kind: string }>(
      'SELECT date_key, override_kind FROM workout_schedule_overrides ORDER BY date_key',
    );
    expect(overrides).toEqual([]);
    const intents = await db.getAllAsync<{ id: string }>(
      "SELECT id FROM sync_outbox WHERE entity = 'workout_schedule_overrides'",
    );
    expect(intents).toEqual([]);
    await db.closeAsync();
  }, 60000);

  it('an invalid destination date is rejected before any write', async () => {
    const db = await freshDatabase();
    await seedRoutineWorld(db);
    const workout = await import('@/features/workout/workout.data');
    await expect(
      workout.rescheduleWorkoutDate({
        fromDateKey: '2026-10-19',
        toDateKey: '2026-02-30',
        routineId: 'wrk_a',
      }),
    ).rejects.toThrow(/valid source and destination date/);
    const overrides = await db.getAllAsync('SELECT date_key FROM workout_schedule_overrides');
    expect(overrides).toEqual([]);
    await db.closeAsync();
  }, 60000);
});

describe('AUD-SH15-B: the successful move commits both legs and both intents', () => {
  async function seedRoutineWorld(db: TestDatabase): Promise<void> {
    await db.runAsync(
      `INSERT INTO workout_routines (id, name, description, created_at, updated_at, deleted_at)
       VALUES ('wrk_a', 'Push day', NULL, ?, ?, NULL)`,
      [NOW, NOW],
    );
  }

  it('a different-day move writes exactly one rest source and one workout destination', async () => {
    const db = await freshDatabase();
    await seedRoutineWorld(db);
    const workout = await import('@/features/workout/workout.data');

    await workout.rescheduleWorkoutDate({
      fromDateKey: '2026-10-19',
      toDateKey: '2026-10-20',
      routineId: 'wrk_a',
    });

    const overrides = await db.getAllAsync<{
      date_key: string;
      override_kind: string;
      routine_id: string | null;
      moved_from_date_key: string | null;
    }>(
      'SELECT date_key, override_kind, routine_id, moved_from_date_key FROM workout_schedule_overrides ORDER BY date_key',
    );
    expect(overrides).toHaveLength(2);
    expect(overrides[0]).toMatchObject({ date_key: '2026-10-19', override_kind: 'rest' });
    expect(overrides[1]).toMatchObject({
      date_key: '2026-10-20',
      override_kind: 'workout',
      routine_id: 'wrk_a',
      moved_from_date_key: '2026-10-19',
    });

    // One coherent set of intents, not a superseded pair.
    const intents = await db.getAllAsync<{ id: string; operation: string }>(
      "SELECT id, operation FROM sync_outbox WHERE entity = 'workout_schedule_overrides' ORDER BY id",
    );
    expect(intents).toHaveLength(2);
    expect(intents.every((intent) => intent.operation === 'create')).toBe(true);

    // The resolved schedule reflects the move.
    const destination = await workout.resolveWorkoutScheduleForDate('2026-10-20');
    expect(destination).toMatchObject({
      source: 'override',
      planKind: 'workout',
      routineId: 'wrk_a',
    });
    await db.closeAsync();
  }, 60000);

  it('a same-day move records only the destination and stays idempotent on repeat', async () => {
    const db = await freshDatabase();
    await seedRoutineWorld(db);
    const workout = await import('@/features/workout/workout.data');

    await workout.rescheduleWorkoutDate({
      fromDateKey: '2026-10-19',
      toDateKey: '2026-10-19',
      routineId: 'wrk_a',
    });
    await workout.rescheduleWorkoutDate({
      fromDateKey: '2026-10-19',
      toDateKey: '2026-10-19',
      routineId: 'wrk_a',
    });

    const overrides = await db.getAllAsync<{ date_key: string; override_kind: string }>(
      'SELECT date_key, override_kind FROM workout_schedule_overrides ORDER BY date_key',
    );
    // No source-rest leg for a same-day move, and the repeat did not duplicate.
    expect(overrides).toEqual([{ date_key: '2026-10-19', override_kind: 'workout' }]);
    await db.closeAsync();
  }, 60000);
});
