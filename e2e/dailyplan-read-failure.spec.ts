import { test, expect, type Page } from './fixtures';
import type { Locator } from '@playwright/test';
import { clearDatabase } from './helpers/db';
import { goToTab, planningHubTab } from './helpers/navigation';
import { returnToApp, runSql } from './helpers/dbHarness';
import { browserLocalDateKeyOffset } from './helpers/browserDate';

/**
 * Daily Plan / Weekly Review READ-path honesty (UX sweep, part 3).
 *
 * PR #210 made the planning WRITE failures honest. The READ path still had
 * three silent spots where a rejected read became an *unhandled rejection* and
 * the UI fell through to a state that reads as a fact:
 *
 *   1. `DailyPlanHistoryView` initial load → the panel showed
 *      "No past plans yet…" as if the history were empty.
 *   2. `DailyPlanView` `refresh()` (post-delete / post-action) and its initial
 *      load → no feedback at all, and the editor kept claiming stale state.
 *   3. `ReviewHistoryView` initial load (the identical bug) → "No past reviews
 *      yet. Complete this week's review…".
 *
 * Each test below asserts the same three things per site:
 *   (a) a visible AND announced (role="alert") error in curated copy,
 *   (b) no misleading empty/stale claim as if the read had succeeded
 *       (previously loaded data is preserved, never blanked by a failed read),
 *   (c) the retry control re-runs the read and the real data appears.
 * Plus: no unhandled rejection reaches the page (the failure is caught).
 *
 * Failure-injection tooling note. `e2e/helpers/failure.ts` intercepts the
 * REMOTE boundary (Supabase REST/auth) and can never reject a local-first
 * read. A `RAISE(ABORT)` trigger — the repository's established technique for
 * rejected WRITES — cannot abort a SELECT (SQLite ignores RAISE outside a
 * statement that writes), and a view cannot be made to throw on read. So this
 * spec injects the failure at the boundary the app's reads actually cross: the
 * expo-sqlite web worker channel. `prepare` messages whose SQL matches a
 * per-test fragment are rewritten to a statement that cannot prepare (a
 * missing table), which rejects the app's read exactly like a corrupt/missing
 * schema would — inside `getDatabase()`'s own worker, with no product code
 * aware of the harness. The rule is armed/disarmed per test phase and only
 * ever matches the one read under test, so bootstrap and every unrelated query
 * stay real.
 */

/** Rules are matched against the SQL text of `prepare` worker messages. */
type ReadFailureRule = {
  include: string[];
  exclude?: string[];
  /**
   * `fail` (default) rewrites the matched statement so it cannot prepare, so
   * the read REJECTS immediately. `hold` instead queues the worker message and
   * sends nothing, so the read stays PENDING until `releaseHeldReads()` — the
   * shape of a slow/blocked read against the still-visible failure surface.
   */
  mode?: 'fail' | 'hold';
};

/** Survives reloads (read by the init script) — cleared per test. */
const RULE_STORAGE_KEY = 'e2e.dailyplan-read-failure';

/** Exact fragments of the reads under test (`*.data.ts` source strings). */
const LIST_RECENT_DAILY_PLANS = 'deleted_at IS NULL AND date_key >= ? ORDER BY date_key DESC';
const GET_DAILY_PLAN = 'FROM daily_plans WHERE date_key = ? AND deleted_at IS NULL';
const LIST_WEEKLY_REVIEWS = 'FROM weekly_reviews WHERE deleted_at IS NULL ORDER BY week_start_date';

/** Install the worker-channel read-failure injector once per page. */
async function installReadFailureInjection(page: Page): Promise<void> {
  await page.addInitScript((storageKey: string) => {
    const win = window as unknown as {
      __shReadFailure?: ReadFailureRule | null;
      __shHeldReadPosts?: (() => void)[];
      __shReleaseHeldReads?: () => void;
    };
    const stored = window.localStorage.getItem(storageKey);
    win.__shReadFailure = stored ? (JSON.parse(stored) as ReadFailureRule) : null;
    const held: (() => void)[] = [];
    win.__shHeldReadPosts = held;
    /** Send every held worker message, and disarm so the read can settle. */
    win.__shReleaseHeldReads = () => {
      win.__shReadFailure = null;
      window.localStorage.removeItem(storageKey);
      for (const send of held.splice(0, held.length)) send();
    };
    const originalPostMessage = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function patchedPostMessage(
      this: Worker,
      message: { type?: string; data?: { source?: unknown } },
      ...rest: unknown[]
    ) {
      try {
        const rule = win.__shReadFailure;
        if (rule && message && message.type === 'prepare' && message.data) {
          const source = String(message.data.source ?? '');
          const matched =
            rule.include.every((needle) => source.includes(needle)) &&
            (rule.exclude ?? []).every((needle) => !source.includes(needle));
          if (matched) {
            if (rule.mode === 'hold') {
              // Queue instead of sending: the read never reaches the worker,
              // so its promise stays pending exactly like a blocked read.
              held.push(() => {
                originalPostMessage.call(this, message, ...(rest as []));
              });
              return undefined;
            }
            message = {
              ...message,
              data: { ...message.data, source: 'SELECT * FROM __sh_read_failure__' },
            };
          }
        }
      } catch {
        // The injector must never break the worker channel itself.
      }
      return originalPostMessage.call(this, message, ...(rest as []));
    };
  }, RULE_STORAGE_KEY);
}

/** Arm the injector for the SQL fragments in `include` (until cleared). */
async function armReadFailure(page: Page, rule: ReadFailureRule): Promise<void> {
  await page.evaluate(
    ({ storageKey, json }) => {
      window.localStorage.setItem(storageKey, json);
      (window as unknown as { __shReadFailure?: unknown }).__shReadFailure = JSON.parse(
        json,
      ) as ReadFailureRule | null;
    },
    { storageKey: RULE_STORAGE_KEY, json: JSON.stringify(rule) },
  );
}

/** Disarm the injector so the retry runs against the real database. */
async function clearReadFailure(page: Page): Promise<void> {
  await page.evaluate((storageKey) => {
    window.localStorage.removeItem(storageKey);
    (window as unknown as { __shReadFailure?: unknown }).__shReadFailure = null;
  }, RULE_STORAGE_KEY);
}

/**
 * Arm a HOLDING rule: matched reads are queued at the worker boundary and stay
 * pending until `releaseHeldReads()`.
 */
async function armHeldReadFailure(page: Page, rule: ReadFailureRule): Promise<void> {
  await armReadFailure(page, { ...rule, mode: 'hold' });
}

/**
 * Block until the app has actually issued a held read, so the "while pending"
 * assertions below are deterministic instead of racing the click.
 */
async function expectHeldReadInFlight(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      ((window as unknown as { __shHeldReadPosts?: unknown[] }).__shHeldReadPosts?.length ?? 0) > 0,
    null,
    { timeout: 20_000 },
  );
}

/** Release every held worker message and disarm, so the read can settle. */
async function releaseHeldReads(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __shReleaseHeldReads?: () => void }).__shReleaseHeldReads?.();
  });
}

/** The announced failure surface (role=alert) carrying `text`. */
function errorSurface(page: Page, text: string | RegExp): Locator {
  return page.getByRole('alert').filter({ hasText: text });
}

/** Errors that escaped a handler as an unhandled promise rejection. */
function unhandledReadRejections(errors: string[]): string[] {
  return errors.filter((message) => message.includes('__sh_read_failure__'));
}

async function openPlanHub(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Plan today' }).click();
  await expect(planningHubTab(page, 'Projects')).toBeVisible({ timeout: 20_000 });
}

/** Today's plan-editor intention input (last in DOM order: the guided card owns the first). */
function planEditorIntention(page: Page): Locator {
  return page.getByPlaceholder('What is the one thing that matters most today?').last();
}

/**
 * The failure UI renders ONLY on failure, so the success path's layout is
 * untouched. This still has to fit the three narrow widths the product
 * supports: the error card + retry must not overflow the viewport at 360/375/
 * 390, and no horizontal scroll may appear because of it.
 */
async function expectNoHorizontalOverflow(page: Page, surface: Locator): Promise<void> {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  const box = await surface.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const viewportWidth = page.viewportSize()?.width ?? 0;
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewportWidth + 1);
}

test.describe('Planning history reads are honest under failure', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultNavigationTimeout(90_000);
    await goToTab(page, 'overview');
    await clearDatabase(page);
    await goToTab(page, 'overview');
    await page.evaluate((storageKey) => {
      window.localStorage.removeItem(storageKey);
    }, RULE_STORAGE_KEY);
  });

  test('a rejected plan-history read reports the failure, keeps the empty claim away, and the retry lists the plans', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await installReadFailureInjection(page);

    // A real history row: the panel has something it MUST NOT pretend is absent.
    const yesterday = await browserLocalDateKeyOffset(page, -1);
    const today = await browserLocalDateKeyOffset(page, 0);
    const now = new Date().toISOString();
    await runSql(
      page,
      `INSERT INTO daily_plans (id, date_key, intention, status, created_at, updated_at)
       VALUES ('dplan_rf_history', '${yesterday}', 'Yesterday plan', 'committed', '${now}', '${now}');
       INSERT INTO daily_plans (id, date_key, intention, status, created_at, updated_at)
       VALUES ('dplan_rf_today', '${today}', 'Today plan', 'committed', '${now}', '${now}');`,
    );
    await returnToApp(page);
    await goToTab(page, 'overview');
    await openPlanHub(page);
    await expect(planEditorIntention(page)).toHaveValue('Today plan', { timeout: 20_000 });

    await armReadFailure(page, { include: [LIST_RECENT_DAILY_PLANS] });
    await page.getByRole('button', { name: 'Plan history' }).click();

    // (a) Visible AND announced, in curated copy — never a raw engine message.
    await expect(errorSurface(page, 'Could not load your plan history. Try again.')).toBeVisible({
      timeout: 20_000,
    });
    // (b) The failed read never reads as "you have no history".
    await expect(page.getByText(/No past plans yet/)).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: `Plan for ${yesterday}, Committed` }),
    ).toHaveCount(0);
    // The editor's own (successful) read is untouched by the injected failure.
    await expect(planEditorIntention(page)).toHaveValue('Today plan');
    expect(unhandledReadRejections(pageErrors)).toEqual([]);

    // (c) Once the read works again, the retry shows the real history.
    await clearReadFailure(page);
    await page.getByRole('button', { name: 'Retry loading plan history' }).click();
    await expect(
      page.getByRole('button', { name: `Plan for ${yesterday}, Committed` }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: `Plan for ${today}, Committed` })).toBeVisible();
    await expect(errorSurface(page, 'Could not load your plan history.')).toHaveCount(0);
    await expect(page.getByText(/No past plans yet/)).toHaveCount(0);
  });

  test('a rejected post-delete plan refresh reports the failure, preserves the loaded editor, and the retry shows the committed delete', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await installReadFailureInjection(page);

    const today = await browserLocalDateKeyOffset(page, 0);
    const now = new Date().toISOString();
    await runSql(
      page,
      `INSERT INTO daily_plans (id, date_key, intention, status, created_at, updated_at)
       VALUES ('dplan_rf_delete', '${today}', 'Plan to keep', 'committed', '${now}', '${now}')`,
    );
    await returnToApp(page);
    await goToTab(page, 'overview');
    await openPlanHub(page);
    await expect(planEditorIntention(page)).toHaveValue('Plan to keep', { timeout: 20_000 });

    // Only the editor's post-delete re-read (getDailyPlan) fails; the delete
    // write itself and the history panel's own read stay real.
    await armReadFailure(page, { include: [GET_DAILY_PLAN] });
    await page.getByRole('button', { name: 'Plan history' }).click();
    const entry = page.getByRole('button', { name: `Plan for ${today}, Committed` });
    await expect(entry).toBeVisible({ timeout: 20_000 });
    await entry.click();
    await page.getByRole('button', { name: `Delete plan for ${today}` }).click();
    await expect(page.getByText('Delete daily plan', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Delete plan', exact: true }).click();

    // (a) Visible AND announced.
    await expect(errorSurface(page, 'Could not load your plan. Try again.')).toBeVisible({
      timeout: 20_000,
    });
    // (b) The failed refresh neither blanks the editor nor invents an empty
    //     "Not yet saved" plan; the previously loaded values stay on screen.
    await expect(planEditorIntention(page)).toHaveValue('Plan to keep');
    await expect(page.getByText('Not yet saved')).toHaveCount(0);
    // The delete itself is not re-reported as a failure (no double-report).
    await expect(errorSurface(page, 'Could not delete the plan.')).toHaveCount(0);
    expect(unhandledReadRejections(pageErrors)).toEqual([]);

    // (c) The retry re-reads the committed state: the deleted plan is gone.
    await clearReadFailure(page);
    await page.getByRole('button', { name: 'Retry loading the plan' }).click();
    await expect(page.getByText('Not yet saved')).toBeVisible({ timeout: 20_000 });
    await expect(planEditorIntention(page)).toHaveValue('');
    await expect(errorSurface(page, 'Could not load your plan.')).toHaveCount(0);
  });

  test('a rejected initial plan read reports the failure instead of an empty editor, and the retry loads the saved plan', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await installReadFailureInjection(page);

    const today = await browserLocalDateKeyOffset(page, 0);
    const now = new Date().toISOString();
    await runSql(
      page,
      `INSERT INTO daily_plans (id, date_key, intention, status, created_at, updated_at)
       VALUES ('dplan_rf_mount', '${today}', 'Saved this morning', 'committed', '${now}', '${now}')`,
    );
    await returnToApp(page);
    await goToTab(page, 'overview');
    await openPlanHub(page);
    await expect(planEditorIntention(page)).toHaveValue('Saved this morning', { timeout: 20_000 });

    // Remount the editor with the read failing (hub view switch, not a reload,
    // so the injected rule can be armed/cleared from the live page).
    await armReadFailure(page, { include: [GET_DAILY_PLAN] });
    await planningHubTab(page, 'Projects').click();
    await planningHubTab(page, 'Today').click();

    // (a) Visible AND announced.
    await expect(errorSurface(page, 'Could not load your plan. Try again.')).toBeVisible({
      timeout: 20_000,
    });
    // (b) No editor is offered on top of an unread plan, so nothing can claim
    //     the day is unsaved or invite a blind overwrite.
    await expect(page.getByText('Not yet saved')).toHaveCount(0);
    await expect(
      page.getByPlaceholder('What is the one thing that matters most today?'),
    ).toHaveCount(0);
    expect(unhandledReadRejections(pageErrors)).toEqual([]);

    // (c) The retry loads the plan that is really there.
    await clearReadFailure(page);
    await page.getByRole('button', { name: 'Retry loading the plan' }).click();
    await expect(planEditorIntention(page)).toHaveValue('Saved this morning', { timeout: 20_000 });
    await expect(errorSurface(page, 'Could not load your plan.')).toHaveCount(0);
  });

  test('a rejected past-review read reports the failure instead of "no past reviews", and the retry lists the review', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await installReadFailureInjection(page);

    await runSql(
      page,
      `INSERT INTO weekly_reviews
         (id, week_key, week_start_date, week_end_date, next_week_start_date,
          completed_at, status, summary_payload, plan_payload, reflection,
          created_at, updated_at, deleted_at)
       VALUES ('wrev_rf_seed', '2026-10-19', '2026-10-19', '2026-10-25', '2026-10-26',
               '2026-10-25T09:00:00.000Z', 'completed', '{}',
               '{"priorities":[],"todoDecisions":[],"newCommitments":[]}',
               'Steady week', '2026-10-25T09:00:00.000Z', '2026-10-25T09:00:00.000Z', NULL)`,
    );
    await returnToApp(page);
    await goToTab(page, 'overview');
    await page.getByRole('button', { name: 'View Momentum Garden' }).click();
    const openReview = page.getByRole('dialog').getByRole('button', { name: 'Open weekly review' });
    await expect(openReview).toBeVisible({ timeout: 20_000 });
    await openReview.click();
    const modal = page.getByRole('dialog');
    await expect(modal.getByText(/^Step 1 of 5/)).toBeVisible({ timeout: 20_000 });

    await armReadFailure(page, { include: [LIST_WEEKLY_REVIEWS] });
    await modal.getByRole('button', { name: 'Show past reviews' }).click();

    // (a) Visible AND announced.
    await expect(errorSurface(page, 'Could not load past reviews. Try again.')).toBeVisible({
      timeout: 20_000,
    });
    // (b) The failed read never claims there is no history.
    await expect(page.getByText(/No past reviews yet/)).toHaveCount(0);
    await expect(modal.getByRole('button', { name: 'Week of 2026-10-19 review' })).toHaveCount(0);
    expect(unhandledReadRejections(pageErrors)).toEqual([]);

    // (c) The retry lists the review that is really there.
    await clearReadFailure(page);
    await modal.getByRole('button', { name: 'Retry loading past reviews' }).click();
    await expect(modal.getByRole('button', { name: 'Week of 2026-10-19 review' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(errorSurface(page, 'Could not load past reviews.')).toHaveCount(0);
    await expect(page.getByText(/No past reviews yet/)).toHaveCount(0);
  });

  test('the plan-history retry never exposes the empty state while its read is still pending', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await installReadFailureInjection(page);

    // Real history exists, so "No past plans yet" is never a true statement here.
    const yesterday = await browserLocalDateKeyOffset(page, -1);
    const now = new Date().toISOString();
    await runSql(
      page,
      `INSERT INTO daily_plans (id, date_key, intention, status, created_at, updated_at)
       VALUES ('dplan_rf_hold', '${yesterday}', 'Held retry plan', 'committed', '${now}', '${now}')`,
    );
    await returnToApp(page);
    await goToTab(page, 'overview');
    await openPlanHub(page);

    await armReadFailure(page, { include: [LIST_RECENT_DAILY_PLANS] });
    await page.getByRole('button', { name: 'Plan history' }).click();
    const errorText = 'Could not load your plan history. Try again.';
    await expect(errorSurface(page, errorText)).toBeVisible({ timeout: 20_000 });

    // The retry's own read is now HELD: it stays pending indefinitely.
    await armHeldReadFailure(page, { include: [LIST_RECENT_DAILY_PLANS] });
    const retry = page.getByRole('button', { name: 'Retry loading plan history' });
    await retry.click();
    await expectHeldReadInFlight(page);

    // While the retry is pending: no false empty claim, and the failure
    // surface stays mounted so the user can see the read is still in flight.
    await expect(page.getByText(/No past plans yet/)).toHaveCount(0);
    await expect(errorSurface(page, errorText)).toBeVisible();
    await expect(retry).toBeVisible();
    await expect(retry).toBeDisabled();
    // Exactly one failure surface: the retry never double-reports.
    await expect(errorSurface(page, errorText)).toHaveCount(1);
    expect(unhandledReadRejections(pageErrors)).toEqual([]);

    // Released: the real read settles and the honest history renders.
    await releaseHeldReads(page);
    await expect(
      page.getByRole('button', { name: `Plan for ${yesterday}, Committed` }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(errorSurface(page, errorText)).toHaveCount(0);
    await expect(page.getByText(/No past plans yet/)).toHaveCount(0);
    expect(unhandledReadRejections(pageErrors)).toEqual([]);
  });

  test('the past-review retry never exposes the empty state while its read is still pending', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await installReadFailureInjection(page);

    await runSql(
      page,
      `INSERT INTO weekly_reviews
         (id, week_key, week_start_date, week_end_date, next_week_start_date,
          completed_at, status, summary_payload, plan_payload, reflection,
          created_at, updated_at, deleted_at)
       VALUES ('wrev_rf_hold', '2026-10-19', '2026-10-19', '2026-10-25', '2026-10-26',
               '2026-10-25T09:00:00.000Z', 'completed', '{}',
               '{"priorities":[],"todoDecisions":[],"newCommitments":[]}',
               'Held retry review', '2026-10-25T09:00:00.000Z', '2026-10-25T09:00:00.000Z', NULL)`,
    );
    await returnToApp(page);
    await goToTab(page, 'overview');
    await page.getByRole('button', { name: 'View Momentum Garden' }).click();
    const openReview = page.getByRole('dialog').getByRole('button', { name: 'Open weekly review' });
    await expect(openReview).toBeVisible({ timeout: 20_000 });
    await openReview.click();
    const modal = page.getByRole('dialog');
    await expect(modal.getByText(/^Step 1 of 5/)).toBeVisible({ timeout: 20_000 });

    await armReadFailure(page, { include: [LIST_WEEKLY_REVIEWS] });
    await modal.getByRole('button', { name: 'Show past reviews' }).click();
    const errorText = 'Could not load past reviews. Try again.';
    await expect(errorSurface(page, errorText)).toBeVisible({ timeout: 20_000 });

    await armHeldReadFailure(page, { include: [LIST_WEEKLY_REVIEWS] });
    const retry = modal.getByRole('button', { name: 'Retry loading past reviews' });
    await retry.click();
    await expectHeldReadInFlight(page);

    // While the retry is pending: no false empty claim, failure surface intact.
    await expect(page.getByText(/No past reviews yet/)).toHaveCount(0);
    await expect(errorSurface(page, errorText)).toBeVisible();
    await expect(retry).toBeVisible();
    await expect(retry).toBeDisabled();
    await expect(errorSurface(page, errorText)).toHaveCount(1);
    expect(unhandledReadRejections(pageErrors)).toEqual([]);

    await releaseHeldReads(page);
    await expect(modal.getByRole('button', { name: 'Week of 2026-10-19 review' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(errorSurface(page, errorText)).toHaveCount(0);
    await expect(page.getByText(/No past reviews yet/)).toHaveCount(0);
    expect(unhandledReadRejections(pageErrors)).toEqual([]);
  });

  test('the read-failure surfaces fit the three supported narrow widths without overflow', async ({
    page,
  }) => {
    test.setTimeout(240_000);

    await installReadFailureInjection(page);
    const today = await browserLocalDateKeyOffset(page, 0);
    const now = new Date().toISOString();
    await runSql(
      page,
      `INSERT INTO daily_plans (id, date_key, intention, status, created_at, updated_at)
       VALUES ('dplan_rf_narrow', '${today}', 'Narrow plan', 'committed', '${now}', '${now}')`,
    );
    await returnToApp(page);
    await goToTab(page, 'overview');
    await openPlanHub(page);
    await expect(planEditorIntention(page)).toHaveValue('Narrow plan', { timeout: 20_000 });

    await armReadFailure(page, { include: [LIST_RECENT_DAILY_PLANS] });

    for (const width of [360, 375, 390]) {
      await page.setViewportSize({ width, height: 844 });
      // Each width opens a FRESH panel, so the read fails again and the
      // failure layout is measured at that width (the old one is closed at the
      // end of the previous iteration).
      await page.getByRole('button', { name: 'Show plan history' }).click();
      const alert = errorSurface(page, 'Could not load your plan history. Try again.');
      await expect(alert).toBeVisible({ timeout: 20_000 });
      await expectNoHorizontalOverflow(page, alert);
      const retry = page.getByRole('button', { name: 'Retry loading plan history' });
      await expect(retry).toBeVisible();
      await expectNoHorizontalOverflow(page, retry);
      await page.getByRole('button', { name: 'Hide plan history' }).click();
    }
  });
});
