import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { freshDatabase, type TestDatabase } from './helpers/db';
import { pauseTodoRule, removeTodoRule, saveTodoRules } from './helpers/linkedActionRules';

/**
 * Multi-rule crash-recovery matrix (campaign A1 follow-up).
 *
 * `processSourceAction` dispatches EVERY matching rule for one source event,
 * and the engine's durable unit is the per-rule execution
 * (`UNIQUE(rule_id, source_event_id)`). A crash can therefore leave a source
 * event with rule A terminal while rule B is still missing, failed, or
 * running — and startup recovery must complete every applicable incomplete
 * rule exactly once.
 *
 * These tests pin that contract against real SQLite and the real engine:
 *
 * - the authoritative source mutation commits with the durable event handoff;
 * - the post-commit dispatch is interrupted AFTER rule A's effect completed
 *   and BEFORE rule B completed (crash hooks, `LinkedActionCrashError`, and a
 *   between-iterations notice seam that models process death mid-loop);
 * - `recoverPendingLinkedActions()` (the real startup sweeper) must finish the
 *   interrupted sibling rule exactly once, respect fresh execution leases,
 *   reclaim stale ones, and never re-apply terminal effects;
 * - rules created after the historical event must never fire retroactively;
 * - paused/deleted rules must never resurrect effects.
 *
 * Phrase note: the thrown "crash" replaces work that a real process death
 * would sever. The pre-dispatch crash of the dispatch call itself is the same
 * boundary the existing single-rule suite pins; the mid-loop interruptions
 * here pin the multi-rule partial-completion window.
 */

type TwoRuleWorld = {
  sourceTodoId: string;
  habitAId: string;
  habitBId: string;
  ruleAId: string;
  ruleBId: string;
  eventId: string;
};

type ExecutionRow = {
  id: string;
  rule_id: string;
  status: string;
  error_message: string | null;
  produced_entity_id: string | null;
  produced_entity_type: string | null;
};

async function listExecutions(db: TestDatabase): Promise<ExecutionRow[]> {
  return db.getAllAsync<ExecutionRow>(
    `SELECT id, rule_id, status, error_message, produced_entity_id, produced_entity_type
     FROM linked_action_executions
     ORDER BY created_at ASC, id ASC`,
  );
}

async function habitCompletionTotal(db: TestDatabase, habitId: string): Promise<number> {
  const row = await db.getFirstAsync<{ total: number | null }>(
    'SELECT SUM(count) AS total FROM habit_completions WHERE habit_id = ?',
    [habitId],
  );
  return row?.total ?? 0;
}

async function persistedEvent(world: TwoRuleWorld) {
  const linked = await import('@/core/linked-actions/linkedActions.data');
  const event = await linked.getLinkedActionEvent(world.eventId);
  expect(event).not.toBeNull();
  return event!;
}

/**
 * Source todo + two active rules (habit.increment on distinct habits) that
 * both match `todo.completed` for the source todo. Rule iteration order is
 * pinned via `created_at` (millisecond timestamps can collide under the
 * Windows clock resolution, and `listMatchingLinkedActionRules` orders by
 * `created_at ASC`).
 */
async function setupTwoRuleWorld(
  db: TestDatabase,
  options: { crashDispatch: boolean },
): Promise<TwoRuleWorld> {
  const todos = await import('@/features/todos/todos.data');
  const habits = await import('@/features/habits/habits.data');
  const sourceTodoId = await todos.addTodo({ title: 'Ship the report' });
  const habitAId = await habits.addHabit('Hydrate', 1);
  const habitBId = await habits.addHabit('Stretch', 1);

  const ruleIds = await saveTodoRules(sourceTodoId, [
    {
      triggerType: 'todo.completed',
      target: {
        feature: 'habits',
        entityType: 'habit',
        entityId: habitAId,
        effect: {
          kind: 'progress',
          type: 'habit.increment',
          amount: 1,
          dateStrategy: 'source_date',
        },
      },
    },
    {
      triggerType: 'todo.completed',
      target: {
        feature: 'habits',
        entityType: 'habit',
        entityId: habitBId,
        effect: {
          kind: 'progress',
          type: 'habit.increment',
          amount: 1,
          dateStrategy: 'source_date',
        },
      },
    },
  ]);
  const ruleA = { id: ruleIds[0] };
  const ruleB = { id: ruleIds[1] };

  await db.runAsync(`UPDATE linked_action_rules SET created_at = ? WHERE id = ?`, [
    '2026-01-01T00:00:00.000Z',
    ruleA.id,
  ]);
  await db.runAsync(`UPDATE linked_action_rules SET created_at = ? WHERE id = ?`, [
    '2026-01-02T00:00:00.000Z',
    ruleB.id,
  ]);

  const source = (await todos.listTodos()).find((t) => t.id === sourceTodoId)!;

  if (options.crashDispatch) {
    const engineModule = await import('@/core/linked-actions/linkedActions.engine');
    const crash = vi
      .spyOn(engineModule.linkedActionsEngine, 'processSourceAction')
      .mockImplementation(async () => {
        throw new Error('SIMULATED_CRASH_AFTER_SOURCE_COMMIT');
      });
    await expect(todos.toggleTodo(source)).rejects.toThrow('SIMULATED_CRASH_AFTER_SOURCE_COMMIT');
    crash.mockRestore();
  } else {
    await todos.toggleTodo(source);
  }

  const todoRow = await db.getFirstAsync<{ completed: number }>(
    'SELECT completed FROM todos WHERE id = ?',
    [sourceTodoId],
  );
  expect(todoRow?.completed).toBe(1);

  const events = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM linked_action_events WHERE source_entity_id = ?',
    [sourceTodoId],
  );
  expect(events).toHaveLength(1);

  return {
    sourceTodoId,
    habitAId,
    habitBId,
    ruleAId: ruleA.id,
    ruleBId: ruleB.id,
    eventId: events[0].id,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('multi-rule partial completion recovery', () => {
  it('recovers the failed sibling rule exactly once (first applied, second failed)', async () => {
    const db = await freshDatabase();
    const world = await setupTwoRuleWorld(db, { crashDispatch: true });
    const effects = await import('@/core/linked-actions/linkedActions.effects');
    const engineModule = await import('@/core/linked-actions/linkedActions.engine');
    const realIncrement = effects.linkedActionEffectRegistry['habit.increment'];

    const interrupted = await new engineModule.LinkedActionsEngine({
      effectRegistry: {
        'habit.increment': async (plan) => {
          if (plan.rule.target.entityId === world.habitBId) {
            throw new Error('injected sibling effect failure');
          }
          return realIncrement(plan);
        },
      },
    }).processSourceAction(await persistedEvent(world));

    expect(interrupted.effects.map((effect) => effect.status)).toEqual(['applied', 'failed']);

    // Precise pre-recovery state: source committed, event durable, rule A
    // terminal with its effect, rule B failed with NO effect.
    const before = await listExecutions(db);
    expect(before).toHaveLength(2);
    expect(before.find((row) => row.rule_id === world.ruleAId)).toMatchObject({
      status: 'applied',
    });
    const failedB = before.find((row) => row.rule_id === world.ruleBId)!;
    expect(failedB).toMatchObject({
      status: 'failed',
      error_message: 'injected sibling effect failure',
    });
    expect(await habitCompletionTotal(db, world.habitAId)).toBe(1);
    expect(await habitCompletionTotal(db, world.habitBId)).toBe(0);

    const recovery = await import('@/core/linked-actions/linkedActions.recovery');
    const first = await recovery.recoverPendingLinkedActions();
    expect(first).toMatchObject({ replayedEvents: 1, skippedEvents: 0, failedEvents: 0 });

    // The interrupted sibling rule is completed exactly once, reusing the
    // interrupted execution's stable identity.
    expect(await habitCompletionTotal(db, world.habitBId)).toBe(1);
    const outboxAfterRecovery = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM sync_outbox',
    );
    const after = await listExecutions(db);
    expect(after).toHaveLength(2);
    const appliedB = after.find((row) => row.rule_id === world.ruleBId)!;
    expect(appliedB).toMatchObject({ status: 'applied' });
    expect(appliedB.id).toBe(failedB.id);

    const second = await recovery.recoverPendingLinkedActions();
    expect(second).toMatchObject({ replayedEvents: 0, skippedEvents: 0, failedEvents: 0 });
    expect(await habitCompletionTotal(db, world.habitAId)).toBe(1);
    expect(await habitCompletionTotal(db, world.habitBId)).toBe(1);
    expect(await listExecutions(db)).toHaveLength(2);
    // Replay and repeated sweeps never duplicate durable backup intents.
    expect(await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sync_outbox')).toEqual(
      outboxAfterRecovery,
    );

    await db.closeAsync();
  });

  it('respects a fresh running lease, then reclaims the stale one exactly once (first applied, second running)', async () => {
    const db = await freshDatabase();
    const world = await setupTwoRuleWorld(db, { crashDispatch: true });
    const engineModule = await import('@/core/linked-actions/linkedActions.engine');

    const interrupted = new engineModule.LinkedActionsEngine({
      beforeEffect: (_executionId, plan) => {
        if (plan.rule.target.entityId === world.habitBId) {
          throw new engineModule.LinkedActionCrashError('crash before sibling effect');
        }
      },
    });
    await expect(interrupted.processSourceAction(await persistedEvent(world))).rejects.toThrow(
      'crash before sibling effect',
    );

    const before = await listExecutions(db);
    expect(before).toHaveLength(2);
    expect(before.find((row) => row.rule_id === world.ruleAId)).toMatchObject({
      status: 'applied',
    });
    const runningB = before.find((row) => row.rule_id === world.ruleBId)!;
    expect(runningB).toMatchObject({ status: 'running' });
    expect(await habitCompletionTotal(db, world.habitBId)).toBe(0);

    const recovery = await import('@/core/linked-actions/linkedActions.recovery');

    // A fresh execution lease is NOT stolen: the sweep sees the event but
    // leaves the in-progress execution (and its effect) untouched. It is
    // retried once the lease is stale (see next pass — the startup sweep is
    // the retry mechanism).
    const first = await recovery.recoverPendingLinkedActions();
    expect(first).toMatchObject({ replayedEvents: 0, skippedEvents: 1, failedEvents: 0 });
    expect(await habitCompletionTotal(db, world.habitBId)).toBe(0);
    expect((await listExecutions(db)).find((row) => row.rule_id === world.ruleBId)).toMatchObject({
      status: 'running',
    });

    // Lease expired (the execution was abandoned by the crash).
    await db.runAsync(`UPDATE linked_action_executions SET updated_at = ? WHERE id = ?`, [
      '2020-01-01T00:00:00.000Z',
      runningB.id,
    ]);

    const second = await recovery.recoverPendingLinkedActions();
    expect(second).toMatchObject({ replayedEvents: 1, skippedEvents: 0, failedEvents: 0 });
    expect(await habitCompletionTotal(db, world.habitBId)).toBe(1);
    const after = await listExecutions(db);
    const appliedB = after.find((row) => row.rule_id === world.ruleBId)!;
    expect(appliedB).toMatchObject({ status: 'applied' });
    expect(appliedB.id).toBe(runningB.id);

    const third = await recovery.recoverPendingLinkedActions();
    expect(third).toMatchObject({ replayedEvents: 0, skippedEvents: 0, failedEvents: 0 });
    expect(await habitCompletionTotal(db, world.habitAId)).toBe(1);
    expect(await habitCompletionTotal(db, world.habitBId)).toBe(1);
    expect(await listExecutions(db)).toHaveLength(2);

    await db.closeAsync();
  });

  it('recovers the never-started sibling rule exactly once (crash between rule iterations)', async () => {
    const db = await freshDatabase();
    const world = await setupTwoRuleWorld(db, { crashDispatch: true });
    const engineModule = await import('@/core/linked-actions/linkedActions.engine');

    // The notice seam is the only engine boundary between two rule
    // iterations; throwing the engine's crash error there models a process
    // death after rule A's effect + finalize but before rule B started.
    const interrupted = new engineModule.LinkedActionsEngine({
      onNotice: () => {
        throw new engineModule.LinkedActionCrashError('crash between rule iterations');
      },
    });
    await expect(interrupted.processSourceAction(await persistedEvent(world))).rejects.toThrow(
      'crash between rule iterations',
    );

    // Precise pre-recovery state: rule A terminal with its effect; rule B has
    // NO execution record at all and NO effect.
    const before = await listExecutions(db);
    expect(before).toHaveLength(1);
    expect(before[0].rule_id).toBe(world.ruleAId);
    expect(before[0]).toMatchObject({ status: 'applied' });
    expect(await habitCompletionTotal(db, world.habitAId)).toBe(1);
    expect(await habitCompletionTotal(db, world.habitBId)).toBe(0);

    const recovery = await import('@/core/linked-actions/linkedActions.recovery');
    const first = await recovery.recoverPendingLinkedActions();
    expect(first).toMatchObject({ replayedEvents: 1, skippedEvents: 0, failedEvents: 0 });

    expect(await habitCompletionTotal(db, world.habitBId)).toBe(1);
    const after = await listExecutions(db);
    expect(after).toHaveLength(2);
    expect(after.find((row) => row.rule_id === world.ruleBId)).toMatchObject({ status: 'applied' });

    const second = await recovery.recoverPendingLinkedActions();
    expect(second).toMatchObject({ replayedEvents: 0, skippedEvents: 0, failedEvents: 0 });
    expect(await habitCompletionTotal(db, world.habitAId)).toBe(1);
    expect(await habitCompletionTotal(db, world.habitBId)).toBe(1);
    expect(await listExecutions(db)).toHaveLength(2);

    const events = await db.getAllAsync('SELECT id FROM linked_action_events');
    expect(events).toHaveLength(1);

    await db.closeAsync();
  });

  it('completes the never-started sibling rule across a simulated restart', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'superhabits-multirule-restart-'));
    const file = path.join(dir, 'superhabits.db');

    try {
      const db = await freshDatabase(file);
      const world = await setupTwoRuleWorld(db, { crashDispatch: true });
      const engineModule = await import('@/core/linked-actions/linkedActions.engine');
      const interrupted = new engineModule.LinkedActionsEngine({
        onNotice: () => {
          throw new engineModule.LinkedActionCrashError('crash between rule iterations');
        },
      });
      await expect(interrupted.processSourceAction(await persistedEvent(world))).rejects.toThrow(
        'crash between rule iterations',
      );
      expect(await habitCompletionTotal(db, world.habitBId)).toBe(0);
      await db.closeAsync();

      const restartedDb = await freshDatabase(file);
      const recovery = await import('@/core/linked-actions/linkedActions.recovery');
      const first = await recovery.recoverPendingLinkedActions();
      expect(first).toMatchObject({ replayedEvents: 1, skippedEvents: 0, failedEvents: 0 });
      expect(await habitCompletionTotal(restartedDb, world.habitBId)).toBe(1);
      const second = await recovery.recoverPendingLinkedActions();
      expect(second).toMatchObject({ replayedEvents: 0, skippedEvents: 0, failedEvents: 0 });
      expect(await listExecutions(restartedDb)).toHaveLength(2);
      await restartedDb.closeAsync();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('multi-rule complete state', () => {
  it('creates no further effects when both rules already applied', async () => {
    const db = await freshDatabase();
    const world = await setupTwoRuleWorld(db, { crashDispatch: false });

    expect(await habitCompletionTotal(db, world.habitAId)).toBe(1);
    expect(await habitCompletionTotal(db, world.habitBId)).toBe(1);
    const executions = await listExecutions(db);
    expect(executions).toHaveLength(2);
    expect(executions.every((row) => row.status === 'applied')).toBe(true);

    const recovery = await import('@/core/linked-actions/linkedActions.recovery');
    const first = await recovery.recoverPendingLinkedActions();
    expect(first).toMatchObject({ replayedEvents: 0, skippedEvents: 0, failedEvents: 0 });
    const second = await recovery.recoverPendingLinkedActions();
    expect(second).toMatchObject({ replayedEvents: 0, skippedEvents: 0, failedEvents: 0 });

    expect(await habitCompletionTotal(db, world.habitAId)).toBe(1);
    expect(await habitCompletionTotal(db, world.habitBId)).toBe(1);
    expect(await listExecutions(db)).toHaveLength(2);

    await db.closeAsync();
  });

  it('creates no further effects when one rule applied and one legitimately skipped', async () => {
    const db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const habits = await import('@/features/habits/habits.data');
    const sourceTodoId = await todos.addTodo({ title: 'Ship the report' });
    const habitAId = await habits.addHabit('Hydrate', 1);
    const targetTodoId = await todos.addTodo({ title: 'Already done' });
    await todos.completeTodo(targetTodoId);

    // Rule B's target is already completed at dispatch time: the adapter
    // records a terminal `skipped` (already_completed) — done, not pending.
    const ruleIds = await saveTodoRules(sourceTodoId, [
      {
        triggerType: 'todo.completed',
        target: {
          feature: 'habits',
          entityType: 'habit',
          entityId: habitAId,
          effect: {
            kind: 'progress',
            type: 'habit.increment',
            amount: 1,
            dateStrategy: 'source_date',
          },
        },
      },
      {
        triggerType: 'todo.completed',
        target: {
          feature: 'todos',
          entityType: 'todo',
          entityId: targetTodoId,
          effect: { kind: 'binary', type: 'todo.complete' },
        },
      },
    ]);
    const ruleA = { id: ruleIds[0] };
    const ruleB = { id: ruleIds[1] };
    await db.runAsync(`UPDATE linked_action_rules SET created_at = ? WHERE id = ?`, [
      '2026-01-01T00:00:00.000Z',
      ruleA.id,
    ]);
    await db.runAsync(`UPDATE linked_action_rules SET created_at = ? WHERE id = ?`, [
      '2026-01-02T00:00:00.000Z',
      ruleB.id,
    ]);

    const source = (await todos.listTodos()).find((t) => t.id === sourceTodoId)!;
    await todos.toggleTodo(source);

    const effects = await db.getAllAsync<{ status: string }>(
      'SELECT status FROM linked_action_executions ORDER BY created_at ASC, id ASC',
    );
    expect(effects.map((row) => row.status)).toEqual(['applied', 'skipped']);
    expect(await habitCompletionTotal(db, habitAId)).toBe(1);

    const recovery = await import('@/core/linked-actions/linkedActions.recovery');
    const first = await recovery.recoverPendingLinkedActions();
    expect(first).toMatchObject({ replayedEvents: 0, skippedEvents: 0, failedEvents: 0 });
    const second = await recovery.recoverPendingLinkedActions();
    expect(second).toMatchObject({ replayedEvents: 0, skippedEvents: 0, failedEvents: 0 });
    expect(await habitCompletionTotal(db, habitAId)).toBe(1);
    expect(await listExecutions(db)).toHaveLength(2);

    await db.closeAsync();
  });
});

describe('historical rule changes', () => {
  it('never fires a rule that was paused after the historical source event', async () => {
    const db = await freshDatabase();
    const world = await setupTwoRuleWorld(db, { crashDispatch: true });
    const engineModule = await import('@/core/linked-actions/linkedActions.engine');
    const effects = await import('@/core/linked-actions/linkedActions.effects');
    const realIncrement = effects.linkedActionEffectRegistry['habit.increment'];

    const interrupted = await new engineModule.LinkedActionsEngine({
      effectRegistry: {
        'habit.increment': async (plan) => {
          if (plan.rule.target.entityId === world.habitBId) {
            throw new Error('injected sibling effect failure');
          }
          return realIncrement(plan);
        },
      },
    }).processSourceAction(await persistedEvent(world));
    expect(interrupted.effects.map((effect) => effect.status)).toEqual(['applied', 'failed']);

    await pauseTodoRule(world.sourceTodoId, world.ruleBId);

    const recovery = await import('@/core/linked-actions/linkedActions.recovery');
    const first = await recovery.recoverPendingLinkedActions();
    expect(first).toMatchObject({ replayedEvents: 0, skippedEvents: 0, failedEvents: 0 });
    expect(await habitCompletionTotal(db, world.habitBId)).toBe(0);
    expect(await habitCompletionTotal(db, world.habitAId)).toBe(1);
    const executions = await listExecutions(db);
    expect(executions).toHaveLength(2);
    expect(executions.find((row) => row.rule_id === world.ruleBId)).toMatchObject({
      status: 'failed',
    });

    await db.closeAsync();
  });

  it('never fires a rule that was deleted after the historical source event', async () => {
    const db = await freshDatabase();
    const world = await setupTwoRuleWorld(db, { crashDispatch: true });
    const engineModule = await import('@/core/linked-actions/linkedActions.engine');

    const interrupted = new engineModule.LinkedActionsEngine({
      onNotice: () => {
        throw new engineModule.LinkedActionCrashError('crash between rule iterations');
      },
    });
    await expect(interrupted.processSourceAction(await persistedEvent(world))).rejects.toThrow(
      'crash between rule iterations',
    );

    await removeTodoRule(world.sourceTodoId, world.ruleBId);

    const recovery = await import('@/core/linked-actions/linkedActions.recovery');
    const first = await recovery.recoverPendingLinkedActions();
    expect(first).toMatchObject({ replayedEvents: 0, skippedEvents: 0, failedEvents: 0 });
    expect(await habitCompletionTotal(db, world.habitBId)).toBe(0);
    expect(await habitCompletionTotal(db, world.habitAId)).toBe(1);

    await db.closeAsync();
  });

  it('never fires a rule created after the historical source event', async () => {
    const db = await freshDatabase();
    const world = await setupTwoRuleWorld(db, { crashDispatch: true });
    const engineModule = await import('@/core/linked-actions/linkedActions.engine');
    const habits = await import('@/features/habits/habits.data');
    const linked = await import('@/core/linked-actions/linkedActions.data');

    const interrupted = new engineModule.LinkedActionsEngine({
      onNotice: () => {
        throw new engineModule.LinkedActionCrashError('crash between rule iterations');
      },
    });
    await expect(interrupted.processSourceAction(await persistedEvent(world))).rejects.toThrow(
      'crash between rule iterations',
    );

    // The user authors a new matching rule AFTER the source event happened.
    // The editor replaces a source's whole rule set, so the two existing rules
    // are resubmitted by id and the new one is appended.
    const habitCId = await habits.addHabit('Meditate', 1);
    const existing = await linked.listLinkedActionRulesForSourceEntity({
      feature: 'todos',
      entityType: 'todo',
      entityId: world.sourceTodoId,
    });
    const resubmitted = existing.flatMap((rule) =>
      rule.isUnsupported
        ? []
        : [
            {
              existingRuleId: rule.id,
              triggerType: rule.source.triggerType,
              target: rule.target,
            },
          ],
    );
    const ruleIds = await saveTodoRules(world.sourceTodoId, [
      ...resubmitted,
      {
        triggerType: 'todo.completed',
        target: {
          feature: 'habits',
          entityType: 'habit',
          entityId: habitCId,
          effect: {
            kind: 'progress',
            type: 'habit.increment',
            amount: 1,
            dateStrategy: 'source_date',
          },
        },
      },
    ]);
    const ruleC = { id: ruleIds[ruleIds.length - 1] };
    await db.runAsync(`UPDATE linked_action_rules SET created_at = ? WHERE id = ?`, [
      '2026-12-31T00:00:00.000Z',
      ruleC.id,
    ]);

    const recovery = await import('@/core/linked-actions/linkedActions.recovery');
    const first = await recovery.recoverPendingLinkedActions();
    expect(first).toMatchObject({ replayedEvents: 1, skippedEvents: 0, failedEvents: 0 });

    // The unfinished historical rule completes; the new rule must not gain a
    // retroactive effect from a historical event.
    expect(await habitCompletionTotal(db, world.habitBId)).toBe(1);
    expect(await habitCompletionTotal(db, habitCId)).toBe(0);
    const executions = await listExecutions(db);
    expect(executions).toHaveLength(2);
    expect(executions.find((row) => row.rule_id === ruleC.id)).toBeUndefined();

    const second = await recovery.recoverPendingLinkedActions();
    expect(second).toMatchObject({ replayedEvents: 0, skippedEvents: 0, failedEvents: 0 });
    expect(await habitCompletionTotal(db, habitCId)).toBe(0);

    await db.closeAsync();
  });

  it('completes an interrupted rule with its current configuration when it still matches', async () => {
    const db = await freshDatabase();
    const world = await setupTwoRuleWorld(db, { crashDispatch: true });
    const engineModule = await import('@/core/linked-actions/linkedActions.engine');
    const habits = await import('@/features/habits/habits.data');
    const linked = await import('@/core/linked-actions/linkedActions.data');

    const interrupted = new engineModule.LinkedActionsEngine({
      onNotice: () => {
        throw new engineModule.LinkedActionCrashError('crash between rule iterations');
      },
    });
    await expect(interrupted.processSourceAction(await persistedEvent(world))).rejects.toThrow(
      'crash between rule iterations',
    );

    // The user retargets rule B before the next startup. Supported historical
    // semantics (unchanged from A1): recovery replays through the live rule
    // pipeline, so a rule that still matches the historical source fires with
    // its CURRENT configuration; rules that no longer match never fire.
    const habitB2Id = await habits.addHabit('Stretch (v2)', 1);
    await linked.replaceLinkedActionRulesForSourceEntity({
      feature: 'todos',
      entityType: 'todo',
      entityId: world.sourceTodoId,
      rules: [
        {
          existingRuleId: world.ruleAId,
          triggerType: 'todo.completed',
          target: {
            feature: 'habits',
            entityType: 'habit',
            entityId: world.habitAId,
            effect: {
              kind: 'progress',
              type: 'habit.increment',
              amount: 1,
              dateStrategy: 'source_date',
            },
          },
        },
        {
          existingRuleId: world.ruleBId,
          triggerType: 'todo.completed',
          target: {
            feature: 'habits',
            entityType: 'habit',
            entityId: habitB2Id,
            effect: {
              kind: 'progress',
              type: 'habit.increment',
              amount: 1,
              dateStrategy: 'source_date',
            },
          },
        },
      ],
    });

    const recovery = await import('@/core/linked-actions/linkedActions.recovery');
    const first = await recovery.recoverPendingLinkedActions();
    expect(first).toMatchObject({ replayedEvents: 1, skippedEvents: 0, failedEvents: 0 });

    expect(await habitCompletionTotal(db, habitB2Id)).toBe(1);
    expect(await habitCompletionTotal(db, world.habitBId)).toBe(0);

    const second = await recovery.recoverPendingLinkedActions();
    expect(second).toMatchObject({ replayedEvents: 0, skippedEvents: 0, failedEvents: 0 });
    expect(await habitCompletionTotal(db, habitB2Id)).toBe(1);

    await db.closeAsync();
  });
});

describe('exactly-once integrity across effect types', () => {
  it('completes every interrupted sibling effect (habit, todo, calorie, pomodoro) exactly once', async () => {
    const db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const habits = await import('@/features/habits/habits.data');
    const linked = await import('@/core/linked-actions/linkedActions.data');
    const engineModule = await import('@/core/linked-actions/linkedActions.engine');

    const sourceTodoId = await todos.addTodo({ title: 'Ship the release' });
    const habitId = await habits.addHabit('Hydrate', 1);
    const targetTodoId = await todos.addTodo({ title: 'Write the changelog' });

    const ruleIds = await saveTodoRules(sourceTodoId, [
      {
        triggerType: 'todo.completed',
        target: {
          feature: 'habits',
          entityType: 'habit',
          entityId: habitId,
          effect: {
            kind: 'progress',
            type: 'habit.increment',
            amount: 1,
            dateStrategy: 'source_date',
          },
        },
      },
      {
        triggerType: 'todo.completed',
        target: {
          feature: 'todos',
          entityType: 'todo',
          entityId: targetTodoId,
          effect: { kind: 'binary', type: 'todo.complete' },
        },
      },
      {
        triggerType: 'todo.completed',
        target: {
          feature: 'calories',
          entityType: 'calorie_log',
          entityId: null,
          effect: {
            kind: 'log',
            type: 'calorie.log',
            dateStrategy: 'today',
            templateSource: 'inline',
            savedMealId: null,
            foodName: 'Release snack',
            calories: 200,
            protein: 5,
            carbs: 30,
            fats: 6,
            fiber: 2,
            mealType: 'snack',
          },
        },
      },
      {
        triggerType: 'todo.completed',
        target: {
          feature: 'pomodoro',
          entityType: 'pomodoro_session',
          entityId: null,
          effect: {
            kind: 'log',
            type: 'pomodoro.log',
            sessionType: 'focus',
            durationSeconds: 1500,
          },
        },
      },
    ]);
    const ruleHabit = { id: ruleIds[0] };
    const ruleTodo = { id: ruleIds[1] };
    const ruleCalorie = { id: ruleIds[2] };
    const rulePomodoro = { id: ruleIds[3] };

    // Deterministic rule order: habit → todo → calorie → pomodoro.
    await db.runAsync(`UPDATE linked_action_rules SET created_at = ? WHERE id = ?`, [
      '2026-01-01T00:00:00.000Z',
      ruleHabit.id,
    ]);
    await db.runAsync(`UPDATE linked_action_rules SET created_at = ? WHERE id = ?`, [
      '2026-01-02T00:00:00.000Z',
      ruleTodo.id,
    ]);
    await db.runAsync(`UPDATE linked_action_rules SET created_at = ? WHERE id = ?`, [
      '2026-01-03T00:00:00.000Z',
      ruleCalorie.id,
    ]);
    await db.runAsync(`UPDATE linked_action_rules SET created_at = ? WHERE id = ?`, [
      '2026-01-04T00:00:00.000Z',
      rulePomodoro.id,
    ]);

    const source = (await todos.listTodos()).find((t) => t.id === sourceTodoId)!;
    const engineModuleForCrash = engineModule;
    const crash = vi
      .spyOn(engineModuleForCrash.linkedActionsEngine, 'processSourceAction')
      .mockImplementation(async () => {
        throw new Error('SIMULATED_CRASH_AFTER_SOURCE_COMMIT');
      });
    await expect(todos.toggleTodo(source)).rejects.toThrow('SIMULATED_CRASH_AFTER_SOURCE_COMMIT');
    crash.mockRestore();

    const event = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM linked_action_events WHERE source_entity_id = ?',
      [sourceTodoId],
    );
    expect(event).not.toBeNull();

    // Process death after the first effect's notice: only the habit rule
    // completed; the other three rules never started.
    const interrupted = new engineModule.LinkedActionsEngine({
      onNotice: () => {
        throw new engineModule.LinkedActionCrashError('crash between rule iterations');
      },
    });
    await expect(
      interrupted.processSourceAction((await linked.getLinkedActionEvent(event!.id))!),
    ).rejects.toThrow('crash between rule iterations');

    const before = await listExecutions(db);
    expect(before).toHaveLength(1);
    expect(before[0]).toMatchObject({ status: 'applied', rule_id: ruleHabit.id });
    expect(await habitCompletionTotal(db, habitId)).toBe(1);
    expect(
      await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM calorie_entries'),
    ).toEqual({ n: 0 });
    expect(
      await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM pomodoro_sessions'),
    ).toEqual({ n: 0 });
    expect(
      await db.getFirstAsync<{ completed: number }>('SELECT completed FROM todos WHERE id = ?', [
        targetTodoId,
      ]),
    ).toEqual({ completed: 0 });

    const recovery = await import('@/core/linked-actions/linkedActions.recovery');
    const first = await recovery.recoverPendingLinkedActions();
    expect(first).toMatchObject({ replayedEvents: 1, skippedEvents: 0, failedEvents: 0 });

    const after = await listExecutions(db);
    expect(after).toHaveLength(4);
    expect(after.every((row) => row.status === 'applied')).toBe(true);
    const outboxAfterFirstRecovery = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM sync_outbox',
    );

    // Exactly-once per effect type: the recovered executions reuse their
    // stable planned produced identities, so replay collapses to one row.
    expect(await habitCompletionTotal(db, habitId)).toBe(1);
    expect(
      await db.getFirstAsync<{ completed: number }>('SELECT completed FROM todos WHERE id = ?', [
        targetTodoId,
      ]),
    ).toEqual({ completed: 1 });
    const calorieRows = await db.getAllAsync<{ id: string }>('SELECT id FROM calorie_entries');
    expect(calorieRows).toHaveLength(1);
    const pomodoroRows = await db.getAllAsync<{ id: string }>('SELECT id FROM pomodoro_sessions');
    expect(pomodoroRows).toHaveLength(1);
    const calorieExecution = after.find((row) => row.rule_id === ruleCalorie.id)!;
    expect(calorieExecution.produced_entity_id).toBe(calorieRows[0].id);
    const pomodoroExecution = after.find((row) => row.rule_id === rulePomodoro.id)!;
    expect(pomodoroExecution.produced_entity_id).toBe(pomodoroRows[0].id);

    // Repeated recovery and a repeated dispatch of the same event are no-ops.
    const second = await recovery.recoverPendingLinkedActions();
    expect(second).toMatchObject({ replayedEvents: 0, skippedEvents: 0, failedEvents: 0 });
    const redispatch = await engineModule.linkedActionsEngine.processSourceAction(
      (await linked.getLinkedActionEvent(event!.id))!,
    );
    expect(redispatch.effects.every((effect) => effect.status === 'duplicate')).toBe(true);
    expect(
      await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM calorie_entries'),
    ).toEqual({ n: 1 });
    expect(
      await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM pomodoro_sessions'),
    ).toEqual({ n: 1 });
    expect(await listExecutions(db)).toHaveLength(4);
    expect(await habitCompletionTotal(db, habitId)).toBe(1);
    // Neither the repeat sweep nor the repeated dispatch duplicated durable
    // backup intents.
    expect(await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sync_outbox')).toEqual(
      outboxAfterFirstRecovery,
    );

    await db.closeAsync();
  });
});
