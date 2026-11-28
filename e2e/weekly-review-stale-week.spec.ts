import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { clearDatabase } from './helpers/db';
import { goToTab } from './helpers/navigation';
import { installClock, setLocalTime } from './helpers/clock';
import { queryRows, returnToApp } from './helpers/dbHarness';

/**
 * Stale-week lead (audit #225 follow-up): the Weekly Review derives its review
 * week once, in `useMemo(() => getReviewWeek(), [])` at mount. The review modal
 * is left mounted while the app runs, so a review opened on Sunday evening and
 * still open after local midnight keeps targeting LAST week: the user reads
 * "Complete this week's review", confirmed, and the review is written against
 * the week that ended yesterday — one week off from the app's own calendar
 * (which the shell already rolls over through `useDayRolloverGeneration`).
 *
 * This spec pins the product contract: an unfinished review retargets to the
 * week that contains the day the user confirms it on, confirmation waits for
 * that week's summary, and a review that is already saved keeps its week.
 */

/** Sunday 23:50 local — the review week is Mon 2026-08-17 – Sun 2026-08-23. */
const SUNDAY_LATE = '2026-08-23T23:50:00';
/** Monday 00:05 local — the current week is Mon 2026-08-24 – Sun 2026-08-30. */
const MONDAY_EARLY = '2026-08-24T00:05:00';
const SUNDAY_WEEK = '2026-08-17 – 2026-08-23';
const MONDAY_WEEK = '2026-08-24 – 2026-08-30';

async function openWeeklyReview(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'View Momentum Garden' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Open weekly review' }).click();
  const modal = page.getByRole('dialog');
  await expect(modal.getByText(/^Step 1 of 5/)).toBeVisible({ timeout: 20_000 });
  return modal;
}

async function walkToConfirm(modal: Locator, priorityText: string): Promise<void> {
  await modal.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(modal.getByText(/^Step 2 of 5/)).toBeVisible();
  await modal.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(modal.getByText(/^Step 3 of 5/)).toBeVisible();
  await modal.getByRole('button', { name: 'Add priority' }).click();
  await modal.getByPlaceholder('Priority 1').fill(priorityText);
  await modal.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(modal.getByText(/^Step 4 of 5/)).toBeVisible();
  await modal.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(modal.getByText(/^Step 5 of 5/)).toBeVisible();
}

async function rolloverToMonday(page: Page): Promise<void> {
  await setLocalTime(page, MONDAY_EARLY);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
}

async function savedReviews(page: Page) {
  await returnToApp(page);
  return queryRows(
    page,
    `SELECT week_key, week_start_date, week_end_date FROM weekly_reviews WHERE deleted_at IS NULL`,
  );
}

test.describe('Weekly Review week target across a local day rollover', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultNavigationTimeout(90_000);
    // The clock must be installed before the app's first render: `toDateKey()`
    // reads `new Date()` at call time.
    await installClock(page, SUNDAY_LATE);
    await goToTab(page, 'overview');
    await clearDatabase(page);
    await goToTab(page, 'overview');
  });

  test('a review left open over local midnight targets the new week when confirmed', async ({
    page,
  }) => {
    test.setTimeout(240_000);

    const modal = await openWeeklyReview(page);
    // Sunday's review week.
    await expect(modal.getByText(SUNDAY_WEEK)).toBeVisible();

    // The day rolls over while the modal stays open (a tab left open overnight;
    // the shell's rollover provider reacts to the same visibility event).
    await rolloverToMonday(page);

    // Monday's review week must replace Sunday's on the still-open review.
    await expect(modal.getByText(MONDAY_WEEK)).toBeVisible({ timeout: 20_000 });
    await expect(modal.getByText(SUNDAY_WEEK)).toHaveCount(0);

    // ...and the confirmed review must be persisted against Monday's week.
    await walkToConfirm(modal, 'Keep the new week honest');
    await modal.getByRole('button', { name: 'Confirm & Save' }).click();
    await expect(modal.getByText('Review saved', { exact: true })).toBeVisible({
      timeout: 30_000,
    });

    expect(await savedReviews(page)).toEqual([
      {
        week_key: '2026-08-24',
        week_start_date: '2026-08-24',
        week_end_date: '2026-08-30',
      },
    ]);
  });

  test('confirmation stays blocked until the new week summary has loaded', async ({ page }) => {
    test.setTimeout(240_000);

    const modal = await openWeeklyReview(page);
    await expect(modal.getByText(SUNDAY_WEEK)).toBeVisible();
    await walkToConfirm(modal, 'Do not save last week after midnight');
    await expect(modal.getByRole('button', { name: 'Confirm & Save' })).toBeEnabled();

    await rolloverToMonday(page);

    // The Sunday summary is stale the moment the week retargets, so Confirm
    // must disappear (loading) rather than stay enabled against last week.
    await expect(modal.getByText('Loading weekly summary…')).toBeVisible({
      timeout: 20_000,
    });
    await expect(modal.getByRole('button', { name: 'Confirm & Save' })).toHaveCount(0);

    await expect(modal.getByText(MONDAY_WEEK)).toBeVisible({ timeout: 20_000 });
    await expect(modal.getByRole('button', { name: 'Confirm & Save' })).toBeEnabled();
    await modal.getByRole('button', { name: 'Confirm & Save' }).click();
    await expect(modal.getByText('Review saved', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(modal.getByText(`Your weekly review for ${MONDAY_WEEK} is saved.`)).toBeVisible();

    expect(await savedReviews(page)).toEqual([
      {
        week_key: '2026-08-24',
        week_start_date: '2026-08-24',
        week_end_date: '2026-08-30',
      },
    ]);
  });

  test('a saved review keeps its week on the completion screen after midnight', async ({
    page,
  }) => {
    test.setTimeout(240_000);

    const modal = await openWeeklyReview(page);
    await expect(modal.getByText(SUNDAY_WEEK)).toBeVisible();
    await walkToConfirm(modal, 'Keep the saved week honest');
    await modal.getByRole('button', { name: 'Confirm & Save' }).click();
    await expect(modal.getByText('Review saved', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(modal.getByText(`Your weekly review for ${SUNDAY_WEEK} is saved.`)).toBeVisible();

    await rolloverToMonday(page);

    // The success surface, including carry-forward seeding, stays on the week
    // that was actually written — not Monday's empty new week.
    await expect(modal.getByText(`Your weekly review for ${SUNDAY_WEEK} is saved.`)).toBeVisible();
    await expect(modal.getByText(MONDAY_WEEK)).toHaveCount(0);

    expect(await savedReviews(page)).toEqual([
      {
        week_key: '2026-08-17',
        week_start_date: '2026-08-17',
        week_end_date: '2026-08-23',
      },
    ]);
  });
});
