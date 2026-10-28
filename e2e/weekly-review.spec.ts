import { test, expect } from './fixtures';
import { clearDatabase } from './helpers/db';
import { goToTab } from './helpers/navigation';
import { queryRows, returnToApp, runSql } from './helpers/dbHarness';
import { seedSql } from './helpers/seed';

/**
 * Wave 6 (task 5.3): the shipped Weekly Review loop must be reachable from the
 * normal in-app flow (Progress surface, per the disposition ledger) and the
 * history delete must be real: soft delete + durable delete intent, with the
 * review gone from the history list afterwards.
 *
 * W12 (design D12.2) reduced the guided flow from seven steps to five
 * (`review → decide → plan → reflect → confirm`) and moved every domain count
 * behind one `All numbers` disclosure. The SQLite/outbox oracles below are
 * unchanged in meaning; only the tap sequence that reaches Confirm changed.
 */
test.describe('Weekly Review', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultNavigationTimeout(90_000);
    await goToTab(page, 'overview');
    await clearDatabase(page);
    await goToTab(page, 'overview');
  });

  /** Open the Weekly Review overlay from the hub's Progress view. */
  async function openReviewFromHub(page: import('@playwright/test').Page) {
    await page.getByRole('button', { name: 'View Momentum Garden' }).click();
    const openReview = page.getByRole('dialog').getByRole('button', { name: 'Open weekly review' });
    await expect(openReview).toBeVisible({ timeout: 20_000 });
    await openReview.click();
    const modal = page.getByRole('dialog');
    await expect(modal.getByText(/^Step 1 of 5/)).toBeVisible({ timeout: 20_000 });
    return modal;
  }

  test('guided flow from Progress persists the review, survives a revisit, and deletes with a durable intent', async ({
    page,
  }) => {
    test.setTimeout(180_000);

    // Progress surface entry (Momentum Garden button opens the hub on Progress).
    const modal = await openReviewFromHub(page);
    await expect(modal.getByText('Weekly Review', { exact: true }).first()).toBeVisible();

    // W12: the review step leads with the week range and its factual story;
    // the statistics live behind one disclosure.
    await expect(modal.getByText(/^\d{4}-\d{2}-\d{2} – \d{4}-\d{2}-\d{2}$/)).toBeVisible();
    const allNumbers = modal.getByRole('button', { name: 'Show all numbers' });
    await expect(allNumbers).toBeVisible();
    await expect(allNumbers).toHaveAttribute('aria-expanded', 'false');
    await allNumbers.click();
    await expect(modal.getByRole('button', { name: 'Hide all numbers' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(modal.getByText('Consistency')).toBeVisible();

    // review → decide → plan
    const next = modal.getByRole('button', { name: 'Next', exact: true });
    await next.click();
    await expect(modal.getByText(/^Step 2 of 5/)).toBeVisible();
    await next.click();
    await expect(modal.getByText(/^Step 3 of 5/)).toBeVisible();

    // Plan step: priorities first (required 1), then commitments.
    await modal.getByRole('button', { name: 'Add priority' }).click();
    await modal.getByPlaceholder('Priority 1').fill('Protect deep work');

    // plan → reflect → confirm
    await next.click();
    await expect(modal.getByText(/^Step 4 of 5/)).toBeVisible();
    await modal.getByPlaceholder('How did this week go?').fill('E2E reflection');
    await next.click();
    await expect(modal.getByText(/^Step 5 of 5/)).toBeVisible();
    await expect(modal.getByText('Protect deep work')).toBeVisible();
    await modal.getByRole('button', { name: 'Confirm & Save' }).click();
    await expect(modal.getByText('Review saved', { exact: true })).toBeVisible({
      timeout: 30_000,
    });

    // Close the flow first: queryRows switches to the DB harness document,
    // which unloads the app (and the modal) until returnToApp.
    await modal.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const saved = await queryRows(
      page,
      `SELECT status, reflection, plan_payload FROM weekly_reviews WHERE deleted_at IS NULL`,
    );
    expect(saved).toHaveLength(1);
    expect(saved[0].status).toBe('completed');
    expect(saved[0].reflection).toBe('E2E reflection');
    // The persisted plan payload carries the priority the Plan step collected.
    expect(String(saved[0].plan_payload)).toContain('Protect deep work');
    const saveIntents = await queryRows(
      page,
      `SELECT operation FROM sync_outbox WHERE entity = 'weekly_reviews'`,
    );
    expect(saveIntents).toEqual([{ operation: 'create' }]);

    // Revisit: re-enter from Progress — the review is in history and
    // the week is flagged as already reviewed.
    await returnToApp(page);
    await goToTab(page, 'overview');
    const revisit = await openReviewFromHub(page);
    await expect(revisit.getByText('A review for this week already exists.')).toBeVisible();

    await page.getByRole('dialog').getByRole('button', { name: 'Show past reviews' }).click();
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

  test('counts a completion in the week it was finished, not the week it was due', async ({
    page,
  }) => {
    // Weekly-review F8: "Completed this week" used to window by `due_date`, so
    // an undated task finished today was invisible (the review said "Nothing
    // scheduled this week") while a task finished months ago whose due date
    // fell inside the week was credited as this week's work.
    const todayKey = await page.evaluate(() => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    });
    await runSql(
      page,
      `INSERT INTO todos (id,title,notes,completed,created_at,updated_at,deleted_at,due_date,priority,sort_order,recurrence,recurrence_id,completed_at)
         VALUES ('wrev_undated','Undated but finished today',null,1,'${todayKey}T01:00:00.000Z','${todayKey}T10:00:00.000Z',null,null,'normal',0,null,null,'${todayKey}T10:00:00.000Z');`,
    );
    await returnToApp(page);
    await goToTab(page, 'overview');

    const modal = await openReviewFromHub(page);
    await expect(modal.getByText('Completed 1 todo this week')).toBeVisible({ timeout: 20_000 });
    await expect(modal.getByText('Nothing scheduled this week.')).toHaveCount(0);

    // The row is really undated — the count cannot be a due-date coincidence.
    await returnToApp(page);
    expect(
      await queryRows(page, `SELECT due_date, completed_at FROM todos WHERE id = 'wrev_undated'`),
    ).toEqual([{ due_date: null, completed_at: `${todayKey}T10:00:00.000Z` }]);
  });

  test('a rejected review write reports failure and never renders the saved state', async ({
    page,
  }) => {
    test.setTimeout(240_000);

    // Install a real SQLite rejection on the review insert through the DB
    // harness BEFORE touching the UI (harness navigation unloads the app), the
    // established W11.5 pattern. Nothing else writes weekly_reviews.
    await seedSql(
      page,
      `CREATE TRIGGER w12_reject_review_insert
         BEFORE INSERT ON weekly_reviews
         BEGIN SELECT RAISE(ABORT, 'review-write-blocked'); END;`,
    );
    // seedSql leaves the page on the DB-harness document; re-enter the app
    // before driving the UI.
    await returnToApp(page);
    await goToTab(page, 'overview');

    const modal = await openReviewFromHub(page);
    const next = modal.getByRole('button', { name: 'Next', exact: true });
    await next.click(); // decide
    await next.click(); // plan
    await modal.getByRole('button', { name: 'Add priority' }).click();
    await modal.getByPlaceholder('Priority 1').fill('Rejected save');
    await next.click(); // reflect
    await next.click(); // confirm

    await modal.getByRole('button', { name: 'Confirm & Save' }).click();
    await expect(page.getByText(/The review was not saved/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Review saved', { exact: true })).toHaveCount(0);

    // Durable truth: the rejected write left no row and no outbox intent.
    await returnToApp(page);
    expect(await queryRows(page, `SELECT id FROM weekly_reviews`)).toHaveLength(0);
    expect(
      await queryRows(page, `SELECT operation FROM sync_outbox WHERE entity = 'weekly_reviews'`),
    ).toHaveLength(0);
    await runSql(page, 'DROP TRIGGER w12_reject_review_insert');

    // The retry (trigger dropped) persists exactly one review.
    await returnToApp(page);
    const retryModal = await openReviewFromHub(page);
    const retryNext = retryModal.getByRole('button', { name: 'Next', exact: true });
    await retryNext.click();
    await retryNext.click();
    await retryModal.getByRole('button', { name: 'Add priority' }).click();
    await retryModal.getByPlaceholder('Priority 1').fill('Recovered priority');
    await retryNext.click();
    await retryNext.click();
    await retryModal.getByRole('button', { name: 'Confirm & Save' }).click();
    await expect(retryModal.getByText('Review saved', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await returnToApp(page);
    const savedRows = await queryRows(
      page,
      `SELECT status FROM weekly_reviews WHERE deleted_at IS NULL`,
    );
    expect(savedRows).toEqual([{ status: 'completed' }]);
  });
});
