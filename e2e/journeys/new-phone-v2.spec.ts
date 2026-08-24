import { expect, test, type Page, type Route } from '@playwright/test';
import { defineJourney } from '../helpers/journey';
import { ACTIVE_SECTION_SELECTOR, expectRows } from '../helpers/oracles';
import { returnToApp, queryRows } from '../helpers/dbHarness';
import { resetAll } from '../helpers/reset';

/**
 * J5b — "New phone, complete backup" (Backup Completeness V2).
 *
 * The full disaster-recovery round trip: a source device's COMPLETE V2 backup
 * (all 21 Scope-7 recoverable entities + settings + integrity manifest) is served as
 * the remote; a pristine device recovers it through the V2 restore path and
 * ends up semantically equivalent — habit history and streaks included, focus
 * history, workout structure + history, saved meals, linked-action rules, and
 * settings — with NO historical side effects (empty linked-action ledgers,
 * empty sync outbox) and with new activity syncing normally afterwards.
 *
 * Runs in the journeys-sync lane against dist-sync/ (dummy Supabase). In the
 * standard dist/ build the restore boundary is absent and the boundary steps
 * are released as fixme (same protocol as new-phone.spec.ts).
 */

let remoteBackupDetected = false;

// ---------------------------------------------------------------------------
// Deterministic backup integrity (mirrors lib/checksum.ts + backup.types.ts
// so the spec independently validates the app's canonicalization).
// ---------------------------------------------------------------------------

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

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

function sha256Hex(input: string): string {
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
  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const w = new Uint32Array(64);
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

const COLUMNS: Record<string, string[]> = {
  todos: [
    'id',
    'title',
    'notes',
    'completed',
    'due_date',
    'priority',
    'sort_order',
    'recurrence',
    'recurrence_id',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  habits: [
    'id',
    'name',
    'target_per_day',
    'reminder_time',
    'category',
    'icon',
    'color',
    'rule_history',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  habit_completions: ['id', 'habit_id', 'date_key', 'count', 'created_at', 'updated_at'],
  calorie_entries: [
    'id',
    'food_name',
    'calories',
    'protein',
    'carbs',
    'fats',
    'fiber',
    'meal_type',
    'consumed_on',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  saved_meals: [
    'id',
    'food_name',
    'calories',
    'protein',
    'carbs',
    'fats',
    'fiber',
    'meal_type',
    'use_count',
    'last_used_at',
    'created_at',
  ],
  workout_routines: ['id', 'name', 'description', 'created_at', 'updated_at', 'deleted_at'],
  routine_exercises: [
    'id',
    'routine_id',
    'name',
    'sort_order',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  routine_exercise_sets: [
    'id',
    'exercise_id',
    'set_number',
    'active_seconds',
    'rest_seconds',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  workout_logs: ['id', 'routine_id', 'notes', 'completed_at', 'created_at'],
  workout_session_exercises: ['id', 'log_id', 'exercise_name', 'sets_completed', 'created_at'],
  pomodoro_sessions: [
    'id',
    'started_at',
    'ended_at',
    'duration_seconds',
    'session_type',
    'created_at',
  ],
  linked_action_rules: [
    'id',
    'status',
    'direction_policy',
    'bidirectional_group_id',
    'source_feature',
    'source_entity_type',
    'source_entity_id',
    'trigger_type',
    'target_feature',
    'target_entity_type',
    'target_entity_id',
    'effect_type',
    'effect_payload',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
};

function entityChecksum(rows: Record<string, unknown>[]): { count: number; checksum: string } {
  const columns = COLUMNS[String(rows[0]?._entity ?? Object.keys(rows[0] ?? {})[0])] ?? [];
  void columns;
  // The caller passes the entity name via a hidden marker on each row.
  const entity = String(rows[0]?._entity);
  const columnList = COLUMNS[entity] ?? [];
  const sorted = [...rows].sort((a, b) =>
    String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0,
  );
  const lines = sorted.map((row) => {
    const ordered: Record<string, unknown> = {};
    for (const column of columnList) {
      ordered[column] = row[column] === undefined ? null : row[column];
    }
    return JSON.stringify(ordered);
  });
  return { count: rows.length, checksum: sha256Hex(lines.join('\n')) };
}

/**
 * Settings integrity checksum, mirroring `canonicalizeSettingsPayload`:
 * fixed allowlist shape, explicit null defaults, sorted theme-slot keys —
 * independent of JSON key order, so it also verifies the slot-ordering
 * invariance of the app's canonicalization.
 */
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

// ---------------------------------------------------------------------------
// The complete V2 backup fixture ("source device" state).
// ---------------------------------------------------------------------------

const HABIT_ID = 'habit_1786000000000_abcdef12';
const TODO_ID = 'todo_1786000000000_abcdef12';
const ROUTINE_ID = 'wrk_1786000000000_abcdef12';
const LOG_ID = 'wrk_1786000000001_abcdef12';
const EXERCISE_ID = 'ex_1786000000000_abcdef12';
const SET_ID = 'eset_1786000000000_abcdef12';
const SESSION_EX_ID = 'wsex_1786000000000_abcdef12';
const RULE_ID = 'link_1786000000000_abcdef12';

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

const REMOTE_BACKUP: Record<string, Record<string, unknown>[]> = {
  todos: [
    {
      _entity: 'todos',
      id: TODO_ID,
      title: 'Restored V2 task',
      notes: null,
      completed: 0,
      due_date: null,
      priority: 'urgent',
      sort_order: 1,
      recurrence: null,
      recurrence_id: null,
      created_at: '2026-01-10T09:00:00.000Z',
      updated_at: '2026-01-11T09:00:00.000Z',
      deleted_at: null,
    },
  ],
  habits: [
    {
      _entity: 'habits',
      id: HABIT_ID,
      name: 'Hydrate',
      target_per_day: 2,
      reminder_time: null,
      category: 'anytime',
      icon: 'water-drop',
      color: '#3b82f6',
      rule_history: JSON.stringify([
        { effective_from_date: '2026-01-05', weekdays: [1, 2, 3, 4, 5, 6, 7], target_per_day: 2 },
      ]),
      created_at: '2026-01-05T08:00:00.000Z',
      updated_at: '2026-01-11T08:00:00.000Z',
      deleted_at: null,
    },
  ],
  habit_completions: [
    {
      _entity: 'habit_completions',
      id: 'hcmp_1786000000001_abcdef12',
      habit_id: HABIT_ID,
      date_key: '2026-01-08',
      count: 2,
      created_at: '2026-01-08T08:00:00.000Z',
      updated_at: '2026-01-08T08:00:00.000Z',
    },
    {
      _entity: 'habit_completions',
      id: 'hcmp_1786000000002_abcdef12',
      habit_id: HABIT_ID,
      date_key: '2026-01-09',
      count: 2,
      created_at: '2026-01-09T08:00:00.000Z',
      updated_at: '2026-01-09T08:00:00.000Z',
    },
    {
      _entity: 'habit_completions',
      id: 'hcmp_1786000000003_abcdef12',
      habit_id: HABIT_ID,
      date_key: '2026-01-10',
      count: 1,
      created_at: '2026-01-10T08:00:00.000Z',
      updated_at: '2026-01-10T08:00:00.000Z',
    },
  ],
  calorie_entries: [
    {
      _entity: 'calorie_entries',
      id: 'cal_1786000000000_abcdef12',
      food_name: 'Oatmeal',
      calories: 300,
      protein: 10,
      carbs: 40,
      fats: 5,
      fiber: 4,
      meal_type: 'breakfast',
      consumed_on: '2026-01-10',
      created_at: '2026-01-10T07:30:00.000Z',
      updated_at: '2026-01-10T07:30:00.000Z',
      deleted_at: null,
    },
  ],
  saved_meals: [
    {
      _entity: 'saved_meals',
      id: 'smeal_1786000000000_abcdef12',
      food_name: 'Oatmeal',
      calories: 300,
      protein: 10,
      carbs: 40,
      fats: 5,
      fiber: 4,
      meal_type: 'breakfast',
      use_count: 4,
      last_used_at: '2026-01-10T07:30:00.000Z',
      created_at: '2026-01-01T07:30:00.000Z',
    },
  ],
  workout_routines: [
    {
      _entity: 'workout_routines',
      id: ROUTINE_ID,
      name: 'Push day',
      description: 'Chest, shoulders, triceps',
      created_at: '2026-01-02T09:00:00.000Z',
      updated_at: '2026-01-10T09:00:00.000Z',
      deleted_at: null,
    },
  ],
  routine_exercises: [
    {
      _entity: 'routine_exercises',
      id: EXERCISE_ID,
      routine_id: ROUTINE_ID,
      name: 'Bench press',
      sort_order: 1,
      created_at: '2026-01-02T09:05:00.000Z',
      updated_at: '2026-01-02T09:05:00.000Z',
      deleted_at: null,
    },
  ],
  routine_exercise_sets: [
    {
      _entity: 'routine_exercise_sets',
      id: SET_ID,
      exercise_id: EXERCISE_ID,
      set_number: 1,
      active_seconds: 40,
      rest_seconds: 20,
      created_at: '2026-01-02T09:10:00.000Z',
      updated_at: '2026-01-02T09:10:00.000Z',
      deleted_at: null,
    },
  ],
  workout_logs: [
    {
      _entity: 'workout_logs',
      id: LOG_ID,
      routine_id: ROUTINE_ID,
      notes: 'Felt strong',
      completed_at: '2026-01-10T18:00:00.000Z',
      created_at: '2026-01-10T18:00:00.000Z',
    },
  ],
  workout_session_exercises: [
    {
      _entity: 'workout_session_exercises',
      id: SESSION_EX_ID,
      log_id: LOG_ID,
      exercise_name: 'Bench press',
      sets_completed: 3,
      created_at: '2026-01-10T18:00:00.000Z',
    },
  ],
  pomodoro_sessions: [
    {
      _entity: 'pomodoro_sessions',
      id: 'pom_1786000000000_abcdef12',
      started_at: '2026-01-10T09:00:00.000Z',
      ended_at: '2026-01-10T09:50:00.000Z',
      duration_seconds: 3000,
      session_type: 'focus',
      created_at: '2026-01-10T09:50:00.000Z',
    },
  ],
  linked_action_rules: [
    {
      _entity: 'linked_action_rules',
      id: RULE_ID,
      status: 'active',
      direction_policy: 'one_way',
      bidirectional_group_id: null,
      source_feature: 'todos',
      source_entity_type: 'todo',
      source_entity_id: TODO_ID,
      trigger_type: 'todo.completed',
      target_feature: 'habits',
      target_entity_type: 'habit',
      target_entity_id: HABIT_ID,
      effect_type: 'habit.increment',
      effect_payload: '{"amount":1,"dateStrategy":"source_date"}',
      created_at: '2026-01-05T10:00:00.000Z',
      updated_at: '2026-01-05T10:00:00.000Z',
      deleted_at: null,
    },
  ],
  weekly_reviews: [],
};

const BACKUP_ENTITIES = [
  'todos',
  'habits',
  'habit_completions',
  'calorie_entries',
  'saved_meals',
  'workout_routines',
  'routine_exercises',
  'routine_exercise_sets',
  'workout_logs',
  'workout_session_exercises',
  'pomodoro_sessions',
  'linked_action_rules',
  'weekly_reviews',
];

function buildManifest(): Record<string, unknown> {
  const entityMetadata: Record<string, { count: number; checksum: string }> = {};
  for (const entity of BACKUP_ENTITIES) {
    entityMetadata[entity] = entityChecksum(REMOTE_BACKUP[entity] ?? []);
  }
  return {
    user_id: 'dummy-anon',
    backup_schema_version: 2,
    generation: 1,
    completed_at: '2026-01-11T12:00:00.000Z',
    entity_metadata: entityMetadata,
    settings_version: 2,
    settings_metadata: { version: 2, checksum: settingsChecksum(SETTINGS_PAYLOAD) },
    updated_at: '2026-01-11T12:00:00.000Z',
  };
}

const MANIFEST_ROW = buildManifest();

// ---------------------------------------------------------------------------
// Dummy-Supabase request handler (mirrors new-phone.spec.ts + V2 surfaces).
// ---------------------------------------------------------------------------

const REMOTE_HEADERS = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-expose-headers': 'content-range',
};

let upsertCount = 0;

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
  const q = url.searchParams;

  if (method === 'POST' || method === 'PATCH') {
    upsertCount += 1;
    return route.fulfill({ status: 201, headers: REMOTE_HEADERS, body: '[]' });
  }

  if (entity === 'backup_manifest') {
    return route.fulfill({
      status: 200,
      headers: REMOTE_HEADERS,
      body: JSON.stringify([MANIFEST_ROW]),
    });
  }

  if (entity === 'user_backup_settings') {
    // Restore V2 fetches the full owner-scoped settings row and verifies it
    // (version + canonical checksum) against the manifest BEFORE importing.
    return route.fulfill({
      status: 200,
      headers: REMOTE_HEADERS,
      body: JSON.stringify([
        {
          user_id: 'dummy-anon',
          settings_version: 2,
          payload: SETTINGS_PAYLOAD,
          updated_at: '2026-01-11T12:00:00.000Z',
        },
      ]),
    });
  }

  const rows: Record<string, unknown>[] = (REMOTE_BACKUP[entity] ?? []).map((row) => {
    const { _entity: _marker, ...rest } = row;
    return { ...rest, user_id: 'dummy-anon' };
  });
  const active = rows.filter((row) => row.deleted_at == null);

  if (q.get('select') === 'updated_at') {
    const latest = [...active].sort((a, b) =>
      String(b.updated_at).localeCompare(String(a.updated_at)),
    )[0];
    return route.fulfill({
      status: 200,
      headers: REMOTE_HEADERS,
      body: JSON.stringify(latest ? [{ updated_at: latest.updated_at }] : []),
    });
  }

  if (method === 'HEAD') {
    return route.fulfill({
      status: 200,
      headers: { ...REMOTE_HEADERS, 'content-range': `0-0/${active.length}` },
      body: '[]',
    });
  }

  if (q.get('select') === '*') {
    return route.fulfill({
      status: 200,
      headers: { ...REMOTE_HEADERS, 'content-range': `0-${rows.length - 1}/${rows.length}` },
      body: JSON.stringify(rows),
    });
  }

  return route.fulfill({
    status: 200,
    headers: { ...REMOTE_HEADERS, 'content-range': `0-0/${active.length}` },
    body: '[]',
  });
}

async function installMockRemoteBackup(page: Page): Promise<void> {
  await page.route('**/*.supabase.co/**', handleDummySupabaseRequest);
}

const PROMPT_SUBTITLE =
  'A remote backup is available and this device is still empty for user data.';

function restorePromptVisible(page: Page): Promise<boolean> {
  return page
    .getByRole('button', { name: 'Restore backup', exact: true })
    .first()
    .waitFor({ state: 'visible', timeout: 8_000 })
    .then(() => true)
    .catch(() => false);
}

defineJourney({
  persona: 'P6 — Jordan, the New Device Migrator (complete backup)',
  goal: 'restore a COMPLETE V2 backup onto a pristine device and verify semantic equivalence, no side-effect replay, and continued sync',
  tags: ['@p6', '@sync'],
  risks: ['R3'],
  steps: [
    {
      name: 'empty device detects the V2 restore boundary',
      run: async ({ page }) => {
        await installMockRemoteBackup(page);
        await resetAll(page);
        await returnToApp(page);
        remoteBackupDetected = await restorePromptVisible(page);
        await returnToApp(page);
      },
    },
    {
      name: 'accept the restore and verify full semantic equivalence',
      run: async ({ page }) => {
        test.fixme(
          !remoteBackupDetected,
          'this standard dist/ build has no Supabase-backed remote, so the V2 import cannot run — runs in the journeys-sync lane against dist-sync/',
        );
        await page.getByRole('button', { name: 'Restore backup', exact: true }).first().click();
        await expect(page.getByText(PROMPT_SUBTITLE)).toBeHidden({ timeout: 20_000 });

        // Settings now shows the complete-V2 coverage state.
        await page.getByRole('button', { name: 'Open settings' }).click();
        await expect(page.getByText('Complete (V2)').first()).toBeVisible({ timeout: 10_000 });
        await expect(
          page.getByText(/A verified complete V2 backup exists\./).first(),
        ).toBeVisible();
        await page.getByRole('button', { name: 'Close' }).first().click();

        // Every recoverable entity arrived.
        await expectRows(
          page,
          `
          SELECT
            (SELECT COUNT(*) FROM todos) AS todos,
            (SELECT COUNT(*) FROM habits) AS habits,
            (SELECT COUNT(*) FROM habit_completions) AS completions,
            (SELECT COUNT(*) FROM calorie_entries) AS calorie_entries,
            (SELECT COUNT(*) FROM saved_meals) AS saved_meals,
            (SELECT COUNT(*) FROM pomodoro_sessions) AS pomodoro_sessions,
            (SELECT COUNT(*) FROM workout_routines) AS routines,
            (SELECT COUNT(*) FROM routine_exercises) AS exercises,
            (SELECT COUNT(*) FROM routine_exercise_sets) AS sets,
            (SELECT COUNT(*) FROM workout_logs) AS logs,
            (SELECT COUNT(*) FROM workout_session_exercises) AS session_exercises,
            (SELECT COUNT(*) FROM linked_action_rules) AS rules
          `,
          (rows) => {
            const r = rows[0];
            expect(
              [
                r.todos,
                r.habits,
                r.completions,
                r.calorie_entries,
                r.saved_meals,
                r.pomodoro_sessions,
                r.routines,
                r.exercises,
                r.sets,
                r.logs,
                r.session_exercises,
                r.rules,
              ].map(Number),
            ).toEqual([1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
          },
        );

        // Settings restored (calorie goal + pomodoro defaults).
        await expectRows(page, "SELECT value FROM app_meta WHERE key = 'calorie_goal'", (rows) => {
          const goal = JSON.parse(String(rows[0]?.value ?? '{}')) as { calories?: number };
          expect(goal.calories).toBe(2100);
        });
        await expectRows(
          page,
          "SELECT value FROM app_meta WHERE key = 'pomodoro_settings'",
          (rows) => {
            const settings = JSON.parse(String(rows[0]?.value ?? '{}')) as {
              focusMinutes?: number;
            };
            expect(settings.focusMinutes).toBe(50);
          },
        );

        // Theme restored through the durable cross-store reconciliation:
        // AsyncStorage is written AFTER the SQLite import commits (and the
        // pending-application marker is cleared only on success).
        await expect
          .poll(async () => page.evaluate(() => localStorage.getItem('superhabits.theme.mode')), {
            timeout: 10_000,
          })
          .toBe('dark');
        await expect
          .poll(
            async () => page.evaluate(() => localStorage.getItem('superhabits.theme.slots.v2')),
            { timeout: 10_000 },
          )
          .toBe('{"lightThemeId":"ocean","darkThemeId":"midnight"}');
        // No pending theme application remains — the durable marker cleared.
        await expectRows(
          page,
          "SELECT value FROM app_meta WHERE key = 'backup.pending_theme_apply'",
          (rows) => {
            expect(rows[0]?.value ?? 'null').toBe('null');
          },
        );

        // Workout structure + history intact.
        await expectRows(
          page,
          'SELECT name FROM routine_exercises WHERE routine_id = (SELECT id FROM workout_routines LIMIT 1)',
          (rows) => {
            expect(rows[0]?.name).toBe('Bench press');
          },
        );

        // Saved meal use_count preserved (import is not usage).
        await expectRows(
          page,
          "SELECT use_count FROM saved_meals WHERE food_name = 'Oatmeal'",
          (rows) => {
            expect(Number(rows[0]?.use_count)).toBe(4);
          },
        );

        // NO historical side effects: empty linked-action ledgers, empty
        // outbox, and no future reminder records for past dates.
        await expectRows(
          page,
          `
          SELECT
            (SELECT COUNT(*) FROM linked_action_events) AS events,
            (SELECT COUNT(*) FROM linked_action_executions) AS executions,
            (SELECT COUNT(*) FROM sync_outbox) AS outbox,
            (SELECT COUNT(*) FROM processed_notification_actions) AS processed
          `,
          (rows) => {
            const r = rows[0];
            expect([r.events, r.executions, r.outbox, r.processed].map(Number)).toEqual([
              0, 0, 0, 0,
            ]);
          },
        );
      },
    },
    {
      name: 'new activity syncs normally and the restored rule fires exactly once',
      run: async ({ page }) => {
        test.fixme(
          !remoteBackupDetected,
          'the sync boundary needs the dummy-Supabase build — runs in the journeys-sync lane against dist-sync/',
        );
        // Reload first: the previous step ended on the DB harness (SQL
        // oracles). This reload also exercises the post-restore bootstrap
        // (backfill of restored rows + re-push against the remote).
        await returnToApp(page);
        // Complete the restored todo: the restored linked-action rule must
        // fire EXACTLY once (habit.increment on today).
        await page.getByRole('button', { name: 'To Do', exact: true }).click();
        const activeSection = page.locator(ACTIVE_SECTION_SELECTOR);
        await expect(activeSection.getByText('Restored V2 task').first()).toBeVisible({
          timeout: 10_000,
        });
        const todoCheckbox = activeSection.getByRole('checkbox', {
          name: /^Mark complete: Restored V2 task$/,
        });
        await todoCheckbox.click({ force: true });
        // DOM-only wait (SQL oracles would navigate away and abort the
        // in-flight toggle transaction): completing the todo moves it into
        // the collapsed "completed" list, so the reveal toggle appears.
        await expect(activeSection.getByText(/Show completed \(\d+\)/).first()).toBeVisible({
          timeout: 10_000,
        });
        // Row-level: the restored todo is now completed (the toggle committed).
        await expect
          .poll(
            async () =>
              Number(
                (await queryRows(page, `SELECT completed FROM todos WHERE id = '${TODO_ID}'`))[0]
                  ?.completed ?? 0,
              ),
            { timeout: 10_000 },
          )
          .toBe(1);

        // The rule executed once: exactly one linked-action execution exists.
        await expectRows(page, 'SELECT COUNT(*) AS n FROM linked_action_executions', (rows) => {
          expect(Number(rows[0]?.n ?? 0)).toBe(1);
        });
        // And the habit completion for today incremented once.
        await expectRows(
          page,
          `
          SELECT COUNT(*) AS n
          FROM habit_completions
          WHERE habit_id = '${HABIT_ID}'
            AND date_key = strftime('%Y-%m-%d', 'now', 'localtime')
          `,
          (rows) => {
            expect(Number(rows[0]?.n ?? 0)).toBe(1);
          },
        );

        // The new mutation reaches the remote on the next flush. The SQL
        // oracles above left the page on the DB harness; reload so the app
        // (and its flush interval) is live again.
        await returnToApp(page);
        await expect.poll(() => upsertCount, { timeout: 45_000 }).toBeGreaterThanOrEqual(1);
      },
    },
  ],
});
