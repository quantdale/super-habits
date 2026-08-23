import { describe, expect, it, vi } from 'vitest';
import {
  classifyNotificationResponse,
  dispatchNotificationResponse,
  getNotificationResponseFingerprint,
} from '@/core/notifications/notificationResponseDispatcher';
import {
  HABIT_REMINDER_MARK_COMPLETE_ACTION,
  HABIT_REMINDER_SNOOZE_ACTION,
} from '@/features/habits/habitReminders.domain';
import {
  TODO_REMINDER_MARK_DONE_ACTION,
  TODO_REMINDER_SNOOZE_ACTION,
} from '@/lib/notificationConstants';
import {
  getTodoReminderActionKey,
  todoReminderIdentifier,
} from '@/core/notifications/reminderPlanning';

const DEFAULT_ACTION = 'expo.modules.notifications.actions.DEFAULT';

function response(
  data: Record<string, unknown>,
  actionIdentifier = DEFAULT_ACTION,
  id = 'notification-1',
) {
  return {
    actionIdentifier,
    notification: {
      date: 1,
      request: {
        identifier: id,
        content: { data },
        trigger: null,
      },
    },
  } as never;
}

const normalData = {
  kind: 'habit-reminder',
  version: 2,
  habitId: 'habit_gym',
  dateKey: '2026-08-10',
  occurrenceId: 'habit-reminder:habit_gym:2026-08-10',
};

describe('notification response dispatcher', () => {
  it('classifies a body tap using ID metadata, never title text', () => {
    expect(classifyNotificationResponse(response({ ...normalData, title: 'Gym' }))).toMatchObject({
      kind: 'habit-reminder',
      action: 'open',
      habitId: 'habit_gym',
      dateKey: '2026-08-10',
    });
  });

  it.each([
    [HABIT_REMINDER_MARK_COMPLETE_ACTION, 'mark_complete'],
    [HABIT_REMINDER_SNOOZE_ACTION, 'snooze'],
  ])('classifies %s as %s', (identifier, action) => {
    expect(classifyNotificationResponse(response(normalData, identifier))).toMatchObject({
      kind: 'habit-reminder',
      action,
    });
  });

  it('rejects unknown actions and notification types safely', () => {
    expect(classifyNotificationResponse(response(normalData, 'future_action'))).toMatchObject({
      kind: 'unknown',
    });
    // The dead 'pomodoro' arm was removed (audit F7): nothing schedules that
    // kind, so such payloads classify unknown like any other unrecognized
    // notification.
    expect(
      classifyNotificationResponse(response({ kind: 'pomodoro', sessionId: 'pom_1' })),
    ).toMatchObject({
      kind: 'unknown',
    });
    expect(classifyNotificationResponse(response({ kind: 'other' }))).toMatchObject({
      kind: 'unknown',
    });
  });

  it('dispatches exact open, mark-complete, and snooze handlers', async () => {
    const openHabit = vi.fn();
    const markComplete = vi.fn().mockResolvedValue(undefined);
    const snooze = vi.fn().mockResolvedValue(undefined);
    const todoHandlers = {
      openTodo: vi.fn(),
      markDone: vi.fn().mockResolvedValue(undefined),
      snoozeTodo: vi.fn().mockResolvedValue(undefined),
    };

    await dispatchNotificationResponse(response(normalData), {
      openHabit,
      markComplete,
      snooze,
      ...todoHandlers,
      openWeeklyReview: vi.fn(),
    });
    await dispatchNotificationResponse(response(normalData, HABIT_REMINDER_MARK_COMPLETE_ACTION), {
      openHabit,
      markComplete,
      snooze,
      ...todoHandlers,
      openWeeklyReview: vi.fn(),
    });
    await dispatchNotificationResponse(response(normalData, HABIT_REMINDER_SNOOZE_ACTION), {
      openHabit,
      markComplete,
      snooze,
      ...todoHandlers,
      openWeeklyReview: vi.fn(),
    });

    expect(openHabit).toHaveBeenCalledWith('habit_gym');
    expect(markComplete).toHaveBeenCalledWith({
      habitId: 'habit_gym',
      dateKey: '2026-08-10',
      actionKey: 'habit-reminder:habit_gym:2026-08-10:habit_reminder_mark_complete',
      occurrenceId: 'habit-reminder:habit_gym:2026-08-10',
    });
    expect(snooze).toHaveBeenCalledWith({
      habitId: 'habit_gym',
      dateKey: '2026-08-10',
      actionKey: 'habit-reminder:habit_gym:2026-08-10:habit_reminder_snooze',
      occurrenceId: 'habit-reminder:habit_gym:2026-08-10',
    });
    expect(todoHandlers.openTodo).not.toHaveBeenCalled();
    expect(todoHandlers.markDone).not.toHaveBeenCalled();
    expect(todoHandlers.snoozeTodo).not.toHaveBeenCalled();
  });

  it('creates a stable replay fingerprint from notification occurrence and action', () => {
    const first = response(
      normalData,
      HABIT_REMINDER_MARK_COMPLETE_ACTION,
      'habit-reminder:habit_gym:2026-08-10',
    );
    const replay = response(
      normalData,
      HABIT_REMINDER_MARK_COMPLETE_ACTION,
      'habit-reminder:habit_gym:2026-08-10',
    );
    expect(getNotificationResponseFingerprint(first)).toBe(
      getNotificationResponseFingerprint(replay),
    );
  });
});

const todoOccurrenceId = 'todo-reminder:todo_laundry:1755000000000';
const todoData = {
  kind: 'todo-reminder',
  version: 1,
  todoId: 'todo_laundry',
  occurrenceId: todoOccurrenceId,
  dueAt: new Date(1755000000000).toISOString(),
  snoozed: false,
};

describe('todo reminder response classification', () => {
  it('classifies a body tap as open', () => {
    expect(classifyNotificationResponse(response(todoData))).toMatchObject({
      kind: 'todo-reminder',
      action: 'open',
      todoId: 'todo_laundry',
      occurrenceId: todoOccurrenceId,
      snoozed: false,
    });
  });

  it.each([
    [TODO_REMINDER_MARK_DONE_ACTION, 'mark_done'],
    [TODO_REMINDER_SNOOZE_ACTION, 'snooze'],
  ])('classifies %s as %s', (identifier, action) => {
    expect(classifyNotificationResponse(response(todoData, identifier))).toMatchObject({
      kind: 'todo-reminder',
      action,
    });
  });

  it.each([
    ['missing todoId', { ...todoData, todoId: undefined }],
    ['empty todoId', { ...todoData, todoId: '' }],
    ['non-string todoId', { ...todoData, todoId: 42 }],
  ])('%s classifies unknown', (_label, data) => {
    expect(classifyNotificationResponse(response(data))).toMatchObject({ kind: 'unknown' });
  });

  it('treats an unrecognized action identifier as unknown, never as a body tap', () => {
    expect(classifyNotificationResponse(response(todoData, 'future_todo_action'))).toMatchObject({
      kind: 'unknown',
    });
  });

  it('derives the legacy per-todo occurrence when the payload has none', () => {
    const legacy = { kind: 'todo-reminder', version: 1, todoId: 'todo_laundry' };
    expect(
      classifyNotificationResponse(response(legacy, TODO_REMINDER_MARK_DONE_ACTION)),
    ).toMatchObject({
      kind: 'todo-reminder',
      action: 'mark_done',
      occurrenceId: todoReminderIdentifier('todo_laundry'),
    });
  });

  it('keeps daily-plan reminders unknown', () => {
    expect(
      classifyNotificationResponse(response({ kind: 'daily-plan-reminder', version: 1 })),
    ).toMatchObject({ kind: 'unknown' });
  });

  it('dispatches exact openTodo, markDone, and snoozeTodo handlers with occurrence-derived keys', async () => {
    const openHabit = vi.fn();
    const markComplete = vi.fn().mockResolvedValue(undefined);
    const snooze = vi.fn().mockResolvedValue(undefined);
    const openTodo = vi.fn();
    const markDone = vi.fn().mockResolvedValue(undefined);
    const snoozeTodo = vi.fn().mockResolvedValue(undefined);
    const handlers = {
      openHabit,
      markComplete,
      snooze,
      openTodo,
      markDone,
      snoozeTodo,
      openWeeklyReview: vi.fn(),
    };

    await dispatchNotificationResponse(response(todoData), handlers);
    await dispatchNotificationResponse(
      response(todoData, TODO_REMINDER_MARK_DONE_ACTION),
      handlers,
    );
    await dispatchNotificationResponse(response(todoData, TODO_REMINDER_SNOOZE_ACTION), handlers);

    expect(openTodo).toHaveBeenCalledWith('todo_laundry');
    expect(markDone).toHaveBeenCalledWith({
      todoId: 'todo_laundry',
      actionKey: getTodoReminderActionKey(todoOccurrenceId, TODO_REMINDER_MARK_DONE_ACTION),
      occurrenceId: todoOccurrenceId,
    });
    expect(snoozeTodo).toHaveBeenCalledWith({
      todoId: 'todo_laundry',
      actionKey: getTodoReminderActionKey(todoOccurrenceId, TODO_REMINDER_SNOOZE_ACTION),
      occurrenceId: todoOccurrenceId,
    });
    expect(openHabit).not.toHaveBeenCalled();
    expect(markComplete).not.toHaveBeenCalled();
    expect(snooze).not.toHaveBeenCalled();
  });

  it('does not invoke todo handlers for an unknown action identifier', async () => {
    const openTodo = vi.fn();
    const markDone = vi.fn().mockResolvedValue(undefined);
    const snoozeTodo = vi.fn().mockResolvedValue(undefined);

    const classified = await dispatchNotificationResponse(response(todoData, 'bogus_action'), {
      openHabit: vi.fn(),
      markComplete: vi.fn().mockResolvedValue(undefined),
      snooze: vi.fn().mockResolvedValue(undefined),
      openTodo,
      markDone,
      snoozeTodo,
      openWeeklyReview: vi.fn(),
    });

    expect(classified).toMatchObject({ kind: 'unknown' });
    expect(openTodo).not.toHaveBeenCalled();
    expect(markDone).not.toHaveBeenCalled();
    expect(snoozeTodo).not.toHaveBeenCalled();
  });
});
