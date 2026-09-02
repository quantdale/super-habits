import { test, expect } from './fixtures';
import { goToTab } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { fillCaloriesMacros } from './helpers/forms';
import { openCommandScreen } from './helpers/commandObservation';

/**
 * Warm Momentum 2.3 — data-entry determinism (OpenSpec
 * polish-warm-momentum-2-3-data-entry-modal-determinism-v1).
 *
 * These specs pin the two user-visible determinism contracts that unit tests
 * cannot fully cover:
 *
 * 1. Deterministic submit ownership — a rapid second activation of an
 *    in-flight submit MUST NOT create a second row (lib/submitGuard.ts).
 * 2. Deterministic modal transitions — at most one modal layer is ever
 *    interactive; the quick-capture → command swap leaves no interactive
 *    ghost of the outgoing sheet (core/ui/Modal.tsx closing-phase contract).
 */

test.describe('WM2.3 data-entry determinism', () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, 'calories');
    await clearDatabase(page);
    await page.evaluate(() => {
      window.localStorage.removeItem('superhabits.calories.viewMode');
    });
    await page.reload({ waitUntil: 'load' });
    await goToTab(page, 'calories');
  });

  test('double-activating Add entry in rapid succession creates exactly one row', async ({
    page,
  }) => {
    await fillCaloriesMacros(page, 'Guarded oats', '10', '40', '5', '5');

    const addButton = page.getByText('Add entry', { exact: true }).last();
    await addButton.click({ force: true });
    // Second activation lands while the first submission is still in flight
    // (persist + refresh + modal close). The submit guard must swallow it.
    await addButton.click({ force: true, timeout: 2_000 }).catch(() => {
      // The button may already be disabled/loading or the modal already
      // closed — either way the second write must not happen.
    });

    await expect(page.getByText('Guarded oats - 235 kcal', { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Today: 235 kcal')).toBeVisible({ timeout: 15_000 });

    // Exactly one row: the full row label (name + kcal) appears exactly once
    // in the Form view's daily log; a duplicate entry would render a second
    // "Guarded oats - 235 kcal" row and "Today: 470 kcal".
    await expect(page.getByText('Guarded oats - 235 kcal', { exact: true })).toHaveCount(1, {
      timeout: 15_000,
    });
    await expect(page.getByText('Today: 470 kcal')).toHaveCount(0);
  });

  test('quick-capture → command swap leaves exactly one interactive layer', async ({ page }) => {
    await openCommandScreen(page);
    await expect(page.getByText('Command center', { exact: true })).toBeVisible();
    await expect(page.locator('#command-input')).toBeVisible({ timeout: 15_000 });

    // The outgoing quick-capture sheet must be fully unmounted (closing-phase
    // contract): its "Add something" header is gone from the a11y tree, so a
    // stray tap cannot land on a ghost layer.
    await expect(page.getByText('Add something', { exact: true })).toHaveCount(0);

    // The command modal is THE interactive layer: its primary input accepts
    // typing immediately (no focus trap ambiguity with a fading sheet).
    await page.locator('#command-input').fill('30m run tomorrow');
    await expect(page.locator('#command-input')).toHaveValue('30m run tomorrow');

    await page.getByRole('button', { name: 'Close' }).click({ force: true });
    await expect(page.locator('#command-input')).toBeHidden();

    // After closing, the sheet's launcher is back and the command modal is
    // fully gone — no orphaned interactive layer remains.
    await expect(page.getByRole('button', { name: 'Quick capture', exact: true })).toBeVisible();
    await expect(page.locator('#command-input')).toHaveCount(0);
  });
});
