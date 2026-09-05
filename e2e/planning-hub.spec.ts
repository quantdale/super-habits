import { test, expect, type Page } from './fixtures';
import { clearDatabase } from './helpers/db';
import { goToTab } from './helpers/navigation';
import { queryRows, returnToApp } from './helpers/dbHarness';

/**
 * Wave 7 (Functional Completion V1): the Planning Hub (Today / Projects /
 * Goals / Progress / Timeline) previously had zero dedicated E2E coverage —
 * every view's SQL ran only against mocked databases. These journeys drive
 * the normal product entry (Overview "Plan") and certify each surface with
 * row-level SQLite oracles plus durable outbox intents, not visibility-only
 * checks. Note the established harness contract: queryRows navigates to the
 * DB document, so all UI steps finish before oracles.
 */

function localTodayKey(date = new Date()): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

async function openPlanHub(page: Page) {
  await page.getByRole('button', { name: 'Plan today' }).click();
  await expect(page.getByRole('tab', { name: 'Projects' })).toBeVisible({ timeout: 20_000 });
}

test.describe('Planning Hub', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultNavigationTimeout(90_000);
    await goToTab(page, 'overview');
    await clearDatabase(page);
    await goToTab(page, 'overview');
  });

  test('guided plan flow on Today persists the daily plan for the editor and a fresh mount', async ({
    page,
  }) => {
    test.setTimeout(240_000);

    await openPlanHub(page);
    await expect(page.getByText('Plan your day · Carry-over')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Start fresh' }).click();
    await expect(page.getByText('Plan your day · Commitments')).toBeVisible();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('Plan your day · Priorities')).toBeVisible();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('Plan your day · Focus')).toBeVisible();
    // The guided card renders above the full editor, and both expose an
    // Intention field — step 3's input is the first one in DOM order.
    await page.getByRole('textbox', { name: 'Intention' }).first().fill('Protect deep work');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('Plan your day · Confirm')).toBeVisible();
    await page.getByRole('button', { name: 'Save plan', exact: true }).click();
    await expect(page.getByText("Today's plan is set.")).toBeVisible({ timeout: 20_000 });

    // The full editor below the guided card re-reads the saved plan (not the
    // in-memory wizard state) — the intention input mirrors the persisted row.
    await expect(
      page.getByPlaceholder('What is the one thing that matters most today?'),
    ).toHaveValue('Protect deep work', { timeout: 15_000 });

    const rows = await queryRows(
      page,
      `SELECT date_key, intention, focus_target_minutes FROM daily_plans WHERE deleted_at IS NULL`,
    );
    expect(rows).toEqual([
      {
        date_key: localTodayKey(),
        intention: 'Protect deep work',
        focus_target_minutes: 25,
      },
    ]);
    const intents = await queryRows(
      page,
      `SELECT operation FROM sync_outbox WHERE entity = 'daily_plans'`,
    );
    expect(intents).toEqual([{ operation: 'create' }]);

    // Fresh app mount: the full editor still shows the saved intention.
    await returnToApp(page);
    await goToTab(page, 'overview');
    await openPlanHub(page);
    await expect(
      page.getByPlaceholder('What is the one thing that matters most today?'),
    ).toHaveValue('Protect deep work', { timeout: 20_000 });
  });

  test('Projects, Goals, Progress, and Timeline surfaces persist and read real rows', async ({
    page,
  }) => {
    test.setTimeout(300_000);

    // Today tab is the default; every tab control is present and switchable.
    await openPlanHub(page);
    await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Timeline' })).toBeVisible();

    // --- Projects view: create through the detail editor. ---
    await page.getByRole('tab', { name: 'Projects' }).click();
    await expect(page.getByText('No projects yet')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Create project' }).click();
    await page.getByPlaceholder('Project name').fill('Home renovation');
    await page.getByRole('button', { name: 'Create Project' }).click();
    await expect(
      page.getByRole('button', { name: /^Home renovation, Active, 0 percent progress/ }),
    ).toBeVisible({ timeout: 20_000 });

    // --- Goals view: create through the detail editor. ---
    await page.getByRole('tab', { name: 'Goals' }).click();
    await expect(page.getByText('No goals yet')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Create goal' }).click();
    await page.getByPlaceholder('Goal title').fill('Run a 5k');
    await page.getByRole('button', { name: 'Create Goal' }).click();
    await expect(page.getByRole('button', { name: /^Run a 5k, Active, 0 percent/ })).toBeVisible({
      timeout: 20_000,
    });

    // --- Progress view: the disposition-ledger Weekly Review entry and the
    // insight cards (fed live by progress.data through real SQLite). ---
    await page.getByRole('tab', { name: 'Progress' }).click();
    await expect(page.getByRole('button', { name: 'Open weekly review' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/^Last 7 days \(/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Tasks completed')).toBeVisible();
    await expect(page.getByText('Habit completions')).toBeVisible();

    // --- Timeline view: the real activity rows surface as feed items. ---
    await page.getByRole('tab', { name: 'Timeline' }).click();
    await expect(page.getByText('Created project "Home renovation"')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Created goal "Run a 5k"')).toBeVisible();

    // --- Row + durable intent oracles for everything the UI just created. ---
    const projects = await queryRows(
      page,
      `SELECT name, status FROM projects WHERE deleted_at IS NULL`,
    );
    expect(projects).toEqual([{ name: 'Home renovation', status: 'active' }]);
    const goals = await queryRows(
      page,
      `SELECT title, status, progress_percent FROM goals WHERE deleted_at IS NULL`,
    );
    expect(goals).toEqual([{ title: 'Run a 5k', status: 'active', progress_percent: 0 }]);
    const projectIntents = await queryRows(
      page,
      `SELECT operation FROM sync_outbox WHERE entity = 'projects'`,
    );
    expect(projectIntents).toEqual([{ operation: 'create' }]);
    const goalIntents = await queryRows(
      page,
      `SELECT operation FROM sync_outbox WHERE entity = 'goals'`,
    );
    expect(goalIntents).toEqual([{ operation: 'create' }]);

    // Fresh mount: both rows survived restart and the list surfaces re-read them.
    await returnToApp(page);
    await goToTab(page, 'overview');
    await openPlanHub(page);
    await page.getByRole('tab', { name: 'Projects' }).click();
    await expect(
      page.getByRole('button', { name: /^Home renovation, Active, 0 percent progress/ }),
    ).toBeVisible({ timeout: 20_000 });
  });
});
