import { expect, test, type Page, type Route } from '@playwright/test';
import { defineJourney } from '../helpers/journey';
import { ACTIVE_SECTION_SELECTOR } from '../helpers/oracles';
import { returnToApp, queryRows } from '../helpers/dbHarness';
import { resetAll } from '../helpers/reset';

/**
 * J5c — "New phone, settings integrity" (Backup V2 closure).
 *
 * Restore V2 must treat recoverable settings as part of the coherent recovery
 * point: the settings row is fetched and verified BEFORE any local write, so
 * a missing row, a manifest without settings integrity metadata, or a
 * checksum mismatch blocks the restore and leaves the device untouched —
 * while a valid settings row restores completely.
 *
 * Runs in the journeys-sync lane against dist-sync/ (dummy Supabase). In the
 * standard dist/ build the restore boundary is absent and the steps are
 * released as fixme (same protocol as new-phone-v2.spec.ts).
 */

let remoteBackupDetected = false;

type SettingsFailureMode = 'none' | 'no-metadata' | 'missing-row' | 'checksum-mismatch';
const settingsFailureMode: { value: SettingsFailureMode } = { value: 'none' };

const TODO_ID = 'todo_1786000000000_abcdef12';

/** Canonical todos row (BACKUP_ENTITY_COLUMNS order) — served AND hashed. */
const TODO_ROW: Record<string, unknown> = {
  id: TODO_ID,
  title: 'Restored settings task',
  notes: null,
  completed: 0,
  due_date: null,
  priority: 'normal',
  sort_order: 1,
  recurrence: null,
  recurrence_id: null,
  created_at: '2026-01-10T09:00:00.000Z',
  updated_at: '2026-01-11T09:00:00.000Z',
  deleted_at: null,
};

const SETTINGS_PAYLOAD = {
  calorieGoal: { calories: 2100, protein: 140, carbs: 210, fats: 70 },
  pomodoroSettings: {
    focusMinutes: 50,
    shortBreakMinutes: 10,
    longBreakMinutes: 25,
    sessionsBeforeLongBreak: 3,
  },
  theme: { mode: 'dark', slots: { lightThemeId: 'ocean', darkThemeId: 'midnight' } },
};

function sha256Hex(input: string): string {
  // Mirror of lib/checksum.ts (pure TS SHA-256), used to certify the settings
  // payload independently of the app.
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const H0 = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    let code = input.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
      const next = input.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i += 1;
      }
    }
    if (code <= 0x7f) bytes.push(code);
    else if (code <= 0x7ff) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code <= 0xffff)
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
  }
  const bitLength = bytes.length * 8;
  const paddedLength = (((bytes.length + 8) >> 6) + 1) << 6;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);
  const h = H0.slice();
  const w = new Uint32Array(64);
  const rotr = (value: number, bits: number) => (value >>> bits) | (value << (32 - bits));
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }
  return h.map((value) => value.toString(16).padStart(8, '0')).join('');
}

/** Mirror of canonicalizeSettingsPayload (fixed shape, sorted slot keys). */
function settingsChecksum(payload: Record<string, unknown>): string {
  const raw = (payload ?? {}) as {
    calorieGoal?: Record<string, number> | null;
    pomodoroSettings?: Record<string, number> | null;
    theme?: { mode?: string | null; slots?: Record<string, string> | null } | null;
  };
  const canonical: Record<string, unknown> = {
    calorieGoal: raw.calorieGoal
      ? {
          calories: raw.calorieGoal.calories,
          protein: raw.calorieGoal.protein,
          carbs: raw.calorieGoal.carbs,
          fats: raw.calorieGoal.fats,
        }
      : null,
    pomodoroSettings: raw.pomodoroSettings
      ? {
          focusMinutes: raw.pomodoroSettings.focusMinutes,
          shortBreakMinutes: raw.pomodoroSettings.shortBreakMinutes,
          longBreakMinutes: raw.pomodoroSettings.longBreakMinutes,
          sessionsBeforeLongBreak: raw.pomodoroSettings.sessionsBeforeLongBreak,
        }
      : null,
    theme: {
      mode: raw.theme?.mode ?? null,
      slots: raw.theme?.slots
        ? Object.fromEntries(
            Object.entries(raw.theme.slots).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
          )
        : null,
    },
  };
  return sha256Hex(JSON.stringify(canonical));
}

const SETTINGS_CHECKSUM = settingsChecksum(SETTINGS_PAYLOAD);

function buildManifest(): Record<string, unknown> {
  return {
    user_id: 'dummy-anon',
    backup_schema_version: 2,
    generation: 1,
    completed_at: '2026-01-11T12:00:00.000Z',
    entity_metadata: {
      todos: { count: 1, checksum: sha256Hex(JSON.stringify(TODO_ROW)) },
      habits: { count: 0, checksum: sha256Hex('') },
      habit_completions: { count: 0, checksum: sha256Hex('') },
      calorie_entries: { count: 0, checksum: sha256Hex('') },
      saved_meals: { count: 0, checksum: sha256Hex('') },
      workout_routines: { count: 0, checksum: sha256Hex('') },
      routine_exercises: { count: 0, checksum: sha256Hex('') },
      routine_exercise_sets: { count: 0, checksum: sha256Hex('') },
      workout_logs: { count: 0, checksum: sha256Hex('') },
      workout_session_exercises: { count: 0, checksum: sha256Hex('') },
      pomodoro_sessions: { count: 0, checksum: sha256Hex('') },
      linked_action_rules: { count: 0, checksum: sha256Hex('') },
      weekly_reviews: { count: 0, checksum: sha256Hex('') },
    },
    settings_version: 2,
    settings_metadata:
      settingsFailureMode.value === 'no-metadata'
        ? undefined
        : { version: 2, checksum: SETTINGS_CHECKSUM },
    updated_at: '2026-01-11T12:00:00.000Z',
  };
}

const REMOTE_HEADERS = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-expose-headers': 'content-range',
};

async function handleDummySupabaseRequest(route: Route): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  const method = request.method();
  const path = url.pathname;

  if (method === 'OPTIONS') {
    return route.fulfill({
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, PATCH, DELETE, PUT, OPTIONS',
        'access-control-allow-headers': '*',
        'access-control-max-age': '86400',
      },
    });
  }

  if (path.startsWith('/auth/v1/')) {
    if (path === '/auth/v1/user' && method === 'GET') {
      return route.fulfill({
        status: 200,
        headers: REMOTE_HEADERS,
        body: JSON.stringify({
          id: 'dummy-anon',
          aud: 'authenticated',
          role: 'authenticated',
          email: null,
          is_anonymous: true,
        }),
      });
    }
    if (method === 'POST') {
      const now = Math.floor(Date.now() / 1000);
      return route.fulfill({
        status: 200,
        headers: REMOTE_HEADERS,
        body: JSON.stringify({
          access_token: 'dummy-access-token',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: now + 3600,
          refresh_token: 'dummy-refresh-token',
          user: { id: 'dummy-anon', aud: 'authenticated', role: 'authenticated' },
        }),
      });
    }
    return route.fulfill({ status: 200, headers: REMOTE_HEADERS, body: '{}' });
  }

  const match = path.match(/^\/rest\/v1\/([a-z_]+)$/);
  if (!match) {
    return route.fulfill({ status: 404, headers: REMOTE_HEADERS, body: '{"error":"not found"}' });
  }

  const entity = match[1];

  if (method === 'POST' || method === 'PATCH') {
    return route.fulfill({ status: 201, headers: REMOTE_HEADERS, body: '[]' });
  }

  if (entity === 'backup_manifest') {
    const manifest = buildManifest();
    if (settingsFailureMode.value === 'no-metadata') delete manifest.settings_metadata;
    return route.fulfill({
      status: 200,
      headers: REMOTE_HEADERS,
      body: JSON.stringify([manifest]),
    });
  }

  if (entity === 'user_backup_settings') {
    if (settingsFailureMode.value === 'missing-row') {
      return route.fulfill({ status: 200, headers: REMOTE_HEADERS, body: '[]' });
    }
    const payload =
      settingsFailureMode.value === 'checksum-mismatch'
        ? {
            ...SETTINGS_PAYLOAD,
            calorieGoal: { ...SETTINGS_PAYLOAD.calorieGoal, calories: 2200 },
          }
        : SETTINGS_PAYLOAD;
    return route.fulfill({
      status: 200,
      headers: REMOTE_HEADERS,
      body: JSON.stringify([
        {
          user_id: 'dummy-anon',
          settings_version: 2,
          payload,
          updated_at: '2026-01-11T12:00:00.000Z',
        },
      ]),
    });
  }

  if (entity === 'todos') {
    return route.fulfill({
      status: 200,
      headers: { ...REMOTE_HEADERS, 'content-range': '0-0/1' },
      body: JSON.stringify([{ ...TODO_ROW, user_id: 'dummy-anon' }]),
    });
  }

  return route.fulfill({
    status: 200,
    headers: { ...REMOTE_HEADERS, 'content-range': '0-0/0' },
    body: '[]',
  });
}

async function installMockRemoteBackup(page: Page): Promise<void> {
  await page.unroute('**/*.supabase.co/**').catch(() => {});
  await page
    .context()
    .unroute('**/*.supabase.co/**')
    .catch(() => {});
  await page.context().route('**/*.supabase.co/**', handleDummySupabaseRequest);
}

function restorePromptVisible(page: Page): Promise<boolean> {
  return page
    .getByRole('button', { name: 'Restore backup', exact: true })
    .first()
    .waitFor({ state: 'visible', timeout: 8_000 })
    .then(() => true)
    .catch(() => false);
}

async function attemptRestore(page: Page, expected: 'blocked' | 'restored'): Promise<void> {
  await resetAll(page);
  await returnToApp(page);
  if (!(await restorePromptVisible(page))) {
    test.fixme(
      !remoteBackupDetected,
      'this standard dist/ build has no Supabase-backed remote, so the V2 import cannot run — runs in the journeys-sync lane against dist-sync/',
    );
    return;
  }
  remoteBackupDetected = true;
  await page.getByRole('button', { name: 'Restore backup', exact: true }).first().click();
  if (expected === 'restored') {
    // A successful restore dismisses the prompt.
    await expect(page.getByText(/A remote backup is available/).first()).toBeHidden({
      timeout: 20_000,
    });
    return;
  }
  // A blocked/invalid restore keeps the prompt open and surfaces the failure.
  await expect(
    page
      .getByText(
        /could not be restored|remote backup manifest does not certify|declares a settings snapshot but has no settings row|settings failed integrity verification/i,
      )
      .first(),
  ).toBeVisible({ timeout: 20_000 });
}

async function expectEmptyDevice(page: Page): Promise<void> {
  const rows = await queryRows(
    page,
    `SELECT
       (SELECT COUNT(*) FROM todos) AS todos,
       (SELECT COUNT(*) FROM habits) AS habits,
       (SELECT COUNT(*) FROM saved_meals) AS saved_meals,
       (SELECT COUNT(*) FROM sync_outbox) AS outbox`,
  );
  expect(
    [rows[0]?.todos, rows[0]?.habits, rows[0]?.saved_meals, rows[0]?.outbox].map(Number),
  ).toEqual([0, 0, 0, 0]);
}

defineJourney({
  persona: 'P6 — Jordan, the New Device Migrator (settings integrity)',
  goal: 'verify that Restore V2 blocks on any settings integrity failure and leaves the device untouched, then restores completely with valid settings',
  tags: ['@sync'],
  risks: ['R3'],
  steps: [
    {
      name: 'restore is blocked when the manifest lacks settings integrity metadata',
      run: async ({ page }) => {
        settingsFailureMode.value = 'no-metadata';
        await installMockRemoteBackup(page);
        await attemptRestore(page, 'blocked');
        if (!remoteBackupDetected) return;
        await expectEmptyDevice(page);
        // The SQL oracle above left the page on the DB harness; return to the
        // app before touching the UI. The restore prompt re-appears on boot
        // (the device is still empty), so dismiss it first — it overlays the
        // app and would block the settings button.
        await returnToApp(page);
        const promptAgain = await page
          .getByRole('button', { name: 'Restore backup', exact: true })
          .first()
          .waitFor({ state: 'visible', timeout: 8_000 })
          .then(() => true)
          .catch(() => false);
        if (promptAgain) {
          await page.getByRole('button', { name: 'Not now', exact: true }).first().click();
        }
        // Settings UI must not claim a complete V2 backup for a manifest that
        // cannot certify settings integrity.
        await page.getByRole('button', { name: 'Open settings' }).click();
        await expect(page.getByText('Invalid').first()).toBeVisible({ timeout: 10_000 });
        await page.getByRole('button', { name: 'Close' }).first().click();
      },
    },
    {
      name: 'restore is blocked when the settings row is missing',
      run: async ({ page }) => {
        settingsFailureMode.value = 'missing-row';
        await attemptRestore(page, 'blocked');
        if (!remoteBackupDetected) return;
        await expectEmptyDevice(page);
      },
    },
    {
      name: 'restore is blocked when the settings checksum mismatches',
      run: async ({ page }) => {
        settingsFailureMode.value = 'checksum-mismatch';
        await attemptRestore(page, 'blocked');
        if (!remoteBackupDetected) return;
        await expectEmptyDevice(page);
      },
    },
    {
      name: 'restore succeeds when the settings row verifies against the manifest',
      run: async ({ page }) => {
        settingsFailureMode.value = 'none';
        await attemptRestore(page, 'restored');
        if (!remoteBackupDetected) return;
        // The valid backup imported: the todo arrived AND the certified
        // settings were applied (calorie goal from the verified payload).
        const rows = await queryRows(
          page,
          `SELECT
             (SELECT COUNT(*) FROM todos) AS todos,
             (SELECT value FROM app_meta WHERE key = 'calorie_goal') AS goal`,
        );
        expect(Number(rows[0]?.todos)).toBe(1);
        expect(JSON.parse(String(rows[0]?.goal ?? '{}')).calories).toBe(2100);
        await returnToApp(page);
        await page.getByRole('button', { name: 'Open settings' }).click();
        await expect(page.getByText('Complete (V2)').first()).toBeVisible({ timeout: 10_000 });
        await page.getByRole('button', { name: 'Close' }).first().click();
        await expect(page.locator(ACTIVE_SECTION_SELECTOR).first()).toBeVisible();
      },
    },
  ],
});
