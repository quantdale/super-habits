import { describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';
import type { ActionKind } from '@/features/gamification/gamification.types';

async function seedActions(kind: ActionKind): Promise<string[]> {
  const time = await import('@/lib/time');
  const today = time.toDateKey();
  const ids: string[] = [];
  const todos = await import('@/features/todos/todos.data');
  const habits = await import('@/features/habits/habits.data');
  const pomodoro = await import('@/features/pomodoro/pomodoro.data');
  const workout = await import('@/features/workout/workout.data');
  let routineId = '';
  if (kind === 'workout') {
    await workout.addRoutine('Reconciliation session', '');
    routineId = (await workout.listRoutines())[0].id;
  }
  for (let i = 0; i < 26; i++) {
    if (kind === 'todo') {
      const id = await todos.addTodo({ title: `Task ${i}` });
      await todos.completeTodo(id);
      ids.push(id);
    } else if (kind === 'habit') {
      const id = await habits.addHabit(`Habit ${i}`, 1);
      await habits.incrementHabit(id, today);
      ids.push(id);
    } else if (kind === 'focus') {
      const start = new Date(time.getUtcIsoRangeForLocalDateKeys(today, today).startUtcIso);
      await pomodoro.logPomodoroSession(
        start.toISOString(),
        new Date(start.getTime() + 60_000).toISOString(),
        60,
        'focus',
      );
    } else if (kind === 'workout') {
      await workout.completeRoutine(routineId);
    }
  }
  return ids;
}

async function paidCount(db: TestDatabase, kind: ActionKind) {
  return (await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM gamification_events WHERE event_kind = ?',
    [kind],
  ))!.count;
}

describe('reward reconciliation makes bounded forward progress', () => {
  it.each(['todo', 'habit', 'focus', 'workout'] as const)(
    'eventually pays all 26 %s actions without re-paying the first 25',
    async (kind) => {
      const db = await freshDatabase();
      try {
        await seedActions(kind);
        const { reconcileGamificationActivity } =
          await import('@/features/gamification/gamification.data');
        const outbox = await db.getAllAsync('SELECT * FROM sync_outbox ORDER BY entity, id');
        expect((await reconcileGamificationActivity()).awarded).toBe(25);
        expect(await paidCount(db, kind)).toBe(25);
        expect((await reconcileGamificationActivity()).awarded).toBe(1);
        expect(await paidCount(db, kind)).toBe(26);
        expect((await reconcileGamificationActivity()).awarded).toBe(0);
        expect(await db.getAllAsync('SELECT * FROM sync_outbox ORDER BY entity, id')).toEqual(
          outbox,
        );
      } finally {
        await db.closeAsync();
      }
    },
  );

  it('does not let 25 legacy same-day todo keys starve a later unpaid action', async () => {
    const db = await freshDatabase();
    try {
      const ids = await seedActions('todo');
      const { toDateKey, nowIso } = await import('@/lib/time');
      const day = toDateKey();
      for (let i = 0; i < 25; i++)
        await db.runAsync(
          "INSERT INTO gamification_events (id, event_kind, source_key, date_key, xp, created_at) VALUES (?, 'todo', ?, ?, 5, ?)",
          [`gxp_legacy_${i}`, ids[i], day, nowIso()],
        );
      const { reconcileGamificationActivity } =
        await import('@/features/gamification/gamification.data');
      expect((await reconcileGamificationActivity()).awarded).toBe(1);
      expect(await paidCount(db, 'todo')).toBe(26);
      expect((await reconcileGamificationActivity()).awarded).toBe(0);
    } finally {
      await db.closeAsync();
    }
  });

  it('housekeeping also advances past a full previously-paid batch', async () => {
    const db = await freshDatabase();
    try {
      await seedActions('todo');
      const { runGamificationHousekeeping } =
        await import('@/features/gamification/gamification.data');
      await runGamificationHousekeeping();
      expect(await paidCount(db, 'todo')).toBe(25);
      await runGamificationHousekeeping();
      expect(await paidCount(db, 'todo')).toBe(26);
      await runGamificationHousekeeping();
      expect(await paidCount(db, 'todo')).toBe(26);
    } finally {
      await db.closeAsync();
    }
  });
});
