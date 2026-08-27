import { expect, test, type Page, type Route } from '@playwright/test';
import { defineJourney } from '../helpers/journey';
import { installClock } from '../helpers/clock';
import { openSettingsScreen } from '../helpers/commandObservation';
import { queryRows, returnToApp } from '../helpers/dbHarness';
import { expectRows } from '../helpers/oracles';
import { TAB_LABELS } from '../helpers/navigation';
import { resetAll } from '../helpers/reset';
import { handleBackupRestRequest } from '../helpers/accountSupabaseMock';

const SUPABASE_ROUTE = '**/*.supabase.co/**';
const ANONYMOUS_USER = {
  id: '00000000-0000-0000-0000-000000000101',
  aud: 'authenticated',
  role: 'authenticated',
  email: null,
  is_anonymous: true,
};
const PERMANENT_USER = {
  id: ANONYMOUS_USER.id,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'recover@example.com',
  is_anonymous: false,
};
const WRONG_USER = {
  id: '00000000-0000-0000-0000-000000000202',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'other@example.com',
  is_anonymous: false,
};
const BACKUP_TODO = {
  // ID must satisfy the production backup-row contract (createId shape:
  // {prefix}_{ms}_{rand}, enforced by validateBackupRow on the restore path).
  id: 'todo_1786694400000_a1b2c3d4',
  title: 'Recovered from backup',
  notes: null,
  completed: 0,
  due_date: null,
  priority: 'normal',
  sort_order: 0,
  recurrence: null,
  recurrence_id: null,
  created_at: '2026-08-14T08:00:00.000Z',
  updated_at: '2026-08-14T08:00:00.000Z',
  deleted_at: null,
  user_id: PERMANENT_USER.id,
};

const JSON_HEADERS = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-expose-headers': 'content-range',
};

let currentUser: typeof ANONYMOUS_USER | typeof PERMANENT_USER = ANONYMOUS_USER;
let requestShouldCreateUser: boolean | null = null;
let supabaseRequestsSeen = 0;
let verifyUserOverride: typeof ANONYMOUS_USER | typeof PERMANENT_USER | typeof WRONG_USER | null =
  null;
let pushedTodoUserIds: string[] = [];

function sessionBody(user: typeof currentUser) {
  const now = Math.floor(Date.now() / 1_000);
  return {
    access_token: `account-v1-${user.is_anonymous ? 'anonymous' : 'permanent'}-token`,
    token_type: 'bearer',
    expires_in: 3_600,
    expires_at: now + 3_600,
    refresh_token: `account-v1-${user.is_anonymous ? 'anonymous' : 'permanent'}-refresh`,
    user,
  };
}

async function handleAccountMock(route: Route): Promise<void> {
  supabaseRequestsSeen += 1;
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname;
  const method = request.method();

  if (method === 'OPTIONS') {
    await route.fulfill({
      status: 204,
      headers: {
        ...JSON_HEADERS,
        'access-control-allow-methods': 'GET, POST, PATCH, DELETE, PUT, OPTIONS',
      },
    });
    return;
  }

  if (path === '/auth/v1/user') {
    if (!request.headers().authorization?.startsWith('Bearer ')) {
      await route.fulfill({
        status: 401,
        headers: JSON_HEADERS,
        body: JSON.stringify({ message: 'Auth session missing' }),
      });
      return;
    }
    await route.fulfill({ status: 200, headers: JSON_HEADERS, body: JSON.stringify(currentUser) });
    return;
  }

  if (path === '/auth/v1/signup' && method === 'POST') {
    currentUser = ANONYMOUS_USER;
    await route.fulfill({
      status: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify(sessionBody(currentUser)),
    });
    return;
  }

  if (path === '/auth/v1/otp' && method === 'POST') {
    const body = request.postDataJSON() as {
      email?: string;
      create_user?: boolean;
      options?: { shouldCreateUser?: boolean };
    };
    requestShouldCreateUser = body.options?.shouldCreateUser ?? body.create_user ?? null;
    if (body.email === 'unknown@example.com') {
      await route.fulfill({
        status: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ message: 'User not found' }),
      });
      return;
    }
    await route.fulfill({ status: 200, headers: JSON_HEADERS, body: JSON.stringify({}) });
    return;
  }

  if (path === '/auth/v1/user' && method === 'PATCH') {
    await route.fulfill({ status: 200, headers: JSON_HEADERS, body: JSON.stringify(currentUser) });
    return;
  }

  if (path === '/auth/v1/verify' && method === 'POST') {
    const body = request.postDataJSON() as { token?: string; type?: string };
    if (body.token !== '123456') {
      await route.fulfill({
        status: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ message: 'Invalid or expired OTP' }),
      });
      return;
    }
    currentUser = verifyUserOverride ?? PERMANENT_USER;
    await route.fulfill({
      status: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify(sessionBody(currentUser)),
    });
    return;
  }

  if (path.startsWith('/auth/v1/')) {
    await route.fulfill({ status: 200, headers: JSON_HEADERS, body: JSON.stringify({}) });
    return;
  }

  // Shared backup-aware boundary: recognize the full production backup surface
  // (all BACKUP_ENTITIES + BACKUP_SYNTHETIC_ENTITIES) so the Account
  // Coordinator's owner-scoped remote-footprint probes never 404 against a stale
  // four-table subset and fail closed. Unknown REST tables fall through to the
  // strict 404 below.
  //
  // The restore read path mirrors the original four-table handler: the durable
  // remote Todo backup is only modeled for the verified permanent owner (the
  // original `hasBackup` case). The anonymous/temporary account must see an
  // empty remote surface so the backup prompt / RestorePrompt overlay is not
  // raised against a phantom backup during protection.
  const entityOverrides =
    currentUser.is_anonymous === false && currentUser.id === PERMANENT_USER.id
      ? { todos: { count: 1, rows: [BACKUP_TODO] } }
      : {};
  const handled = await handleBackupRestRequest(route, {
    entities: entityOverrides,
    onPostRows: (_entity, rows) => {
      for (const row of rows) {
        if (row && typeof (row as { user_id?: unknown }).user_id === 'string') {
          pushedTodoUserIds.push((row as { user_id: string }).user_id);
        }
      }
    },
  });
  if (handled === 'handled') return;

  // Unknown Supabase REST table — strict 404 so new unmodeled dependencies are
  // visible rather than silently swallowed.
  await route.fulfill({
    status: 404,
    headers: JSON_HEADERS,
    body: JSON.stringify({ message: 'not found' }),
  });
}

async function installAccountMock(page: Page): Promise<void> {
  currentUser = ANONYMOUS_USER;
  requestShouldCreateUser = null;
  supabaseRequestsSeen = 0;
  verifyUserOverride = null;
  pushedTodoUserIds = [];
  await page.unroute(SUPABASE_ROUTE).catch(() => {});
  await page
    .context()
    .unroute(SUPABASE_ROUTE)
    .catch(() => {});
  await page.context().route(SUPABASE_ROUTE, handleAccountMock);
}

function requireAccountBoundary(): void {
  test.fixme(
    supabaseRequestsSeen === 0,
    'This account boundary runs against the dummy-Supabase dist-sync export.',
  );
}

defineJourney({
  persona: 'A — Recoverable Account V1',
  goal: 'protect an anonymous owner, recover it on an empty device, and restore the backup',
  tags: ['@account-v1', '@sync'],
  risks: [
    'email protection must not change the owner UUID',
    'recover existing must send shouldCreateUser=false',
    'restore must remain empty-device-only after sign-in',
  ],
  steps: [
    {
      name: 'protect the anonymous backup with email',
      run: async ({ page }) => {
        await installAccountMock(page);
        await resetAll(page);
        await returnToApp(page);
        requireAccountBoundary();
        await openSettingsScreen(page);
        await expect(page.getByText('Anonymous / unprotected', { exact: true })).toBeVisible();
        await page.getByLabel('Email for backup recovery').fill('recover@example.com');
        await page.getByRole('button', { name: 'Protect backup with email', exact: true }).click();
        await expect(page.getByText('Verification pending', { exact: true })).toBeVisible();
        await page.getByLabel('Backup protection verification code').fill('123456');
        await page.getByRole('button', { name: 'Verify email', exact: true }).click();
        await expect(page.getByText('Protected', { exact: true })).toBeVisible();
      },
    },
    {
      name: 'recover the same account on an empty device and restore V1 data',
      run: async ({ page }) => {
        requireAccountBoundary();
        // Clearing browser Auth storage simulates a new device; reset the
        // mock server identity too so the temporary anonymous session cannot
        // expose the permanent account's backup before recovery is chosen.
        currentUser = ANONYMOUS_USER;
        await resetAll(page);
        await returnToApp(page);
        await openSettingsScreen(page);
        await expect(page.getByText('Anonymous / unprotected', { exact: true })).toBeVisible();

        await page.getByLabel('Protected account email').fill('unknown@example.com');
        await page.getByRole('button', { name: 'Recover existing backup', exact: true }).click();
        await expect(page.getByText(/could not find an existing account/i)).toBeVisible();

        await page.getByLabel('Protected account email').fill('recover@example.com');
        await page.getByRole('button', { name: 'Recover existing backup', exact: true }).click();
        await expect(page.getByText('Sign-in pending', { exact: true })).toBeVisible();
        await page.getByLabel('Account recovery verification code').fill('123456');
        await page.getByRole('button', { name: 'Sign in and continue', exact: true }).click();
        await expect(page.getByText('Protected', { exact: true })).toBeVisible();
        expect(requestShouldCreateUser).toBe(false);

        await expect(page.getByText('Allowed', { exact: true })).toBeVisible({ timeout: 15_000 });
        await page.getByRole('button', { name: 'Restore backup', exact: true }).last().click();
        await expect(
          page.getByText('Restore is only available on an empty device', { exact: false }),
        ).toBeVisible();
      },
    },
    {
      name: 'session loss pauses remote backup but permits owner recovery',
      run: async ({ page }) => {
        requireAccountBoundary();
        await page.evaluate(() => {
          for (const key of Object.keys(window.localStorage)) {
            if (key.startsWith('sb-')) window.localStorage.removeItem(key);
          }
        });
        await page.reload();
        await page.waitForLoadState('load');
        await openSettingsScreen(page);
        await expect(page.getByText('Recovery required', { exact: true })).toBeVisible();
        await expect(
          page.getByText('Sign back into this device account', { exact: true }),
        ).toBeVisible();
        await page.getByLabel('Protected account email').fill('recover@example.com');
        await page.getByRole('button', { name: 'Send sign-in code', exact: true }).click();
        await expect(page.getByText('Sign-in pending', { exact: true })).toBeVisible();
        await page.getByLabel('Account recovery verification code').fill('123456');
        await page.getByRole('button', { name: 'Sign in and continue', exact: true }).click();
        await expect(page.getByText('Protected', { exact: true })).toBeVisible();
      },
    },
    {
      name: 'a different authenticated owner is blocked without local reassignment',
      run: async ({ page }) => {
        requireAccountBoundary();
        currentUser = WRONG_USER;
        await page.reload();
        await page.waitForLoadState('load');
        await openSettingsScreen(page);
        await expect(page.getByText('Account mismatch', { exact: true })).toBeVisible();
        await expect(
          page.getByText('This device belongs to another backup account.', { exact: false }),
        ).toBeVisible();
        await expect(page.getByText('Blocked', { exact: true }).last()).toBeVisible();
      },
    },
    {
      name: 'first synced activity is durably owned by the anonymous account',
      run: async ({ page }) => {
        requireAccountBoundary();
        verifyUserOverride = null;
        pushedTodoUserIds = [];
        await resetAll(page);
        await returnToApp(page);
        await page.getByRole('button', { name: 'Open settings' }).click();
        await expect(page.getByText('Anonymous / unprotected', { exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Close settings' }).click();

        // First synced write on the fresh anonymous install.
        await page.getByRole('button', { name: TAB_LABELS.todos, exact: true }).click();
        await page.getByRole('button', { name: 'Add task' }).last().click();
        await page.getByPlaceholder(/Add a task/i).fill('First synced todo');
        await page.getByText('Add task', { exact: true }).locator('..').click({ force: true });
        await expect(page.getByPlaceholder(/Add a task/i)).toBeHidden({ timeout: 15_000 });

        // Trigger a background flush (NetInfo online signal) and wait for the
        // push: the first outbox row must reach the backup endpoint owned by
        // the anonymous UID — never ownerless.
        await page.evaluate(() => {
          const conn = (
            navigator as unknown as {
              connection?: { dispatchEvent(ev: Event): boolean };
              mozConnection?: { dispatchEvent(ev: Event): boolean };
              webkitConnection?: { dispatchEvent(ev: Event): boolean };
            }
          ).connection;
          if (conn) conn.dispatchEvent(new Event('change'));
          window.dispatchEvent(new Event('online'));
        });
        // The first synced write must be owned by the anonymous account (never
        // ownerless). The durable outbox may flush the row more than once across
        // the online-event trigger and the background sync, so assert ownership
        // rather than an exact capture count.
        await expect.poll(() => pushedTodoUserIds.length).toBeGreaterThanOrEqual(1);
        await expect
          .poll(() => pushedTodoUserIds.every((id) => id === ANONYMOUS_USER.id))
          .toBe(true);
        const owners = await queryRows(page, 'SELECT DISTINCT owner_user_id FROM sync_outbox');
        expect(owners.every((row) => row.owner_user_id === ANONYMOUS_USER.id)).toBe(true);
      },
    },
    {
      name: 'protection succeeds while the user keeps writing and sync keeps flushing',
      run: async ({ page }) => {
        requireAccountBoundary();
        verifyUserOverride = null;
        pushedTodoUserIds = [];
        await resetAll(page);
        await returnToApp(page);
        await openSettingsScreen(page);
        await page.getByLabel('Email for backup recovery').fill('recover@example.com');
        await page.getByRole('button', { name: 'Protect backup with email', exact: true }).click();
        await expect(page.getByText('Verification pending', { exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Close settings' }).click();

        // The user keeps using the app while the OTP is pending.
        await page.getByRole('button', { name: TAB_LABELS.todos, exact: true }).click();
        await page.getByRole('button', { name: 'Add task' }).last().click();
        await page.getByPlaceholder(/Add a task/i).fill('Todo while code pending');
        await page.getByText('Add task', { exact: true }).locator('..').click({ force: true });
        await expect(page.getByPlaceholder(/Add a task/i)).toBeHidden({ timeout: 15_000 });
        await page.evaluate(() => {
          const conn = (
            navigator as unknown as {
              connection?: { dispatchEvent(ev: Event): boolean };
              mozConnection?: { dispatchEvent(ev: Event): boolean };
              webkitConnection?: { dispatchEvent(ev: Event): boolean };
            }
          ).connection;
          if (conn) conn.dispatchEvent(new Event('change'));
          window.dispatchEvent(new Event('online'));
        });
        // Background sync drains the outbox while protection is pending.
        await expect.poll(() => pushedTodoUserIds).toContain(ANONYMOUS_USER.id);

        await openSettingsScreen(page);
        // A reload re-bootstraps with the pending protection record: the app
        // must still surface verification pending, never a stale state.
        await expect(page.getByText('Verification pending', { exact: true })).toBeVisible();
        await page.getByLabel('Backup protection verification code').fill('123456');
        await page.getByRole('button', { name: 'Verify email', exact: true }).click();
        await expect(page.getByText('Protected', { exact: true })).toBeVisible();
        // UUID and local binding are unchanged.
        const owner = await queryRows(
          page,
          "SELECT value FROM app_meta WHERE key = 'account.owner_user_id'",
        );
        expect(owner).toEqual([{ value: ANONYMOUS_USER.id }]);
      },
    },
    {
      name: 'a populated device cannot switch to a different account after local-only activity',
      run: async ({ page }) => {
        requireAccountBoundary();
        verifyUserOverride = null;
        pushedTodoUserIds = [];
        await resetAll(page);
        // Fake clock BEFORE the app's first render so the focus timer can be
        // completed deterministically.
        await installClock(page);
        await returnToApp(page);

        // First activity is local-only: complete a Pomodoro focus session.
        // Scope to the tab rail landmark: the first-run onboarding card on
        // Overview exposes interest chips whose labels can equal a tab label
        // (Habits, Focus, Workout), so an unscoped lookup strict-matches two
        // buttons (same protocol as helpers/navigation.goToTab).
        await page
          .getByRole('tablist', { name: 'Section tabs' })
          .getByRole('button', { name: TAB_LABELS.pomodoro, exact: true })
          .click();
        await page.getByText('Start focus', { exact: true }).click();
        await page.clock.fastForward(25 * 60 * 1000);
        // After the focus session completes the timer advances to the next
        // mode — the completion marker.
        await expect(page.getByText('Start short break', { exact: true })).toBeVisible({
          timeout: 10_000,
        });

        // The settings card still reflects the bootstrap view; attempting
        // recovery on the now-populated device sends the OTP, but verifying
        // with a DIFFERENT account (different UUID) must fail closed.
        // The settings shortcut lives on the Overview section; return there.
        // Scope to the tab rail landmark (see the Focus note above).
        await page
          .getByRole('tablist', { name: 'Section tabs' })
          .getByRole('button', { name: TAB_LABELS.overview, exact: true })
          .click();
        await page.getByRole('button', { name: 'Open settings' }).click();
        await expect(page.getByText('Anonymous / unprotected', { exact: true })).toBeVisible();
        await page.getByLabel('Protected account email').fill('other@example.com');
        await page.getByRole('button', { name: 'Recover existing backup', exact: true }).click();
        await expect(page.getByText('Sign-in pending', { exact: true })).toBeVisible();

        verifyUserOverride = WRONG_USER;
        await page.getByLabel('Account recovery verification code').fill('123456');
        await page.getByRole('button', { name: 'Sign in and continue', exact: true }).click();
        await expect(page.getByText(/different account/i)).toBeVisible();
        // The unsafe session was cleared (fail closed), local data intact, and
        // the retry path stays available — the switch was rejected without
        // reassigning anything.
        await expect(
          page.getByText(
            'Recovery verification is pending. Enter the code sent to recover this backup.',
          ),
        ).toBeVisible();

        // The local-only write durably claimed the dataset for the anonymous
        // owner; the failed switch reassigned nothing.
        const owner = await queryRows(
          page,
          "SELECT value FROM app_meta WHERE key = 'account.owner_user_id'",
        );
        expect(owner).toEqual([{ value: ANONYMOUS_USER.id }]);
        const state = await queryRows(
          page,
          "SELECT value FROM app_meta WHERE key = 'account.owner_binding_state'",
        );
        expect(state).toEqual([{ value: 'permanent' }]);
        await expectRows(page, 'SELECT COUNT(*) AS n FROM pomodoro_sessions', (rows) =>
          expect(Number(rows[0]?.n)).toBe(1),
        );
      },
    },
  ],
});
