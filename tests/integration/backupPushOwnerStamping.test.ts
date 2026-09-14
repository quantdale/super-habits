import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';
import { toDateKey } from '@/lib/time';
import { TODO_REMINDER_MARK_DONE_ACTION } from '@/lib/notificationConstants';
import {
  HABIT_REMINDER_MARK_COMPLETE_ACTION,
  getHabitReminderActionKey,
  getHabitReminderIdentifier,
} from '@/features/habits/habitReminders.domain';
import {
  getTodoReminderActionKey,
  todoReminderIdentifier,
} from '@/core/notifications/reminderPlanning';

/**
 * Backup-push owner stamping against real SQLite: the notification and
 * linked-action completion paths write recoverable rows, so their durable
 * outbox intents must carry the bound dataset owner and must reach the
 * in-memory flush queue after commit (no hydrate required). Before this
 * contract a bound device could flush an entity batch with a missing owner
 * and fail it even though the local write succeeded.
 */

const NOW = new Date(2026, 7, 12, 12, 0, 0, 0);
const OWNER = 'user_bound_owner';

describe('backup push owner stamping (real SQLite)', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    db = await freshDatabase();
  });

  afterEach(async () => {
    await db?.closeAsync();
    vi.useRealTimers();
  });

  async function bindOwner(): Promise<void> {
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(db as never, OWNER);
  }

  it('stamps the bound owner on a habit reminder completion and publishes it to the in-memory queue', async () => {
    const habits = await import('@/features/habits/habits.data');
    const { syncEngine } = await import('@/core/sync/sync.engine');
    await bindOwner();
    const habitId = await habits.addHabit('Hydrate', 1);
    const today = toDateKey(NOW);

    const enqueueSpy = vi.spyOn(syncEngine, 'enqueuePrepared');
    const result = await habits.completeHabitFromNotification({
      habitId,
      dateKey: today,
      actionKey: getHabitReminderActionKey(habitId, today, HABIT_REMINDER_MARK_COMPLETE_ACTION),
      occurrenceId: getHabitReminderIdentifier(habitId, today),
      now: NOW,
    });
    expect(result.status).toBe('applied');

    const intent = await db.getFirstAsync<{ owner_user_id: string | null; operation: string }>(
      `SELECT owner_user_id, operation FROM sync_outbox
       WHERE entity = 'habit_completions'
       ORDER BY rowid DESC LIMIT 1`,
    );
    expect(intent).toMatchObject({ owner_user_id: OWNER, operation: 'create' });
    expect(enqueueSpy).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'habit_completions', ownerUserId: OWNER }),
      { durablyPersisted: true },
    );
    enqueueSpy.mockRestore();
  });

  it('stamps the bound owner on a linked-action habit increment', async () => {
    const habits = await import('@/features/habits/habits.data');
    const { syncEngine } = await import('@/core/sync/sync.engine');
    await bindOwner();
    const habitId = await habits.addHabit('Walk', 1, 'anytime', 'fitness-center', '#10b981');
    const today = toDateKey(NOW);

    const enqueueSpy = vi.spyOn(syncEngine, 'enqueuePrepared');
    const result = await habits.incrementHabitFromLinkedAction({
      habitId,
      amount: 1,
      dateKey: today,
    });
    expect(result.status).toBe('applied');

    const intent = await db.getFirstAsync<{ owner_user_id: string | null; operation: string }>(
      `SELECT owner_user_id, operation FROM sync_outbox
       WHERE entity = 'habit_completions'
       ORDER BY rowid DESC LIMIT 1`,
    );
    expect(intent).toMatchObject({ owner_user_id: OWNER, operation: 'create' });
    expect(enqueueSpy).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'habit_completions', ownerUserId: OWNER }),
      { durablyPersisted: true },
    );
    enqueueSpy.mockRestore();
  });

  it('stamps the bound owner on a todo reminder completion and reaches the in-memory queue without hydrate', async () => {
    const todos = await import('@/features/todos/todos.data');
    const actions = await import('@/features/todos/todoNotificationActions.data');
    const { syncEngine } = await import('@/core/sync/sync.engine');
    await bindOwner();
    const todoId = await todos.addTodo({ title: 'Laundry' });
    const occurrenceId = `${todoReminderIdentifier(todoId)}:1755000000000`;

    const enqueueSpy = vi.spyOn(syncEngine, 'enqueuePrepared');
    const result = await actions.completeTodoFromNotification({
      todoId,
      actionKey: getTodoReminderActionKey(occurrenceId, TODO_REMINDER_MARK_DONE_ACTION),
      occurrenceId,
      now: NOW,
    });
    expect(result.status).toBe('applied');

    const intent = await db.getFirstAsync<{ owner_user_id: string | null; operation: string }>(
      `SELECT owner_user_id, operation FROM sync_outbox WHERE entity = 'todos' AND id = ?`,
      [todoId],
    );
    expect(intent).toMatchObject({ owner_user_id: OWNER, operation: 'update' });
    expect(enqueueSpy).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'todos', id: todoId, ownerUserId: OWNER }),
      { durablyPersisted: true },
    );
    enqueueSpy.mockRestore();
  });

  it('allows a fresh unbound device to write locally and leaves the intent unowned', async () => {
    const habits = await import('@/features/habits/habits.data');
    const habitId = await habits.addHabit('Stretch', 1);
    const today = toDateKey(NOW);

    const result = await habits.completeHabitFromNotification({
      habitId,
      dateKey: today,
      actionKey: getHabitReminderActionKey(habitId, today, HABIT_REMINDER_MARK_COMPLETE_ACTION),
      occurrenceId: getHabitReminderIdentifier(habitId, today),
      now: NOW,
    });
    expect(result.status).toBe('applied');

    const intent = await db.getFirstAsync<{ owner_user_id: string | null }>(
      `SELECT owner_user_id FROM sync_outbox
       WHERE entity = 'habit_completions'
       ORDER BY rowid DESC LIMIT 1`,
    );
    // No Supabase session in tests: the local write still succeeds and the
    // outbox row stays unowned until an owner is established, mirroring CRUD.
    expect(intent?.owner_user_id).toBeNull();
  });
});
