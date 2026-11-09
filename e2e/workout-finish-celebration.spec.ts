import { test, expect, type Page } from './fixtures';
import { goToTab } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { returnToApp, runSql } from './helpers/dbHarness';
import { fillRoutineName } from './helpers/forms';

/**
 * P16 finish celebration (docs/ui-ux/16-playful-momentum.md § "Workout
 * session"): "Finish → PR/milestone celebration card (trophy hero icon, no
 * emoji)".
 *
 * The trophy card rides the existing `RewardCelebrationOverlay` (top-anchored,
 * non-blocking, 2.8s auto-dismiss) at the durable finish — the "Save and
 * finish" commit — and it is sized to the achievement:
 *
 *  - mid-session set checks stay celebration-free (pop + haptic only, no XP
 *    float, no mascot);
 *  - a PR finish celebrates "Personal best!" while the summary's
 *    "New personal records" box keeps its own single locator match;
 *  - a finished session without records earns the milestone card;
 *  - a recovery reopen (`resume.alreadyFinished`) never replays the card,
 *    even though its save still finds the records;
 *  - a zero-work early finish earns no card at all.
 *
 * The card copy is deliberately disjoint from strings other specs assert
 * ("Workout saved", "Workout complete!", "New personal records", "Some cleanup
 * after saving") so the floating card can never make those locators ambiguous.
 */

async function openRoutineBuilder(page: Page, name: string) {
  await fillRoutineName(page, name);
  await page.getByText('Add routine', { exact: true }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await page.getByText(name, { exact: true }).first().click();
}

async function startSession(page: Page, routineName: string, exerciseName: string) {
  await openRoutineBuilder(page, routineName);
  const builder = page.getByRole('dialog');
  await builder.getByPlaceholder(/e\.g\. Rows, Curls, Push-ups/i).fill(exerciseName);
  await builder.getByText('Add', { exact: true }).click({ force: true });
  await builder.getByText('Start workout', { exact: true }).click();
}

test.describe('Workout finish celebration (P16 trophy card)', () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, 'workout');
    await clearDatabase(page);
    await goToTab(page, 'workout');
  });

  test('set checks stay celebration-free; finishing and saving shows the trophy card', async ({
    page,
  }) => {
    await startSession(page, 'Celebration Day', 'Press');
    await expect(page.getByText('Set 1 of 1')).toBeVisible();
    await page.getByRole('button', { name: 'Add set' }).click();
    await expect(page.getByText('Set 1 of 2', { exact: true })).toBeVisible();

    // Mid-session check: feedback pop only — never a celebration card or an
    // XP float.
    await page.getByRole('button', { name: 'Complete set 1' }).click();
    await expect(page.getByText('Rest', { exact: true })).toBeVisible();
    await expect(page.getByText('Session complete!')).toHaveCount(0);
    await expect(page.getByText('Personal best!')).toHaveCount(0);
    await expect(page.getByText(/\+\d+ XP/)).toHaveCount(0);

    await page.getByRole('button', { name: 'Skip rest' }).click();
    await expect(page.getByText('Set 2 of 2', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Complete set 2' }).click();
    await expect(page.getByText('Workout complete!')).toBeVisible();
    // The summary renders alone; the celebration is earned by the save.
    await expect(page.getByText('Session complete!')).toHaveCount(0);

    await page.getByText('Save and finish', { exact: true }).click();
    await expect(page.getByText('Workout saved')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Session complete!')).toBeVisible();
    await expect(page.getByText('2 sets ·')).toBeVisible();
    await expect(page.getByText('Personal best!')).toHaveCount(0);

    // Dismissible without touching the summary underneath.
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Session complete!')).toHaveCount(0);
    await page.getByText('Done', { exact: true }).click();
  });

  test('a personal-record finish celebrates the records and fits 360', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await startSession(page, 'PR Day', 'Bench Press');
    await expect(page.getByText('Set 1 of 1')).toBeVisible();
    await page.getByRole('textbox', { name: 'Weight' }).fill('80');
    await page.getByRole('textbox', { name: 'Reps' }).fill('8');
    await page.getByRole('button', { name: 'Complete set 1' }).click();
    await expect(page.getByText('Workout complete!')).toBeVisible();

    await page.getByText('Save and finish', { exact: true }).click();
    await expect(page.getByText('Workout saved')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Personal best!')).toBeVisible();
    await expect(page.getByText('You set 1 new record.')).toBeVisible();
    // The summary's PR box keeps exactly one match while the card is up.
    await expect(page.getByText('New personal records')).toHaveCount(1);

    // No overflow at the narrowest supported width.
    for (const text of ['Personal best!', 'You set 1 new record.']) {
      const box = await page.getByText(text).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(360);
    }

    // The card never sticks around: it self-dismisses like every celebration.
    await expect(page.getByText('Personal best!')).toBeHidden({ timeout: 6_000 });
    await page.getByText('Done', { exact: true }).click();
  });

  test('a recovered finish saves without replaying the celebration', async ({ page }) => {
    // Force the first workout_logs insert to fail so the finished session is
    // kept as the durable pending-save recovery state (AUD-SH04-B).
    await runSql(
      page,
      `CREATE TRIGGER e2e_fail_workout_log_insert
       BEFORE INSERT ON workout_logs
       BEGIN SELECT RAISE(ABORT, 'forced e2e save failure'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'workout');

    await startSession(page, 'Recovery Day', 'Bench Press');
    await expect(page.getByText('Set 1 of 1')).toBeVisible();
    await page.getByRole('textbox', { name: 'Weight' }).fill('80');
    await page.getByRole('textbox', { name: 'Reps' }).fill('8');
    await page.getByRole('button', { name: 'Complete set 1' }).click();
    await expect(page.getByText('Workout complete!')).toBeVisible();
    await page.getByText('Save and finish', { exact: true }).click();
    await expect(page.getByText(/This workout could not be saved/)).toBeVisible({
      timeout: 10_000,
    });
    // A failed save earns no celebration.
    await expect(page.getByText('Personal best!')).toHaveCount(0);
    await expect(page.getByText('Session complete!')).toHaveCount(0);

    await runSql(page, 'DROP TRIGGER e2e_fail_workout_log_insert');
    await returnToApp(page);
    await goToTab(page, 'workout');
    await expect(page.getByText('Workout finished — not saved yet')).toBeVisible();
    await page.getByText('Save finished workout', { exact: true }).click();
    await expect(page.getByText('Workout complete!')).toBeVisible({ timeout: 10_000 });
    // Reopening the finished summary must not replay the card on mount.
    await expect(page.getByText('Personal best!')).toHaveCount(0);

    await page.getByText('Save and finish', { exact: true }).click();
    await expect(page.getByText('Workout saved')).toBeVisible({ timeout: 10_000 });
    // ...nor on the recovery save — even though that save found the records.
    await expect(page.getByText('New personal records')).toBeVisible();
    await expect(page.getByText('Personal best!')).toHaveCount(0);
    await expect(page.getByText('Session complete!')).toHaveCount(0);
    await page.getByText('Done', { exact: true }).click();
  });

  test('a zero-work early finish saves without a celebration card', async ({ page }) => {
    await startSession(page, 'Early Day', 'Press');
    await expect(page.getByText('Set 1 of 1')).toBeVisible();
    // Nothing performed: Finish straight away. The untouched set is logged as
    // skipped, not done — and there is no finished work to celebrate.
    await page.getByRole('button', { name: 'Finish workout' }).click();
    await expect(page.getByText('Workout complete!')).toBeVisible();
    await page.getByText('Save and finish', { exact: true }).click();
    await expect(page.getByText('Workout saved')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Session complete!')).toHaveCount(0);
    await expect(page.getByText('Personal best!')).toHaveCount(0);
    await page.getByText('Done', { exact: true }).click();
  });
});
