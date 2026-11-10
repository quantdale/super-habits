import { test, expect, type Page } from './fixtures';
import type { Locator } from '@playwright/test';
import { clearDatabase } from './helpers/db';
import { goToTab } from './helpers/navigation';
import { clearInjectedFailures } from './helpers/failure';
import { browserLocalDateKeyOffset } from './helpers/browserDate';
import { queryRows, returnToApp, runSql } from './helpers/dbHarness';
import { seedSql } from './helpers/seed';

/**
 * Tier-2 planning write-failure honesty (UX sweep, part 2).
 *
 * The successor report's "Tier-2 silent-no-op UI writes" row lists the
 * daily-plan and weekly-review history deletes. This spec proves, against the
 * real OPFS SQLite database, that a REJECTED local write in the planning
 * history/done surfaces is:
 *
 *   (a) visible AND announced (the shared `ValidationError` / `role="alert"`
 *       surface the Tier-1 campaign standardized on),
 *   (b) honest about durable state (the row survives, nothing was deleted,
 *       nothing was written, no outbox intent exists, and no UI claims the
 *       write happened),
 *   (c) retriable: once the rejection clears, the same action persists
 *       exactly once.
 *
 * Failure-injection tooling note. `e2e/helpers/failure.ts` intercepts the
 * REMOTE boundary (Supabase REST/auth over `page.route()`); it can never
 * reject a local-first write, because those writes never leave the device
 * (OPFS + the expo-sqlite worker). The repository's established, repeated
 * technique for a real rejected write is a SQLite `RAISE(ABORT)` trigger
 * installed through the same-origin DB harness (see
 * `planning-w115-reliability.spec.ts`, `calories.spec.ts`, `habits-w7.spec.ts`,
 * `weekly-review.spec.ts`). This spec uses that technique and additionally
 * clears the remote injectors in `beforeEach`, so an observed failure can
 * only have come from the LOCAL write — never from a network interceptor.
 *
 * Harness rule (dbHarness.ts): navigating to the DB document destroys the app
 * page's React state, so every test runs UI interactions in app context and
 * round-trips to the harness only at interaction boundaries.
 */

/** Today + `offset` days as a browser-local `YYYY-MM-DD` key. */
async function reviewWeekKeys(page: Page): Promise<{ nextWeekStart: string }> {
  return page.evaluate(() => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const today = new Date();
    // Mirrors getReviewWeek(): weeks run Monday–Sunday, so next week's start is
    // the coming Monday (today itself when today is Sunday).
    const dayOfWeek = today.getDay();
    const offset = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + offset);
    return { nextWeekStart: key(nextMonday) };
  });
}

async function openPlanHubFromOverview(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Plan today' }).click();
  await expect(
    page
      .getByRole('tablist', { name: 'Planning hub views' })
      .getByRole('tab', { name: 'Projects' }),
  ).toBeVisible({ timeout: 20_000 });
}

/** Open the weekly-review overlay from the Progress surface (normal product entry). */
async function openWeeklyReview(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'View Momentum Garden' }).click();
  const openReview = page.getByRole('dialog').getByRole('button', { name: 'Open weekly review' });
  await expect(openReview).toBeVisible({ timeout: 20_000 });
  await openReview.click();
  const modal = page.getByRole('dialog');
  await expect(modal.getByText(/^Step 1 of 5/)).toBeVisible({ timeout: 20_000 });
  return modal;
}

/**
 * Walk the five review steps to a saved review (one required priority), which
 * is the only way to reach the done step's next-week apply action.
 */
async function confirmReviewWithPriority(modal: Locator, priority: string): Promise<void> {
  const next = modal.getByRole('button', { name: 'Next', exact: true });
  await next.click(); // review → decide
  await next.click(); // decide → plan
  await modal.getByRole('button', { name: 'Add priority' }).click();
  await modal.getByPlaceholder('Priority 1').fill(priority);
  await next.click(); // plan → reflect
  await next.click(); // reflect → confirm
  await modal.getByRole('button', { name: 'Confirm & Save' }).click();
  await expect(modal.getByText('Review saved', { exact: true })).toBeVisible({ timeout: 30_000 });
}

/** The announced failure surface (role=alert) carrying `text`. */
function errorSurface(page: Page, text: string | RegExp): Locator {
  return page.getByRole('alert').filter({ hasText: text });
}

test.describe('Planning history writes are honest under failure', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultNavigationTimeout(90_000);
    await goToTab(page, 'overview');
    await clearDatabase(page);
    await clearInjectedFailures(page);
    await goToTab(page, 'overview');
  });

  test('a rejected daily-plan delete names the failure, keeps the plan, and the retry deletes once', async ({
    page,
  }) => {
    test.setTimeout(240_000);

    // Seed a PAST plan (yesterday) so the history list has a row whose delete
    // cannot be confused with the today editor's own draft state.
    const yesterday = await browserLocalDateKeyOffset(page, -1);
    const now = new Date().toISOString();
    await seedSql(
      page,
      `INSERT INTO daily_plans
         (id, date_key, intention, top_todo_ids, top_todo_titles, focus_target_minutes,
          notes, reflection, energy_score, status, completed_at, created_at, updated_at, deleted_at)
       VALUES ('dplan_t2_seed', '${yesterday}', 'Plan to remove', '[]', '[]', 0,
               '', '', NULL, 'committed', NULL, '${now}', '${now}', NULL);
       CREATE TRIGGER p2_reject_plan_delete
         BEFORE UPDATE ON daily_plans
         WHEN NEW.deleted_at IS NOT NULL
         BEGIN SELECT RAISE(ABORT, 'plan-delete-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'overview');
    await openPlanHubFromOverview(page);

    const entry = page.getByRole('button', { name: `Plan for ${yesterday}, Committed` });
    await page.getByRole('button', { name: 'Plan history' }).click();
    await expect(entry).toBeVisible({ timeout: 20_000 });
    await entry.click();
    // Expansion signal: the detail's delete control only renders when expanded
    // (this row keeps `accessibilityState.expanded`, which React Native Web
    // does not project to an `aria-expanded` attribute — the review history
    // row, asserted below, carries both).
    await expect(page.getByRole('button', { name: `Delete plan for ${yesterday}` })).toBeVisible();

    await page.getByRole('button', { name: `Delete plan for ${yesterday}` }).click();
    await expect(page.getByText('Delete daily plan', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Delete plan', exact: true }).click();

    // (a) Visible AND announced, in curated planning copy (never the raw
    // engine message a RAISE(ABORT) surfaces as).
    await expect(errorSurface(page, 'Could not delete the plan. Please try again.')).toBeVisible({
      timeout: 20_000,
    });
    // (b) UI truth: the row survives, stays expanded and stays retriable.
    await expect(entry).toBeVisible();
    await expect(page.getByText(`Delete plan for ${yesterday}`)).toHaveCount(0);
    await expect(page.getByRole('button', { name: `Delete plan for ${yesterday}` })).toBeEnabled();
    await expect(page.getByText(/No past plans yet/)).toHaveCount(0);

    // (b) Durable truth: no tombstone and no delete intent. DROP the trigger in
    // this same round-trip so the retry below can commit.
    expect(
      await queryRows(page, `SELECT deleted_at FROM daily_plans WHERE id = 'dplan_t2_seed'`),
    ).toEqual([{ deleted_at: null }]);
    expect(
      await queryRows(page, `SELECT id FROM sync_outbox WHERE entity = 'daily_plans'`),
    ).toHaveLength(0);
    await runSql(page, 'DROP TRIGGER p2_reject_plan_delete');

    // (c) The retry (a fresh mount of the very same durable state) deletes
    // exactly once and leaves a coalesced delete intent.
    await returnToApp(page);
    await goToTab(page, 'overview');
    await openPlanHubFromOverview(page);
    await page.getByRole('button', { name: 'Plan history' }).click();
    const retryEntry = page.getByRole('button', { name: `Plan for ${yesterday}, Committed` });
    await expect(retryEntry).toBeVisible({ timeout: 20_000 });
    await retryEntry.click();
    await page.getByRole('button', { name: `Delete plan for ${yesterday}` }).click();
    await expect(page.getByText('Delete daily plan', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Delete plan', exact: true }).click();
    await expect(page.getByText(/No past plans yet/)).toBeVisible({ timeout: 20_000 });
    await expect(errorSurface(page, 'Could not delete the plan.')).toHaveCount(0);

    expect(
      await queryRows(page, `SELECT deleted_at FROM daily_plans WHERE id = 'dplan_t2_seed'`),
    ).toHaveLength(1);
    expect(
      (await queryRows(page, `SELECT deleted_at FROM daily_plans WHERE id = 'dplan_t2_seed'`))[0]
        ?.deleted_at,
    ).not.toBeNull();
    expect(
      await queryRows(page, `SELECT operation FROM sync_outbox WHERE entity = 'daily_plans'`),
    ).toEqual([{ operation: 'delete' }]);
  });

  test('a rejected weekly-review delete names the failure, keeps the review, and the retry deletes once', async ({
    page,
  }) => {
    test.setTimeout(240_000);

    await seedSql(
      page,
      `INSERT INTO weekly_reviews
        (id, week_key, week_start_date, week_end_date, next_week_start_date,
         completed_at, status, summary_payload, plan_payload, reflection,
         created_at, updated_at, deleted_at)
       VALUES ('wrev_t2_seed', '2026-10-19', '2026-10-19', '2026-10-25', '2026-10-26',
               '2026-10-25T09:00:00.000Z', 'completed', '{}',
               '{"priorities":[],"todoDecisions":[],"newCommitments":[]}',
               'Steady week', '2026-10-25T09:00:00.000Z', '2026-10-25T09:00:00.000Z', NULL);
       CREATE TRIGGER p2_reject_review_delete
         BEFORE UPDATE ON weekly_reviews
         WHEN NEW.deleted_at IS NOT NULL
         BEGIN SELECT RAISE(ABORT, 'review-delete-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'overview');

    const modal = await openWeeklyReview(page);
    await modal.getByRole('button', { name: 'Show past reviews' }).click();
    const row = modal.getByRole('button', { name: 'Week of 2026-10-19 review' });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.click();
    await expect(row).toHaveAttribute('aria-expanded', 'true');

    await modal.getByRole('button', { name: 'Delete review for week 2026-10-19' }).click();
    await expect(page.getByText('Delete weekly review', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Delete review', exact: true }).click();

    // (a) Visible AND announced, in curated planning copy.
    await expect(errorSurface(page, 'Could not delete the review. Please try again.')).toBeVisible({
      timeout: 20_000,
    });
    // (b) UI truth: the review row survives, expanded and retriable.
    await expect(row).toBeVisible();
    await expect(row).toHaveAttribute('aria-expanded', 'true');
    await expect(
      modal.getByRole('button', { name: 'Delete review for week 2026-10-19' }),
    ).toBeEnabled();
    await expect(page.getByText(/No past reviews yet/)).toHaveCount(0);

    // (b) Durable truth: no tombstone and no delete intent.
    expect(
      await queryRows(page, `SELECT deleted_at FROM weekly_reviews WHERE id = 'wrev_t2_seed'`),
    ).toEqual([{ deleted_at: null }]);
    expect(
      await queryRows(page, `SELECT id FROM sync_outbox WHERE entity = 'weekly_reviews'`),
    ).toHaveLength(0);
    await runSql(page, 'DROP TRIGGER p2_reject_review_delete');

    // (c) Retry from a fresh mount of the same durable state deletes once.
    await returnToApp(page);
    await goToTab(page, 'overview');
    const retryModal = await openWeeklyReview(page);
    await retryModal.getByRole('button', { name: 'Show past reviews' }).click();
    const retryRow = retryModal.getByRole('button', { name: 'Week of 2026-10-19 review' });
    await expect(retryRow).toBeVisible({ timeout: 20_000 });
    await retryRow.click();
    await retryModal.getByRole('button', { name: 'Delete review for week 2026-10-19' }).click();
    await expect(page.getByText('Delete weekly review', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Delete review', exact: true }).click();
    await expect(page.getByText(/No past reviews yet/)).toBeVisible({ timeout: 20_000 });
    await expect(errorSurface(page, 'Could not delete the review.')).toHaveCount(0);

    expect(
      await queryRows(page, `SELECT deleted_at FROM weekly_reviews WHERE id = 'wrev_t2_seed'`),
    ).toHaveLength(1);
    expect(
      (await queryRows(page, `SELECT deleted_at FROM weekly_reviews WHERE id = 'wrev_t2_seed'`))[0]
        ?.deleted_at,
    ).not.toBeNull();
    expect(
      await queryRows(page, `SELECT operation FROM sync_outbox WHERE entity = 'weekly_reviews'`),
    ).toEqual([{ operation: 'delete' }]);
  });

  test('a rejected next-week apply names the failure, writes no plan, and succeeds once cleared', async ({
    page,
  }) => {
    test.setTimeout(300_000);

    // A todo due inside the reviewed week (today) and unfinished is a
    // carry-forward candidate, so the done step offers the next-week apply.
    const today = await browserLocalDateKeyOffset(page, 0);
    const { nextWeekStart } = await reviewWeekKeys(page);
    await seedSql(
      page,
      `INSERT INTO todos
         (id, title, notes, completed, created_at, updated_at, deleted_at, due_date, priority, sort_order, project_id, goal_id)
       VALUES ('todo_t2_carry', 'Carried over task', NULL, 0,
               '${today}T00:00:00.000Z', '${today}T00:00:00.000Z', NULL, '${today}', 'normal', 1, NULL, NULL);
       CREATE TRIGGER p2_reject_next_week_plan_insert
         BEFORE INSERT ON daily_plans
         WHEN NEW.date_key = '${nextWeekStart}'
         BEGIN SELECT RAISE(ABORT, 'next-week-plan-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'overview');

    const modal = await openWeeklyReview(page);
    await confirmReviewWithPriority(modal, 'Protect deep work');
    const applyButton = modal.getByRole('button', { name: /Add carry-forwards to next week/ });
    await expect(applyButton).toBeVisible();
    await applyButton.click();

    // (a) Visible AND announced, in curated planning copy; no success claim.
    await expect(
      errorSurface(page, 'Could not add the priorities to next week. Please try again.'),
    ).toBeVisible({ timeout: 20_000 });
    await expect(modal.getByText(/^Added /)).toHaveCount(0);
    // (b) UI truth: the action stays retriable and nothing claims it applied.
    await expect(applyButton).toBeVisible();
    await expect(applyButton).toBeEnabled();

    // (b) Durable truth: the review is saved (a separate write) but next week's
    // plans are untouched and no daily-plan intent exists. The whole apply runs
    // in ONE transaction, so a rejected day leaves the week unmodified.
    expect(
      await queryRows(page, `SELECT id FROM daily_plans WHERE date_key = '${nextWeekStart}'`),
    ).toHaveLength(0);
    expect(
      await queryRows(page, `SELECT id FROM sync_outbox WHERE entity = 'daily_plans'`),
    ).toHaveLength(0);
    expect(
      await queryRows(page, `SELECT id FROM weekly_reviews WHERE deleted_at IS NULL`),
    ).toHaveLength(1);
    // Clear the rejection and seed one fresh carry-forward candidate: the first
    // confirm already moved the original todo into next week, so a new
    // in-week incomplete todo is the candidate the retry applies.
    await runSql(
      page,
      `DROP TRIGGER p2_reject_next_week_plan_insert;
       INSERT INTO todos
         (id, title, notes, completed, created_at, updated_at, deleted_at, due_date, priority, sort_order, project_id, goal_id)
       VALUES ('todo_t2_carry_retry', 'Carried over again', NULL, 0,
               '${today}T00:00:00.000Z', '${today}T00:00:00.000Z', NULL, '${today}', 'normal', 2, NULL, NULL);`,
    );

    // (c) The same action, rejection cleared, persists exactly what it claims.
    await returnToApp(page);
    await goToTab(page, 'overview');
    const retryModal = await openWeeklyReview(page);
    await confirmReviewWithPriority(retryModal, 'Protect deep work');
    const retryApply = retryModal.getByRole('button', {
      name: /Add carry-forwards to next week/,
    });
    await expect(retryApply).toBeVisible();
    await retryApply.click();
    await expect(retryModal.getByText(/Added 1 priority across 1 day of next week/)).toBeVisible({
      timeout: 20_000,
    });
    await expect(errorSurface(page, 'Could not add the priorities to next week.')).toHaveCount(0);

    const plans = await queryRows(
      page,
      `SELECT date_key, top_todo_ids FROM daily_plans WHERE deleted_at IS NULL`,
    );
    expect(plans).toHaveLength(1);
    expect(plans[0]?.date_key).toBe(nextWeekStart);
    expect(String(plans[0]?.top_todo_ids)).toContain('todo_t2_carry_retry');
    expect(
      await queryRows(page, `SELECT operation FROM sync_outbox WHERE entity = 'daily_plans'`),
    ).toEqual([{ operation: 'create' }]);
  });
});
