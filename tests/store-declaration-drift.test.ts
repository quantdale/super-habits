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
import { BACKUP_ENTITIES } from '@/core/backup/backup.types';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appJsonPath = resolve(repositoryRoot, 'app.json');
const notificationsPath = resolve(repositoryRoot, 'lib', 'notifications.ts');
const readinessPath = resolve(repositoryRoot, 'docs', 'release', 'app-store-readiness.md');
const releasePath = resolve(repositoryRoot, 'docs', 'release');

function releaseText(fileName: string): string {
  return readFileSync(resolve(releasePath, fileName), 'utf8')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[*`_]/g, '')
    .replace(/\s+/g, ' ');
}

function hostedPrivacyText(): string {
  return readFileSync(resolve(repositoryRoot, 'public', 'privacy.html'), 'utf8')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ');
}

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

  it('discloses automatic anonymous Auth and one-way backup in configured builds', () => {
    const supabaseSource = readFileSync(resolve(repositoryRoot, 'lib', 'supabase.ts'), 'utf8');
    const coordinatorSource = readFileSync(
      resolve(repositoryRoot, 'core', 'auth', 'accountCoordinator.ts'),
      'utf8',
    );
    expect(supabaseSource).toMatch(/let remoteMode: RemoteMode = 'enabled'/);
    expect(coordinatorSource).toContain('await this.dependencies.ensureAnonymousSession()');

    const policy = releaseText('privacy-policy.md');
    const hostedPolicy = hostedPrivacyText();
    const declarations = releaseText('store-data-declarations.md');
    const readiness = releaseText('app-store-readiness.md');
    const notes = releaseText('release-notes-1.0.0.md');

    for (const text of [policy, hostedPolicy]) {
      expect(text).toMatch(/anonymous session during startup/i);
      expect(text).toMatch(/automatically push recoverable data/i);
      expect(text).toMatch(/no in-app backup opt-in switch/i);
      expect(text).toMatch(/one-way push plus restore/i);
    }
    expect(declarations).toMatch(/anonymous Auth at startup and automatically push/i);
    expect(declarations).toMatch(/no in-app backup opt-in switch/i);
    expect(declarations).toMatch(/Data Not Collected is not a supported draft answer/i);
    expect(readiness).toMatch(/anonymous Auth at startup and automatically push/i);
    expect(notes).toMatch(/anonymous Auth and push recoverable local writes.{0,80}automatically/i);
  });

  it('discloses conditional AI provider processing without asserting provider retention', () => {
    const askSource = readFileSync(
      resolve(repositoryRoot, 'features', 'command', 'types.ts'),
      'utf8',
    );
    const parseSource = readFileSync(
      resolve(repositoryRoot, 'supabase', 'functions', 'parse-ai-command', 'index.js'),
      'utf8',
    );
    const answerSource = readFileSync(
      resolve(repositoryRoot, 'supabase', 'functions', 'user-ai-ask', 'index.js'),
      'utf8',
    );
    expect(askSource).toContain("EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT === 'true'");
    expect(parseSource).toContain('Deno.env.get("OPENAI_API_KEY")');
    expect(answerSource).toContain('Deno.env.get("DEEPSEEK_API_KEY")');

    const policy = releaseText('privacy-policy.md');
    const hostedPolicy = hostedPrivacyText();
    const declarations = releaseText('store-data-declarations.md');
    for (const text of [policy, hostedPolicy]) {
      expect(text).toMatch(
        /question, selected conversation turns.{0,110}third-party model service/i,
      );
      expect(text).toMatch(/command text and date\/time context to a model service/i);
      expect(text).toMatch(/does not establish provider retention/i);
    }
    expect(declarations).toMatch(/AI route enabled and used/i);
    expect(declarations).toMatch(/model provider/i);
    expect(declarations).toMatch(/provider.*retention/i);
  });

  it('keeps reward state outside the backed-up scope in release copy', () => {
    expect(BACKUP_ENTITIES).not.toContain('gamification_events');
    expect(BACKUP_ENTITIES).not.toContain('gamification_badges');
    expect(BACKUP_ENTITIES).not.toContain('gamification_quests');
    expect(BACKUP_ENTITIES).not.toContain('gamification_streak_freezes');

    for (const text of [
      releaseText('privacy-policy.md'),
      hostedPrivacyText(),
      releaseText('store-data-declarations.md'),
      releaseText('release-notes-1.0.0.md'),
    ]) {
      expect(text).toMatch(/rewards?.{0,120}local-only/i);
      expect(text).toMatch(/never uploaded(?:,| or) backed up/i);
    }
  });

  it('does not promise an unavailable email-removal control or an unverified erasure timeline', () => {
    const policy = releaseText('privacy-policy.md');
    const hostedPolicy = hostedPrivacyText();
    const declarations = releaseText('store-data-declarations.md');
    const handoff = releaseText('submission-package.md');

    for (const text of [policy, hostedPolicy]) {
      expect(text).toMatch(/no in-app control to remove an attached recovery email/i);
      expect(text).toMatch(
        /Backups can be anonymous, so an email address alone cannot identify every account/i,
      );
      expect(text).toMatch(/ownership-verification and deletion procedure/i);
      expect(text).not.toMatch(/removing the email from your backup settings/i);
      expect(text).not.toMatch(/30.days?.{0,30}(?:erasure|deletion|request)/i);
    }
    expect(declarations).not.toMatch(/support-contact erasure \(30 days\)/i);
    expect(handoff).toMatch(
      /ownership-check and deletion procedure for both anonymous and email-protected accounts/i,
    );
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
