import { expect, test, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { defineJourney } from '../helpers/journey';
import { expectOutbox, expectRows, switchSection, type OutboxRecord } from '../helpers/oracles';
import {
  queryRows,
  returnToApp,
  WA_SQLITE_ASSET_DIR,
  discoverWasmName,
} from '../helpers/dbHarness';
import { resetAll } from '../helpers/reset';
import { setOffline } from '../helpers/failure';
import { clickCaloriesAddEntry, fillCaloriesMacros } from '../helpers/forms';

/**
 * J3 — "The commute" (P5, Alex the Commuter). OpenSpec task 4.3.
 *
 * Offline-first sync/outbox behaviour:
 *   online, create data → go offline → create/edit/delete across todos,
 *   habits and calories → outbox grows and dedupes per (entity, id) →
 *   full reload → app_meta.sync_outbox survived (hydrate restored it) →
 *   reconnect → each record pushed exactly once.
 *
 * What runs against the standard `dist/` build (no EXPO_PUBLIC_SUPABASE_*):
 * the whole offline half. `syncEngine.enqueue()` persists the outbox to
 * `app_meta.sync_outbox` (SqliteSyncPersistence) on every enqueue, so the
 * outbox grows and survives a reload even though the Supabase adapter is a
 * no-op here. Going offline (context.setOffline) does NOT trigger a flush
 * (NetInfo only flushes on reconnect) and a reload in headless Chromium does
 * not hide the document, so the 30s interval is the only flush risk and the
 * offline phase deliberately completes well inside one 30s window.
 *
 * The reconnect-push half ("each record pushed exactly once") needs a real
 * remote boundary. It runs in the dedicated `journeys-sync` Playwright project
 * against the dummy-Supabase `dist-sync/` build (OpenSpec task 6.1a / Q5,
 * `npm run e2e:sync`); in the standard `dist/` build (no Supabase env) it is
 * runtime-gated with `test.fixme(!remoteBoundaryDetected, ...)` and skipped.
 * The boundary is detected like J4: a counting route is installed before the
 * app's first render, and a boundary is present iff the app issues a Supabase
 * request. The route withholds success (auth 400 / REST 503) through the
 * offline phase so no online flush can drain the outbox early; the reconnect
 * step swaps in a success route and forces the push exactly once.
 */

interface ExpectedRecord {
  entity: string;
  id: string;
  operation: string;
}

/**
 * Assert the sync outbox contains EXACTLY `expected` (length + membership +
 * operation) and that no (entity, id) appears twice — the dedupe oracle. Any
 * duplicate or unexpected record fails, so this doubles as the negative oracle
 * for outbox growth.
 */
async function expectOutboxRecords(page: Page, expected: ExpectedRecord[]): Promise<void> {
  await expectOutbox(page, (outbox) => {
    const key = (r: OutboxRecord) => `${r.entity}:${r.id}`;
    expect(outbox, 'sync_outbox record count (growth, no extras)').toHaveLength(expected.length);
    for (const exp of expected) {
      const rec = outbox.find((r) => key(r) === `${exp.entity}:${exp.id}`);
      expect(rec, `expected outbox record for ${exp.entity}:${exp.id}`).toBeDefined();
      expect(rec?.operation, `operation for ${exp.entity}:${exp.id}`).toBe(exp.operation);
      expect(rec?.updatedAt, `updatedAt for ${exp.entity}:${exp.id}`).toBeTruthy();
    }
    expect(new Set(outbox.map(key)).size, 'each (entity, id) deduped to one record').toBe(
      expected.length,
    );
  });
}

/** Read the four terminal row ids the journey created, via the DB harness. */
async function fetchJourneyIds(page: Page): Promise<{
  rideId: string;
  draftId: string;
  stretchId: string;
  trailId: string;
}> {
  const ride = await queryRows(
    page,
    "SELECT id FROM todos WHERE title = 'Commute ride' AND deleted_at IS NULL",
  );
  const draft = await queryRows(
    page,
    "SELECT id FROM todos WHERE title = 'Draft reply' AND deleted_at IS NULL",
  );
  const stretch = await queryRows(page, "SELECT id FROM habits WHERE name = 'Stretch'");
  const trail = await queryRows(
    page,
    "SELECT id FROM calorie_entries WHERE food_name = 'Trail mix' AND deleted_at IS NULL",
  );
  expect(ride, 'Commute ride row').toHaveLength(1);
  expect(draft, 'Draft reply row').toHaveLength(1);
  expect(stretch, 'Stretch habit row (soft-deleted rows persist)').toHaveLength(1);
  expect(trail, 'Trail mix row').toHaveLength(1);
  return {
    rideId: String(ride[0].id),
    draftId: String(draft[0].id),
    stretchId: String(stretch[0].id),
    trailId: String(trail[0].id),
  };
}

const installedWasmRoute = new WeakSet<Page>();

// Runtime detection of a Supabase boundary in the served build, mirroring J4:
// a counting route is installed BEFORE the app's first render; on the standard
// `dist/` build (no EXPO_PUBLIC_SUPABASE_*) the app issues no Supabase request
// and the flag stays false, while on the `dist-sync/` build (dummy env) the
// bootstrap's auth/restore calls are observed and the reconnect-push step runs.
let supabaseRequestsSeen = 0;
let remoteBoundaryDetected = false;

/**
 * The DB harness document and worker are route-fulfilled (so they load even
 * offline), but the wa-sqlite `.wasm` it fetches comes from the real static
 * server at `/assets/...` — with the context offline that fetch fails and the
 * harness cannot open the database. Serve the same file from disk through a
 * route so row-level oracles work while offline. Call once per journey page.
 */
async function registerOfflineWasmRoute(page: Page): Promise<void> {
  if (installedWasmRoute.has(page)) return;
  installedWasmRoute.add(page);
  const name = discoverWasmName();
  await page.route(`**/wa-sqlite/${name}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/wasm',
      body: fs.readFileSync(path.join(WA_SQLITE_ASSET_DIR, name)),
    }),
  );
}

/**
 * Supabase route used through the ONLINE/offline phases: counts every request
 * (boundary detection) and WITHHOLDS success — auth 400 (supabase-js retries
 * 5xx, not 4xx, so bootstrap stays fast), REST 503 — so an opportunist online
 * flush (e.g. the mount-time NetInfo callback after a reload) can never drain
 * the outbox before the reconnect step asserts it.
 */
async function installWithholdingSupabaseRoute(page: Page): Promise<void> {
  await page.route('**/*.supabase.co/**', (route) => {
    supabaseRequestsSeen += 1;
    if (route.request().url().includes('/auth/v1/')) {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: '{"error":"anonymous sign-in disabled (injected)"}',
      });
    }
    return route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{"error":"injected server error"}',
    });
  });
}

defineJourney({
  persona: 'P5 — Alex, the Commuter (offline user)',
  goal: 'offline writes survive to the outbox, dedupe, reload, and reconnect push',
  risks: ['R2', 'R5'],
  tags: ['@p5', '@sync'],
  steps: [
    {
      name: 'reset the device, boot the app, and assert the outbox starts empty',
      run: async ({ page }) => {
        // Install the counting/withholding Supabase route BEFORE the app's
        // first render so a boundary is observed (and no online flush can
        // drain the outbox early). Serve the harness wasm from disk so
        // row-level oracles work while the context is offline later.
        await installWithholdingSupabaseRoute(page);
        await resetAll(page);
        await registerOfflineWasmRoute(page);
        await returnToApp(page);
        // Negative oracle: a fresh device has no pending sync records.
        await expectOutbox(page, []);
        await returnToApp(page);
        // A boundary is present iff the app issued a Supabase request during
        // boot (only the dist-sync/ build bundles a Supabase origin).
        remoteBoundaryDetected = supabaseRequestsSeen > 0;
      },
    },
    {
      name: 'online baseline: create a todo (Commute ride)',
      run: async ({ page }) => {
        await switchSection(page, 'todos');
        await page.getByRole('button', { name: 'Add task' }).first().click();
        await page.getByPlaceholder(/Add a task/i).fill('Commute ride');
        await page.getByText('Add task', { exact: true }).locator('..').click({ force: true });
        await expect(page.getByText('Commute ride').first()).toBeVisible();
      },
    },
    {
      name: 'go offline and create/edit/delete across todos, habits and calories',
      run: async ({ page }) => {
        await setOffline(page, true);

        // todos: create then complete (update) — must dedupe to one record.
        await switchSection(page, 'todos');
        await page.getByRole('button', { name: 'Add task' }).first().click();
        await page.getByPlaceholder(/Add a task/i).fill('Draft reply');
        await page.getByText('Add task', { exact: true }).locator('..').click({ force: true });
        await expect(page.getByText('Draft reply').first()).toBeVisible();
        // The completion toggle is the checkbox RectButton left of the title
        // (row child [1]; the title text itself has no onPress — the existing
        // todos spec only clicks the text and never verifies completion).
        await page
          .getByText('Draft reply')
          .first()
          .locator('xpath=../../preceding-sibling::*[1]')
          .click();
        // Completion moves the row into the collapsed "completed" set; the
        // deterministic immediate-UI signal is the reveal toggle appearing
        // (completed tasks render only once the user expands them).
        await expect(page.getByText(/Show completed \(\d+\)/).first()).toBeVisible();

        // habits: create then delete — must dedupe to one delete record.
        await switchSection(page, 'habits');
        await expect(page.getByText('ANYTIME').first()).toBeVisible({ timeout: 15_000 });
        await page
          .getByLabel('Habit groups')
          .getByText('Add', { exact: true })
          .first()
          .locator('xpath=preceding-sibling::*[1]')
          .click({ force: true });
        await page.getByLabel('Habit name').fill('Stretch');
        await page.getByText('Create habit', { exact: true }).locator('..').click({ force: true });
        await expect(page.getByText('Stretch').first()).toBeVisible();
        await page.getByLabel('Enter habit edit mode').click({ force: true });
        await expect(page.getByLabel('Exit habit edit mode')).toBeVisible();
        // Scope to the habits grid: the Todos section was mounted earlier in
        // this journey and its swipe-delete action also renders a "Delete"
        // text earlier in the DOM (all sections stay mounted). The unscoped
        // `.first()` would hit that off-viewport one.
        await page.getByLabel('Habit groups').getByText('Delete', { exact: true }).first().click();
        await page.getByText('Delete habit', { exact: true }).last().click({ force: true });
        await expect(page.getByText('Stretch').first()).not.toBeVisible();

        // calories: create an entry.
        await switchSection(page, 'calories');
        await fillCaloriesMacros(page, 'Trail mix', '10', '20', '8', '4');
        await clickCaloriesAddEntry(page);
        await expect(page.locator('body')).toContainText('Trail mix', { timeout: 15_000 });
      },
    },
    {
      name: 'offline: outbox grew to one record per (entity, id) and persisted to app_meta',
      run: async ({ page }) => {
        // Chromium's offline emulation blocks a new document navigation even
        // when the navigation's resources are fulfilled by Playwright routes.
        // Enter the harness while online, then take the context offline while
        // the already-loaded harness owns the page. Its worker and OPFS reads
        // are local, so this still asserts the offline outbox state without
        // allowing the app's 30s flush interval to run.
        await setOffline(page, false);
        const { rideId, draftId, stretchId, trailId } = await fetchJourneyIds(page);
        await setOffline(page, true);
        await expectOutboxRecords(page, [
          { entity: 'todos', id: rideId, operation: 'create' },
          // create → complete deduped to a single 'update' record
          { entity: 'todos', id: draftId, operation: 'update' },
          // create → delete deduped to a single 'delete' record
          { entity: 'habits', id: stretchId, operation: 'delete' },
          { entity: 'calorie_entries', id: trailId, operation: 'create' },
        ]);
        await expectRows(
          page,
          "SELECT completed, deleted_at FROM todos WHERE title = 'Draft reply'",
          (rows) => {
            expect(rows).toHaveLength(1);
            expect(rows[0].completed).toBe(1);
            expect(rows[0].deleted_at).toBeNull();
          },
        );
        await expectRows(page, "SELECT deleted_at FROM habits WHERE name = 'Stretch'", (rows) => {
          expect(rows).toHaveLength(1);
          expect(rows[0].deleted_at).not.toBeNull(); // soft delete keeps the row
        });
        await expectRows(
          page,
          "SELECT food_name FROM calorie_entries WHERE food_name = 'Trail mix' AND deleted_at IS NULL",
          (rows) => {
            expect(rows).toHaveLength(1);
          },
        );
      },
    },
    {
      name: 'full reload: app_meta.sync_outbox survived (hydrate restored it)',
      run: async ({ page }) => {
        // Page is on the DB harness (no app mounted): going online here is safe
        // — the NetInfo reconnect flush lives in AppProviders on the app page
        // and cannot fire from the harness document, so the outbox is not
        // cleared before the reload.
        await setOffline(page, false);
        await returnToApp(page); // full reload; hydrate() must restore the outbox
        const { rideId, draftId, stretchId, trailId } = await fetchJourneyIds(page);
        await expectOutboxRecords(page, [
          { entity: 'todos', id: rideId, operation: 'create' },
          { entity: 'todos', id: draftId, operation: 'update' },
          { entity: 'habits', id: stretchId, operation: 'delete' },
          { entity: 'calorie_entries', id: trailId, operation: 'create' },
        ]);
        // Surviving surfaces agree with the surviving outbox after reload.
        await returnToApp(page);
        await switchSection(page, 'todos');
        await expect(page.getByText('Commute ride').first()).toBeVisible();
        // Completed todos are collapsed behind the reveal toggle on a fresh
        // mount; expand it to confirm the completed row came back too.
        await page
          .getByText(/Show completed \(\d+\)/)
          .first()
          .click();
        await expect(page.getByText('Draft reply').first()).toBeVisible();
        await switchSection(page, 'habits');
        await expect(page.getByText('Stretch').first()).not.toBeVisible();
        await switchSection(page, 'calories');
        await expect(page.locator('body')).toContainText('Trail mix');
      },
    },
    {
      name: 'reconnect: each outbox record is pushed exactly once',
      run: async ({ page }) => {
        // Runtime-gated (mirroring J4/J5): the push needs a Supabase boundary.
        // Standard dist/ bundles no Supabase env, so `supabase` is null and a
        // flush no-ops — records would be DROPPED, which is not a push and must
        // not be asserted as one. The journeys-sync project (OpenSpec task
        // 6.1a/Q5, `npm run e2e:sync`) serves the dummy-Supabase `dist-sync/`
        // build, where this step runs for real; on the standard build it shows
        // as fixme naming the lane.
        test.fixme(
          !remoteBoundaryDetected,
          'no Supabase boundary in this build — the reconnect-push assertion runs in the journeys-sync lane against the dist-sync/ build (task 6.1a / Q5)',
        );

        // --- Decided-contract body (runs on the dist-sync lane) ---
        // Swap the withholding route for a success route: count every REST
        // upsert so "exactly once" is observable at the network boundary.
        // Auth stays 400 (supabase-js retries 5xx, not 4xx) so bootstrap and
        // any incidental load stay fast/deterministic.
        const pushed: { entity: string; id: string }[] = [];
        await page.route('**/*.supabase.co/**', async (route) => {
          const req = route.request();
          if (req.url().includes('/auth/v1/')) {
            return route.fulfill({
              status: 400,
              contentType: 'application/json',
              body: '{"error":"anonymous sign-in disabled (injected)"}',
            });
          }
          const match = req.url().match(/\/rest\/v1\/(todos|habits|calorie_entries)\?/);
          if (req.method() === 'POST' && match) {
            const body = req.postDataJSON();
            for (const row of Array.isArray(body) ? body : [body]) {
              if (row && typeof row.id === 'string') {
                pushed.push({ entity: match[1], id: row.id });
              }
            }
          }
          await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        });

        // The page is on the app (calories) from step 5. Force one
        // deterministic opportunistic flush: NetInfo's web module listens to
        // `navigator.connection`'s `change` event (in headless Chromium the
        // window offline/online events from context.setOffline do not reach
        // it — same finding as J4), so toggle offline→online and dispatch the
        // change event the listener is actually bound to.
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
        // Let the network boundary tell us the flush completed before
        // navigating to the DB harness. Navigating away mid-push would abort
        // the in-flight upsert and requeue instead of draining.
        await expect.poll(() => pushed.length, { timeout: 15_000 }).toBeGreaterThanOrEqual(4);

        const { rideId, draftId, stretchId, trailId } = await fetchJourneyIds(page);
        const expected = [
          { entity: 'todos', id: rideId },
          { entity: 'todos', id: draftId },
          { entity: 'habits', id: stretchId },
          { entity: 'calorie_entries', id: trailId },
        ];

        // Reconnect → NetInfo fires isConnected → opportunistic flush. Each
        // record must be delivered exactly once and the outbox must drain
        // (status cleared; no record left pending).
        await expect(async () => {
          const rows = await queryRows(
            page,
            "SELECT value FROM app_meta WHERE key = 'sync_outbox'",
          );
          const raw = rows[0]?.value;
          return typeof raw !== 'string' || raw.trim() === '' || raw === '[]';
        }).toPass({ timeout: 15_000 });

        for (const exp of expected) {
          const hits = pushed.filter((p) => p.entity === exp.entity && p.id === exp.id);
          expect(hits, `pushed ${exp.entity}:${exp.id} exactly once`).toHaveLength(1);
        }
      },
    },
  ],
});
