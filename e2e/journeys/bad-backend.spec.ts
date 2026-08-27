import { expect, test, type Page } from '@playwright/test';
import { defineJourney } from '../helpers/journey';
import { resetAll } from '../helpers/reset';
import { ensureAppContext, queryRows } from '../helpers/dbHarness';
import { expectOutbox, switchSection } from '../helpers/oracles';
import { setOffline, SYNCABLE_ENTITIES } from '../helpers/failure';
import { fulfillDummySupabaseAuth } from '../helpers/supabaseAuth';

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
 * outbox (`sync_outbox`); raw SQL inserts bypass the engine and are
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
  await page.getByRole('button', { name: 'Add task' }).last().click();
  await page.getByPlaceholder(/Add a task/i).fill(title);
  await page.getByText('Add task', { exact: true }).locator('..').click({ force: true });
  await expect(page.getByText(title).first()).toBeVisible();
}

async function addHabitViaUi(page: Page, name: string): Promise<void> {
  await ensureAppContext(page);
  await switchSection(page, 'habits');
  await expect(page.getByText('ANYTIME').first()).toBeVisible({ timeout: 15_000 });
  const nameField = page.getByLabel('Habit name');
  await page.getByLabel('Habit groups').getByLabel('Add anytime habit').click({ force: true });
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
 * Install a Supabase route whose REST behaviour is `restHandler` while Auth is
 * fulfilled by a deterministic signed-in anonymous user. The ownership
 * boundary requires an authenticated UID before a mock REST push can proceed.
 */
async function routeSupabase(
  page: Page,
  restHandler: (route: import('@playwright/test').Route, url: string) => void | Promise<void>,
): Promise<void> {
  // Centralize on the browser-context level: it covers both page and Worker
  // (wa-sqlite, Supabase) traffic. Registering the same handler on both
  // page and context double-handles a single logical request and was the
  // cause of the "one or two failures" tolerance. Keep a single logical
  // ownership here.
  await page.unroute(SUPABASE_ROUTE).catch(() => {});
  await page
    .context()
    .unroute(SUPABASE_ROUTE)
    .catch(() => {});
  // Drain any still-held timeout routes before installing a new injector so
  // a previous stalled request cannot spill into the next step.
  drainPendingTimeoutRoutes();
  await page.context().route(SUPABASE_ROUTE, (route) => {
    supabaseRequestsSeen += 1;
    const method = route.request().method();
    const url = route.request().url();
    if (method === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': 'GET, POST, PATCH, DELETE, PUT, OPTIONS',
          'access-control-expose-headers': 'content-range',
        },
      });
    }
    if (url.includes('/auth/v1/')) {
      return fulfillDummySupabaseAuth(route);
    }
    return restHandler(route, url);
  });
}

// Timeout harness state: held routes + their abort timers. Installing a new
// injector drains this so a previous stalled request cannot be misattributed
// to the next mock (the PA-02 spill).
let pendingTimeoutRoutes: import('@playwright/test').Route[] = [];
let pendingTimeoutIds: ReturnType<typeof setTimeout>[] = [];
function drainPendingTimeoutRoutes(): void {
  for (const id of pendingTimeoutIds) clearTimeout(id);
  pendingTimeoutIds = [];
  for (const r of pendingTimeoutRoutes) {
    // Best-effort: the route may already be handled; ignore.
    r.fulfill({
      status: 503,
      headers: { 'access-control-allow-origin': '*' },
      contentType: 'application/json',
      body: '{"error":"drained stalled request"}',
    }).catch(() => {});
  }
  pendingTimeoutRoutes = [];
}

/** Every REST request fails with 503 (the "backend is down" blocking injector). */
async function injectRest503(page: Page): Promise<void> {
  drainPendingTimeoutRoutes();
  await routeSupabase(page, (route) => {
    return route.fulfill({
      status: 503,
      headers: { 'access-control-allow-origin': '*' },
      contentType: 'application/json',
      body: '{"error":"injected server error"}',
    });
  });
}

/** Every REST request returns 200 with invalid JSON (parser robustness). */
async function injectRestMalformed(page: Page): Promise<void> {
  drainPendingTimeoutRoutes();
  await routeSupabase(page, (route) =>
    route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*' },
      contentType: 'application/json',
      body: '{',
    }),
  );
}

/** Every REST request is stalled then aborted after `ms` (a real stalled request). */
async function injectRestTimeout(page: Page, ms = 2500): Promise<void> {
  drainPendingTimeoutRoutes();
  await routeSupabase(page, (route) => {
    pendingTimeoutRoutes.push(route);
    const id = setTimeout(() => {
      // Remove from pending before acting.
      pendingTimeoutRoutes = pendingTimeoutRoutes.filter((r) => r !== route);
      route.abort('timedout').catch(() => {});
    }, ms);
    pendingTimeoutIds.push(id);
  });
}

/** Every REST request succeeds (200, empty array) — the "backend recovered" injector. */
async function injectRestSuccess(page: Page): Promise<void> {
  drainPendingTimeoutRoutes();
  await routeSupabase(page, (route) =>
    route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*' },
      contentType: 'application/json',
      body: '[]',
    }),
  );
}

/**
 * Per-entity partial failure: `failEntities` respond 503; every other REST
 * request (including the successful entities' upserts) responds 200 with an
 * empty JSON array so supabase-js parses it as success. Deterministic — no
 * `route.continue()` that would leak toward a real backend.
 */
async function injectRestPartial(page: Page, failEntities: readonly string[]): Promise<void> {
  drainPendingTimeoutRoutes();
  const fail = new Set<string>(failEntities);
  await routeSupabase(page, (route, url) => {
    const hit = SYNCABLE_ENTITIES.find((e) => url.includes(`/rest/v1/${e}`));
    if (hit && fail.has(hit)) {
      return route.fulfill({
        status: 503,
        headers: { 'access-control-allow-origin': '*' },
        contentType: 'application/json',
        body: '{"error":"injected partial failure"}',
      });
    }
    return route.fulfill({
      status: 200,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-expose-headers': 'content-range',
        'content-range': '0-0/*',
      },
      contentType: 'application/json',
      body: '[]',
    });
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
        // ever hit and no record can silently push. Cross-origin remote
        // requests bypass the app-shell service worker in the product path.
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
        await expect
          .poll(async () => Number((await readSyncStatus(page))?.consecutiveFailures ?? 0))
          .toBe(n + 1);
        const mid = await readSyncStatus(page);
        expect(new Date(String(mid?.nextRetryAt ?? '')).getTime()).toBeGreaterThan(Date.now());

        // The fixed 30s interval flush respects backoff: wait past one interval
        // tick and confirm it did NOT retry (failure count unchanged, record
        // still pending, nextRetryAt still in the future).
        await ensureAppContext(page);
        // The reload fires the NetInfo reconnect flush, which legitimately
        // bypasses backoff (like an explicit reconnect) and fails once under
        // the injected 503. Measure the interval behavior from that
        // post-reload baseline.
        await expect
          .poll(async () => Number((await readSyncStatus(page))?.consecutiveFailures ?? 0))
          .toBe(n + 1);
        const afterReload = await readSyncStatus(page);
        await page.waitForTimeout(35_000);
        const afterWait = await readSyncStatus(page);
        expect(Number(afterWait?.consecutiveFailures ?? 0)).toBe(
          Number(afterReload?.consecutiveFailures ?? 0),
        );
        expect(new Date(String(afterWait?.nextRetryAt ?? '')).getTime()).toBeGreaterThan(
          Date.now(),
        );
        await expectOutbox(page, (outbox) => {
          expect(outbox.map((r) => r.entity).sort()).toEqual(['habits']);
        });
        // A later success clears the failure state and the outbox (only the
        // Backup Completeness V2 manifest checkpoint record may remain,
        // pending its own push).
        await injectRestSuccess(page);
        await triggerReconnectFlush(page);
        const after = await readSyncStatus(page);
        expect(Number(after?.consecutiveFailures ?? 0)).toBe(0);
        expect(after?.lastErrorMessage).toBeNull();
        await expectOutbox(page, (outbox) => {
          const dataRecords = outbox.filter((r) => r.entity !== 'backup_manifest');
          expect(dataRecords).toEqual([]);
        });

        // Settings now shows the healthy state.
        await assertSettingsSyncPill(page, 'Synced');
        await expect(page.getByText(/Up to date/)).toBeVisible();
      },
    },
  ],
});
