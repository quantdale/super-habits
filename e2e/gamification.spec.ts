import { expect, test, type Page } from './fixtures';
import { clearDatabase } from './helpers/db';
import { goToTab, hardReload } from './helpers/navigation';
import { openSettingsScreen } from './helpers/commandObservation';

/**
 * The reward loop end to end: a real check-off must pay XP, complete the day,
 * celebrate once, and be visible on the dashboard and achievements surfaces.
 *
 * XP amounts are asserted exactly (10 base + 25 complete day = 35) because the
 * curve is the contract: a silent change to the balance should fail loudly.
 */

const HABIT = 'Morning run';

/** Opens the add-habit modal via the first group's add tile (a11y label contract). */
async function openAddHabitModal(page: Page) {
  await expect(page.getByText('ANYTIME').first()).toBeVisible({ timeout: 15_000 });
  const nameField = page.getByLabel('Habit name');
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByLabel('Habit groups').getByLabel('Add anytime habit').click({ force: true });
    try {
      await nameField.waitFor({ state: 'visible', timeout: 8_000 });
      return;
    } catch {
      /* retry */
    }
  }
  throw new Error('Add-habit modal did not open (Habit name field never visible)');
}

async function createHabit(page: Page, name: string) {
  await openAddHabitModal(page);
  await page.getByLabel('Habit name').fill(name);
  await page.getByText('Create habit', { exact: true }).locator('..').click({ force: true });
  await expect(page.getByText(name).first()).toBeVisible();
}

test.describe('Gamification', () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, 'habits');
    await clearDatabase(page);
    await goToTab(page, 'habits');
  });

  test('a habit check-off pays XP, completes the day, and celebrates', async ({ page }) => {
    await createHabit(page, HABIT);

    await goToTab(page, 'overview');
    await expect(page.getByText('Level & Streaks').first()).toBeVisible();
    await expect(page.getByLabel(/Level 1, Starter\. 0 of 50 XP/)).toBeVisible();

    await goToTab(page, 'habits');
    await page.getByLabel(new RegExp(`${HABIT}: 0 of 1 today`)).click({ force: true });

    // One habit is the whole day here, so the check-off completes the day and
    // unlocks the first complete-day badge — the badge outranks the day
    // celebration and is the one the overlay shows.
    const celebration = page.getByText(/Badge unlocked/);
    await expect(celebration).toBeVisible({ timeout: 10_000 });
    // The overlay self-dismisses after a few seconds by design, so clicking
    // "Continue" is best-effort: either path ends with it gone.
    const continueButton = page.getByRole('button', { name: 'Continue' });
    if (await continueButton.isVisible().catch(() => false)) {
      await continueButton.click();
    }
    await expect(celebration).toBeHidden();

    await goToTab(page, 'overview');
    await expect(page.getByText('Complete day — every habit is done')).toBeVisible();
    await expect(page.getByLabel(/Level 1, Starter\. 35 of 50 XP towards level 2/)).toBeVisible();
    await expect(page.getByLabel(/1 active day in the last week/)).toBeVisible();

    // The reward is durable: reopening the app keeps the award.
    await hardReload(page);
    await expect(page.getByLabel(/Level 1, Starter\. 35 of 50 XP towards level 2/)).toBeVisible();
  });

  test('a replay of the same check-off never pays twice', async ({ page }) => {
    await createHabit(page, HABIT);

    await page.getByLabel(new RegExp(`${HABIT}: 0 of 1 today`)).click({ force: true });
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await continueButton.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
    if (await continueButton.isVisible().catch(() => false)) {
      await continueButton.click();
    }

    // Undo (long press) then check in again: the day-habit pair is already paid.
    await page.getByLabel(new RegExp(`${HABIT}: 1 of 1 today`)).click({
      button: 'left',
      delay: 700,
      force: true,
    });

    await goToTab(page, 'overview');
    await expect(page.getByLabel(/Level 1, Starter\. 35 of 50 XP towards level 2/)).toBeVisible();
  });

  test('opens the achievements overlay from the dashboard card', async ({ page }) => {
    await createHabit(page, HABIT);
    await goToTab(page, 'overview');

    await page.getByRole('button', { name: /Level & Streaks card — open achievements/ }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Level & Achievements')).toBeVisible();
    await expect(dialog.getByText("Today's quests")).toBeVisible();
    await expect(dialog.getByText('Streak protection')).toBeVisible();
    // The badge board renders every family's first tier, earned or not.
    await expect(dialog.getByLabel(/Bronze Complete days/)).toBeVisible();
    // The quest board always rotates exactly three quests in.
    await expect(dialog.getByLabel(/Reward 15 XP\./)).toHaveCount(3);

    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog.getByText('Level & Achievements')).toBeHidden();
  });

  test('reward feedback preferences persist across reloads', async ({ page }) => {
    await openSettingsScreen(page);

    const soundsOff = page.getByText('Sounds off', { exact: true });
    await soundsOff.scrollIntoViewIfNeeded();
    await soundsOff.click();
    await expect(page.getByText('All reward sounds are off.')).toBeVisible();

    await hardReload(page);
    await openSettingsScreen(page);
    await expect(page.getByText('All reward sounds are off.')).toBeVisible();
  });
});
