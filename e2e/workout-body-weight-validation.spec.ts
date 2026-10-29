import { test, expect } from './fixtures';
import { goToTab } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { queryRows, returnToApp } from './helpers/dbHarness';

/**
 * Body-weight dialog validation is real on web (bughunt20 F2 leftovers).
 *
 * Two user-visible failures in `WorkoutScreen`'s body-weight dialog:
 *
 * 1. "Save weight and goal" with an EMPTY weight field but an existing stored
 *    goal passes every guard, takes neither the insert nor the update branch,
 *    saves preferences and dismisses the dialog — the user sees success with
 *    nothing logged.
 * 2. Every validation message in that handler goes through `Alert.alert`, which
 *    is a NO-OP on react-native-web (`Alert.alert(){}`), so a rejected value is
 *    silent and the dialog stays open with no explanation.
 *
 * Both assertions below fail before the fix and pass after it; neither weakens
 * an existing assertion.
 */
test.describe('Workout body-weight dialog validation', () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, 'workout');
    await clearDatabase(page);
    await goToTab(page, 'workout');
  });

  test('an empty weight with a stored goal is refused instead of a silent no-op', async ({
    page,
  }) => {
    // Seed the stored goal through the real dialog once, so the reporter's
    // precondition ("any user who has logged once") is the actual shipped path.
    await page.getByRole('button', { name: 'History and insights' }).click();
    await page.getByText('Log weight', { exact: true }).click();
    const seedDialog = page.getByRole('dialog');
    await seedDialog.getByRole('textbox', { name: 'Weight', exact: true }).fill('80');
    await seedDialog.getByRole('textbox', { name: 'Goal weight (optional)' }).fill('75');
    await seedDialog.getByText('Save weight and goal', { exact: true }).click();
    await expect(page.getByText('Goal · 75 kg', { exact: true })).toBeVisible();

    // Now the reported flow: leave the weight EMPTY and press save.
    await page.getByText('Log weight', { exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'Weight', exact: true }).fill('');
    await dialog.getByText('Save weight and goal', { exact: true }).click();

    // The dialog must stay open and explain itself — not dismiss as if saved.
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(/weight/i);

    // …and no second measurement may have been invented.
    const entries = await queryRows(
      page,
      `SELECT weight FROM body_weight_entries WHERE deleted_at IS NULL`,
    );
    expect(entries).toHaveLength(1);
  });

  test('an out-of-range weight reports the write error instead of vanishing', async ({ page }) => {
    await page.getByRole('button', { name: 'History and insights' }).click();
    await page.getByText('Log weight', { exact: true }).click();
    const dialog = page.getByRole('dialog');
    // 2000 is above the data layer's 1,000 cap; the sanitizer keeps it and the
    // write rejects. Pre-fix that rejection is an unhandled promise and the
    // dialog shows nothing at all.
    await dialog.getByRole('textbox', { name: 'Weight', exact: true }).fill('2000');
    await dialog.getByText('Save weight and goal', { exact: true }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(/1,000|weight/i);
    const entries = await queryRows(page, `SELECT weight FROM body_weight_entries`);
    expect(entries).toHaveLength(0);

    await returnToApp(page);
    await goToTab(page, 'workout');
  });
});
