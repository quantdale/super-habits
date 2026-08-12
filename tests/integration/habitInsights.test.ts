import { describe, expect, it } from 'vitest';
import { calculateHabitProgressInsights } from '@/features/habits/habitInsights.domain';
import { toDateKey } from '@/lib/time';
import { freshDatabase } from './helpers/db';

describe('real SQLite habit progress insight loading', () => {
  it('reads active completion history once and excludes deleted habits from the shared list', async () => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const today = toDateKey();
    const activeId = await habits.addHabit('Target two', 2);
    const deletedId = await habits.addHabit('Deleted', 1);

    await habits.incrementHabit(activeId, today);
    await habits.incrementHabit(activeId, today);
    await habits.incrementHabit(deletedId, today);
    await habits.deleteHabit(deletedId);

    const sharedRows = await habits.getAllHabitCompletions();
    expect(sharedRows).toEqual([
      expect.objectContaining({ habit_id: activeId, date_key: today, count: 2 }),
    ]);

    const preparedSql: string[] = [];
    const raw = db.raw as unknown as { prepare: (sql: string) => unknown };
    const originalPrepare = raw.prepare.bind(raw);
    raw.prepare = (sql: string) => {
      if (/FROM\s+habit_completions/i.test(sql)) preparedSql.push(sql);
      return originalPrepare(sql);
    };
    const history = await habits.getCompletionHistory(activeId);
    expect(history).toHaveLength(1);
    expect(preparedSql).toHaveLength(1);

    const activeHabit = (await habits.listHabits()).find((habit) => habit.id === activeId)!;
    const insights = calculateHabitProgressInsights(activeHabit, history, today);
    expect(insights).toMatchObject({
      currentStreak: 1,
      longestStreak: 1,
      totalEligibleOccurrences: 1,
      totalCompletedOccurrences: 1,
      totalTarget: 2,
      totalActual: 2,
      last7: {
        eligibleOccurrences: 1,
        completedOccurrences: 1,
        targetTotal: 2,
        actualTotal: 2,
        percentage: 100,
      },
    });

    await db.closeAsync();
  });
});
