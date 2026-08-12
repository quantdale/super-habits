import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freshDatabase } from './helpers/db';
import { toDateKey } from '@/lib/time';
import {
  HABIT_REMINDER_MARK_COMPLETE_ACTION,
  HABIT_REMINDER_SNOOZE_ACTION,
  getHabitReminderActionKey,
  getHabitReminderIdentifier,
  getHabitReminderSnoozeIdentifier,
} from '@/features/habits/habitReminders.domain';

const NOW = new Date(2026, 7, 12, 12, 0, 0, 0);

function actionInput(
  habitId: string,
  dateKey: string,
  action: typeof HABIT_REMINDER_MARK_COMPLETE_ACTION | typeof HABIT_REMINDER_SNOOZE_ACTION,
) {
  return {
    habitId,
    dateKey,
    actionKey: getHabitReminderActionKey(habitId, dateKey, action),
    occurrenceId: getHabitReminderIdentifier(habitId, dateKey),
  };
}

async function createHabit(
  habits: typeof import('@/features/habits/habits.data'),
  target = 1,
  weekdays: readonly (1 | 2 | 3 | 4 | 5 | 6 | 7)[] = [1, 2, 3, 4, 5, 6, 7],
) {
  return habits.addHabit('Gym', target, 'anytime', 'fitness-center', '#10b981', weekdays, '18:00');
}

describe('habit reminder Mark complete against real SQLite', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('increments target one once and survives a concurrent duplicate response', async () => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const habitId = await createHabit(habits);
    const today = toDateKey(NOW);
    const input = actionInput(habitId, today, HABIT_REMINDER_MARK_COMPLETE_ACTION);

    const results = await Promise.all([
      habits.completeHabitFromNotification({ ...input, now: NOW }),
      habits.completeHabitFromNotification({ ...input, now: NOW }),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual(['applied', 'duplicate']);
    expect(await habits.getHabitCountByDate(habitId, today)).toBe(1);
    expect(
      await db.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM processed_notification_actions WHERE action_key = ?',
        [input.actionKey],
      ),
    ).toMatchObject({ n: 1 });
    await db.closeAsync();
  });

  it('increments a partial target by exactly one rather than filling the target', async () => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const habitId = await createHabit(habits, 3);
    const today = toDateKey(NOW);
    await habits.incrementHabit(habitId, today);

    const result = await habits.completeHabitFromNotification({
      ...actionInput(habitId, today, HABIT_REMINDER_MARK_COMPLETE_ACTION),
      now: NOW,
    });

    expect(result).toMatchObject({ status: 'applied', count: 2 });
    expect(await habits.getHabitCountByDate(habitId, today)).toBe(2);
    await db.closeAsync();
  });

  it.each([
    [
      'already satisfied',
      async (habits: typeof import('@/features/habits/habits.data'), id: string, date: string) => {
        await habits.incrementHabit(id, date);
      },
    ],
    [
      'deleted',
      async (habits: typeof import('@/features/habits/habits.data'), id: string) => {
        await habits.deleteHabit(id);
      },
    ],
  ])('%s is a safe no-op', async (_label, prepare) => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const habitId = await createHabit(habits);
    const today = toDateKey(NOW);
    await prepare(habits, habitId, today);

    const result = await habits.completeHabitFromNotification({
      ...actionInput(habitId, today, HABIT_REMINDER_MARK_COMPLETE_ACTION),
      now: NOW,
    });

    expect(result.status).toBe('noop');
    expect(await habits.getHabitCountByDate(habitId, today)).toBe(
      _label === 'already satisfied' ? 1 : 0,
    );
    await db.closeAsync();
  });

  it('does not backdate a stale previous-date notification after local midnight', async () => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const habitId = await createHabit(habits);
    const yesterday = toDateKey(new Date(2026, 7, 11, 23, 59));

    const result = await habits.completeHabitFromNotification({
      ...actionInput(habitId, yesterday, HABIT_REMINDER_MARK_COMPLETE_ACTION),
      now: new Date(2026, 7, 12, 0, 2),
    });

    expect(result.status).toBe('noop');
    expect(await habits.getHabitCountByDate(habitId, yesterday)).toBe(0);
    await db.closeAsync();
  });

  it('does not mutate when the schedule is edited off the current date', async () => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const habitId = await createHabit(habits);
    const today = toDateKey(NOW);
    await habits.updateHabit(habitId, {
      name: 'Gym',
      targetPerDay: 1,
      category: 'anytime',
      weekdays: [1],
      effectiveFromDate: today,
      reminderTime: '18:00',
    });

    const result = await habits.completeHabitFromNotification({
      ...actionInput(habitId, today, HABIT_REMINDER_MARK_COMPLETE_ACTION),
      now: NOW,
    });

    expect(result.status).toBe('noop');
    expect(await habits.getHabitCountByDate(habitId, today)).toBe(0);
    await db.closeAsync();
  });

  it('runs a habit completion Linked Action once across response replay', async () => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const todos = await import('@/features/todos/todos.data');
    const linked = await import('@/core/linked-actions/linkedActions.data');
    const habitId = await createHabit(habits);
    const todoId = await todos.addTodo({ title: 'Review gym progress' });
    await linked.createLinkedActionRule({
      source: {
        feature: 'habits',
        entityType: 'habit',
        entityId: habitId,
        triggerType: 'habit.completed_for_day',
      },
      target: {
        feature: 'todos',
        entityType: 'todo',
        entityId: todoId,
        effect: { kind: 'binary', type: 'todo.complete' },
      },
    });

    const today = toDateKey(NOW);
    const input = actionInput(habitId, today, HABIT_REMINDER_MARK_COMPLETE_ACTION);
    const first = await habits.completeHabitFromNotification({ ...input, now: NOW });
    const replay = await habits.completeHabitFromNotification({ ...input, now: NOW });

    expect(first.status).toBe('applied');
    expect(first.linkedActions.matchedRuleCount).toBe(1);
    expect(replay.status).toBe('duplicate');
    expect(replay.linkedActions.notices).toEqual([]);
    expect(
      await db.getFirstAsync<{ completed: number }>('SELECT completed FROM todos WHERE id = ?', [
        todoId,
      ]),
    ).toMatchObject({ completed: 1 });
    expect(
      await db.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM linked_action_executions WHERE source_event_id IN (SELECT id FROM linked_action_events WHERE source_entity_id = ?)',
        [habitId],
      ),
    ).toMatchObject({ n: 1 });
    await db.closeAsync();
  });

  it('replays safely after reopening the same database file', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'superhabits-reminder-action-'));
    const filename = path.join(dir, 'superhabits.db');
    try {
      const firstDb = await freshDatabase(filename);
      const firstHabits = await import('@/features/habits/habits.data');
      const habitId = await createHabit(firstHabits);
      const today = toDateKey(NOW);
      const input = actionInput(habitId, today, HABIT_REMINDER_MARK_COMPLETE_ACTION);
      await firstHabits.completeHabitFromNotification({ ...input, now: NOW });
      await firstDb.closeAsync();

      const secondDb = await freshDatabase(filename);
      const secondHabits = await import('@/features/habits/habits.data');
      const replay = await secondHabits.completeHabitFromNotification({ ...input, now: NOW });

      expect(replay.status).toBe('duplicate');
      expect(await secondHabits.getHabitCountByDate(habitId, today)).toBe(1);
      await secondDb.closeAsync();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps two habits isolated by ID', async () => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const gymId = await createHabit(habits);
    const readId = await habits.addHabit('Read', 1);
    const today = toDateKey(NOW);

    await habits.completeHabitFromNotification({
      ...actionInput(gymId, today, HABIT_REMINDER_MARK_COMPLETE_ACTION),
      now: NOW,
    });

    expect(await habits.getHabitCountByDate(gymId, today)).toBe(1);
    expect(await habits.getHabitCountByDate(readId, today)).toBe(0);
    await db.closeAsync();
  });
});

describe('habit reminder Snooze against real SQLite', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function adapter() {
    const scheduled: { identifier: string; fireAt: Date; data: Record<string, unknown> }[] = [];
    const cancelled: string[] = [];
    return {
      scheduled,
      cancelled,
      getPermissionState: vi.fn(async () => 'granted' as const),
      ensureChannel: vi.fn(async () => undefined),
      listScheduled: vi.fn(async () =>
        scheduled.map(
          (item) =>
            ({
              identifier: item.identifier,
              content: { data: item.data },
              trigger: { type: 'date', date: item.fireAt.getTime() },
            }) as never,
        ),
      ),
      schedule: vi.fn(
        async (item: { identifier: string; fireAt: Date; data: Record<string, unknown> }) => {
          scheduled.push(item);
          return item.identifier;
        },
      ),
      cancel: vi.fn(async (identifier: string) => {
        cancelled.push(identifier);
        const index = scheduled.findIndex((item) => item.identifier === identifier);
        if (index >= 0) scheduled.splice(index, 1);
      }),
    };
  }

  it('schedules one fixed fifteen-minute replacement and preserves configured time', async () => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const { snoozeHabitReminderAction } = await import('@/features/habits/habitReminderActions');
    const habitId = await createHabit(habits);
    const today = toDateKey(NOW);
    const native = adapter();

    const result = await snoozeHabitReminderAction(
      { ...actionInput(habitId, today, HABIT_REMINDER_SNOOZE_ACTION), now: NOW },
      native,
    );

    expect(result.status).toBe('scheduled');
    expect(native.scheduled).toHaveLength(1);
    expect(native.scheduled[0].identifier).toBe(getHabitReminderSnoozeIdentifier(habitId, today));
    expect(native.scheduled[0].fireAt.getTime() - NOW.getTime()).toBe(15 * 60 * 1000);
    expect((await habits.listHabits()).find((habit) => habit.id === habitId)?.reminder_time).toBe(
      '18:00',
    );
    await db.closeAsync();
  });

  it('deduplicates a repeated snooze response and does not cross local midnight', async () => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const { snoozeHabitReminderAction } = await import('@/features/habits/habitReminderActions');
    const habitId = await createHabit(habits);
    const today = toDateKey(NOW);
    const native = adapter();
    const input = { ...actionInput(habitId, today, HABIT_REMINDER_SNOOZE_ACTION), now: NOW };

    await snoozeHabitReminderAction(input, native);
    const replay = await snoozeHabitReminderAction(input, native);
    expect(replay.status).toBe('duplicate');
    expect(native.scheduled).toHaveLength(1);

    const midnight = await snoozeHabitReminderAction(
      { ...input, actionKey: `${input.actionKey}:midnight`, now: new Date(2026, 7, 12, 23, 55) },
      native,
    );
    expect(midnight.status).toBe('noop');
    expect(native.scheduled).toHaveLength(0);
    await db.closeAsync();
  });

  it.each(['completed', 'unscheduled', 'deleted'])('%s habit cannot snooze', async (state) => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const { snoozeHabitReminderAction } = await import('@/features/habits/habitReminderActions');
    const habitId = await createHabit(habits);
    const today = toDateKey(NOW);
    if (state === 'completed') await habits.incrementHabit(habitId, today);
    if (state === 'unscheduled') {
      await habits.updateHabit(habitId, {
        name: 'Gym',
        targetPerDay: 1,
        category: 'anytime',
        weekdays: [1],
        effectiveFromDate: today,
        reminderTime: '18:00',
      });
    }
    if (state === 'deleted') await habits.deleteHabit(habitId);

    const native = adapter();
    const result = await snoozeHabitReminderAction(
      { ...actionInput(habitId, today, HABIT_REMINDER_SNOOZE_ACTION), now: NOW },
      native,
    );
    expect(result.status).toBe('noop');
    expect(native.schedule).not.toHaveBeenCalled();
    await db.closeAsync();
  });
});

describe('notification action marker retention', () => {
  it('cleans old local operational markers while retaining recent markers', async () => {
    const db = await freshDatabase();
    const { claimNotificationAction, PROCESSED_NOTIFICATION_ACTION_RETENTION_MS } =
      await import('@/features/habits/notificationActions.data');
    await db.runAsync(
      `INSERT INTO processed_notification_actions
       (action_key, kind, action_name, occurrence_id, linked_event_id, processed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'old',
        'habit-reminder',
        'mark_complete',
        'old-occurrence',
        'old-event',
        '2026-01-01T00:00:00.000Z',
      ],
    );
    const now = new Date(2026, 7, 12, 12);
    await claimNotificationAction({
      actionKey: 'new',
      kind: 'habit-reminder',
      actionName: 'snooze',
      occurrenceId: 'new-occurrence',
      processedAt: now.toISOString(),
    });

    expect(
      await db.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM processed_notification_actions WHERE action_key = ?',
        ['old'],
      ),
    ).toMatchObject({ n: 0 });
    expect(PROCESSED_NOTIFICATION_ACTION_RETENTION_MS).toBe(35 * 24 * 60 * 60 * 1000);
    await db.closeAsync();
  });
});
