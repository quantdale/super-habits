import { afterEach, describe, expect, it } from 'vitest';
import { addLocalDays, toDateKey } from '@/lib/time';
import { freshDatabase, type TestDatabase } from './helpers/db';
import { saveHabitRules, saveTodoRules } from './helpers/linkedActionRules';

/**
 * A crash between the source commit and the post-commit dispatch leaves the
 * durable event row on disk; `recoverPendingLinkedActions()` replays it at the
 * NEXT LAUNCH, which can be a later local day. The produced-row effects must
 * stay attributed to the day the user actually acted on, not to the replay
 * instant: otherwise a todo completed at 23:58 whose dispatch died lands its
 * calorie entry, focus session, workout log — and the XP those earn — on
 * tomorrow.
 */
describe('replayed source events keep the source day attribution', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  /** Record yesterday's durable source event (the crash anchor) for a rule. */
  async function seedCrashAnchor(
    todoId: string,
    sourceDayKey: string,
    occurredAt: string,
  ): Promise<string> {
    const engineModule = await import('@/core/linked-actions/linkedActions.engine');
    const linked = await import('@/core/linked-actions/linkedActions.data');
    const eventId = `levt_replay_${sourceDayKey}`;
    await linked.insertLinkedActionEventInTransaction(
      db as never,
      engineModule.buildTransactionalSourceEvent({
        eventId,
        occurredAt,
        feature: 'todos',
        entityType: 'todo',
        entityId: todoId,
        triggerType: 'todo.completed',
        sourceDateKey: sourceDayKey,
        sourceRecordId: todoId,
        label: 'Late night session',
        origin: { originKind: 'user', originRuleId: null, originEventId: null },
        payload: { previousCompleted: 0, currentCompleted: 1, recurrence: null },
      }),
      occurredAt,
    );
    // Rules must predate the recorded event to stay historically eligible.
    await db.runAsync('UPDATE linked_action_rules SET created_at = ?', [
      '2020-01-01T00:00:00.000Z',
    ]);
    return eventId;
  }

  it('a calorie log replayed the next day lands on the source day', async () => {
    db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const todoId = await todos.addTodo({ title: 'Late night session' });
    await saveTodoRules(todoId, [
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
            foodName: 'Post-run smoothie',
            calories: 250,
            protein: 0,
            carbs: 0,
            fats: 0,
            fiber: 0,
            mealType: 'snack',
          },
        },
      },
    ]);

    const today = toDateKey();
    const sourceDay = addLocalDays(today, -1);
    await seedCrashAnchor(todoId, sourceDay, `${sourceDay}T12:00:00.000Z`);

    const recovery = await import('@/core/linked-actions/linkedActions.recovery');
    expect(await recovery.recoverPendingLinkedActions()).toMatchObject({ replayedEvents: 1 });

    const rows = await db.getAllAsync<{ consumed_on: string }>(
      'SELECT consumed_on FROM calorie_entries WHERE deleted_at IS NULL',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].consumed_on).toBe(sourceDay);
  });

  it('a focus session replayed the next day is timestamped inside the source day', async () => {
    db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const todoId = await todos.addTodo({ title: 'Late night session' });
    await saveTodoRules(todoId, [
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

    const today = toDateKey();
    const sourceDay = addLocalDays(today, -1);
    const occurredAt = `${sourceDay}T12:00:00.000Z`;
    await seedCrashAnchor(todoId, sourceDay, occurredAt);

    const recovery = await import('@/core/linked-actions/linkedActions.recovery');
    expect(await recovery.recoverPendingLinkedActions()).toMatchObject({ replayedEvents: 1 });

    const session = await db.getFirstAsync<{ started_at: string; ended_at: string }>(
      'SELECT started_at, ended_at FROM pomodoro_sessions',
    );
    expect(session).not.toBeNull();
    // The logged focus block ends when the source action happened, not when the
    // app was relaunched.
    expect(session!.ended_at).toBe(occurredAt);
    expect(session!.started_at).toBe(
      new Date(new Date(occurredAt).getTime() - 1500 * 1000).toISOString(),
    );
  });

  it('a workout log replayed the next day is completed on the source day', async () => {
    db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const workout = await import('@/features/workout/workout.data');
    const habitId = await habits.addHabit('Gym prompt', 1);
    // The shipped write gate refuses pre-creation dates for a fixed source day.
    await db.runAsync(`UPDATE habits SET created_at = ?, rule_history = ? WHERE id = ?`, [
      '2026-01-01T00:00:00.000Z',
      JSON.stringify([
        { effective_from_date: '2026-01-01', weekdays: [1, 2, 3, 4, 5, 6, 7], target_per_day: 1 },
      ]),
      habitId,
    ]);
    await workout.addRoutine('Push day', '');
    const [routine] = await workout.listRoutines();
    await saveHabitRules(habitId, [
      {
        triggerType: 'habit.completed_for_day',
        target: {
          feature: 'workout',
          entityType: 'workout_routine',
          entityId: routine.id,
          effect: { kind: 'log', type: 'workout.log', notes: null },
        },
      },
    ]);

    const today = toDateKey();
    const sourceDay = addLocalDays(today, -1);
    const occurredAt = `${sourceDay}T12:00:00.000Z`;
    const engineModule = await import('@/core/linked-actions/linkedActions.engine');
    const linked = await import('@/core/linked-actions/linkedActions.data');
    await linked.insertLinkedActionEventInTransaction(
      db as never,
      engineModule.buildTransactionalSourceEvent({
        eventId: `levt_replay_${sourceDay}`,
        occurredAt,
        feature: 'habits',
        entityType: 'habit',
        entityId: habitId,
        triggerType: 'habit.completed_for_day',
        sourceDateKey: sourceDay,
        sourceRecordId: 'hcmp_crash_anchor',
        label: 'Gym prompt',
        origin: { originKind: 'user', originRuleId: null, originEventId: null },
        payload: { previousCount: 0, currentCount: 1, targetPerDay: 1 },
      }),
      occurredAt,
    );
    await db.runAsync('UPDATE linked_action_rules SET created_at = ?', [
      '2020-01-01T00:00:00.000Z',
    ]);

    const recovery = await import('@/core/linked-actions/linkedActions.recovery');
    expect(await recovery.recoverPendingLinkedActions()).toMatchObject({ replayedEvents: 1 });

    const log = await db.getFirstAsync<{ completed_at: string }>(
      'SELECT completed_at FROM workout_logs',
    );
    expect(log).not.toBeNull();
    expect(log!.completed_at).toBe(occurredAt);
  });
});
