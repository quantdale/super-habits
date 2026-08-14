import { expect, test, type Page, type Route } from '@playwright/test';
import { defineJourney } from '../helpers/journey';
import { openSettingsScreen } from '../helpers/commandObservation';
import { returnToApp } from '../helpers/dbHarness';
import { resetAll } from '../helpers/reset';

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
  id: 'todo_recovered_v1',
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
    currentUser = PERMANENT_USER;
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

  const tableMatch = path.match(/^\/rest\/v1\/(todos|habits|calorie_entries|workout_routines)$/);
  if (!tableMatch) {
    await route.fulfill({
      status: 404,
      headers: JSON_HEADERS,
      body: JSON.stringify({ message: 'not found' }),
    });
    return;
  }

  const table = tableMatch[1];
  const requestedOwner = url.searchParams.get('user_id')?.replace(/^eq\./, '');
  const hasBackup =
    currentUser.is_anonymous === false &&
    currentUser.id === PERMANENT_USER.id &&
    requestedOwner === PERMANENT_USER.id;
  if (url.searchParams.get('select') === 'user_id') {
    await route.fulfill({
      status: 200,
      headers: JSON_HEADERS,
      // Fingerprint probes are kept empty for this deterministic flow so the
      // protection assertion proves UUID preservation without inventing a
      // remote row mutation between the two snapshots.
      body: JSON.stringify([]),
    });
    return;
  }
  if (method === 'HEAD') {
    const count = hasBackup && table === 'todos' ? 1 : 0;
    await route.fulfill({
      status: 200,
      headers: { ...JSON_HEADERS, 'content-range': `0-0/${count}` },
      body: '[]',
    });
    return;
  }
  if (url.searchParams.get('select') === 'updated_at') {
    await route.fulfill({
      status: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify(
        hasBackup && table === 'todos' ? [{ updated_at: BACKUP_TODO.updated_at }] : [],
      ),
    });
    return;
  }
  if (url.searchParams.get('select') === '*') {
    await route.fulfill({
      status: 200,
      headers: {
        ...JSON_HEADERS,
        'content-range': hasBackup && table === 'todos' ? '0-0/1' : '0--1/0',
      },
      body: JSON.stringify(hasBackup && table === 'todos' ? [BACKUP_TODO] : []),
    });
    return;
  }
  await route.fulfill({ status: 200, headers: JSON_HEADERS, body: '[]' });
}

async function installAccountMock(page: Page): Promise<void> {
  currentUser = ANONYMOUS_USER;
  requestShouldCreateUser = null;
  supabaseRequestsSeen = 0;
  await page.route(SUPABASE_ROUTE, handleAccountMock);
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
  ],
});
