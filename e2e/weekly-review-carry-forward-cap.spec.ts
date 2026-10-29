import { test, expect, type Page } from './fixtures';
import { clearDatabase } from './helpers/db';
import { goToTab } from './helpers/navigation';
import { returnToApp, queryRows, runSql } from './helpers/dbHarness';

/**
 * Weekly Review carry-forward cap disclosure (bughunt20 F1).
 *
 * `buildNextWeekPlanSuggestions` caps next-week placement at 3 priorities per
 * day over the first 7 days (21 slots). Everything past that can never be
 * scheduled, so the review must SAY how many candidates were dropped —
 * otherwise the user is told "{N} candidates can seed next week's plans", sees
 * "Added 21 priorities across 7 days", and the rest silently vanish from the
 * week with no plan entry and no warning.
 *
 * The data layer used to compute that dropped count from the already-truncated
 * suggestion list (21 − 21 = 0), so the disclosure was unreachable dead code.
 * This spec drives the real UI to the post-confirm apply button with 25
 * candidates and asserts the dropped 4 are named.
 */
test.describe('Weekly Review carry-forward cap disclosure', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultNavigationTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await goToTab(page, 'overview');
    await clearDatabase(page);
    await goToTab(page, 'overview');
  });

  /** Open the Weekly Review overlay from the hub's Progress view. */
  async function openReviewFromHub(page: Page) {
    await page.getByRole('button', { name: 'View Momentum Garden' }).click();
    const openReview = page.getByRole('dialog').getByRole('button', { name: 'Open weekly review' });
    await expect(openReview).toBeVisible({ timeout: 20_000 });
    await openReview.click();
    const modal = page.getByRole('dialog');
    await expect(modal.getByText(/^Step 1 of 5/)).toBeVisible({ timeout: 20_000 });
    return modal;
  }

  /**
   * Seed 25 unfinished todos due INSIDE the reviewed week, so every one of them
   * becomes a carry-forward candidate on the Decide step (the screen defaults
   * each candidate to `carry_forward`).
   */
  async function seedOverCapCandidates(page: Page) {
    const week = await page.evaluate(() => {
      const now = new Date();
      const monday = new Date(now);
      const dayOfWeek = monday.getDay();
      monday.setDate(monday.getDate() + (dayOfWeek === 0 ? -6 : 1 - dayOfWeek));
      const key = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
          d.getDate(),
        ).padStart(2, '0')}`;
      const tuesday = new Date(monday);
      tuesday.setDate(monday.getDate() + 1);
      return { weekStart: key(monday), weekDue: key(tuesday) };
    });

    const values = Array.from({ length: 25 }, (_, i) => {
      const id = `e2e_carry_${String(i).padStart(2, '0')}`;
      return `('${id}','Carry candidate ${i + 1}',null,0,'${week.weekStart}T00:30:00.000Z','${week.weekStart}T00:30:00.000Z',null,'${week.weekDue}','normal',${i},null,null,null)`;
    }).join(',');
    await runSql(
      page,
      `INSERT INTO todos (id,title,notes,completed,created_at,updated_at,deleted_at,due_date,priority,sort_order,recurrence,recurrence_id,completed_at)
         VALUES ${values};`,
    );
    return week;
  }

  test('names the priorities the 21-slot cap dropped instead of claiming everything was added', async ({
    page,
  }) => {
    test.setTimeout(240_000);

    const week = await seedOverCapCandidates(page);
    await returnToApp(page);
    await goToTab(page, 'overview');

    const modal = await openReviewFromHub(page);
    const next = modal.getByRole('button', { name: 'Next', exact: true });

    // review → decide: all 25 seeded todos are offered as carry-forward
    // candidates (single-priority text is required before Confirm validates).
    await next.click();
    await expect(modal.getByText(/^Step 2 of 5/)).toBeVisible();
    await next.click(); // plan

    await modal.getByRole('button', { name: 'Add priority' }).click();
    await modal.getByPlaceholder('Priority 1').fill('Protect deep work');

    await next.click(); // reflect
    await next.click(); // confirm
    await expect(modal.getByText(/^Step 5 of 5/)).toBeVisible();
    await modal.getByRole('button', { name: 'Confirm & Save' }).click();
    await expect(modal.getByText('Review saved', { exact: true })).toBeVisible({
      timeout: 30_000,
    });

    // The done step mentions every candidate the carry-forward decision covers.
    await expect(modal.getByText(/25 carry-forward candidates can seed next week/)).toBeVisible();

    await modal.getByRole('button', { name: /Add carry-forwards to next week/ }).click();

    // 21 fit the week (3/day × 7 days); the other 4 must be named, not dropped.
    await expect(modal.getByText(/Added 21 priorities across 7 days of next week\./)).toBeVisible({
      timeout: 30_000,
    });
    await expect(modal.getByText(/4 candidates didn't fit the weekly schedule/)).toBeVisible();

    // Durable truth: exactly 21 candidate ids landed on next week's plans and
    // the 4 that could not fit are still open todos (never silently deleted).
    await returnToApp(page);
    const planned = await queryRows(
      page,
      `SELECT top_todo_ids FROM daily_plans
        WHERE deleted_at IS NULL AND date_key >= '${week.weekStart}' ORDER BY date_key`,
    );
    const plannedIds = planned.flatMap(
      (row) => JSON.parse(String(row.top_todo_ids ?? '[]')) as string[],
    );
    expect(plannedIds.filter((id) => id.startsWith('e2e_carry_'))).toHaveLength(21);
    expect(
      await queryRows(
        page,
        `SELECT id FROM todos WHERE id LIKE 'e2e_carry_%' AND deleted_at IS NULL`,
      ),
    ).toHaveLength(25);
  });
});
