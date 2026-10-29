import { test, expect } from './fixtures';
import { goToTab } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { returnToApp } from './helpers/dbHarness';
import { seedSql } from './helpers/seed';
import { advanceToNextDay, installClock } from './helpers/clock';

/**
 * To Do derived "today" state across a local-midnight rollover while the app
 * stays mounted (the CG-1 / `past-midnight-freshness` scenario, applied to the
 * To Do tab's counts and row meta).
 *
 * Regression pin for the stale-"today" bugs in the To Do tab: the overdue
 * summary count (`overdueTasksCount`) and the per-row due meta
 * (`buildTodoRowMeta`) are derived state keyed to "today", so they must follow
 * the local day across midnight even when no todo row changed — the summary
 * chip line and the row meta must agree with `todayKey`-driven derivations.
 *
 * Manila 2026-08-03 23:55 == 2026-08-03T15:55Z (Asia/Manila is UTC+8, no DST;
 * playwright.config.ts pins the browser timezone).
 */
const START_EPOCH = Date.UTC(2026, 7, 3, 15, 55, 0, 0);

test.describe('To Do day rollover', () => {
  test.beforeEach(async ({ page }) => {
    // Install the fake clock BEFORE the first navigation that mounts the app.
    await installClock(page, new Date(START_EPOCH));
    await goToTab(page, 'todos');
    await clearDatabase(page);
    await goToTab(page, 'todos');
    await seedSql(
      page,
      `INSERT INTO todos (id,title,completed,priority,sort_order,due_date,created_at,updated_at) VALUES ('todo_rollover_1','Pay the electricity bill',0,'normal',0,'2026-08-03','2026-08-03T15:50:00.000Z','2026-08-03T15:50:00.000Z');`,
    );
    await returnToApp(page);
    await goToTab(page, 'todos');
  });

  test('the overdue count and row meta follow the local day across midnight', async ({ page }) => {
    // Scope to the To Do section: the mounted-but-inactive Overview card
    // renders its own "1 due today" count for the same rows.
    const panel = page.getByRole('tabpanel', { name: 'To Do' });
    const row = page.getByRole('button', { name: 'Edit task: Pay the electricity bill' });

    // 23:55 on the boundary day: the only open todo is due today.
    await expect(row).toBeVisible();
    await expect(row.getByText('Today', { exact: true })).toBeVisible();
    await expect(panel.getByText('1 due today')).toBeVisible();
    await expect(panel.getByText('1 overdue')).toHaveCount(0);

    // Cross local midnight with the app still mounted; no todo row changes.
    await advanceToNextDay(page);

    // The row meta must no longer call yesterday's due date "Today"…
    await expect(row.getByText('Overdue · Aug 3')).toBeVisible();
    await expect(row.getByText('Today', { exact: true })).toHaveCount(0);
    // …and the summary chip line must agree with it.
    await expect(panel.getByText('1 overdue')).toBeVisible();
    await expect(panel.getByText('1 due today')).toHaveCount(0);
  });
});
