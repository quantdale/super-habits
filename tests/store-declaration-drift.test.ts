import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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

// The permission set the BUILT application actually requests, committed here
// because a fresh clone (and the pull-request gate) has no Gradle build to
// read. Transcribed from the hermetic release merge built on 2026-09-30
// (`android/app/build/intermediates/merged_manifests/release/processReleaseManifest`,
// APK SHA-256 F3D9A63C…D961C5) and grouped by origin, so an unexpected entry is
// a question with an owner:
//
//   - the app's own four (above);
//   - framework/transitive: INTERNET, ACCESS_NETWORK_STATE (expo-image,
//     netinfo), ACCESS_WIFI_STATE (netinfo);
//   - expo-audio: MODIFY_AUDIO_SETTINGS, RECORD_AUDIO. The app only PLAYS
//     reward sounds (lib/rewardFeedback.ts), but the module declares both, and
//     the module is what the build links;
//   - expo-file-system: READ_EXTERNAL_STORAGE and WRITE_EXTERNAL_STORAGE,
//     both capped at API 32 by the module;
//   - expo-notifications + Firebase messaging: the launcher-badge permission
//     family, c2dm RECEIVE, the app's own DYNAMIC_RECEIVER_NOT_EXPORTED
//     signature permission, and BIND_GET_INSTALL_REFERRER_SERVICE.
//
// An earlier transcription of this list, taken from a previous build's
// manifest, named two permissions wrongly (`com.htc.launcher.READ_SETTINGS`,
// `com.htc.launcher.UPDATE_SHORTCET`) and missed the four
// `com.android.launcher.permission.*` entries. The guard caught it against the
// real merge, which is the whole reason the merged-manifest source exists.
//
// `android.permission.SYSTEM_ALERT_WINDOW` is deliberately NOT here: it came
// from the prebuild template, no code path draws an OS overlay, and app.json
// now blocks it (tools:node="remove"), which the local merged-manifest check
// below accounts for.
const EXPECTED_BUILT_MANIFEST_PERMISSIONS = [
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.ACCESS_WIFI_STATE',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'android.permission.INTERNET',
  'android.permission.MODIFY_AUDIO_SETTINGS',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.READ_APP_BADGE',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.RECORD_AUDIO',
  'android.permission.VIBRATE',
  'android.permission.WAKE_LOCK',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'com.android.launcher.permission.INSTALL_SHORTCUT',
  'com.android.launcher.permission.READ_SETTINGS',
  'com.android.launcher.permission.UNINSTALL_SHORTCUT',
  'com.android.launcher.permission.WRITE_SETTINGS',
  'com.dale16.superhabits.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION',
  'com.google.android.c2dm.permission.RECEIVE',
  'com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE',
  'com.sonymobile.home.permission.PROVIDER_INSERT_BADGE',
  'com.sonyericsson.home.permission.BROADCAST_BADGE',
  'com.anddoes.launcher.permission.UPDATE_COUNT',
  'com.htc.launcher.permission.READ_SETTINGS',
  'com.htc.launcher.permission.UPDATE_SHORTCUT',
  'com.huawei.android.launcher.permission.CHANGE_BADGE',
  'com.huawei.android.launcher.permission.READ_SETTINGS',
  'com.huawei.android.launcher.permission.WRITE_SETTINGS',
  'com.majeur.launcher.permission.UPDATE_BADGE',
  'com.oppo.launcher.permission.READ_SETTINGS',
  'com.oppo.launcher.permission.WRITE_SETTINGS',
  'com.sec.android.provider.badge.permission.READ',
  'com.sec.android.provider.badge.permission.WRITE',
  'me.everything.badger.permission.BADGE_COUNT_READ',
  'me.everything.badger.permission.BADGE_COUNT_WRITE',
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
    android?: {
      permissions?: unknown;
      allowBackup?: unknown;
      blockedPermissions?: unknown;
    };
  };
};

function readAppJsonPermissions(): unknown {
  const appJson = JSON.parse(readFileSync(appJsonPath, 'utf8')) as AppJson;
  return appJson.expo?.android?.permissions;
}

function readBlockedPermissions(): string[] {
  const appJson = JSON.parse(readFileSync(appJsonPath, 'utf8')) as AppJson;
  return [...((appJson.expo?.android?.blockedPermissions ?? []) as string[])];
}

/**
 * The merged Android manifest from the most recent local Gradle build, or null
 * when the build intermediates do not exist (fresh clone, pull-request gate).
 *
 * The `android/` tree is generated and gitignored, so this is an OBSERVATION
 * of a real build, never a tracked source of truth — which is exactly why the
 * committed list above exists.
 */
function findMergedManifest(): string | null {
  const intermediates = join(repositoryRoot, 'android', 'app', 'build', 'intermediates');
  const found: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > 4 || !existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (!entry.isDirectory()) continue;
      if (entry.name === 'merged_manifest' || entry.name === 'merged_manifests') {
        collectManifests(full, found);
      } else {
        walk(full, depth + 1);
      }
    }
  };
  const collectManifests = (dir: string, out: string[]) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) collectManifests(full, out);
      else if (entry.name === 'AndroidManifest.xml') out.push(full);
    }
  };
  walk(intermediates, 0);
  if (found.length === 0) return null;
  return found.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0] ?? null;
}

function readManifestPermissions(manifestText: string): string[] {
  return [
    ...new Set(
      [...manifestText.matchAll(/<uses-permission\s+android:name="([^"]+)"/g)].map(
        (match) => match[1] ?? '',
      ),
    ),
  ].sort();
}

/**
 * What the shipped application will actually request: the merged manifest's
 * permissions minus the ones tracked configuration blocks. A permission blocked
 * by `expo.android.blockedPermissions` is removed by the manifest merger, so
 * subtracting it is what keeps a STALE local build from failing this guard
 * before the next prebuild has run.
 */
function effectiveBuiltPermissions(
  manifestPermissions: string[] | null,
  blockedPermissions: string[],
): string[] {
  const source = manifestPermissions ?? EXPECTED_BUILT_MANIFEST_PERMISSIONS;
  return source.filter((permission) => !blockedPermissions.includes(permission)).sort();
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

  it('observes the permissions the BUILT manifest requests, not only the declared four', () => {
    const manifestPath = findMergedManifest();
    const manifestPermissions = manifestPath
      ? readManifestPermissions(readFileSync(manifestPath, 'utf8'))
      : null;
    const blocked = readBlockedPermissions();
    const effective = effectiveBuiltPermissions(manifestPermissions, blocked);

    // The single source under test: the committed list, checked against a real
    // merge whenever one exists on this machine.
    expect(effective).toEqual([...EXPECTED_BUILT_MANIFEST_PERMISSIONS].sort());
    expect(
      manifestPermissions === null ? 'no local merge (committed list used)' : manifestPath,
    ).toBeTruthy();

    // A permission the app declares but nobody built would be a silent lie in
    // the other direction, so the declared four must be a subset.
    for (const declared of EXPECTED_ANDROID_PERMISSIONS) {
      expect(effective).toContain(declared);
    }
  });

  it('reads a synthetic merged manifest and drops what tracked config blocks', () => {
    const synthetic = [
      '<uses-permission android:name="android.permission.INTERNET" />',
      '<uses-permission android:name="android.permission.RECORD_AUDIO" />',
      '<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />',
      '<uses-permission\n        android:name="android.permission.READ_EXTERNAL_STORAGE"\n        android:maxSdkVersion="32" />',
    ].join('\n');
    // Dotted, indented, and plain forms all parse, and the result is sorted.
    expect(readManifestPermissions(synthetic)).toEqual([
      'android.permission.INTERNET',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.RECORD_AUDIO',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ]);
    // The overlay the tracked config blocks is not part of what ships.
    expect(
      effectiveBuiltPermissions(readManifestPermissions(synthetic), [
        'android.permission.SYSTEM_ALERT_WINDOW',
      ]),
    ).toEqual([
      'android.permission.INTERNET',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.RECORD_AUDIO',
    ]);
  });

  it('fails when a library adds a permission the declarations do not cover', () => {
    // Non-vacuity: the guard is not satisfied by app.json alone. A dependency
    // adding one permission must break the comparison against the declarations.
    const withExtra = [
      ...EXPECTED_BUILT_MANIFEST_PERMISSIONS,
      'android.permission.QUERY_ALL_PACKAGES',
    ].sort();
    expect(withExtra).toHaveLength(EXPECTED_BUILT_MANIFEST_PERMISSIONS.length + 1);
    expect(withExtra).not.toEqual([...EXPECTED_BUILT_MANIFEST_PERMISSIONS].sort());
    expect(() =>
      expect(effectiveBuiltPermissions(withExtra, [])).toEqual(
        [...EXPECTED_BUILT_MANIFEST_PERMISSIONS].sort(),
      ),
    ).toThrow();
  });

  it('keeps OS-level backup and the unused overlay permission out of the release build', () => {
    const appJson = JSON.parse(readFileSync(appJsonPath, 'utf8')) as AppJson;
    // The whole local dataset is a credential-bearing SQLite database plus a
    // persisted Supabase session; OS-level backup would hand both to the
    // device's Google account, so the tracked config must forbid it.
    expect(appJson.expo?.android?.allowBackup).toBe(false);
    expect(readBlockedPermissions()).toContain('android.permission.SYSTEM_ALERT_WINDOW');
    // Nothing may request the overlay the block removes.
    for (const permission of EXPECTED_BUILT_MANIFEST_PERMISSIONS) {
      expect(readBlockedPermissions()).not.toContain(permission);
    }
    // No code path draws an OS overlay: the only "overlay" identifiers in the
    // app are in-app theme scrims.
    for (const file of ['lib/rewardFeedback.ts']) {
      const source = readFileSync(resolve(repositoryRoot, file), 'utf8');
      expect(source).not.toContain('SYSTEM_ALERT_WINDOW');
    }
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

  it('declares every permission the built manifest requests, not just the app-declared four', () => {
    // The store permission list is the honest one: a library-contributed
    // permission the declarations omit is a false Play answer. Read the raw
    // markdown (NOT `releaseText`, which strips the dots and underscores these
    // permission names are built from).
    const readiness = readFileSync(readinessPath, 'utf8');
    for (const permission of EXPECTED_BUILT_MANIFEST_PERMISSIONS) {
      expect(readiness, `app-store-readiness.md does not declare ${permission}`).toContain(
        permission,
      );
    }
    // The overlay permission is removed from the build, so the declarations
    // must say it is blocked rather than silently omit it.
    expect(readiness).toMatch(/SYSTEM_ALERT_WINDOW/);
    expect(readiness).toMatch(/blocked/);
    // ...and OS-level backup is off, stated where a reviewer will look.
    expect(readiness).toMatch(/allowBackup[^\n]*false|OS-level backup[^\n]*(?:disabled|off|not)/i);
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
