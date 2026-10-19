/**
 * AUD-SH17-A / AUD-SH17-B — distinct reminder deliveries must not share a host
 * replay fingerprint.
 *
 * Audited defect (SH-17, Medium): the host's replay fingerprint was
 * `requestIdentifier:actionIdentifier`. A repeating reminder keeps ONE fixed
 * identifier across every delivery (the weekly review reminder literally uses the
 * constant `weekly-review-reminder:weekly`), so two weekly reminders delivered on
 * different dates shared a fingerprint and the host dispatched only the first.
 * Executing the actual host callback produced one dispatch instead of two. This
 * is a same-session false suppression (the 64-entry cache lives for the mounted
 * host), which is exactly the case a repeating reminder hits.
 *
 * The fix distinguishes DELIVERY identity while leaving the ACTION's durable
 * business idempotency key alone — a repeated response for the SAME delivery
 * must still be handled once, and repeated Mark Done/Complete must remain
 * idempotent at the data layer.
 */

import { describe, expect, it } from 'vitest';
import {
  classifyNotificationResponse,
  dispatchNotificationResponse,
  getNotificationResponseFingerprint,
} from '@/core/notifications/notificationResponseDispatcher';
import {
  TODO_REMINDER_MARK_DONE_ACTION,
  TODO_REMINDER_SNOOZE_ACTION,
} from '@/lib/notificationConstants';

const DEFAULT_ACTION = 'expo.modules.notifications.actions.DEFAULT';

/**
 * Build a delivered response.
 *
 * @param data the notification payload
 * @param options.requestIdentifier the (possibly fixed) request id
 * @param options.deliveredAt the platform delivery timestamp for this delivery
 * @param options.actionIdentifier the tapped action
 */
function response(
  data: Record<string, unknown>,
  options: {
    requestIdentifier?: string;
    deliveredAt?: number;
    actionIdentifier?: string;
  } = {},
) {
  // EXPO'S ACTUAL SHAPE (`AUD-SH17-A`): the delivery timestamp is
  // `notification.date`. The first attempt at this fixture ALSO put a copy at the
  // response root, which is precisely why the wrong-property defect passed: the
  // test manufactured the property the implementation happened to read.
  return {
    actionIdentifier: options.actionIdentifier ?? DEFAULT_ACTION,
    notification: {
      date: options.deliveredAt ?? 1,
      request: {
        identifier: options.requestIdentifier ?? 'notification-1',
        content: { data },
        trigger: null,
      },
    },
  } as never;
}

const WEEKLY_ID = 'weekly-review-reminder:weekly';
const weeklyData = { kind: 'weekly-review-reminder', dateKey: '2026-10-11' };
const weeklyDataNextWeek = { kind: 'weekly-review-reminder', dateKey: '2026-10-18' };

const todoData = {
  kind: 'todo-reminder',
  todoId: 'todo_1',
  occurrenceId: 'occ_2026-10-18T09:00',
};

/** A host-side fingerprint cache, mirroring `app/_layout.tsx` exactly. */
function createHostCache(max = 64) {
  const handled: string[] = [];
  return {
    handled,
    /** Returns true when this response is NEW (and records it). */
    admit(responseValue: unknown): boolean {
      const fingerprint = getNotificationResponseFingerprint(responseValue as never);
      if (handled.includes(fingerprint)) return false;
      handled.push(fingerprint);
      if (handled.length > max) handled.shift();
      return true;
    },
  };
}

describe('AUD-SH17-A: two distinct weekly deliveries both dispatch', () => {
  it('different delivery timestamps under one fixed identifier are distinct', () => {
    const first = response(weeklyData, { requestIdentifier: WEEKLY_ID, deliveredAt: 1_000 });
    const second = response(weeklyDataNextWeek, {
      requestIdentifier: WEEKLY_ID,
      deliveredAt: 2_000,
    });
    expect(getNotificationResponseFingerprint(first)).not.toBe(
      getNotificationResponseFingerprint(second),
    );
  });

  it('the host dispatches BOTH deliveries (the audited failure was one)', async () => {
    const cache = createHostCache();
    let dispatches = 0;
    const first = response(weeklyData, { requestIdentifier: WEEKLY_ID, deliveredAt: 1_000 });
    const second = response(weeklyDataNextWeek, {
      requestIdentifier: WEEKLY_ID,
      deliveredAt: 2_000,
    });

    for (const delivered of [first, second]) {
      if (!cache.admit(delivered)) continue;
      dispatches += 1;
      await dispatchNotificationResponse(delivered, {
        openHabit: () => {},
        markComplete: async () => {},
        snooze: async () => {},
        openTodo: () => {},
        markDone: async () => {},
        snoozeTodo: async () => {},
        openWeeklyReview: () => {},
        openWorkout: () => {},
      });
    }
    expect(dispatches).toBe(2);
    expect(cache.handled).toHaveLength(2);
  });

  it('replaying the SAME delivery is still handled once', () => {
    const cache = createHostCache();
    const delivered = response(weeklyData, { requestIdentifier: WEEKLY_ID, deliveredAt: 1_000 });
    // Listener + cold-start both see the same response object.
    expect(cache.admit(delivered)).toBe(true);
    expect(cache.admit(delivered)).toBe(false);
  });
});

describe('AUD-SH17-B: business idempotency keys are unchanged', () => {
  it('a different occurrence id separates deliveries even with the same timestamp', () => {
    const base = { kind: 'todo-reminder', todoId: 'todo_1' };
    const first = response(
      { ...base, occurrenceId: 'occ_a' },
      { requestIdentifier: 'todo_1', deliveredAt: 5_000 },
    );
    const second = response(
      { ...base, occurrenceId: 'occ_b' },
      { requestIdentifier: 'todo_1', deliveredAt: 5_000 },
    );
    expect(getNotificationResponseFingerprint(first)).not.toBe(
      getNotificationResponseFingerprint(second),
    );
  });

  it('a missing platform delivery date still separates business occurrences', () => {
    const base = { kind: 'todo-reminder', todoId: 'todo_1' };
    const first = response({ ...base, occurrenceId: 'occ_a' }, { deliveredAt: 0 });
    const second = response({ ...base, occurrenceId: 'occ_b' }, { deliveredAt: 0 });
    expect(getNotificationResponseFingerprint(first)).not.toBe(
      getNotificationResponseFingerprint(second),
    );
    // And the same occurrence with no date is still one delivery.
    expect(getNotificationResponseFingerprint(first)).toBe(
      getNotificationResponseFingerprint(
        response({ ...base, occurrenceId: 'occ_a' }, { deliveredAt: 0 }),
      ),
    );
  });

  it('the durable todo action key is derived from the occurrence, not the fingerprint', async () => {
    const { getTodoReminderActionKey } = await import('@/core/notifications/reminderPlanning');
    const first = classifyNotificationResponse(
      response(
        { ...todoData, occurrenceId: 'occ_1' },
        { actionIdentifier: TODO_REMINDER_MARK_DONE_ACTION },
      ),
    );
    const second = classifyNotificationResponse(
      response(
        { ...todoData, occurrenceId: 'occ_2' },
        { actionIdentifier: TODO_REMINDER_MARK_DONE_ACTION },
      ),
    );
    expect(first.kind).toBe('todo-reminder');
    expect(second.kind).toBe('todo-reminder');
    if (first.kind !== 'todo-reminder' || second.kind !== 'todo-reminder') return;
    // Distinct deliveries get distinct idempotency namespaces...
    expect(getTodoReminderActionKey(first.occurrenceId, TODO_REMINDER_MARK_DONE_ACTION)).not.toBe(
      getTodoReminderActionKey(second.occurrenceId, TODO_REMINDER_MARK_DONE_ACTION),
    );
    // ...while the SAME delivery repeats the SAME key (idempotent retry).
    const repeat = classifyNotificationResponse(
      response(
        { ...todoData, occurrenceId: 'occ_1' },
        { actionIdentifier: TODO_REMINDER_MARK_DONE_ACTION },
      ),
    );
    if (repeat.kind !== 'todo-reminder') throw new Error('expected todo-reminder');
    expect(getTodoReminderActionKey(repeat.occurrenceId, TODO_REMINDER_MARK_DONE_ACTION)).toBe(
      getTodoReminderActionKey(first.occurrenceId, TODO_REMINDER_MARK_DONE_ACTION),
    );
  });

  it('a repeated snooze of the same occurrence keeps one action key', async () => {
    const { getTodoReminderActionKey } = await import('@/core/notifications/reminderPlanning');
    const a = classifyNotificationResponse(
      response(todoData, { actionIdentifier: TODO_REMINDER_SNOOZE_ACTION }),
    );
    const b = classifyNotificationResponse(
      response(todoData, { actionIdentifier: TODO_REMINDER_SNOOZE_ACTION, deliveredAt: 9_999 }),
    );
    if (a.kind !== 'todo-reminder' || b.kind !== 'todo-reminder') {
      throw new Error('expected todo-reminder');
    }
    // A later delivery of the same occurrence snoozes under the same key: the
    // snooze is idempotent per occurrence, not per delivery time.
    expect(getTodoReminderActionKey(a.occurrenceId, TODO_REMINDER_SNOOZE_ACTION)).toBe(
      getTodoReminderActionKey(b.occurrenceId, TODO_REMINDER_SNOOZE_ACTION),
    );
    // But the DELIVERY fingerprint still distinguishes them, so the host cannot
    // swallow the second delivery.
    expect(
      getNotificationResponseFingerprint(
        response(todoData, { actionIdentifier: TODO_REMINDER_SNOOZE_ACTION }),
      ),
    ).not.toBe(
      getNotificationResponseFingerprint(
        response(todoData, { actionIdentifier: TODO_REMINDER_SNOOZE_ACTION, deliveredAt: 9_999 }),
      ),
    );
  });

  it('a dispatch exception does not poison a later distinct delivery', async () => {
    const cache = createHostCache();
    const failing = response(weeklyData, { requestIdentifier: WEEKLY_ID, deliveredAt: 1_000 });
    const later = response(weeklyDataNextWeek, {
      requestIdentifier: WEEKLY_ID,
      deliveredAt: 2_000,
    });

    expect(cache.admit(failing)).toBe(true);
    await expect(
      dispatchNotificationResponse(failing, {
        openHabit: () => {},
        markComplete: async () => {},
        snooze: async () => {},
        openTodo: () => {},
        markDone: async () => {},
        snoozeTodo: async () => {},
        openWeeklyReview: () => {
          throw new Error('simulated handler failure');
        },
        openWorkout: () => {},
      }),
    ).rejects.toThrow(/simulated handler failure/);

    // The later, genuinely distinct delivery is still admitted.
    expect(cache.admit(later)).toBe(true);
    let opened = 0;
    await dispatchNotificationResponse(later, {
      openHabit: () => {},
      markComplete: async () => {},
      snooze: async () => {},
      openTodo: () => {},
      markDone: async () => {},
      snoozeTodo: async () => {},
      openWeeklyReview: () => {
        opened += 1;
      },
      openWorkout: () => {},
    });
    expect(opened).toBe(1);
  });
});
