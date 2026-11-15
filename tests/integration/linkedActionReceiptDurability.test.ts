import { describe, expect, it, vi } from 'vitest';
import { freshDatabase } from './helpers/db';
import { saveTodoRules } from './helpers/linkedActionRules';

describe('terminal linked-action receipts survive post-effect failures', () => {
  it.each(['metadata', 'notice', 'after-effect'] as const)(
    'does not replay an applied habit increment after a %s failure',
    async (failure) => {
      const db = await freshDatabase();
      try {
        const { addTodo } = await import('@/features/todos/todos.data');
        const { addHabit } = await import('@/features/habits/habits.data');
        const { toDateKey } = await import('@/lib/time');
        const sourceId = await addTodo({ title: 'One source action' });
        const habitId = await addHabit('Exactly once', 3);
        await saveTodoRules(sourceId, [
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
        const { LinkedActionsEngine } = await import('@/core/linked-actions/linkedActions.engine');
        const originalRun = db.runAsync.bind(db);
        let injected = false;
        const write = vi.spyOn(db, 'runAsync').mockImplementation(async (sql, params) => {
          if (
            failure === 'metadata' &&
            !injected &&
            sql.includes('UPDATE linked_action_executions') &&
            sql.includes('notice_payload = ?')
          ) {
            injected = true;
            throw new Error('one-shot post-effect metadata failure');
          }
          return originalRun(sql, params);
        });
        const engine = new LinkedActionsEngine({
          onNotice: () => {
            if (failure === 'notice' && !injected) {
              injected = true;
              throw new Error('one-shot notice failure');
            }
          },
          afterEffectBeforeFinalize: () => {
            if (failure === 'after-effect' && !injected) {
              injected = true;
              throw new Error('ordinary post-commit failure');
            }
          },
        });
        const source = {
          eventId: 'levt_1',
          feature: 'todos' as const,
          entityType: 'todo' as const,
          entityId: sourceId,
          triggerType: 'todo.completed' as const,
          sourceDateKey: toDateKey(),
        };
        const first = await engine.processSourceAction(source);
        expect(injected).toBe(true);
        // Replay first: the decisive oracle is authoritative count, not merely
        // a status whose erroneous downgrade would allow a second increment.
        const replay = await engine.processSourceAction(source);
        expect(
          await db.getFirstAsync('SELECT count FROM habit_completions WHERE habit_id = ?', [
            habitId,
          ]),
        ).toEqual({ count: 1 });
        expect(await db.getFirstAsync('SELECT status FROM linked_action_executions')).toEqual({
          status: 'applied',
        });
        expect(first.effects[0]?.status).toBe('applied');
        expect(replay.effects[0]?.status).toBe('duplicate');
        write.mockRestore();
      } finally {
        await db.closeAsync();
      }
    },
  );
});
