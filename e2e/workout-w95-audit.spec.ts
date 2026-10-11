import { test, expect, type Page } from './fixtures';
import { goToTab } from './helpers/navigation';
import { resetAll } from './helpers/reset';
import { returnToApp } from './helpers/dbHarness';
import { seedFixture } from './helpers/seed';
import { fillRoutineName } from './helpers/forms';

/**
 * W9.5 rendered-truth instrument (opt-in, like the W7/W8/W9 audits): captures
 * the Workout surfaces after the two bounded corrections — the landing under
 * the single page-level scroll authority (empty, populated, routine creation,
 * history expanded, dark, 360/768/1280) and the saved-workout state of the
 * guarded finish — into `docs/ui-ux/v3-audit/w9.5/` for human/model visual
 * inspection.
 *
 * DOCUMENTED LIMITATION: the "save failure" state (a skipped write whose
 * routine was soft-deleted mid-session) cannot be staged in this browser
 * fixture — entering the DB harness destroys the live session's React state,
 * and the landing's resume path re-validates the routine before a session can
 * start. That state is proven deterministically by
 * `tests/workoutSessionSave.test.ts` (the decision contract) and
 * `tests/integration/workoutSaveIntegrity.data.test.ts` (real-SQLite oracles:
 * zero rows on a skipped finish, draft retention, no reward). Screenshots are
 * evidence, never assertions.
 */
const OUT = process.env.VISUAL_AUDIT_OUTPUT_DIR ?? 'docs/ui-ux/v3-audit/w9.5';
test.skip(process.env.VISUAL_AUDIT !== '1', 'Opt-in rendered audit; run with VISUAL_AUDIT=1');
test.describe.configure({ mode: 'serial' });
test.setTimeout(300_000);

async function shot(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUT}/${name}.png`, animations: 'disabled' });
}

async function workoutSection(page: Page) {
  await goToTab(page, 'workout');
  const region = page.getByText('Workout', { exact: true }).first();
  await expect(region).toBeVisible({ timeout: 15_000 });
  // Settle the section crossfade so a capture never freezes a transition frame
  // (the W9 audit captured a few such frames).
  await page.waitForTimeout(800);
  return page.locator(
    'div[style*="pointer-events: auto"][style*="z-index: 1"][style*="opacity: 1"]',
  );
}

async function resetToWorkout(page: Page) {
  await resetAll(page);
  await returnToApp(page);
  return workoutSection(page);
}

test.describe('W9.5 Workout rendered surfaces', () => {
  test('landing: empty, populated, creation, history, dark, and widths', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // Empty library: exactly one scroll authority, no analytics competing.
    await resetToWorkout(page);
    await shot(page, '390-workout-empty');

    // Populated landing (training state, quick start, collapsed week).
    await seedFixture(page, 'TYPICAL');
    const section = await workoutSection(page);
    await expect(section.getByText('Quick start')).toBeVisible();
    await shot(page, '390-workout-populated');

    // Routine creation: the New routine form is filled in progress.
    await section.getByRole('textbox', { name: 'New routine name' }).fill('W9.5 Push Day');
    await section
      .getByRole('textbox', { name: 'New routine description' })
      .fill('Bench + accessories');
    await shot(page, '390-workout-routine-creation');

    // History & insights disclosure expanded.
    await section.getByRole('button', { name: 'History and insights' }).click();
    await expect(page.getByText('Recent sessions')).toBeVisible();
    await shot(page, '390-workout-history-expanded');

    // Dark theme, populated landing.
    await page.evaluate(() => localStorage.setItem('superhabits.theme.mode', 'dark'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await workoutSection(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await shot(page, '390-dark-workout');
    await page.evaluate(() => localStorage.setItem('superhabits.theme.mode', 'light'));

    // Narrow 360 layout.
    await page.setViewportSize({ width: 360, height: 800 });
    await workoutSection(page);
    await shot(page, '360-workout-landing');

    // Tablet 768 layout: gutters step up, single scroll authority holds.
    await page.setViewportSize({ width: 768, height: 1024 });
    await workoutSection(page);
    await shot(page, '768-workout-landing');

    // Desktop 1280 layout: centered content-max column, side rail shell.
    await page.setViewportSize({ width: 1280, height: 800 });
    await workoutSection(page);
    await shot(page, '1280-workout-landing');
  });

  test('finish: a guarded save reaches the saved state exactly once', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const section = await resetToWorkout(page);
    await expect(section.getByText('Quick start')).toBeVisible();

    await fillRoutineName(page, 'Guarded Save');
    await page.getByText('Add routine', { exact: true }).click();
    await expect(page.getByText('Guarded Save', { exact: true })).toBeVisible();
    await page.getByText('Guarded Save', { exact: true }).first().click();
    const builder = page.getByRole('dialog');
    await builder.getByPlaceholder(/e\.g\. Rows, Curls, Push-ups/i).fill('Bench Press');
    await builder.getByText('Add', { exact: true }).click({ force: true });
    await builder.getByText('Start workout', { exact: true }).click();

    await expect(page.getByText('Set 1 of 1')).toBeVisible();
    await page.getByRole('textbox', { name: 'Weight' }).fill('80');
    await page.getByRole('textbox', { name: 'Reps' }).fill('8');
    await page.getByRole('button', { name: 'Complete set 1' }).click();
    await expect(page.getByText('Workout complete!')).toBeVisible();

    await page.getByText('Save and finish', { exact: true }).click();
    await expect(page.getByText('Workout saved')).toBeVisible({ timeout: 10_000 });
    await shot(page, '390-workout-save-success');
    await page.getByText('Done', { exact: true }).click();
  });
});
