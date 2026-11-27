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
 * "Complete this week's review", confirms, and the review is written against
 * the week that ended yesterday — one week off from the app's own calendar
 * (which the shell already rolls over through `useDayRolloverGeneration`).
 *
 * This spec pins the product contract: the review the user confirms is always
 * the week that contains the day they confirm it on.
 */

/** Sunday 23:50 local — the review week is Mon 2026-08-17 – Sun 2026-08-23. */
const SUNDAY_LATE = '2026-08-23T23:50:00';
/** Monday 00:05 local — the current week is Mon 2026-08-24 – Sun 2026-08-30. */
const MONDAY_EARLY = '2026-08-24T00:05:00';

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

    await page.getByRole('button', { name: 'View Momentum Garden' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Open weekly review' }).click();
    const modal = page.getByRole('dialog');
    await expect(modal.getByText(/^Step 1 of 5/)).toBeVisible({ timeout: 20_000 });
    // Sunday's review week.
    await expect(modal.getByText('2026-08-17 – 2026-08-23')).toBeVisible();

    // The day rolls over while the modal stays open (a tab left open overnight;
    // the shell's rollover provider reacts to the same visibility event).
    await setLocalTime(page, MONDAY_EARLY);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

    // Monday's review week must replace Sunday's on the still-open review.
    await expect(modal.getByText('2026-08-24 – 2026-08-30')).toBeVisible({ timeout: 20_000 });
    await expect(modal.getByText('2026-08-17 – 2026-08-23')).toHaveCount(0);

    // ...and the confirmed review must be persisted against Monday's week.
    await modal.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(modal.getByText(/^Step 2 of 5/)).toBeVisible();
    await modal.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(modal.getByText(/^Step 3 of 5/)).toBeVisible();
    await modal.getByRole('button', { name: 'Add priority' }).click();
    await modal.getByPlaceholder('Priority 1').fill('Keep the new week honest');
    await modal.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(modal.getByText(/^Step 4 of 5/)).toBeVisible();
    await modal.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(modal.getByText(/^Step 5 of 5/)).toBeVisible();
    await modal.getByRole('button', { name: 'Confirm & Save' }).click();
    await expect(modal.getByText('Review saved', { exact: true })).toBeVisible({
      timeout: 30_000,
    });

    await returnToApp(page);
    const rows = await queryRows(
      page,
      `SELECT week_key, week_start_date, week_end_date FROM weekly_reviews WHERE deleted_at IS NULL`,
    );
    expect(rows).toEqual([
      {
        week_key: '2026-08-24',
        week_start_date: '2026-08-24',
        week_end_date: '2026-08-30',
      },
    ]);
  });
});
