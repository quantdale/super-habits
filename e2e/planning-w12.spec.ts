import { test, expect, type Page } from './fixtures';
import { clearDatabase } from './helpers/db';
import { goToTab } from './helpers/navigation';
import { returnToApp, runSql } from './helpers/dbHarness';

/**
 * W12 (tasks 7.4) — browser assertions for the Progress Insights and Activity
 * Timeline reconstruction:
 *
 * - Progress: one `More details` disclosure; headline metrics only while
 *   collapsed; no percentage derived from a zero prior window.
 * - Activity: one collapsed `Filters` control with a current-selection summary,
 *   a persisted selection across disclosure close/open, a reset, and
 *   `No matching activity` (never the genuinely-empty copy) when filters
 *   exclude everything.
 *
 * These are behaviour assertions, not visual snapshots (W15 owns snapshots).
 */
test.describe('W12 Progress and Activity reconstruction', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultNavigationTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await goToTab(page, 'overview');
    await clearDatabase(page);
    await goToTab(page, 'overview');
  });

  async function openHubView(page: Page, view: 'Progress' | 'Timeline') {
    await page.getByRole('button', { name: 'Plan today' }).click();
    const tab = page.getByRole('tab', { name: view, exact: true });
    await expect(tab).toBeVisible({ timeout: 20_000 });
    await tab.click();
    await page.waitForTimeout(400);
    return page.getByRole('dialog');
  }

  test('Progress leads with headline observations and discloses the rest', async ({ page }) => {
    const dialog = await openHubView(page, 'Progress');

    // Period context is explicit about both windows.
    await expect(dialog.getByText(/Last 7 days \(/)).toBeVisible({ timeout: 20_000 });

    // The details disclosure starts collapsed and owns the remaining metrics.
    const more = dialog.getByRole('button', { name: 'Show metric details' });
    await expect(more).toBeVisible();
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await expect(dialog.getByText('Active projects')).toHaveCount(0);
    await expect(dialog.getByText('Weekly reviews')).toHaveCount(0);

    await more.click();
    await expect(dialog.getByRole('button', { name: 'Hide metric details' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(dialog.getByText('Active projects')).toBeVisible();
    await expect(dialog.getByText('Weekly reviews')).toBeVisible();
    // Distinct units stay labelled separately (minutes vs sessions).
    await expect(dialog.getByText('Focus minutes')).toBeVisible();
    await expect(dialog.getByText('Focus sessions')).toBeVisible();
  });

  test('Progress never invents a percentage from a zero prior window', async ({ page }) => {
    // Seed activity only inside the current window (today) so the prior window
    // is provably zero. `pctDelta()` must return null and the metric row must
    // say "new this period" instead of fabricating a percentage.
    const todayKey = await page.evaluate(() => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    });
    await runSql(
      page,
      `INSERT INTO todos (id,title,notes,completed,created_at,updated_at,deleted_at,due_date,priority,sort_order,recurrence,recurrence_id,completed_at)
         VALUES ('w12_pct_1','Only current window',null,1,'${todayKey}T08:00:00.000Z','${todayKey}T08:00:00.000Z',null,'${todayKey}','normal',0,null,null,'${todayKey}T08:00:00.000Z');`,
    );
    await returnToApp(page);

    const progress = await openHubView(page, 'Progress');
    await expect(progress.getByText(/Last 7 days \(/)).toBeVisible({ timeout: 20_000 });
    await progress.getByRole('button', { name: 'Show metric details' }).click();

    // The headline row for tasks states the new value without a percentage.
    await expect(progress.getByText('new this period')).toBeVisible();
    await expect(progress.getByText(/NaN|Infinity/)).toHaveCount(0);
    // No metric derived a percentage from the empty prior window.
    await expect(progress.getByText(/\+\d+% vs prior/)).toHaveCount(0);
  });

  test('Activity shows events before a collapsed Filters control and persists the selection', async ({
    page,
  }) => {
    // Seed real activity (a completed todo + a habit completion today) through
    // the DB harness, then reload the app so the timeline has rows to render.
    const todayKey = await page.evaluate(() => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    });
    await runSql(
      page,
      `INSERT INTO todos (id,title,notes,completed,created_at,updated_at,deleted_at,due_date,priority,sort_order,recurrence,recurrence_id,completed_at)
         VALUES ('w12_evt_todo','W12 activity probe',null,1,'${todayKey}T08:00:00.000Z','${todayKey}T08:00:00.000Z',null,'${todayKey}','normal',0,null,null,'${todayKey}T08:00:00.000Z');
       INSERT INTO habits (id,name,target_per_day,reminder_time,category,icon,color,created_at,updated_at,deleted_at)
         VALUES ('w12_evt_habit','W12 habit',1,null,'anytime','loop','#10b981','${todayKey}T08:00:00.000Z','${todayKey}T08:00:00.000Z',null);
       INSERT INTO habit_completions (id,habit_id,date_key,count,created_at,updated_at)
         VALUES ('w12_evt_hcmp','w12_evt_habit','${todayKey}',1,'${todayKey}T09:00:00.000Z','${todayKey}T09:00:00.000Z');`,
    );
    await returnToApp(page);

    const dialog = await openHubView(page, 'Timeline');

    // The collapsed control summarises the default selection in words, and the
    // real event rows render before it in the DOM (no filter wall first).
    const filters = dialog.getByRole('button', { name: 'Timeline filters' });
    await expect(filters).toBeVisible({ timeout: 20_000 });
    await expect(filters).toHaveAttribute('aria-expanded', 'false');
    await expect(dialog).toContainText('All sources · Last 30 days');
    await expect(dialog.getByText('Completed "W12 activity probe"')).toBeVisible();

    // Opening exposes all three control groups; the source wrappers keep their
    // per-source accessible names (unchanged filter contract).
    await filters.click();
    await expect(dialog.getByRole('button', { name: 'Timeline filters' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(dialog.getByRole('button', { name: 'Filter timeline by Habits' })).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Show activity from the last 7 days' }),
    ).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Show activity from all time' })).toHaveCount(
      1,
    );
    await expect(dialog.getByRole('button', { name: 'All days' })).toBeVisible();

    // Selecting a non-default filter updates the closed control's summary and
    // signals an active filter count.
    await dialog.getByRole('button', { name: 'Filter timeline by Habits' }).click();
    await dialog.getByRole('button', { name: 'Show activity from the last 7 days' }).click();
    await dialog.getByRole('button', { name: 'Timeline filters, 2 active' }).click();
    await expect(dialog).toContainText('Habits · Last 7 days');

    // Reopening restores the same selection (it survived the close): the
    // disclosure body still renders the selected source/range controls and the
    // summary line still names them.
    await dialog.getByRole('button', { name: 'Timeline filters, 2 active' }).click();
    await expect(dialog.getByRole('button', { name: 'Filter timeline by Habits' })).toBeVisible();
    await expect(dialog).toContainText('Habits · Last 7 days');

    // Reset returns to defaults and clears the active signal.
    await dialog.getByRole('button', { name: 'Reset filters' }).click();
    await expect(dialog.getByRole('button', { name: 'Timeline filters' })).toBeVisible();
    await expect(dialog).toContainText('All sources · Last 30 days');
  });

  test('Activity distinguishes filtered-empty from genuinely-empty', async ({ page }) => {
    // Seed exactly one habit completion, then filter to a source that has no
    // events: the result must say "No matching activity", not the empty copy.
    const todayKey = await page.evaluate(() => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    });
    await runSql(
      page,
      `INSERT INTO habits (id,name,target_per_day,reminder_time,category,icon,color,created_at,updated_at,deleted_at)
         VALUES ('w12_fe_habit','Filter probe habit',1,null,'anytime','loop','#10b981','${todayKey}T08:00:00.000Z','${todayKey}T08:00:00.000Z',null);
       INSERT INTO habit_completions (id,habit_id,date_key,count,created_at,updated_at)
         VALUES ('w12_fe_hcmp','w12_fe_habit','${todayKey}',1,'${todayKey}T09:00:00.000Z','${todayKey}T09:00:00.000Z');`,
    );
    await returnToApp(page);

    const dialog = await openHubView(page, 'Timeline');
    await expect(dialog.getByRole('button', { name: 'Timeline filters' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(dialog.getByText('Nothing logged yet')).toHaveCount(0);

    // Filter to Workout — the seeded habit completion does not match.
    await dialog.getByRole('button', { name: 'Timeline filters' }).click();
    await dialog.getByRole('button', { name: 'Filter timeline by Workout' }).click();
    await expect(dialog.getByText('No matching activity')).toBeVisible();
    await expect(dialog.getByText('Nothing logged yet')).toHaveCount(0);
  });

  test('Activity genuinely-empty state is distinct from filtered-empty', async ({ page }) => {
    const dialog = await openHubView(page, 'Timeline');
    await expect(dialog.getByText('Nothing logged yet')).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByText('No matching activity')).toHaveCount(0);
  });

  // Audit C §7: "All time" used to run the same 90-day, per-source-truncated
  // query as "90d". It must now reach history older than 90 days, in pages.
  test('Activity "All time" reaches history older than 90 days, one page at a time', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const oldestDayKey = await page.evaluate(() => {
      const d = new Date();
      d.setDate(d.getDate() - 400);
      const p = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    });
    const oldestStamp = `${oldestDayKey}T08:00:00.000Z`;

    // One 400-day-old completion (invisible to every bounded chip) plus enough
    // recent rows to push the merged feed past the first page.
    const recentRows = Array.from({ length: 130 }, (_, i) => {
      const id = `w12all_${String(i).padStart(3, '0')}`;
      const stamp = new Date(Date.now() - i * 60_000).toISOString();
      return `INSERT INTO todos (id,title,notes,completed,created_at,updated_at,deleted_at,due_date,priority,sort_order,recurrence,recurrence_id,completed_at)
        VALUES ('${id}','Paged ${i}',null,1,'${stamp}','${stamp}',null,null,'normal',0,null,null,'${stamp}');`;
    }).join('\n');
    await runSql(
      page,
      `INSERT INTO todos (id,title,notes,completed,created_at,updated_at,deleted_at,due_date,priority,sort_order,recurrence,recurrence_id,completed_at)
         VALUES ('w12all_old','Ancient task',null,1,'${oldestStamp}','${oldestStamp}',null,null,'normal',0,null,null,'${oldestStamp}');
       ${recentRows}`,
    );
    await returnToApp(page);

    const dialog = await openHubView(page, 'Timeline');
    const loadMore = dialog.getByRole('button', { name: 'Load more' });
    await expect(loadMore).toBeVisible({ timeout: 30_000 });
    // The default 30-day window genuinely cannot see the ancient row.
    await expect(dialog.getByText('Ancient task')).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Timeline filters' }).click();
    await dialog.getByRole('button', { name: 'Show activity from all time' }).click();
    await expect(dialog).toContainText('All time');

    // Paging is the only way to that row: take pages until it shows up.
    const ancient = dialog.getByText('Ancient task');
    for (let paged = 0; paged < 5 && !(await ancient.isVisible()); paged += 1) {
      await loadMore.click();
      await page.waitForTimeout(300);
    }
    await expect(ancient).toBeVisible({ timeout: 20_000 });
    // The feed is exhausted, so the paging control is gone.
    await expect(loadMore).toHaveCount(0);
  });
});
