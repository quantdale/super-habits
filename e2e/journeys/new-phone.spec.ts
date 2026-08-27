import { expect, test, type Page, type Route } from '@playwright/test';
import { defineJourney } from '../helpers/journey';
import { expectRows } from '../helpers/oracles';
import { returnToApp } from '../helpers/dbHarness';
import { resetAll } from '../helpers/reset';
import { seedSql } from '../helpers/seed';

/**
 * J5 — "New phone" (P6, Jordan the New Device Migrator).
 *
 * Empty device with a remote backup available → restore prompt appears at
 * bootstrap → dismiss it ("Not now") → reload (prompt must not reappear for
 * the same backup signature) → add one todo → restore is now blocked with the
 * local-data-present message. Second run: accept the restore and verify the
 * imported rows, the disclosures shown, and — critically — that habit
 * completion history, saved meals, pomodoro sessions and workout logs did NOT
 * come back, so streaks read 0. A third branch covers D10's decided contract
 * on a device holding only soft-deleted rows.
 *
 * Restore ROUND-TRIP / remote boundary: the restore flow requires a
 * Supabase-backed remote to restore FROM. That boundary only exists in the
 * dummy-Supabase `dist-sync/` build (Q5, task 6.1a) — the standard `dist/`
 * build has no Supabase env bundled, so `supabase` is null and
 * `getRestorePreview()` reports `remote_backup_unavailable`. In that build the
 * restore prompt can never appear and no import can run.
 *
 * Strategy (see tasks.md 4.5 and design.md D5/Q5):
 * - Step 1 always runs: it resets to an empty device, loads the app, and
 *   detects whether a restore boundary is actually present (the prompt appears
 *   at bootstrap iff `remoteAvailable`, which requires a Supabase-backed build).
 * - Branches that need the live remote boundary are gated per step with
 *   `test.fixme(!remoteBackupDetected, ...)`: in the dedicated `journeys-sync`
 *   project (dummy-Supabase `dist-sync/` build, task 6.1a/Q5, `npm run
 *   e2e:sync`) the mock backup makes the prompt appear and the branches run
 *   for real; in the standard `dist/` build they show as skipped fixmes
 *   naming the lane. This is the D13 protocol applied to transport
 *   availability: the branch is written against the real contract and runs
 *   when the lane exists; it is never weakened to force a pass.
 * - The "restore blocked when non-empty" + "no re-prompt after dismiss" +
 *   "what is not restored" contracts are asserted where the app exposes them
 *   WITHOUT a remote too (the local-data-present eligibility gate, the
 *   dismissal signature row, and the not-restored row counts).
 */

// Module-level result of the step-1 detection. Steps run serially in one
// worker, so this is set before any boundary-dependent step runs.
let remoteBackupDetected = false;

// ---------------------------------------------------------------------------
// Mock remote backup (an "old device's" Supabase backup).
//
// Remote behaviour is never exercised against a live Supabase project (D5).
// The dist-sync/ build bundles dummy EXPO_PUBLIC_SUPABASE_* env (Q5, task
// 6.1a). Every request the app makes to that origin is answered here. The
// payload mirrors what the sync engine actually pushes: todos, habits and
// calorie_entries only — habit_completions, saved_meals, pomodoro_sessions and
// workout logs never reach the backup, so they must not come back on restore.
// The host is the `.supabase.co` glob the failure injectors already target.
// ---------------------------------------------------------------------------

const REMOTE_BACKUP: Record<string, Record<string, unknown>[]> = {
  todos: [
    {
      // IDs must satisfy the production backup-row contract (createId shape:
      // {prefix}_{ms}_{rand}, enforced by validateBackupRow on the restore
      // path) — restored remote rows are validated before import.
      id: 'todo_1768035600000_a1b2c3d4',
      title: 'Restored task',
      notes: null,
      completed: 0,
      due_date: null,
      priority: 'normal',
      sort_order: 0,
      recurrence: null,
      recurrence_id: null,
      created_at: '2026-01-10T09:00:00.000Z',
      updated_at: '2026-01-11T09:00:00.000Z',
      deleted_at: null,
    },
    {
      id: 'todo_1768039200000_e5f6a7b8',
      title: 'Restored done task',
      notes: 'from backup',
      completed: 1,
      due_date: null,
      priority: 'low',
      sort_order: 1,
      recurrence: null,
      recurrence_id: null,
      created_at: '2026-01-10T10:00:00.000Z',
      updated_at: '2026-01-11T10:00:00.000Z',
      deleted_at: null,
    },
  ],
  habits: [
    {
      id: 'habit_1767600000000_c9d0e1f2',
      name: 'Hydrate',
      target_per_day: 3,
      // Required by the production backup-row contract (effective-dated
      // schedule history, migration 16+): JSON string of dated rules.
      rule_history:
        '[{"effective_from_date":"2026-01-05","weekdays":[1,2,3,4,5,6,7],"target_per_day":3}]',
      reminder_time: null,
      category: 'anytime',
      icon: 'water-drop',
      color: '#3b82f6',
      created_at: '2026-01-05T08:00:00.000Z',
      updated_at: '2026-01-11T08:00:00.000Z',
      deleted_at: null,
    },
  ],
  calorie_entries: [
    {
      id: 'cal_1768030200000_b3c4d5e6',
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
  workout_routines: [],
};

const REMOTE_HEADERS = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  // supabase-js reads the row count from the `content-range` header on count
  // (HEAD) requests; expose it so the browser lets the page read it.
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

  // Auth: keep ensureAnonymousSession quiet (the app catches failures anyway).
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

  const match = path.match(/^\/rest\/v1\/(todos|habits|calorie_entries|workout_routines)$/);
  if (!match) {
    // A pre-V2 server has no backup_manifest/user_backup_settings tables;
    // PostgREST answers with PGRST205 (relation does not exist). The app must
    // recognize that as a legacy-only backup, not a corrupt one.
    return route.fulfill({
      status: 404,
      headers: REMOTE_HEADERS,
      body: JSON.stringify({
        code: 'PGRST205',
        details: 'pre-V2 dummy backend',
        hint: null,
        message: 'relation "public.backup_manifest" does not exist',
      }),
    });
  }

  const entity = match[1];
  const rows = REMOTE_BACKUP[entity] ?? [];
  const active = rows.filter((row) => row.deleted_at == null);
  const q = url.searchParams;

  // Latest-updated-at probe (checks the backup's freshness signature).
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

  // Row-count probe (eligibility: is there a non-empty restorable backup?).
  if (method === 'HEAD') {
    return route.fulfill({
      status: 200,
      headers: { ...REMOTE_HEADERS, 'content-range': `0-0/${active.length}` },
      body: '[]',
    });
  }

  // Full row fetch during restore.
  if (q.get('select') === '*') {
    return route.fulfill({
      status: 200,
      headers: { ...REMOTE_HEADERS, 'content-range': `0-${rows.length - 1}/${rows.length}` },
      body: JSON.stringify(rows),
    });
  }

  // Any other read/write (e.g. a sync push after the user adds a todo) →
  // minimal success.
  return route.fulfill({
    status: 200,
    headers: { ...REMOTE_HEADERS, 'content-range': `0-0/${active.length}` },
    body: '[]',
  });
}

async function installMockRemoteBackup(page: Page): Promise<void> {
  await page.route('**/*.supabase.co/**', handleDummySupabaseRequest);
  await page.context().route('**/*.supabase.co/**', handleDummySupabaseRequest);
}

// --- SQL oracles ------------------------------------------------------------

const EMPTY_DEVICE_SQL = `
  SELECT
    (SELECT COUNT(*) FROM todos) AS todos,
    (SELECT COUNT(*) FROM habits) AS habits,
    (SELECT COUNT(*) FROM calorie_entries) AS calorie_entries,
    (SELECT COUNT(*) FROM workout_routines) AS workout_routines
`;

const NOT_RESTORED_SQL = `
  SELECT
    (SELECT COUNT(*) FROM habit_completions) AS completions,
    (SELECT COUNT(*) FROM saved_meals) AS saved_meals,
    (SELECT COUNT(*) FROM pomodoro_sessions) AS pomodoro_sessions,
    (SELECT COUNT(*) FROM workout_logs) AS workout_logs,
    (SELECT COUNT(*) FROM routine_exercises) AS routine_exercises,
    (SELECT COUNT(*) FROM routine_exercise_sets) AS routine_exercise_sets
`;

const PROMPT_SUBTITLE =
  'A remote backup is available and this device is still empty for user data.';
const LOCAL_DATA_PRESENT_MESSAGE =
  'Restore is only available on an empty device. Any local user data — including history such as focus sessions or workout logs — blocks import.';

const EMPTY_DEVICE_MESSAGE =
  'This device is empty for user data, so importing the remote backup is allowed.';

/** The restore prompt is present iff the app surfaced a restorable remote. */
function restorePromptVisible(page: Page): Promise<boolean> {
  return page
    .getByRole('button', { name: 'Restore backup', exact: true })
    .first()
    .waitFor({ state: 'visible', timeout: 8_000 })
    .then(() => true)
    .catch(() => false);
}

defineJourney({
  persona: 'P6 — Jordan, the New Device Migrator',
  goal: 'restore prompt lifecycle: dismiss → no re-prompt → blocked after local data → accept restore and verify what does not come back',
  tags: ['@p6', '@sync'],
  risks: ['R3'],
  steps: [
    {
      name: 'reset to an empty device and detect whether this build has a remote restore boundary',
      run: async ({ page }) => {
        // The mock must be installed before the first app load so bootstrap's
        // getRestorePreview() can discover the backup on the dist-sync/ lane.
        await installMockRemoteBackup(page);
        await resetAll(page);
        await returnToApp(page);

        // A restore boundary is present iff the empty-device prompt appears at
        // bootstrap (remoteAvailable && empty && not dismissed). Standard
        // dist/ has no Supabase env → no prompt → boundary absent.
        remoteBackupDetected = await restorePromptVisible(page);

        // Row-level: this is genuinely an empty device (zero rows in every
        // sync-backed table). The schema is bootstrapped by the app load above.
        await expectRows(page, EMPTY_DEVICE_SQL, (rows) => {
          const r = rows[0];
          expect([r.todos, r.habits, r.calorie_entries, r.workout_routines].map(Number)).toEqual([
            0, 0, 0, 0,
          ]);
        });

        // Return to the app fresh. On the dist-sync/ lane the (still-undismissed)
        // prompt is present again for the next step; on standard dist/ there is
        // no prompt and the boundary steps are released as fixme below.
        await returnToApp(page);
      },
    },
    {
      name: 'dismiss the restore prompt ("Not now")',
      run: async ({ page }) => {
        test.fixme(
          !remoteBackupDetected,
          'this standard dist/ build has no Supabase-backed remote, so no restore prompt is observable — runs in the journeys-sync lane against dist-sync/ (task 6.1a / Q5)',
        );
        await page.getByRole('button', { name: 'Not now', exact: true }).click();
        await expect(page.getByText(PROMPT_SUBTITLE)).toBeHidden();
      },
    },
    {
      name: 'reload: the dismissed prompt does not reappear, restore stays available in Settings',
      run: async ({ page }) => {
        test.fixme(
          !remoteBackupDetected,
          'this standard dist/ build has no Supabase-backed remote, so no restore prompt is observable — runs in the journeys-sync lane against dist-sync/ (task 6.1a / Q5)',
        );
        // Dismissal persists as a column-less signature in app_meta.
        await expectRows(
          page,
          "SELECT value FROM app_meta WHERE key = 'restore_prompt_dismissed_signature'",
          (rows) => {
            expect(rows).toHaveLength(1);
            expect(String(rows[0]?.value ?? '')).not.toBe('');
          },
        );
        // Hard reload → no re-prompt for the same backup signature.
        await returnToApp(page);
        await expect(page.getByText(PROMPT_SUBTITLE)).toHaveCount(0);
        // Independent surface: dismissal suppressed only the prompt, not restore.
        // Settings still reports the device as empty and eligible.
        await page.getByRole('button', { name: 'Open settings' }).click();
        await expect(page.getByText(EMPTY_DEVICE_MESSAGE)).toBeVisible();
        await expect(page.getByText('Allowed').first()).toBeVisible();
        await expect(page.getByRole('button', { name: 'Restore backup' }).first()).toBeEnabled();
        await page.getByRole('button', { name: 'Close' }).first().click();
      },
    },
    {
      name: 'add a todo → restore is now blocked (device non-empty)',
      run: async ({ page }) => {
        // This contract holds on BOTH builds: eligibility is gated on local
        // rows before remote availability, so adding a todo blocks restore
        // regardless of whether a remote boundary exists.
        await page.getByRole('button', { name: 'To Do', exact: true }).click();
        await page.getByRole('button', { name: 'Add task' }).last().click();
        await page.getByPlaceholder(/Add a task/i).fill('New phone todo');
        await page.getByText('Add task', { exact: true }).locator('..').click({ force: true });
        await expect(page.getByText('New phone todo').first()).toBeVisible();

        // Row-level: exactly one todo row, not zero and not duplicated.
        await expectRows(
          page,
          "SELECT COUNT(*) AS n FROM todos WHERE title = 'New phone todo' AND deleted_at IS NULL",
          (rows) => {
            expect(Number(rows[0]?.n ?? 0)).toBe(1);
          },
        );

        // The one-way door: Settings now reports restore as blocked.
        await returnToApp(page);
        await page.getByRole('button', { name: 'Open settings' }).click();
        const blockedMessage = page.getByText(LOCAL_DATA_PRESENT_MESSAGE);
        await blockedMessage.scrollIntoViewIfNeeded();
        await expect(blockedMessage).toBeVisible();
        await expect(page.getByText('Blocked').first()).toBeVisible();
        await expect(page.getByRole('button', { name: 'Restore backup' }).first()).toBeDisabled();
        await page.getByRole('button', { name: 'Close' }).first().click();

        // Negative oracle: the device is non-empty, so a reload must not
        // surface a restore prompt either.
        await returnToApp(page);
        await expect(page.getByText(PROMPT_SUBTITLE)).toHaveCount(0);
      },
    },
    {
      name: 'second device: accept the restore and verify imported rows',
      run: async ({ page }) => {
        test.fixme(
          !remoteBackupDetected,
          'the import needs a Supabase-backed remote to restore FROM — runs in the journeys-sync lane against dist-sync/ (task 6.1a / Q5)',
        );
        // Fresh device (second pass): the prompt reappears because nothing was
        // dismissed on this device.
        await resetAll(page);
        await returnToApp(page);
        await expect(page.getByText(PROMPT_SUBTITLE)).toBeVisible();
        // The disclosures are shown before accepting.
        await expect(
          page.getByText(
            'Habits restore definitions only (phase-one restore surface). Habit completion history is included in Backup V2 restore.',
          ),
        ).toBeVisible();
        await expect(
          page.getByText(
            'Calories restore entries only (phase-one restore surface). Saved meals are included in Backup V2 restore.',
          ),
        ).toBeVisible();

        await page.getByRole('button', { name: 'Restore backup', exact: true }).first().click();
        // On success the prompt closes (resolveRestorePromptOutcome dismisses).
        await expect(page.getByText(PROMPT_SUBTITLE)).toBeHidden({ timeout: 15_000 });

        // Row-level: exactly the backed-up rows were imported.
        await expectRows(
          page,
          `
          SELECT
            (SELECT COUNT(*) FROM todos) AS todos,
            (SELECT COUNT(*) FROM habits) AS habits,
            (SELECT COUNT(*) FROM calorie_entries) AS calorie_entries
          `,
          (rows) => {
            const r = rows[0];
            expect([r.todos, r.habits, r.calorie_entries].map(Number)).toEqual([2, 1, 1]);
          },
        );
        // The restore is recorded.
        await expectRows(
          page,
          "SELECT value FROM app_meta WHERE key = 'last_restore_at'",
          (rows) => {
            expect(rows).toHaveLength(1);
            expect(String(rows[0]?.value ?? '')).not.toBe('');
          },
        );
      },
    },
    {
      name: 'what did NOT come back: no completions, saved meals, pomodoro sessions or workout logs; streaks read 0',
      run: async ({ page }) => {
        test.fixme(
          !remoteBackupDetected,
          'the import needs a Supabase-backed remote to restore FROM — runs in the journeys-sync lane against dist-sync/ (task 6.1a / Q5)',
        );
        // Negative row oracle: every local-only entity is absent after restore.
        await expectRows(page, NOT_RESTORED_SQL, (rows) => {
          const r = rows[0];
          expect(
            [
              r.completions,
              r.saved_meals,
              r.pomodoro_sessions,
              r.workout_logs,
              r.routine_exercises,
              r.routine_exercise_sets,
            ].map(Number),
          ).toEqual([0, 0, 0, 0, 0, 0]);
        });

        // Positive UI: the imported habit survived, but with no completion
        // history its streak is 0 — the "Best streak" stat reads zero.
        await returnToApp(page);
        await page.getByRole('button', { name: 'Habits', exact: true }).click();
        await expect(page.getByText('Hydrate').first()).toBeVisible();
        // Scope the streak value to the StatBlock labelled "Best streak".
        const bestStreakBlock = page.getByText('Best streak').first().locator('..');
        await expect(bestStreakBlock.getByText('0')).toBeVisible();
      },
    },
    {
      name: 'CG-2: a device holding only soft-deleted rows is not empty (decided contract)',
      run: async ({ page }) => {
        // CG-2 (D10): the decided contract is that a
        // device which has EVER held sync-backed rows is not empty, so a
        // device whose only synced rows are soft-deleted must NOT be prompted
        // and must NOT accept a restore (a stale backup would resurrect the
        // user's deleted todo). The count includes tombstones, so this device
        // is non-empty. The branch runs against the remote boundary in the
        // journeys-sync lane (task 6.1a).

        await resetAll(page);
        await returnToApp(page);
        // Seed a soft-deleted todo: the device has "history" but zero active rows.
        await seedSql(
          page,
          "INSERT INTO todos (id,title,notes,completed,created_at,updated_at,deleted_at,due_date,priority,sort_order,recurrence,recurrence_id) VALUES ('todo_deleted_1','Deleted todo',NULL,0,'2026-01-01T09:00:00.000Z','2026-01-02T09:00:00.000Z','2026-01-02T10:00:00.000Z',NULL,'normal',0,NULL,NULL)",
        );
        await returnToApp(page);
        // Decided contract: not an empty device → no restore prompt, restore
        // blocked with the local-data-present gate.
        await expect(page.getByText(PROMPT_SUBTITLE)).toHaveCount(0);
        await page.getByRole('button', { name: 'Open settings' }).click();
        const blockedMessage = page.getByText(LOCAL_DATA_PRESENT_MESSAGE);
        await blockedMessage.scrollIntoViewIfNeeded();
        await expect(blockedMessage).toBeVisible();
        await expect(page.getByRole('button', { name: 'Restore backup' }).first()).toBeDisabled();
      },
    },
  ],
});
