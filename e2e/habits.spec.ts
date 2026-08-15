import { test, expect, type Page } from './fixtures';
import { goToTab } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { advanceToNextDay, installClock } from './helpers/clock';
import { expectRows } from './helpers/oracles';

/** Opens add-habit modal via the first time-group + (scoped to Habit groups a11y region). */
async function openAddHabitModal(page: Page) {
  await expect(page.getByText('ANYTIME').first()).toBeVisible({ timeout: 15_000 });
  const nameField = page.getByLabel('Habit name');
  // Click the first group's Add tile instead of class-based wrappers.
  for (let attempt = 0; attempt < 3; attempt++) {
    const firstAddTile = page
      .getByLabel('Habit groups')
      .getByText('Add', { exact: true })
      .first()
      .locator('xpath=preceding-sibling::*[1]');
    await firstAddTile.click({ force: true });
    try {
      await nameField.waitFor({ state: 'visible', timeout: 8_000 });
      return;
    } catch {
      /* retry */
    }
  }
  throw new Error('Add-habit modal did not open (Habit name field never visible)');
}

test.describe('Habits', () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, 'habits');
    await clearDatabase(page);
    await goToTab(page, 'habits');
    await expect(page.getByText('ANYTIME').first()).toBeVisible({ timeout: 15_000 });
  });

  test('shows empty state when no habits exist', async ({ page }) => {
    await expect(
      page.getByText(/Pick a time of day and tap Add to create your first habit/i),
    ).toBeVisible();
    await expect(page.getByText('ANYTIME')).toBeVisible();
  });

  test('does not add habit with empty name', async ({ page }) => {
    await openAddHabitModal(page);
    await page.getByText('Create habit', { exact: true }).locator('..').click({ force: true });
    await expect(
      page.getByText(/Pick a time of day and tap Add to create your first habit/i),
    ).toBeVisible();
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

    await page.getByRole('button', { name: 'View progress for Read progress' }).click();
    await expect(page.getByText('Read progress progress', { exact: true })).toBeVisible();
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
    // Ring is the preceding sibling of the label row (Pressable has no role="button" on RN Web).
    await page
      .getByText('Meditate', { exact: true })
      .locator('xpath=preceding-sibling::*[1]')
      .click();
    await expect(page.getByText('Meditate').first()).toBeVisible();
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

  test('deletes a habit in edit mode after web confirmation', async ({ page }) => {
    await openAddHabitModal(page);
    await page.getByLabel('Habit name').fill('Delete this habit');
    await page.getByText('Create habit', { exact: true }).locator('..').click({ force: true });
    await expect(page.getByText('Delete this habit').first()).toBeVisible();
    await page.getByLabel('Enter habit edit mode').click({ force: true });
    await expect(page.getByLabel('Exit habit edit mode')).toBeVisible();
    await page.getByText('Delete', { exact: true }).first().click();
    await page.getByText('Delete habit', { exact: true }).last().click({ force: true });
    await expect(page.getByText('Delete this habit').first()).not.toBeVisible();
  });
});

test.describe('Scheduled habits', () => {
  test.beforeEach(async ({ page }) => {
    await installClock(page, '2026-08-10T12:00:00');
    await goToTab(page, 'habits');
    await clearDatabase(page);
    await goToTab(page, 'habits');
    await expect(page.getByText('ANYTIME').first()).toBeVisible({ timeout: 15_000 });
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
      page.getByRole('button', {
        name: 'Gym: 0 of 1 today. Tap to add one. Long press to remove one.',
      }),
    ).toBeVisible();

    await advanceToNextDay(page);
    await expect(
      page.getByRole('button', { name: 'Gym: not scheduled today. Rest day.' }),
    ).toBeVisible();
    await expect(page.getByText('Rest', { exact: true })).toBeVisible();

    await advanceToNextDay(page);
    const gymButton = page.getByRole('button', {
      name: 'Gym: 0 of 1 today. Tap to add one. Long press to remove one.',
    });
    await expect(gymButton).toBeVisible();
    await gymButton.click();
    await expect(
      page.getByRole('button', {
        name: 'Gym: 1 of 1 today. Tap to add one. Long press to remove one.',
      }),
    ).toBeVisible();
  });

  test('schedule edits remain visible after reload', async ({ page }) => {
    await openAddHabitModal(page);
    await page.getByLabel('Habit name').fill('Study weekdays');
    await page.getByText('Create habit', { exact: true }).locator('..').click({ force: true });
    await expect(page.getByText('Every day', { exact: true })).toBeVisible();

    await expect(page.getByLabel('Enter habit edit mode')).toBeVisible();
    await page.getByLabel('Enter habit edit mode').click();
    await expect(page.getByLabel('Exit habit edit mode')).toBeVisible();
    await page
      .getByLabel('Habit groups')
      .getByText('Edit', { exact: true })
      .first()
      .click({ force: true });
    await page.getByText('Weekdays', { exact: true }).click();
    await page.getByText('Save changes', { exact: true }).locator('..').click({ force: true });
    await page.getByLabel('Exit habit edit mode').click();
    const habitCard = page.getByText('Study weekdays', { exact: true }).locator('..');
    await expect(habitCard.getByText('Weekdays', { exact: true })).toBeVisible();

    await page.reload();
    await page.waitForLoadState('load');
    await goToTab(page, 'habits');
    await expect(
      page
        .getByText('Study weekdays', { exact: true })
        .locator('..')
        .getByText('Weekdays', { exact: true }),
    ).toBeVisible();
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
      .getByRole('button', {
        name: 'Read target history: 0 of 1 today. Tap to add one. Long press to remove one.',
      })
      .click();
    await expect(
      page.getByRole('button', {
        name: 'Read target history: 1 of 1 today. Tap to add one. Long press to remove one.',
      }),
    ).toBeVisible();

    await advanceToNextDay(page);
    await expect(page.getByLabel('Enter habit edit mode')).toBeVisible();
    await page.getByLabel('Enter habit edit mode').click();
    await expect(page.getByLabel('Exit habit edit mode')).toBeVisible();
    await page.getByLabel('Habit groups').getByText('Edit', { exact: true }).first().click();
    await page.getByLabel('Target per day', { exact: true }).fill('2');
    await page.getByText('Save changes', { exact: true }).locator('..').click({ force: true });
    // The save's async mutation chain outlives the click; a SQL oracle below
    // navigates the page away, which would abort an in-flight transaction on
    // slower runners. The modal closes only after the edit commits.
    await expect(page.getByText('Save changes', { exact: true })).toBeHidden({
      timeout: 10_000,
    });
    await expect(page.getByText('Read target history', { exact: true })).toBeVisible();

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
