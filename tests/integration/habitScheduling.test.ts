import { describe, expect, it } from 'vitest';
import {
  buildDayCompletions,
  getHabitRuleForDate,
  parseHabitRuleHistory,
  type HabitWeekday,
} from '@/features/habits/habits.domain';
import { toDateKey } from '@/lib/time';
import { freshDatabase } from './helpers/db';

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

  it('keeps completion rows compatible while scheduled metrics ignore off-days', async () => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const offDay = nextWeekdayOutside([1, 3, 5]);
    const id = await habits.addHabit('Gym', 1, 'anytime', 'fitness-center', '#10b981', [1, 3, 5]);

    await habits.incrementHabit(id, offDay); // Tomorrow is Tuesday, intentionally off schedule.
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT count FROM habit_completions WHERE habit_id = ? AND date_key = ?',
      [id, offDay],
    );
    expect(row?.count).toBe(1);

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
    const linked = await import('@/core/linked-actions/linkedActions.data');
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

    await linked.createLinkedActionRule({
      source: {
        feature: 'todos',
        entityType: 'todo',
        entityId: sourceTodoId,
        triggerType: 'todo.completed',
      },
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
    });

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

    expect(first.effects[0]).toMatchObject({ status: 'applied' });
    expect(second.effects[0]).toMatchObject({ status: 'duplicate' });
    const completion = await db.getFirstAsync<{ count: number }>(
      'SELECT count FROM habit_completions WHERE habit_id = ? AND date_key = ?',
      [habitId, offDay],
    );
    expect(completion?.count).toBe(1);
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
