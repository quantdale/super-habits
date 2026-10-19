import { describe, expect, it, vi } from 'vitest';
import { createNotificationResponseQueue } from '@/core/notifications/notificationResponseQueue';
import {
  dispatchNotificationResponse,
  getNotificationResponseFingerprint,
} from '@/core/notifications/notificationResponseDispatcher';

function delivery(date: number) {
  return {
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    notification: {
      date,
      request: {
        identifier: 'weekly-review-reminder:weekly',
        content: { data: { kind: 'weekly-review-reminder', version: 1 } },
        trigger: null,
      },
    },
  } as never;
}

describe('notification delivery queue', () => {
  it('dispatches concurrent copies of one delivery once, through the real dispatcher', async () => {
    const queue = createNotificationResponseQueue();
    const open = vi.fn();
    const clear = vi.fn();
    const response = delivery(1000);
    const dispatch = async () => {
      await dispatchNotificationResponse(response, {
        openHabit: () => {},
        markComplete: async () => {},
        snooze: async () => {},
        openTodo: () => {},
        markDone: async () => {},
        snoozeTodo: async () => {},
        openWeeklyReview: open,
        openWorkout: () => {},
      });
      clear();
    };
    const key = getNotificationResponseFingerprint(response);
    await Promise.all([queue.enqueue(key, dispatch), queue.enqueue(key, dispatch)]);
    expect(open).toHaveBeenCalledTimes(1);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('retries a failed delivery, without clearing it or blocking another delivery', async () => {
    const queue = createNotificationResponseQueue();
    const clear = vi.fn();
    const dispatch = vi
      .fn()
      .mockRejectedValueOnce(new Error('write failed'))
      .mockResolvedValue(null);
    const handle = async () => {
      await dispatch();
      clear();
    };
    await expect(queue.enqueue('same', handle)).rejects.toThrow('write failed');
    expect(clear).not.toHaveBeenCalled();
    await queue.enqueue('same', handle);
    await queue.enqueue('same', handle);
    await queue.enqueue('next week', handle);
    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(clear).toHaveBeenCalledTimes(2);
  });

  it('serializes distinct responses and bounds successful replay retention', async () => {
    const queue = createNotificationResponseQueue(2);
    const order: string[] = [];
    await Promise.all(
      ['a', 'b', 'c'].map((key) =>
        queue.enqueue(key, async () => {
          order.push(key);
          await Promise.resolve();
          order.push(`${key} done`);
        }),
      ),
    );
    await queue.enqueue('b', async () => {
      order.push('duplicate');
    });
    await queue.enqueue('a', async () => {
      order.push('a again');
    });
    expect(order).toEqual(['a', 'a done', 'b', 'b done', 'c', 'c done', 'a again']);
  });
});
