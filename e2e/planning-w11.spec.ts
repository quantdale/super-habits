import { test, expect, type Page } from './fixtures';
import { clearDatabase } from './helpers/db';
import { goToTab } from './helpers/navigation';
import { queryRows } from './helpers/dbHarness';

/** W11 disclosure & planning journeys. SQLite oracles come last because the
 * database harness replaces the active app page/worker. */
async function openPlanning(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Plan today' }).click();
  await expect(page.getByRole('tab', { name: 'Projects' })).toBeVisible({ timeout: 20_000 });
}

test.describe('W11 Planning disclosure hierarchy', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goToTab(page, 'overview');
    await clearDatabase(page);
    await goToTab(page, 'overview');
  });

  test('projects show objective first; filters preserve state when collapsed', async ({ page }) => {
    await openPlanning(page);
    await page.getByRole('tab', { name: 'Projects' }).click();
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(page.getByRole('button', { name: 'Project more options' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expect(page.getByPlaceholder('Optional')).toHaveCount(0);
    await page.getByPlaceholder('Project name').fill('W11 Project');
    await page.getByRole('button', { name: 'Project more options' }).click();
    await expect(page.getByPlaceholder('Optional')).toHaveCount(2);
    await page.getByRole('button', { name: 'Create Project' }).click();

    await expect(
      page.getByRole('button', { name: /^W11 Project, Active, 0 percent progress/ }),
    ).toBeVisible();
    const filters = page.getByRole('button', { name: 'Projects filters and sort' });
    await expect(filters).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('button', { name: 'Filter projects by Completed' })).toHaveCount(0);
    await filters.click();
    await expect(filters).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('button', { name: 'Filter projects by Completed' }).click();
    await expect(page.getByText('No matching projects')).toBeVisible();
    await filters.click();
    await expect(filters).toContainText('Active');
    await expect(page.getByText('No matching projects')).toBeVisible();
    await filters.click();
    await page.getByRole('button', { name: 'Filter projects by All' }).click();
    await expect(
      page.getByRole('button', { name: /^W11 Project, Active, 0 percent progress/ }),
    ).toBeVisible();

    const rows = await queryRows(
      page,
      'SELECT name, status FROM projects WHERE deleted_at IS NULL',
    );
    expect(rows).toEqual([{ name: 'W11 Project', status: 'active' }]);
  });

  test('goals share the row grammar and preserve manual progress', async ({ page }) => {
    await openPlanning(page);
    await page.getByRole('tab', { name: 'Goals' }).click();
    await page.getByRole('button', { name: 'Create goal' }).click();
    await expect(page.getByRole('button', { name: 'Goal more options' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await page.getByPlaceholder('Goal title').fill('W11 Run');
    await page.getByRole('button', { name: '+10' }).click();
    // W11 rendered-audit finding: the typed percentage and +/- controls
    // must reflect the same editable value, never 10% above a stale "0".
    await expect(page.getByRole('textbox', { name: 'Goal progress percent' })).toHaveValue('10');
    await page.getByRole('button', { name: 'Goal more options' }).click();
    await expect(page.getByPlaceholder('Optional')).toHaveCount(2);
    await page.getByRole('button', { name: 'Create Goal' }).click();
    await expect(page.getByRole('button', { name: /^W11 Run, Active, 10 percent/ })).toBeVisible();
    const filters = page.getByRole('button', { name: 'Goals filters and sort' });
    await expect(filters).toHaveAttribute('aria-expanded', 'false');
    await filters.click();
    await page.getByRole('button', { name: 'Filter goals by Completed status' }).click();
    await expect(page.getByText('No matching goals')).toBeVisible();
    await filters.click();
    await expect(filters).toContainText('Active');
    await filters.click();
    await page.getByRole('button', { name: 'Filter goals by All status' }).click();
    await expect(page.getByRole('button', { name: /^W11 Run, Active, 10 percent/ })).toBeVisible();

    const rows = await queryRows(
      page,
      'SELECT title, status, progress_percent FROM goals WHERE deleted_at IS NULL',
    );
    expect(rows).toEqual([{ title: 'W11 Run', status: 'active', progress_percent: 10 }]);
  });

  test('Daily Plan hides optional fields, retains drafts, commits and completes', async ({
    page,
  }) => {
    await openPlanning(page);
    await expect(page.getByText(/Plan for 20\d\d-/)).toBeVisible();
    const picker = page.getByRole('button', { name: 'Add priority' });
    await expect(picker).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('textbox', { name: 'Quick-add priority' })).toHaveCount(0);
    await picker.click();
    await expect(page.getByRole('textbox', { name: 'Quick-add priority' })).toBeVisible();
    await page.getByRole('button', { name: 'Hide priority picker' }).click();

    const options = page.getByRole('button', { name: 'More planning options' });
    await expect(options).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('textbox', { name: 'Notes' })).toHaveCount(0);
    await options.click();
    await page.getByRole('textbox', { name: 'Notes' }).fill('Keep it calm');
    await page.getByRole('textbox', { name: 'Focus target (minutes)' }).fill('30');
    await options.click();
    await page
      .getByPlaceholder('What is the one thing that matters most today?')
      .fill('Ship W11 work');
    await page.getByRole('button', { name: 'Save Plan' }).click();
    await expect(page.getByText('Committed', { exact: true })).toBeVisible();

    const reflection = page.getByRole('button', { name: 'End-of-day reflection' });
    await expect(reflection).toHaveAttribute('aria-expanded', 'false');
    await reflection.click();
    await page.getByRole('textbox', { name: 'Reflection' }).fill('Made solid progress');
    await page.getByRole('button', { name: 'Energy 4' }).click();
    await page.getByRole('button', { name: 'Complete Daily Plan' }).click();
    await expect(page.getByText('Plan completed.')).toBeVisible();

    const rows = await queryRows(
      page,
      'SELECT intention, notes, reflection, focus_target_minutes, energy_score, status FROM daily_plans WHERE deleted_at IS NULL',
    );
    expect(rows).toEqual([
      {
        intention: 'Ship W11 work',
        notes: 'Keep it calm',
        reflection: 'Made solid progress',
        focus_target_minutes: 30,
        energy_score: 4,
        status: 'completed',
      },
    ]);
  });
});
