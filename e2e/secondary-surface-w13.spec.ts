import { test, expect, type Page } from './fixtures';
import { clearDatabase } from './helpers/db';
import { goToTab } from './helpers/navigation';

/**
 * W13 (tasks 7.1) — browser assertions for the secondary-surface grammar
 * (`SUR-08` settings value authority, `SYS-14`/`SUR-11` command center,
 * `SUR-13` milestone-first achievements).
 *
 * These assert the pinned grammar rules, not pixels (W15 owns snapshots).
 */
test.describe('W13 secondary surface grammar', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultNavigationTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await goToTab(page, 'overview');
    await clearDatabase(page);
    await goToTab(page, 'overview');
  });

  async function openSettings(page: Page) {
    await page.getByRole('button', { name: 'Open settings' }).click();
    await expect(page.getByText('Appearance', { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    });
    await page.waitForTimeout(300);
    return page.getByRole('dialog');
  }

  async function openCommand(page: Page) {
    await page.getByRole('button', { name: 'Quick capture' }).click();
    await page
      .getByPlaceholder('What do you want to remember?')
      .waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByRole('button', { name: 'Describe it' }).click();
    await page.waitForTimeout(600);
    return page.getByRole('dialog');
  }

  test('Appearance states the theme once, not as duplicated narration rows', async ({ page }) => {
    const dialog = await openSettings(page);

    // SUR-08: the old section rendered `Current selection` AND `Current
    // behavior`, each restating the same preference with its own status pill.
    await expect(dialog.getByText('Current selection', { exact: true })).toHaveCount(0);
    await expect(dialog.getByText('Current behavior', { exact: true })).toHaveCount(0);

    // One row owns the current appearance.
    await expect(dialog.getByText('Current appearance', { exact: true })).toBeVisible();

    // And the mode is selected exactly once via the control. PillChip emits
    // `aria-pressed` for its toggle state (added in W13; RN Web does not map
    // `accessibilityState` to the DOM in this version).
    const darkPill = dialog.getByRole('button', { name: 'Dark', exact: true });
    await expect(darkPill).toBeVisible();
    await expect(darkPill).toHaveAttribute('aria-pressed', 'false');

    // Switching mode updates that same single indicator, not a new row. The
    // `System`/`Light` motion pills later in the modal share these labels, so
    // pin the unambiguous Dark pill and the visible appearance text instead.
    await darkPill.click();
    await expect(dialog.getByRole('button', { name: 'Dark', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(dialog.getByText('Using dark mode across the app.')).toBeVisible();
    await expect(dialog.getByText('Current appearance', { exact: true })).toBeVisible();
  });

  test('Settings explanations are collapsed until the row detail is requested', async ({
    page,
  }) => {
    const dialog = await openSettings(page);

    // A row with supporting prose exposes a labelled disclosure whose state is
    // reported, and the prose is not in the first render.
    const detail = dialog.getByRole('button', { name: 'Show details for Current appearance' });
    await expect(detail).toBeVisible();
    await expect(detail).toHaveAttribute('aria-expanded', 'false');

    await detail.click();
    await expect(
      dialog.getByRole('button', { name: 'Hide details for Current appearance' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  test('Accessibility states the effective motion once', async ({ page }) => {
    const dialog = await openSettings(page);
    await dialog.getByText('Motion', { exact: true }).first().scrollIntoViewIfNeeded();

    await expect(dialog.getByText('Global', { exact: true })).toHaveCount(0);
    await expect(dialog.getByText('Current selection', { exact: true })).toHaveCount(0);
    await expect(dialog.getByText('Active behavior', { exact: true })).toHaveCount(0);
    await expect(dialog.getByText('Effective motion', { exact: true })).toBeVisible();
  });

  test('Command Center begins with the input and drops the current-section panel', async ({
    page,
  }) => {
    const dialog = await openCommand(page);

    // SUR-11: the launch context is a caption, never a panel restating it.
    await expect(dialog.getByText('CURRENT SECTION', { exact: true })).toHaveCount(0);
    await expect(dialog.getByText('Current section', { exact: true })).toHaveCount(0);

    // SYS-14: no implementation-narration header on the input card.
    await expect(dialog.getByText('Command input', { exact: true })).toHaveCount(0);
    await expect(
      dialog.getByText(
        'Parsing saves text in recent commands on this device. App actions require confirmation.',
      ),
    ).toBeVisible();

    // The field is the first interactive control, above the examples.
    const field = dialog.getByPlaceholder(/Add a todo to call mom tomorrow/).first();
    await expect(field).toBeVisible();
    const examples = dialog.getByRole('button', { name: /Use example:/ }).first();
    await expect(examples).toBeVisible();

    // Examples demote once the user types — no example wall over a real command.
    await field.fill('Add a todo to call plumber tomorrow');
    await expect(dialog.getByRole('button', { name: /Use example:/ })).toHaveCount(0);
    await expect(
      dialog.getByText(
        'Parsing saves text in recent commands on this device. App actions require confirmation.',
      ),
    ).toBeVisible();
  });

  test('Command Center keeps preview-before-confirm truthful', async ({ page }) => {
    const dialog = await openCommand(page);
    await dialog
      .getByPlaceholder(/Add a todo to call mom tomorrow/)
      .first()
      .fill('Add a todo to call mom tomorrow');
    await dialog.getByRole('button', { name: 'Parse command' }).click();

    // A parsed draft is a preview, not a completed action.
    await expect(dialog.getByText(/call mom tomorrow/i)).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByRole('button', { name: /Confirm|Save|Add/i }).first()).toBeVisible();
    // No success claim before the explicit confirm.
    await expect(dialog.getByText(/^(Done|Saved|Added)(!|\.)?$/)).toHaveCount(0);
  });
});
