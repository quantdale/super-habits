import { test, expect, type Page } from './fixtures';
import { goToTab } from './helpers/navigation';
import { resetAll } from './helpers/reset';
import { returnToApp } from './helpers/dbHarness';
import { seedFixture } from './helpers/seed';
import { fillRoutineName } from './helpers/forms';

/**
 * W9 rendered-truth instrument (opt-in, like the W7/W8 audits): captures the
 * reconstructed Workout surfaces — the quick-start-first landing, rest/scheduled
 * days, the collapsed week, the set-logging-first session, the rest dock, PR
 * feedback, the finish summary, and history — into
 * `docs/ui-ux/v3-audit/w9/` for human/model visual inspection. Screenshots are
 * evidence, never assertions; the behavioral contracts are pinned by
 * `e2e/workout.spec.ts`, `e2e/workout-gym-v2.spec.ts`, and `e2e/workout-w9.spec.ts`.
 */
const OUT = process.env.VISUAL_AUDIT_OUTPUT_DIR ?? 'docs/ui-ux/v3-audit/w9';
test.skip(process.env.VISUAL_AUDIT !== '1', 'Opt-in rendered audit; run with VISUAL_AUDIT=1');
test.describe.configure({ mode: 'serial' });
test.setTimeout(300_000);

async function shot(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUT}/${name}.png`, animations: 'disabled' });
}

/** The Workout section root (single active section on this surface). */
async function workoutSection(page: Page) {
  await goToTab(page, 'workout');
  const region = page.getByText('Workout', { exact: true }).first();
  await expect(region).toBeVisible({ timeout: 15_000 });
  return page.locator(
    'div[style*="pointer-events: auto"][style*="z-index: 1"][style*="opacity: 1"]',
  );
}

async function addRoutineWithExercise(
  page: Page,
  routineName: string,
  exerciseName: string,
  activeSeconds: string,
) {
  await fillRoutineName(page, routineName);
  await page.getByText('Add routine', { exact: true }).click();
  await expect(page.getByText(routineName, { exact: true })).toBeVisible();
  await page.getByText(routineName, { exact: true }).first().click();
  const builder = page.getByRole('dialog');
  await builder.getByPlaceholder(/e\.g\. Rows, Curls, Push-ups/i).fill(exerciseName);
  await builder.getByText('Add', { exact: true }).click({ force: true });
  await builder.getByRole('textbox', { name: 'Active (seconds)' }).fill(activeSeconds);
  await expect(builder.getByRole('textbox', { name: 'Active (seconds)' })).toHaveValue(
    activeSeconds,
    { timeout: 10_000 },
  );
  await builder.getByText('Start workout', { exact: true }).click();
}

test.describe('W9 Workout rendered surfaces', () => {
  test('landing: populated, quick start, week strip, and dark theme', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await resetAll(page);
    await returnToApp(page);
    await seedFixture(page, 'TYPICAL');
    const section = await workoutSection(page);

    // Populated landing: training state, quick start, collapsed week.
    await shot(page, '390-workout-landing-populated');
    await expect(section.getByText('Quick start')).toBeVisible();
    await expect(section.getByText('This week')).toBeVisible();

    // The collapsed week strip is scannable with readable assignments.
    await shot(page, '390-workout-week-strip');

    // Weekly editor remains available behind "Edit plan".
    await section.getByRole('button', { name: 'Edit weekly plan' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await shot(page, '390-workout-week-editor');
    await page.getByRole('dialog').getByLabel('Close').click();

    // Routine detail (management is preserved behind the row).
    await section
      .getByRole('button', { name: /Open .* routine/ })
      .first()
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await shot(page, '390-workout-routine-detail');
    await page.getByRole('dialog').getByLabel('Close').click();

    // History & insights disclosure.
    await section.getByRole('button', { name: 'History and insights' }).click();
    await expect(page.getByText('Recent sessions')).toBeVisible();
    await shot(page, '390-workout-history-open');

    // Dark theme, populated landing.
    await page.evaluate(() => localStorage.setItem('superhabits.theme.mode', 'dark'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await workoutSection(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await shot(page, '390-dark-workout-landing');
    await page.evaluate(() => localStorage.setItem('superhabits.theme.mode', 'light'));

    // 360px and 1280px layouts.
    await page.setViewportSize({ width: 360, height: 800 });
    await workoutSection(page);
    await shot(page, '360-workout-landing');
    await page.setViewportSize({ width: 1280, height: 800 });
    await workoutSection(page);
    await shot(page, '1280-workout-landing');
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test('landing: rest day, empty library, and draft resume states', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await resetAll(page);
    await returnToApp(page);

    // Empty library: quick start guides creation; no analytics compete.
    const section = await workoutSection(page);
    await shot(page, '390-workout-empty');

    // A routine exists with nothing scheduled → compact rest context.
    await fillRoutineName(page, 'Push Day');
    await page.getByText('Add routine', { exact: true }).click();
    await expect(page.getByText('Push Day')).toBeVisible();
    await expect(section.getByText('Today · Rest scheduled')).toBeVisible();
    await shot(page, '390-workout-rest-day');
  });

  test('session: strength logging, rest dock, add set, PR notice, and finish', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await resetAll(page);
    await returnToApp(page);
    await workoutSection(page);

    await addRoutineWithExercise(page, 'Strength Day', 'Bench Press', '40');
    // The engine exercise set carries a default rest; the session shows the
    // set table with previous context and the actionable row.
    await expect(page.getByText('Set 1 of 1')).toBeVisible();
    await page.getByRole('textbox', { name: 'Weight' }).fill('80');
    await page.getByRole('textbox', { name: 'Reps' }).fill('8');
    await shot(page, '390-workout-active-strength');

    // Add set grows the session table (correctly numbered).
    await page.getByRole('button', { name: 'Add set' }).click();
    await expect(page.getByText('Set 1 of 2', { exact: true })).toBeVisible();
    await shot(page, '390-workout-add-set');

    // Complete the first set: the rest dock appears in flow, never blocking.
    await page.getByRole('button', { name: 'Complete set 1' }).click();
    await expect(page.getByText('Rest', { exact: true })).toBeVisible();
    await shot(page, '390-workout-rest-dock');

    // Skip rest, finish set 2, and save: the completion frame is calm.
    await page.getByRole('button', { name: 'Skip rest' }).click();
    await expect(page.getByText('Set 2 of 2', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Complete set 2' }).click();
    await expect(page.getByText('Workout complete!')).toBeVisible();
    await shot(page, '390-workout-finish-summary');
    await page.getByText('Save and finish', { exact: true }).click();
    await expect(page.getByText('Workout saved')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('New personal records')).toBeVisible();
    await shot(page, '390-workout-saved-pr');
    await page.getByText('Done', { exact: true }).click();

    // Draft resume state: leave from the session screen.
    await addRoutineWithExercise(page, 'Draft Day', 'Squat', '40');
    await page.getByRole('textbox', { name: 'Weight' }).fill('60');
    await page.getByText('Start', { exact: true }).first().click();
    await page.getByRole('button', { name: 'End workout' }).click();
    await expect(page.getByText('Leave workout?')).toBeVisible();
    await shot(page, '390-workout-leave-confirmation');
    await page.getByRole('button', { name: 'Leave', exact: true }).click();
    await expect(page.getByText('Session in progress', { exact: true })).toBeVisible();
    await shot(page, '390-workout-draft-resume');
  });

  test('session: modalities (bodyweight, timed, cardio), long name, large text, HEAVY', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await resetAll(page);
    await returnToApp(page);
    await workoutSection(page);

    // Bodyweight / timed / cardio built-ins, plus a legacy free-text exercise
    // carrying an exceptionally long name for the wrapping capture.
    const longName = 'Dumbbell Walking Lunge With An Exceptionally Long Exercise Name';
    await fillRoutineName(page, 'Modality Tour');
    await page.getByText('Add routine', { exact: true }).click();
    await page.getByText('Modality Tour', { exact: true }).first().click();
    const builder = page.getByRole('dialog').filter({ hasText: 'Routine builder' });
    for (const exerciseName of ['Push-up', 'Plank', 'Treadmill Walk']) {
      await builder.getByText('Choose from exercise library', { exact: true }).click();
      await page
        .getByRole('dialog')
        .last()
        .getByRole('button', { name: `Add ${exerciseName}` })
        .click();
      await expect(builder.getByText(exerciseName, { exact: true })).toBeVisible();
    }
    for (const exerciseName of ['Push-up', 'Plank', 'Treadmill Walk']) {
      await builder.getByText(exerciseName, { exact: true }).click();
      await builder.getByRole('textbox', { name: 'Active (seconds)' }).fill('5');
      await builder.getByRole('textbox', { name: 'Rest (seconds, 0 = no rest)' }).fill('0');
      if (exerciseName === 'Push-up') {
        await builder.getByRole('textbox', { name: 'Target reps min' }).fill('8');
        await builder.getByRole('textbox', { name: 'Target reps max' }).fill('12');
        continue;
      }
      await builder.getByRole('textbox', { name: 'Target duration (seconds)' }).fill('5');
      if (exerciseName === 'Treadmill Walk') {
        await builder.getByRole('textbox', { name: 'Target distance' }).fill('3');
        await builder.getByRole('textbox', { name: 'Target pace' }).fill('8');
      }
    }
    // A legacy free-text exercise keeps the long-name wrapping case in play.
    await builder.getByPlaceholder(/e\.g\. Rows, Curls, Push-ups/i).fill(longName);
    await builder.getByText('Add', { exact: true }).click({ force: true });
    await expect(builder.getByText(longName, { exact: true })).toBeVisible();
    await builder.getByText('Start workout', { exact: true }).click();

    await expect(page.getByText(/bodyweight · 8–12 reps/)).toBeVisible();
    await shot(page, '390-workout-active-bodyweight');
    await page.getByRole('button', { name: 'Complete set 1' }).click();
    await expect(page.getByText('Plank', { exact: true })).toBeVisible();
    await shot(page, '390-workout-active-timed');
    await page.getByRole('button', { name: 'Complete set 1' }).click();
    await expect(page.getByText('Treadmill Walk', { exact: true })).toBeVisible();
    await shot(page, '390-workout-active-cardio');
    await page.getByRole('button', { name: 'Complete set 1' }).click();
    // The long legacy name wraps in the exercise header without clipping.
    await expect(page.getByText(longName, { exact: true })).toBeVisible();
    await shot(page, '390-workout-long-exercise-name');

    // Large text proxy: labels stay fully visible, nothing clipped.
    for (const label of await page.locator('[dir="auto"]').all()) {
      await label.evaluate((element) => {
        const computed = getComputedStyle(element);
        element.style.fontSize = `${parseFloat(computed.fontSize) * 2}px`;
        element.style.lineHeight = `${parseFloat(computed.lineHeight) * 2}px`;
      });
    }
    await shot(page, '390-workout-large-text');
  });
});
