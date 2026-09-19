import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  DAILY_PLAN_REMINDER_CHANNEL_ID,
  TODO_REMINDER_CHANNEL_ID,
  WEEKLY_REVIEW_REMINDER_CHANNEL_ID,
} from '@/lib/notificationConstants';
import { HABIT_REMINDER_CHANNEL_ID } from '@/lib/notifications';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appJsonPath = resolve(repositoryRoot, 'app.json');
const notificationsPath = resolve(repositoryRoot, 'lib', 'notifications.ts');
const readinessPath = resolve(repositoryRoot, 'docs', 'release', 'app-store-readiness.md');

// Exact permission set declared in app-store-readiness.md ("declared
// permissions POST_NOTIFICATIONS, VIBRATE, RECEIVE_BOOT_COMPLETED,
// WAKE_LOCK"). The Play Data safety answers were written against this set:
// any addition or removal must update the declarations first.
const EXPECTED_ANDROID_PERMISSIONS = [
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.VIBRATE',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.WAKE_LOCK',
];

// Full runtime channel inventory from app-store-readiness.md ("5 runtime
// channels"). IDs are the stable `setNotificationChannelAsync` keys; names
// are the user-visible channel labels on Android. `ref` is the exact first
// argument expression at the call site in lib/notifications.ts — the
// `default` channel is a literal, the reminder channels pass their
// `lib/notificationConstants.ts` identifiers (pinned to values below).
const EXPECTED_CHANNELS = [
  { id: 'default', name: 'General', ref: "'default'" },
  { id: 'habit-reminders', name: 'Habit reminders', ref: 'HABIT_REMINDER_CHANNEL_ID' },
  { id: 'todo-reminders', name: 'Todo reminders', ref: 'TODO_REMINDER_CHANNEL_ID' },
  {
    id: 'daily-plan-reminders',
    name: 'Daily plan reminders',
    ref: 'DAILY_PLAN_REMINDER_CHANNEL_ID',
  },
  {
    id: 'weekly-review-reminders',
    name: 'Weekly review reminders',
    ref: 'WEEKLY_REVIEW_REMINDER_CHANNEL_ID',
  },
];

type AppJson = {
  expo?: {
    android?: { permissions?: unknown };
  };
};

function readAppJsonPermissions(): unknown {
  const appJson = JSON.parse(readFileSync(appJsonPath, 'utf8')) as AppJson;
  return appJson.expo?.android?.permissions;
}

function readNotificationsSource(): string {
  return readFileSync(notificationsPath, 'utf8');
}

function assertPermissionSet(permissions: unknown): void {
  expect([...(permissions as string[])].sort()).toEqual([...EXPECTED_ANDROID_PERMISSIONS].sort());
}

function assertChannelInventory(source: string): void {
  const callSites = source.match(/setNotificationChannelAsync\(/g) ?? [];
  expect(callSites.length).toBe(EXPECTED_CHANNELS.length);
  for (const { name, ref } of EXPECTED_CHANNELS) {
    expect(source).toContain(`setNotificationChannelAsync(${ref}`);
    expect(source).toContain(`name: '${name}'`);
  }
}

describe('store declaration drift guard', () => {
  it('pins the app.json Android permission set to the declared four', () => {
    assertPermissionSet(readAppJsonPermissions());
  });

  it('keeps the reminder channel IDs equal to the documented inventory', () => {
    expect(HABIT_REMINDER_CHANNEL_ID).toBe('habit-reminders');
    expect(TODO_REMINDER_CHANNEL_ID).toBe('todo-reminders');
    expect(DAILY_PLAN_REMINDER_CHANNEL_ID).toBe('daily-plan-reminders');
    expect(WEEKLY_REVIEW_REMINDER_CHANNEL_ID).toBe('weekly-review-reminders');
  });

  it('keeps the five runtime channels (ids + user-visible names) in lib/notifications.ts', () => {
    assertChannelInventory(readNotificationsSource());
  });

  it('keeps app-store-readiness.md naming the declared permissions and channels', () => {
    const readiness = readFileSync(readinessPath, 'utf8');
    for (const permission of EXPECTED_ANDROID_PERMISSIONS) {
      expect(readiness).toContain(permission.replace('android.permission.', ''));
    }
    for (const { name } of EXPECTED_CHANNELS) {
      expect(readiness).toContain(name);
    }
    expect(readiness).toContain('store-declaration-drift.test.ts');
  });

  it('rejects a permission set with an added permission (guard is not vacuous)', () => {
    expect(() =>
      assertPermissionSet([
        ...(readAppJsonPermissions() as string[]),
        'android.permission.RECORD_AUDIO',
      ]),
    ).toThrow();
  });

  it('rejects a permission set with a removed permission (guard is not vacuous)', () => {
    const trimmed = (readAppJsonPermissions() as string[]).slice(1);
    expect(() => assertPermissionSet(trimmed)).toThrow();
  });

  it('rejects a channel inventory with an added channel (guard is not vacuous)', () => {
    const tampered = readNotificationsSource().replace(
      "setNotificationChannelAsync('default'",
      "setNotificationChannelAsync('extra'",
    );
    expect(() => assertChannelInventory(tampered)).toThrow();
  });

  it('rejects a channel inventory with a removed channel (guard is not vacuous)', () => {
    const tampered = readNotificationsSource().replace(
      "setNotificationChannelAsync('default', {",
      '',
    );
    expect(() => assertChannelInventory(tampered)).toThrow();
  });
});
