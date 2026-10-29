import { describe, expect, it } from 'vitest';
import {
  buildDayCompletions,
  getHabitRuleForDate,
  parseHabitRuleHistory,
  type HabitWeekday,
} from '@/features/habits/habits.domain';
import { toDateKey } from '@/lib/time';
import { freshDatabase } from './helpers/db';
import { saveTodoRules } from './helpers/linkedActionRules';

describe('real SQLite habit scheduling persistence', () => {
  function nextWeekdayOutside(weekdays: readonly number[]): string {
    const candidate = new Date();
    do {
      candidate.setDate(candidate.getDate() + 1);
      const isoWeekday = candidate.getDay() === 0 ? 7 : candidate.getDay();
      if (!weekdays.includes(isoWeekday)) {
        return toDateKey(candidate);
      }
    } while (true);
  }

  it('persists an initial schedule and effective target/schedule edits', async () => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const today = toDateKey();
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = toDateKey(tomorrowDate);

    const id = await habits.addHabit('Gym', 1, 'anytime', 'fitness-center', '#10b981', [1, 3, 5]);
    const initial = await db.getFirstAsync<{ rule_history: string; target_per_day: number }>(
      'SELECT rule_history, target_per_day FROM habits WHERE id = ?',
      [id],
    );
    expect(initial?.target_per_day).toBe(1);
    expect(parseHabitRuleHistory(initial?.rule_history)).toEqual([
      expect.objectContaining({ weekdays: [1, 3, 5], target_per_day: 1 }),
    ]);

    await habits.updateHabit(id, {
      name: 'Gym',
      targetPerDay: 2,
      category: 'anytime',
      icon: 'fitness-center',
      color: '#10b981',
      weekdays: [1, 2, 3, 4, 5] as HabitWeekday[],
      effectiveFromDate: tomorrow,
    });

    const updated = await habits.listHabits();
    const history = parseHabitRuleHistory(updated[0]?.rule_history);
    expect(history).toHaveLength(2);
    expect(getHabitRuleForDate(history, today)?.target_per_day).toBe(1);
    expect(getHabitRuleForDate(history, today)?.weekdays).toEqual([1, 3, 5]);
    expect(getHabitRuleForDate(history, tomorrow)?.target_per_day).toBe(2);
    expect(getHabitRuleForDate(history, tomorrow)?.weekdays).toEqual([1, 2, 3, 4, 5]);

    await db.closeAsync();
  });

  it('persists, updates, disables, reloads, and soft-deletes reminder configuration', async () => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');

    const id = await habits.addHabit(
      'Gym',
      1,
      'anytime',
      'fitness-center',
      '#10b981',
      [1, 3, 5],
      '18:00',
    );
    expect((await habits.listHabits())[0]?.reminder_time).toBe('18:00');

    await habits.updateHabit(id, {
      name: 'Gym',
      targetPerDay: 1,
      category: 'anytime',
      weekdays: [1, 2, 3, 4, 5],
      reminderTime: '07:00',
    });
    expect((await habits.listHabits())[0]?.reminder_time).toBe('07:00');

    await habits.updateHabit(id, {
      name: 'Gym',
      targetPerDay: 1,
      category: 'anytime',
      weekdays: [1, 2, 3, 4, 5],
      reminderTime: null,
    });
    expect((await habits.listHabits())[0]?.reminder_time).toBeNull();

    await habits.deleteHabit(id);
    expect(await habits.listHabits()).toHaveLength(0);
    const deleted = await db.getFirstAsync<{
      reminder_time: string | null;
      deleted_at: string | null;
    }>('SELECT reminder_time, deleted_at FROM habits WHERE id = ?', [id]);
    expect(deleted).toMatchObject({ reminder_time: null });
    expect(deleted?.deleted_at).toEqual(expect.any(String));

    await db.closeAsync();
  });

  it('keeps completion rows compatible while scheduled metrics ignore off-days', async () => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const offDay = nextWeekdayOutside([1, 3, 5]);
    const id = await habits.addHabit('Gym', 1, 'anytime', 'fitness-center', '#10b981', [1, 3, 5]);

    // Lifecycle/schedule write gate: an off-schedule date accepts no
    // completion writes at all.
    await habits.incrementHabit(id, offDay);
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT count FROM habit_completions WHERE habit_id = ? AND date_key = ?',
      [id, offDay],
    );
    expect(row).toBeNull();

    const habit = (await habits.listHabits())[0];
    const completions = await habits.getCompletionHistory(id);
    const days = buildDayCompletions(
      completions,
      habit.target_per_day,
      undefined,
      habit.rule_history,
      undefined,
      offDay,
    );
    expect(days.at(-1)).toMatchObject({ scheduled: false, eligible: false, completed: false });

    await db.closeAsync();
  });

  it('keeps linked-action off-day increments neutral and deduplicated', async () => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const todos = await import('@/features/todos/todos.data');
    const { linkedActionsEngine } = await import('@/core/linked-actions/linkedActions.engine');
    const habitDomain = await import('@/features/habits/habits.domain');
    const habitId = await habits.addHabit(
      'Gym',
      1,
      'anytime',
      'fitness-center',
      '#10b981',
      [1, 3, 5],
    );
    const sourceTodoId = await todos.addTodo({ title: 'Trigger gym' });
    const offDay = nextWeekdayOutside([1, 3, 5]);

    await saveTodoRules(sourceTodoId, [
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
    ]);

    const source = {
      feature: 'todos' as const,
      entityType: 'todo' as const,
      entityId: sourceTodoId,
      triggerType: 'todo.completed' as const,
      label: 'Trigger gym',
      sourceDateKey: offDay,
      sourceRecordId: `todo-event-${offDay}`,
    };
    const first = await linkedActionsEngine.processSourceAction(source);
    const second = await linkedActionsEngine.processSourceAction(source);

    // ONE write gate (audit C #6): the linked-action writer must refuse an
    // off-schedule date exactly like the UI checkbox does, instead of writing a
    // completion the day grid then hides. The refused execution is still
    // terminal, so the identical re-fire is deduplicated rather than retried.
    expect(first.effects[0]).toMatchObject({ status: 'skipped', reason: 'target_inactive' });
    expect(second.effects[0]).toMatchObject({
      status: 'duplicate',
      reason: 'source_identity_already_executed',
    });
    const completion = await db.getFirstAsync<{ count: number }>(
      'SELECT count FROM habit_completions WHERE habit_id = ? AND date_key = ?',
      [habitId, offDay],
    );
    expect(completion).toBeNull();

    const habit = (await habits.listHabits())[0];
    const day = habitDomain
      .buildDayCompletions(
        await habits.getCompletionHistory(habitId),
        habit.target_per_day,
        undefined,
        habit.rule_history,
        undefined,
        offDay,
      )
      .find((entry) => entry.dateKey === offDay);
    expect(day).toMatchObject({ scheduled: false, eligible: false, completed: false });

    await db.closeAsync();
  });

  it('uses the effective historical target for completion pathways', async () => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const today = toDateKey();
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = toDateKey(tomorrowDate);
    const id = await habits.addHabit('Read', 1);

    await habits.updateHabit(id, {
      name: 'Read',
      targetPerDay: 3,
      category: 'anytime',
      effectiveFromDate: tomorrow,
    });

    expect((await habits.incrementHabit(id, today)).count).toBe(1);
    expect((await habits.incrementHabit(id, today)).count).toBe(2);

    const targetApplied = await habits.ensureHabitDailyTargetFromLinkedAction({
      habitId: id,
      minimumCount: 'target_per_day',
      dateKey: today,
    });
    expect(targetApplied.status).toBe('skipped');
    expect(targetApplied.reason).toBe('already_satisfied');

    await db.closeAsync();
  });
});

describe('one habit write gate for linked-action writers (audit C #6)', () => {
  /** Next local weekday NOT in `weekdays` (so the fixture date is a real off-day). */
  function nextWeekdayOutside(weekdays: readonly number[]): string {
    const candidate = new Date();
    do {
      candidate.setDate(candidate.getDate() + 1);
      const isoWeekday = candidate.getDay() === 0 ? 7 : candidate.getDay();
      if (!weekdays.includes(isoWeekday)) return toDateKey(candidate);
    } while (true);
  }

  it('refuses an off-schedule day in both writers with target_inactive', async () => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    // Monday/Wednesday/Friday only: the fixture date is deliberately a rest day.
    const habitId = await habits.addHabit(
      'Gym',
      1,
      'anytime',
      'fitness-center',
      '#10b981',
      [1, 3, 5],
    );
    const offDay = nextWeekdayOutside([1, 3, 5]);

    await expect(
      habits.incrementHabitFromLinkedAction({ habitId, amount: 1, dateKey: offDay }),
    ).resolves.toMatchObject({ status: 'skipped', reason: 'target_inactive' });

    await expect(
      habits.ensureHabitDailyTargetFromLinkedAction({
        habitId,
        minimumCount: 'target_per_day',
        dateKey: offDay,
      }),
    ).resolves.toMatchObject({ status: 'skipped', reason: 'target_inactive' });

    const completions = await db.getAllAsync<{ date_key: string }>(
      'SELECT date_key FROM habit_completions WHERE habit_id = ?',
      [habitId],
    );
    expect(completions).toEqual([]);
    // A refused write must not enqueue a durable backup intent either.
    const intents = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM sync_outbox WHERE entity = 'habit_completions'`,
    );
    expect(intents).toEqual([]);

    await db.closeAsync();
  });

  it('still applies both writers on a scheduled day', async () => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const habitId = await habits.addHabit('Read', 2);

    await expect(
      habits.incrementHabitFromLinkedAction({ habitId, amount: 1, dateKey: toDateKey() }),
    ).resolves.toMatchObject({ status: 'applied' });

    // One of two done, so `ensure_daily_target` lifts the row to the target.
    await expect(
      habits.ensureHabitDailyTargetFromLinkedAction({
        habitId,
        minimumCount: 'target_per_day',
        dateKey: toDateKey(),
      }),
    ).resolves.toMatchObject({ status: 'applied' });

    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT count FROM habit_completions WHERE habit_id = ? AND date_key = ?',
      [habitId, toDateKey()],
    );
    expect(row).toEqual({ count: 2 });

    await db.closeAsync();
  });

  it('refuses a pre-creation date (the effective-from boundary) from linked actions', async () => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const habitId = await habits.addHabit('Read', 1);
    const beforeCreation = (() => {
      const date = new Date();
      date.setDate(date.getDate() - 3);
      return toDateKey(date);
    })();

    await expect(
      habits.incrementHabitFromLinkedAction({ habitId, amount: 1, dateKey: beforeCreation }),
    ).resolves.toMatchObject({ status: 'skipped', reason: 'target_inactive' });

    await expect(
      habits.ensureHabitDailyTargetFromLinkedAction({
        habitId,
        minimumCount: 'target_per_day',
        dateKey: beforeCreation,
      }),
    ).resolves.toMatchObject({ status: 'skipped', reason: 'target_inactive' });

    await db.closeAsync();
  });
});
