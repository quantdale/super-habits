import { test, expect } from './fixtures';
import { clearDatabase } from './helpers/db';
import { goToTab } from './helpers/navigation';
import { queryRows, returnToApp } from './helpers/dbHarness';

/**
 * Wave 6 (task 5.3): the shipped Weekly Review loop must be reachable from the
 * normal in-app flow (Progress surface, per the disposition ledger) and the
 * history delete must be real: soft delete + durable delete intent, with the
 * review gone from the history list afterwards.
 */
test.describe('Weekly Review', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultNavigationTimeout(90_000);
    await goToTab(page, 'overview');
    await clearDatabase(page);
    await goToTab(page, 'overview');
  });

  test('guided flow from Progress persists the review, survives a revisit, and deletes with a durable intent', async ({
    page,
  }) => {
    test.setTimeout(180_000);

    // Progress surface entry (Momentum Garden button opens the hub on Progress).
    await page.getByRole('button', { name: 'View Momentum Garden' }).click();
    const openReview = page.getByRole('button', { name: 'Open weekly review' });
    await expect(openReview).toBeVisible({ timeout: 20_000 });
    await openReview.click();

    const modal = page.getByRole('dialog');
    // Both the modal chrome title and the screen header render the heading.
    await expect(modal.getByText('Weekly Review', { exact: true }).first()).toBeVisible();
    await expect(modal.getByText(/^Week of \d{4}-\d{2}-\d{2}/)).toBeVisible({
      timeout: 20_000,
    });

    // Guided steps: summary → insights → todos → priorities (required 1) →
    // new_todos → reflection → preview → confirm.
    const next = modal.getByRole('button', { name: 'Next', exact: true });
    await next.click();
    await next.click();
    await next.click();
    await modal.getByRole('button', { name: '+ Add Priority' }).click();
    await modal.getByPlaceholder('Priority 1').fill('Protect deep work');
    await next.click();
    await next.click();
    await modal.getByPlaceholder('How did this week go?').fill('E2E reflection');
    await next.click();
    await expect(modal.getByText('Protect deep work')).toBeVisible();
    await modal.getByRole('button', { name: 'Confirm & Save' }).click();
    await expect(modal.getByText('Review Complete ✓', { exact: true })).toBeVisible({
      timeout: 30_000,
    });

    // Close the flow first: queryRows switches to the DB harness document,
    // which unloads the app (and the modal) until returnToApp.
    await modal.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const saved = await queryRows(
      page,
      `SELECT status, reflection FROM weekly_reviews WHERE deleted_at IS NULL`,
    );
    expect(saved).toHaveLength(1);
    expect(saved[0].status).toBe('completed');
    expect(saved[0].reflection).toBe('E2E reflection');
    const saveIntents = await queryRows(
      page,
      `SELECT operation FROM sync_outbox WHERE entity = 'weekly_reviews'`,
    );
    expect(saveIntents).toEqual([{ operation: 'create' }]);

    // Revisit: re-enter from Progress — the review is in history and
    // the week is flagged as already reviewed.
    await returnToApp(page);
    await goToTab(page, 'overview');
    await page.getByRole('button', { name: 'View Momentum Garden' }).click();
    await expect(openReview).toBeVisible({ timeout: 20_000 });
    await openReview.click();
    await expect(
      page.getByRole('dialog').getByText('A review for this week already exists.'),
    ).toBeVisible({ timeout: 20_000 });

    await page.getByRole('dialog').getByLabel('Show past reviews').click();
    const historyRow = page
      .getByRole('dialog')
      .getByRole('button', { name: /^Week of \d{4}-\d{2}-\d{2} review/ });
    await expect(historyRow).toBeVisible();
    await historyRow.click();

    // Confirmed delete from the expanded history row.
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^Delete review for week/ })
      .click();
    await expect(page.getByText('Delete weekly review', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Delete review', exact: true }).click();
    await expect(page.getByText('No past reviews yet')).toBeVisible({ timeout: 15_000 });

    const afterDelete = await queryRows(
      page,
      `SELECT deleted_at FROM weekly_reviews WHERE deleted_at IS NOT NULL`,
    );
    expect(afterDelete).toHaveLength(1);
    const live = await queryRows(page, `SELECT id FROM weekly_reviews WHERE deleted_at IS NULL`);
    expect(live).toHaveLength(0);
    // The outbox coalesces per (entity, id): the delete intent superseded the
    // create — the durable intent for the remote copy is 'delete'.
    const deleteIntents = await queryRows(
      page,
      `SELECT operation FROM sync_outbox WHERE entity = 'weekly_reviews'`,
    );
    expect(deleteIntents).toEqual([{ operation: 'delete' }]);
  });
});
