import { describe, expect, it, vi } from 'vitest';
import {
  reconcileHabitReminders,
  type HabitReminderNativeAdapter,
} from '@/features/habits/habitReminders.service';
import {
  buildHabitReminderPlan,
  getHabitReminderSnoozeIdentifier,
  HABIT_REMINDER_DATA_VERSION,
  type HabitReminderHabit,
} from '@/features/habits/habitReminders.domain';
import { createHabitRule } from '@/features/habits/habits.domain';
import type { NotificationRequest } from '@/lib/notifications';

const NOW = new Date(2026, 7, 10, 12, 0, 0, 0);

function habit(id: string, time = '18:00'): HabitReminderHabit {
  return {
    id,
    name: id,
    target_per_day: 1,
    reminder_time: time,
    created_at: '2026-08-01T00:00:00.000Z',
    deleted_at: null,
    rule_history: JSON.stringify([createHabitRule('2026-08-01', [1, 2, 3, 4, 5, 6, 7], 1)]),
  };
}

function fakeAdapter(
  existing: NotificationRequest[] = [],
  permission: 'granted' | 'denied' | 'unsupported' = 'granted',
) {
  const scheduled: unknown[] = [];
  const cancelled: string[] = [];
  const adapter: HabitReminderNativeAdapter = {
    getPermissionState: vi.fn().mockResolvedValue(permission),
    ensureChannel: vi.fn().mockResolvedValue(undefined),
    listScheduled: vi.fn().mockResolvedValue(existing),
    schedule: vi.fn(async (item) => {
      scheduled.push(item);
      return item.identifier;
    }),
    cancel: vi.fn(async (identifier) => {
      cancelled.push(identifier);
    }),
  };
  return { adapter, scheduled, cancelled };
}

function requestFor(
  item: ReturnType<typeof buildHabitReminderPlan>[number],
  identifier = item.identifier,
): NotificationRequest {
  return {
    identifier,
    content: {
      title: item.title,
      body: item.body,
      data: item.data,
      subtitle: null,
      categoryIdentifier: null,
      sound: 'default',
    },
    trigger: { type: 'date', date: item.fireAt.getTime() } as NotificationRequest['trigger'],
  };
}

describe('reconcileHabitReminders', () => {
  it('schedules the desired window and preserves all correct entries on repeat', async () => {
    const items = buildHabitReminderPlan({ habits: [habit('gym')], now: NOW });
    const first = fakeAdapter();
    const firstResult = await reconcileHabitReminders({
      habits: [habit('gym')],
      completions: [],
      now: NOW,
      adapter: first.adapter,
    });
    expect(firstResult).toMatchObject({
      status: 'reconciled',
      desired: 14,
      scheduled: 14,
      preserved: 0,
    });

    const second = fakeAdapter(items.map((item) => requestFor(item)));
    const secondResult = await reconcileHabitReminders({
      habits: [habit('gym')],
      completions: [],
      now: NOW,
      adapter: second.adapter,
    });
    expect(secondResult).toMatchObject({ desired: 14, scheduled: 0, preserved: 14, cancelled: 0 });
    expect(second.adapter.schedule).not.toHaveBeenCalled();
  });

  it('cancels stale time/schedule entries and schedules the replacement', async () => {
    const oldItems = buildHabitReminderPlan({ habits: [habit('gym', '18:00')], now: NOW });
    const nextItems = buildHabitReminderPlan({ habits: [habit('gym', '07:00')], now: NOW });
    const fake = fakeAdapter(oldItems.map((item) => requestFor(item)));
    const result = await reconcileHabitReminders({
      habits: [habit('gym', '07:00')],
      completions: [],
      now: NOW,
      adapter: fake.adapter,
    });
    expect(result.scheduled).toBe(13);
    expect(result.cancelled).toBe(14);
    expect([...fake.cancelled].sort()).toEqual(oldItems.map((item) => item.identifier).sort());
    expect((fake.scheduled[0] as { time: string }).time).toBe('07:00');
    expect(nextItems).toHaveLength(13);
  });

  it('replaces a metadata-correct notification whose native trigger is stale', async () => {
    const desired = buildHabitReminderPlan({ habits: [habit('gym')], now: NOW });
    const stale = requestFor(desired[0]);
    stale.trigger = {
      type: 'date',
      date: desired[0].fireAt.getTime() + 60 * 60 * 1000,
    } as NotificationRequest['trigger'];
    const fake = fakeAdapter([stale]);

    const result = await reconcileHabitReminders({
      habits: [habit('gym')],
      completions: [],
      now: NOW,
      adapter: fake.adapter,
    });

    expect(result.scheduled).toBe(14);
    expect(result.cancelled).toBe(1);
    expect(fake.cancelled).toContain(desired[0].identifier);
  });

  it('collapses duplicates without touching Pomodoro requests', async () => {
    const desired = buildHabitReminderPlan({ habits: [habit('gym')], now: NOW });
    const duplicate = requestFor(desired[0], 'habit-reminder:legacy:duplicate');
    const pomodoro: NotificationRequest = {
      identifier: 'pomodoro:timer:1',
      content: {
        title: 'Focus complete',
        body: 'Break time',
        subtitle: null,
        categoryIdentifier: null,
        sound: 'default',
      },
      trigger: {
        type: 'timeInterval',
        seconds: 60,
        repeats: false,
      } as NotificationRequest['trigger'],
    };
    const fake = fakeAdapter([requestFor(desired[0]), duplicate, pomodoro]);
    const result = await reconcileHabitReminders({
      habits: [habit('gym')],
      completions: [],
      now: NOW,
      adapter: fake.adapter,
    });
    expect(result.cancelled).toBe(1);
    expect(fake.cancelled).toEqual(['habit-reminder:legacy:duplicate']);
    expect(fake.adapter.cancel).not.toHaveBeenCalledWith('pomodoro:timer:1');
  });

  it('isolates multiple habits when one is changed or removed', async () => {
    const existing = buildHabitReminderPlan({
      habits: [habit('gym'), habit('read', '21:00')],
      now: NOW,
    });
    const fake = fakeAdapter(existing.map((item) => requestFor(item)));
    const result = await reconcileHabitReminders({
      habits: [habit('gym', '07:00')],
      completions: [],
      now: NOW,
      adapter: fake.adapter,
    });
    expect(result.cancelled).toBe(28);
    expect(fake.cancelled.some((id) => id.includes(':read:'))).toBe(true);
    expect(fake.cancelled.some((id) => id.includes(':gym:'))).toBe(true);
  });

  it('cancels habit reminders without prompting when permission is denied', async () => {
    const desired = buildHabitReminderPlan({ habits: [habit('gym')], now: NOW });
    const fake = fakeAdapter(
      desired.map((item) => requestFor(item)),
      'denied',
    );
    const result = await reconcileHabitReminders({ adapter: fake.adapter, now: NOW });
    expect(result).toMatchObject({ status: 'permission_denied', desired: 0, cancelled: 14 });
    expect(fake.adapter.getPermissionState).toHaveBeenCalled();
    expect(fake.adapter.ensureChannel).not.toHaveBeenCalled();
    expect(fake.adapter.schedule).not.toHaveBeenCalled();
  });

  it('is safe on unsupported platforms', async () => {
    const fake = fakeAdapter([], 'unsupported');
    await expect(
      reconcileHabitReminders({ adapter: fake.adapter, now: NOW }),
    ).resolves.toMatchObject({
      status: 'unsupported',
    });
  });

  it('cancels a snoozed reminder whose habit is paused or archived (F3)', async () => {
    const snoozeRequest: NotificationRequest = {
      identifier: getHabitReminderSnoozeIdentifier('gym', '2026-08-10'),
      content: {
        title: 'Gym',
        body: 'Time to complete your habit.',
        subtitle: null,
        categoryIdentifier: null,
        sound: 'default',
        data: {
          kind: 'habit-reminder',
          version: HABIT_REMINDER_DATA_VERSION,
          habitId: 'gym',
          dateKey: '2026-08-10',
          occurrenceId: getHabitReminderSnoozeIdentifier('gym', '2026-08-10'),
          time: '18:00',
          snoozed: true,
        },
      },
      trigger: {
        type: 'date',
        date: new Date(2026, 7, 10, 18, 15).getTime(),
      } as NotificationRequest['trigger'],
    };

    for (const status of ['paused', 'archived'] as const) {
      const fake = fakeAdapter([snoozeRequest]);
      const result = await reconcileHabitReminders({
        habits: [{ ...habit('gym'), status }],
        completions: [],
        now: NOW,
        adapter: fake.adapter,
      });
      expect(result.desired).toBe(0);
      expect(fake.cancelled).toContain(snoozeRequest.identifier);
    }
  });
});
