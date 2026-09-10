import { test, expect } from './fixtures';
import { clearDatabase } from './helpers/db';
import { queryRows, returnToApp, runSql } from './helpers/dbHarness';
import { goToTab } from './helpers/navigation';

/**
 * Direct Overview coverage (previous audits found the dashboard was only ever
 * used as a navigation entry): the Next Best Action hero must render from real
 * data and the dashboard customize layout must persist across a reload. Row
 * oracles back the visible facts.
 */
test.describe('Overview dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, 'overview');
    await clearDatabase(page);
    await goToTab(page, 'overview');
  });

  test('next best action renders from a real todo due today', async ({ page }) => {
    const todayKey = await page.evaluate(() => {
      const date = new Date();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${date.getFullYear()}-${mm}-${dd}`;
    });
    await runSql(
      page,
      `INSERT INTO todos
         (id, title, notes, completed, completed_at, due_date, priority, sort_order,
          recurrence, recurrence_id, project_id, goal_id, created_at, updated_at, deleted_at)
       VALUES ('todo_e2e_nba', 'File taxes', NULL, 0, NULL, '${todayKey}', 'normal', 1,
               NULL, NULL, NULL, NULL, '2026-09-10T00:00:00.000Z', '2026-09-10T00:00:00.000Z', NULL)`,
    );
    await returnToApp(page);
    await goToTab(page, 'overview');

    await expect(
      page.getByRole('button', {
        name: 'Next best action: File taxes. Due today. Open To-Do',
      }),
    ).toBeVisible({ timeout: 20_000 });

    const rows = await queryRows(
      page,
      `SELECT title, completed, due_date FROM todos WHERE deleted_at IS NULL`,
    );
    expect(rows).toEqual([{ title: 'File taxes', completed: 0, due_date: todayKey }]);
  });

  test('customize dashboard toggles persist across a reload', async ({ page }) => {
    await page.getByRole('button', { name: 'Customize dashboard' }).click();
    await expect(page.getByText('Customize dashboard', { exact: true })).toBeVisible();

    const hideWorkout = page.getByRole('checkbox', { name: 'Hide Workout card' });
    await expect(hideWorkout).toBeVisible();
    await hideWorkout.click();

    // Persisted layout no longer includes the hidden card.
    const stored = await page.evaluate(() =>
      window.localStorage.getItem('superhabits.overview.cardLayout'),
    );
    expect(stored).not.toBeNull();
    expect(JSON.parse(String(stored))).not.toContain('workout');

    await page.reload({ waitUntil: 'load' });
    await expect(page.getByRole('button', { name: 'Customize dashboard' })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: 'Customize dashboard' }).click();
    await expect(page.getByRole('checkbox', { name: 'Show Workout card' })).toBeVisible();
  });
});
