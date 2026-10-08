import { test, expect, type Page } from './fixtures';
import { goToTab } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { advanceToNextDay, installClock } from './helpers/clock';
import { expectRows } from './helpers/oracles';

/** Opens the add-habit modal from the header action. */
async function openAddHabitModal(page: Page) {
  await expect(page.getByText('Daily check-in')).toBeVisible({ timeout: 15_000 });
  const nameField = page.getByLabel('Habit name');
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByLabel('Add habit').click({ force: true });
    try {
      await nameField.waitFor({ state: 'visible', timeout: 8_000 });
      return;
    } catch {
      /* retry */
    }
  }
  throw new Error('Add-habit modal did not open (Habit name field never visible)');
}

async function openHabitDetails(page: Page, name: string) {
  await page.getByRole('button', { name: `Open ${name} details` }).click();
}

test.describe('Habits', () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, 'habits');
    await clearDatabase(page);
    await goToTab(page, 'habits');
    await expect(page.getByText('Daily check-in')).toBeVisible({ timeout: 15_000 });
  });

  test('shows empty state when no habits exist', async ({ page }) => {
    await expect(page.getByText(/Add a habit to start today's check-in/i)).toBeVisible();
    await expect(page.getByLabel('Add habit')).toBeVisible();
  });

  test('does not add habit with empty name', async ({ page }) => {
    await openAddHabitModal(page);
    await page.getByText('Create habit', { exact: true }).locator('..').click({ force: true });
    await expect(page.getByText(/Add a habit to start today's check-in/i)).toBeVisible();
  });

  test('adds a new habit', async ({ page }) => {
    await openAddHabitModal(page);
    await page.getByLabel('Habit name').fill('Morning run');
    await page.getByText('Create habit', { exact: true }).locator('..').click({ force: true });
    await expect(page.getByText('Morning run').first()).toBeVisible();
  });

  test('opens accessible progress insights for the exact habit', async ({ page }) => {
    await openAddHabitModal(page);
    await page.getByLabel('Habit name').fill('Read progress');
    await page.getByText('Create habit', { exact: true }).locator('..').click({ force: true });
    await expect(page.getByText('Read progress', { exact: true }).first()).toBeVisible();

    await openHabitDetails(page, 'Read progress');
    await page.getByRole('dialog').getByRole('tab', { name: 'Progress', exact: true }).click();
    await expect(page.getByText('Scheduled completion rate', { exact: true })).toBeVisible();
    await expect(page.getByText('Recent target vs actual', { exact: true })).toBeVisible();
    await expect(page.getByLabel(/Current streak: 0 scheduled occurrences/i)).toBeVisible();
    await expect(
      page.getByLabel(/Last 7 days scheduled completion rate: 0 percent, 0 of 1/i),
    ).toBeVisible();
  });

  test('increments habit completion', async ({ page }) => {
    await openAddHabitModal(page);
    await page.getByLabel('Habit name').fill('Meditate');
    await page.getByText('Create habit', { exact: true }).locator('..').click({ force: true });
    await expect(page.getByText('Meditate').first()).toBeVisible();
    // Binary check-in is a semantic checkbox; quantitative add is a button.
    await page.getByRole('checkbox', { name: /Meditate: 0 of 1 today\. Check in\./ }).click();
    await expect(
      page.getByRole('checkbox', {
        name: /Meditate: 1 of 1 today\. Complete\. Activate to undo\./,
      }),
    ).toBeVisible({ timeout: 15_000 });
    // Persisted fact, not just UI chrome: the tap wrote exactly one
    // completion row (same oracle style as the sibling target-history test).
    await expectRows(page, 'SELECT count FROM habit_completions', [{ count: 1 }]);
  });

  test('habit persists after reload', async ({ page }) => {
    await openAddHabitModal(page);
    await page.getByLabel('Habit name').fill('Drink water');
    await page.getByText('Create habit', { exact: true }).locator('..').click({ force: true });
    await expect(page.getByText('Drink water').first()).toBeVisible();

    await page.reload();
    await page.waitForLoadState('load');
    await goToTab(page, 'habits');
    await expect(page.getByText('Drink water').first()).toBeVisible();
  });

  test('deletes a habit from detail settings after web confirmation', async ({ page }) => {
    await openAddHabitModal(page);
    await page.getByLabel('Habit name').fill('Delete this habit');
    await page.getByText('Create habit', { exact: true }).locator('..').click({ force: true });
    await expect(page.getByText('Delete this habit').first()).toBeVisible();
    await openHabitDetails(page, 'Delete this habit');
    await page.getByRole('dialog').getByRole('tab', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Delete Delete this habit' }).click();
    // Use the semantic Pressable and its stability checks, not a forced
    // click on animated inner text that can land on the dismiss backdrop.
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Delete habit', exact: true })
      .click();
    await expect(page.getByText('Delete this habit').first()).not.toBeVisible();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expectRows(
      page,
      "SELECT deleted_at IS NOT NULL AS deleted FROM habits WHERE name = 'Delete this habit'",
      [{ deleted: 1 }],
    );
  });
});

test.describe('Scheduled habits', () => {
  test.beforeEach(async ({ page }) => {
    await installClock(page, '2026-08-10T12:00:00');
    await goToTab(page, 'habits');
    await clearDatabase(page);
    await goToTab(page, 'habits');
    await expect(page.getByText('Daily check-in')).toBeVisible({ timeout: 15_000 });
  });

  test('creates an M/W/F habit and treats off-days as neutral', async ({ page }) => {
    await openAddHabitModal(page);
    await page.getByLabel('Habit name').fill('Gym');
    await page.getByText('Custom', { exact: true }).click();
    for (const weekday of ['Tuesday', 'Thursday', 'Saturday', 'Sunday']) {
      await page.getByRole('checkbox', { name: `${weekday} scheduled` }).click();
    }
    await page.getByText('Create habit', { exact: true }).locator('..').click({ force: true });

    await expect(page.getByText('Mon / Wed / Fri', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('checkbox', { name: 'Gym: 0 of 1 today. Check in.' }),
    ).toBeVisible();

    await advanceToNextDay(page);
    await expect(
      page.getByRole('checkbox', { name: 'Gym: Not scheduled today. Rest day.' }),
    ).toBeVisible();
    await expect(page.getByText('Nothing scheduled today')).toBeVisible();

    await advanceToNextDay(page);
    const gymButton = page.getByRole('checkbox', { name: 'Gym: 0 of 1 today. Check in.' });
    await expect(gymButton).toBeVisible();
    await gymButton.click();
    await expect(
      page.getByRole('checkbox', {
        name: 'Gym: 1 of 1 today. Complete. Activate to undo.',
      }),
    ).toBeVisible();
  });

  test('schedule edits remain visible after reload', async ({ page }) => {
    await openAddHabitModal(page);
    await page.getByLabel('Habit name').fill('Study weekdays');
    await page.getByText('Create habit', { exact: true }).locator('..').click({ force: true });
    await expect(page.getByText('Every day', { exact: true })).toBeVisible();

    await openHabitDetails(page, 'Study weekdays');
    await page.getByRole('dialog').getByRole('tab', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Edit habit' }).click();
    await page.getByText('Weekdays', { exact: true }).click();
    await page.getByText('Save changes', { exact: true }).locator('..').click({ force: true });
    await expect(page.getByText('Edit Habit', { exact: true })).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText('Weekdays', { exact: true })).toBeVisible();

    await page.reload();
    await page.waitForLoadState('load');
    await goToTab(page, 'habits');
    await expect(page.getByText('Weekdays', { exact: true })).toBeVisible();
  });

  test('reminder configuration persists and remains schedule-aware after reload', async ({
    page,
  }) => {
    await openAddHabitModal(page);
    await page.getByLabel('Habit name').fill('Gym reminder');
    await page.getByText('Custom', { exact: true }).click();
    for (const weekday of ['Tuesday', 'Thursday', 'Saturday', 'Sunday']) {
      await page.getByRole('checkbox', { name: `${weekday} scheduled` }).click();
    }
    // Web explicitly exposes native reminder support as unavailable. The
    // persisted configuration remains null rather than pretending to work.
    await expect(
      page.getByText(/Native reminders are available on Android and iOS only/i),
    ).toBeVisible();
    await page.getByText('Create habit', { exact: true }).locator('..').click({ force: true });
    await expect(page.getByText('Gym reminder', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Mon / Wed / Fri', { exact: true })).toBeVisible();

    await page.reload();
    await page.waitForLoadState('load');
    await goToTab(page, 'habits');
    await expect(page.getByText('Gym reminder', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Mon / Wed / Fri', { exact: true })).toBeVisible();
    await expect(
      page.getByText(/Native reminders are available on Android and iOS only/i),
    ).not.toBeVisible();
  });

  test('target edits keep a prior completed date complete', async ({ page }) => {
    await openAddHabitModal(page);
    await page.getByLabel('Habit name').fill('Read target history');
    await page.getByText('Create habit', { exact: true }).locator('..').click({ force: true });
    await expect(page.getByText('Read target history', { exact: true })).toBeVisible();

    await page
      .getByRole('checkbox', { name: 'Read target history: 0 of 1 today. Check in.' })
      .click();
    await expect(
      page.getByRole('checkbox', {
        name: 'Read target history: 1 of 1 today. Complete. Activate to undo.',
      }),
    ).toBeVisible();

    await advanceToNextDay(page);
    await openHabitDetails(page, 'Read target history');
    await page.getByRole('dialog').getByRole('tab', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Edit habit' }).click();
    await page.getByLabel('Target per day', { exact: true }).fill('2');
    await page.getByText('Save changes', { exact: true }).locator('..').click({ force: true });
    // Wait for the committed close, not for `Save changes` to hide: the label
    // disappears as soon as the button enters its loading state, and a guard on
    // it let the SQL oracle below navigate the page away mid-transaction,
    // aborting the OPFS write (probe: the row still read target 1 while the
    // same save with a settle committed the new target and its rule entry).
    // The modal title is unaffected by the loading state and unmounts only
    // after `updateHabit` resolves, so its disappearance marks the commit.
    await expect(page.getByText('Edit Habit', { exact: true })).toBeHidden({
      timeout: 10_000,
    });
    // Scope to the Habit groups region: the Overview habits card link shares
    // the same text and would trip strict mode.
    await expect(page.getByText('Read target history', { exact: true }).first()).toBeVisible();

    await expectRows(page, "SELECT count FROM habit_completions WHERE date_key = '2026-08-10'", [
      { count: 1 },
    ]);
    await expectRows(
      page,
      "SELECT rule_history FROM habits WHERE name = 'Read target history'",
      (rows) => {
        expect(rows).toHaveLength(1);
        const history = JSON.parse(String(rows[0].rule_history)) as {
          effective_from_date: string;
          target_per_day: number;
        }[];
        expect(history).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ effective_from_date: '2026-08-10', target_per_day: 1 }),
            expect.objectContaining({ effective_from_date: '2026-08-11', target_per_day: 2 }),
          ]),
        );
      },
    );
  });
});
