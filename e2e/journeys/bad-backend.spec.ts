import { expect, test, type Page } from '@playwright/test';
import { defineJourney } from '../helpers/journey';
import { resetAll } from '../helpers/reset';
import { ensureAppContext, queryRows } from '../helpers/dbHarness';
import { expectOutbox, switchSection } from '../helpers/oracles';
import { setOffline, SYNCABLE_ENTITIES } from '../helpers/failure';

/**
 * J4 — "The backend is having a bad day" (P5, offline-user persona).
 *
 * Drives the sync engine against a broken remote: 503, a malformed body, a
 * stalled request (timeout), and a per-entity partial failure. The assertions
 * target the sync contract in `core/sync/sync.engine.ts`:
 *
 *   - requeue scope: a failed flush keeps the records pending; a partial failure
 *     requeues ONLY the failed entity's records (the successful ones are dropped).
 *   - backoff: `shouldAttemptFlush()` gates the fixed 30s interval flush via
 *     `nextRetryAt`, while the event-driven reconnect/visibility flush bypasses
 *     it for an opportunistic retry.
 *   - the Settings-visible failure state (`features/settings/SettingsScreen.tsx`
 *     "Outbox sync" row → "Failing" pill + "Last attempt failed …" description),
 *     and that a later success clears it ("Synced").
 *
 * Environment requirement: this journey needs a Supabase boundary to intercept.
 * The failure injectors target any `.supabase.co` host and are inert on a
 * local-only build, so the web export must be built with
 * `EXPO_PUBLIC_SUPABASE_URL` (+ anon key) — the `dist-sync/` build lane
 * (task 6.1a, Q5) and its dedicated Playwright project. A blanket blocking
 * injector is installed BEFORE the app's first render in step 1, so no request
 * ever reaches whatever origin is bundled; all remote behaviour is exercised
 * through injected responses.
 *
 * All data is created through the real UI write path so records enter the sync
 * outbox (`app_meta.sync_outbox`); raw SQL inserts bypass the engine and are
 * deliberately not used to seed pending work.
 */

const SUPABASE_ROUTE = '**/*.supabase.co/**';

// Runtime detection of a Supabase boundary in the served build. The standard
// `npm run build:web` export bakes no EXPO_PUBLIC_SUPABASE_* (local-only), so
// the app issues NO supabase request and every flush no-ops and DRAINS the
// outbox — the failure-scenario assertions would be meaningless there. The
// failure injectors only take effect when the build carries a supabase origin
// (the `dist-sync/` lane, task 6.1a/Q5). Steps 2–6 gate on this flag: in the
// dedicated `journeys-sync` project (against `dist-sync/`) the flag is true
// and the steps run for real; in the standard `journeys` run (against `dist/`)
// they show as skipped fixmes naming the lane.
let supabaseRequestsSeen = 0;
let remoteBoundaryDetected = false;

/**
 * Disable the app's service worker for the whole journey via `addInitScript`.
 *
 * The app's Workbox SW (`public/sw.js`) routes cross-origin data fetches
 * through its own `fetch` handler, which is NOT intercepted by Playwright's
 * `page.route`. On a Supabase-capable build that means a flush's REST calls can
 * escape the failure injectors and hit the real origin — draining the outbox
 * and making the requeue assertions flaky (observed in the full-suite run:
 * step 2's outbox came back empty instead of `['habits','todos']`). Stubbing
 * `navigator.serviceWorker` (same pattern as J5) forces every request through
 * `page.route`, so the injected behaviour is deterministic. This is a test-side
 * mitigation (no app change, no weakened assertion); the SW bypass is filed as
 * `fix-restore-service-worker`.
 */
async function stubOutServiceWorker(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: () => Promise.resolve({}),
        addEventListener: () => {},
        removeEventListener: () => {},
        getRegistrations: () => Promise.resolve([]),
        getRegistration: () => Promise.resolve(undefined),
        controller: null,
        ready: Promise.resolve(undefined),
      },
      configurable: true,
    });
  });
}

/**
 * Trigger a flush through the NetInfo reconnect path, bypassing
 * `shouldAttemptFlush()`. Headless Chromium exposes the Network Information API
 * (`navigator.connection`), and @react-native-community/netinfo's web module
 * listens to its `change` event there — NOT the window `online`/`offline`
 * events that Playwright's `context.setOffline()` fires (which is why the
 * offline → online transition itself is not enough). So after toggling the
 * context back online we dispatch the `change` event NetInfo is actually
 * listening to (plus the window event for belt-and-braces). `flush()` dedupes
 * concurrent callers, so this yields exactly one push.
 *
 * Also ensures the app page is mounted first (DB-harness reads leave the page
 * on the harness document, where there is no app NetInfo listener).
 */
async function triggerReconnectFlush(page: Page, settleMs = 2500): Promise<void> {
  await ensureAppContext(page);
  await setOffline(page, true);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
  await setOffline(page, false);
  await page.evaluate(() => {
    const nav = navigator as unknown as {
      connection?: { dispatchEvent(ev: Event): boolean };
      mozConnection?: { dispatchEvent(ev: Event): boolean };
      webkitConnection?: { dispatchEvent(ev: Event): boolean };
    };
    const conn = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
    if (conn) conn.dispatchEvent(new Event('change'));
    window.dispatchEvent(new Event('online'));
  });
  await page.waitForTimeout(settleMs);
}

/** Read the persisted sync status from app_meta.sync_status (null when never recorded). */
async function readSyncStatus(page: Page): Promise<Record<string, unknown> | null> {
  const rows = await queryRows(page, "SELECT value FROM app_meta WHERE key = 'sync_status'");
  const raw = rows[0]?.value;
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  return JSON.parse(raw) as Record<string, unknown>;
}

async function addTodoViaUi(page: Page, title: string): Promise<void> {
  await ensureAppContext(page);
  await switchSection(page, 'todos');
  await page.getByRole('button', { name: 'Add task' }).first().click();
  await page.getByPlaceholder(/Add a task/i).fill(title);
  await page.getByText('Add task', { exact: true }).locator('..').click({ force: true });
  await expect(page.getByText(title).first()).toBeVisible();
}

async function addHabitViaUi(page: Page, name: string): Promise<void> {
  await ensureAppContext(page);
  await switchSection(page, 'habits');
  await expect(page.getByText('ANYTIME').first()).toBeVisible({ timeout: 15_000 });
  const nameField = page.getByLabel('Habit name');
  const addTile = page
    .getByLabel('Habit groups')
    .getByText('Add', { exact: true })
    .first()
    .locator('xpath=preceding-sibling::*[1]');
  await addTile.click({ force: true });
  await nameField.waitFor({ state: 'visible', timeout: 8_000 });
  await nameField.fill(name);
  await page.getByText('Create habit', { exact: true }).locator('..').click({ force: true });
  await expect(page.getByText(name).first()).toBeVisible();
}

/**
 * Open Settings and assert the "Outbox sync" row is showing `pill` (Failing /
 * Synced / Pending). The pill text is unique to that row's status on this
 * screen, so a page-level exact match is a faithful row oracle.
 */
async function assertSettingsSyncPill(
  page: Page,
  pill: 'Failing' | 'Synced' | 'Pending',
): Promise<void> {
  await ensureAppContext(page);
  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByText('Outbox sync', { exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByText('Outbox sync', { exact: true })).toBeVisible();
  await expect(page.getByText(pill, { exact: true })).toBeVisible();
}

/**
 * Install a Supabase route whose REST behaviour is `restHandler` while the auth
 * endpoints always fail fast (400). The auth 400 is essential: supabase-js
 * treats 5xx as retryable and burns seconds of retries on every app load,
 * which delays `syncEngine.hydrate()` past our first flush trigger.
 */
async function routeSupabase(
  page: Page,
  restHandler: (route: import('@playwright/test').Route, url: string) => void | Promise<void>,
): Promise<void> {
  await page.unroute(SUPABASE_ROUTE);
  await page.route(SUPABASE_ROUTE, (route) => {
    supabaseRequestsSeen += 1;
    if (route.request().url().includes('/auth/v1/')) {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: '{"error":"anonymous sign-in disabled (injected)"}',
      });
    }
    return restHandler(route, route.request().url());
  });
}

/** Every REST request fails with 503 (the "backend is down" blocking injector). */
async function injectRest503(page: Page): Promise<void> {
  await routeSupabase(page, (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{"error":"injected server error"}',
    }),
  );
}

/** Every REST request returns 200 with invalid JSON (parser robustness). */
async function injectRestMalformed(page: Page): Promise<void> {
  await routeSupabase(page, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{' }),
  );
}

/** Every REST request is held, then aborted after `ms` (a stalled request). */
async function injectRestTimeout(page: Page, ms = 2500): Promise<void> {
  await routeSupabase(page, (route) => {
    setTimeout(() => {
      route.abort('timedout').catch(() => {});
    }, ms);
  });
}

/** Every REST request succeeds (200, empty array) — the "backend recovered" injector. */
async function injectRestSuccess(page: Page): Promise<void> {
  await routeSupabase(page, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
}

/**
 * Per-entity partial failure: `failEntities` respond 503; every other REST
 * request (including the successful entities' upserts) responds 200 with an
 * empty JSON array so supabase-js parses it as success. Deterministic — no
 * `route.continue()` that would leak toward a real backend.
 */
async function injectRestPartial(page: Page, failEntities: readonly string[]): Promise<void> {
  const fail = new Set<string>(failEntities);
  await routeSupabase(page, (route, url) => {
    const hit = SYNCABLE_ENTITIES.find((e) => url.includes(`/rest/v1/${e}`));
    if (hit && fail.has(hit)) {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: '{"error":"injected partial failure"}',
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

defineJourney({
  persona: 'P5 — Alex, the Commuter',
  goal: 'a broken backend: 503, malformed, timeout, partial failure; requeue scope, backoff, Settings failure state',
  risks: ['R2'],
  tags: ['@p5', '@sync'],
  steps: [
    {
      name: 'reset, install a blocking 503, and create a todo + habit through the UI (outbox enqueues both)',
      run: async ({ page }) => {
        // Reset to a clean device (OPFS + AsyncStorage), then install the
        // blocking injector BEFORE the app's first render so no real remote is
        // ever hit and no record can silently push. Stub the service worker
        // first so no fetch can bypass page.route (see helper comment).
        await stubOutServiceWorker(page);
        await resetAll(page);
        await injectRest503(page);

        await addTodoViaUi(page, 'J4 todo');
        await addHabitViaUi(page, 'J4 habit');

        // Both entities are in the outbox (created via the real write path).
        await expectOutbox(page, (outbox) => {
          const entities = outbox.map((r) => r.entity).sort();
          expect(entities).toEqual(['habits', 'todos']);
        });

        // The app has fully booted (UI writes succeeded). If it never issued a
        // supabase request, the served build is local-only → no boundary to
        // intercept; the failure scenarios below are gated on this.
        remoteBoundaryDetected = supabaseRequestsSeen > 0;
      },
    },
    {
      name: '503: flush fails, both records requeue, Settings shows the Failing state',
      run: async ({ page }) => {
        test.fixme(
          !remoteBoundaryDetected,
          'this standard dist/ build has no Supabase boundary — this step runs in the journeys-sync lane against the dummy-Supabase dist-sync/ build (task 6.1a / Q5)',
        );
        await injectRest503(page);
        await triggerReconnectFlush(page);

        // Requeued: both records still pending.
        await expectOutbox(page, (outbox) => {
          expect(outbox.map((r) => r.entity).sort()).toEqual(['habits', 'todos']);
        });

        // Settings surfaces the failure state.
        await assertSettingsSyncPill(page, 'Failing');
        await expect(page.getByText(/Last attempt failed/)).toBeVisible();
      },
    },
    {
      name: 'malformed: 200 + invalid JSON is treated as a failure and requeues',
      run: async ({ page }) => {
        test.fixme(
          !remoteBoundaryDetected,
          'this standard dist/ build has no Supabase boundary — this step runs in the journeys-sync lane against the dummy-Supabase dist-sync/ build (task 6.1a / Q5)',
        );
        await injectRestMalformed(page);
        await triggerReconnectFlush(page);

        await expectOutbox(page, (outbox) => {
          expect(outbox.map((r) => r.entity).sort()).toEqual(['habits', 'todos']);
        });

        await assertSettingsSyncPill(page, 'Failing');
      },
    },
    {
      name: 'timeout: a stalled request is treated as a failure and requeues',
      run: async ({ page }) => {
        test.fixme(
          !remoteBoundaryDetected,
          'this standard dist/ build has no Supabase boundary — this step runs in the journeys-sync lane against the dummy-Supabase dist-sync/ build (task 6.1a / Q5)',
        );
        await injectRestTimeout(page, 2500);
        await triggerReconnectFlush(page, 6000);

        await expectOutbox(page, (outbox) => {
          expect(outbox.map((r) => r.entity).sort()).toEqual(['habits', 'todos']);
        });

        await assertSettingsSyncPill(page, 'Failing');
      },
    },
    {
      name: 'partial failure: only the failed entity requeues, the successful one is dropped',
      run: async ({ page }) => {
        test.fixme(
          !remoteBoundaryDetected,
          'this standard dist/ build has no Supabase boundary — this step runs in the journeys-sync lane against the dummy-Supabase dist-sync/ build (task 6.1a / Q5)',
        );
        // todos succeed (200), habits fail (503): only the habits record requeues.
        await injectRestPartial(page, ['habits']);
        await triggerReconnectFlush(page);

        await expectOutbox(page, (outbox) => {
          expect(outbox.map((r) => r.entity).sort()).toEqual(['habits']);
        });

        await assertSettingsSyncPill(page, 'Failing');
      },
    },
    {
      name: 'backoff: interval flush respects nextRetryAt, reconnect bypasses it, success clears the state',
      run: async ({ page }) => {
        test.fixme(
          !remoteBoundaryDetected,
          'this standard dist/ build has no Supabase boundary — this step runs in the journeys-sync lane against the dummy-Supabase dist-sync/ build (task 6.1a / Q5)',
        );
        // Fail the remaining (habits) record again and record the failure count.
        await injectRest503(page);
        await triggerReconnectFlush(page);
        const before = await readSyncStatus(page);
        const n = Number(before?.consecutiveFailures ?? 0);
        expect(n).toBeGreaterThan(0);

        // Reconnect flushes OPPORTUNISTICALLY: it bypasses shouldAttemptFlush()
        // even while nextRetryAt is still in the future, so the retry happens now.
        await triggerReconnectFlush(page);
        const mid = await readSyncStatus(page);
        expect(Number(mid?.consecutiveFailures ?? 0)).toBe(n + 1);
        expect(new Date(String(mid?.nextRetryAt ?? '')).getTime()).toBeGreaterThan(Date.now());

        // The fixed 30s interval flush respects backoff: wait past one interval
        // tick and confirm it did NOT retry (failure count unchanged, record
        // still pending, nextRetryAt still in the future).
        await ensureAppContext(page);
        await page.waitForTimeout(35_000);
        const afterWait = await readSyncStatus(page);
        expect(Number(afterWait?.consecutiveFailures ?? 0)).toBe(n + 1);
        expect(new Date(String(afterWait?.nextRetryAt ?? '')).getTime()).toBeGreaterThan(
          Date.now(),
        );
        await expectOutbox(page, (outbox) => {
          expect(outbox.map((r) => r.entity).sort()).toEqual(['habits']);
        });

        // A later success clears the failure state and the outbox.
        await injectRestSuccess(page);
        await triggerReconnectFlush(page);
        const after = await readSyncStatus(page);
        expect(Number(after?.consecutiveFailures ?? 0)).toBe(0);
        expect(after?.lastErrorMessage).toBeNull();
        await expectOutbox(page, (outbox) => {
          expect(outbox).toEqual([]);
        });

        // Settings now shows the healthy state.
        await assertSettingsSyncPill(page, 'Synced');
        await expect(page.getByText(/Up to date/)).toBeVisible();
      },
    },
  ],
});
