import { test, expect } from './fixtures';
import { goToTab } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { fillRoutineName } from './helpers/forms';

async function tomorrowDateKey(page: Parameters<typeof goToTab>[0]): Promise<string> {
  return page.evaluate(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  });
}

async function currentWeekdayName(page: Parameters<typeof goToTab>[0]): Promise<string> {
  return page.evaluate(() => {
    const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return names[(new Date().getDay() + 6) % 7];
  });
}

test.describe('Workout Gym V2', () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, 'workout');
    await clearDatabase(page);
    await goToTab(page, 'workout');
  });

  test('builds a catalog routine with prescriptions and a custom exercise', async ({ page }) => {
    await fillRoutineName(page, 'Gym V2 Upper');
    await page.getByText('Add routine', { exact: true }).click();
    await page.getByText('Gym V2 Upper', { exact: true }).first().click();

    const builder = page.getByRole('dialog');
    await builder.getByText('Choose from exercise library', { exact: true }).click();
    const picker = page.getByRole('dialog').last();
    await picker.getByRole('button', { name: 'Add Barbell Bench Press' }).click();
    await expect(builder.getByText('Barbell Bench Press', { exact: true })).toBeVisible();

    await builder.getByRole('textbox', { name: 'Active (seconds)' }).fill('5');
    await builder.getByRole('textbox', { name: 'Target reps min' }).fill('8');
    await builder.getByRole('textbox', { name: 'Target reps max' }).fill('10');
    await builder.getByRole('button', { name: 'Linear', exact: true }).click();
    await builder
      .getByRole('textbox', { name: 'Barbell Bench Press progression increment' })
      .fill('2.5');
    await builder.getByRole('textbox', { name: 'Target load' }).fill('60');
    await expect(builder.getByRole('textbox', { name: 'Target reps min' })).toHaveValue('8');

    await builder.getByText('Choose from exercise library', { exact: true }).click();
    const customPicker = page.getByRole('dialog').last();
    await customPicker.getByPlaceholder('Cable press variation').fill('Cable Y Raise');
    await customPicker.getByRole('textbox', { name: 'Primary body area' }).fill('shoulders');
    await customPicker.getByRole('textbox', { name: 'Equipment' }).fill('cable');
    await customPicker.getByText('Create and add', { exact: true }).click();

    await expect(builder.getByText('Cable Y Raise', { exact: true })).toBeVisible();
    await builder.getByLabel('Move Cable Y Raise up').click();
    await builder.getByLabel('Move Cable Y Raise down').click();
    await builder.getByLabel('Close').click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await page.getByText('Plan week', { exact: true }).click();
    const plan = page.getByRole('dialog');
    await expect(plan.getByText('Plan your week', { exact: true })).toBeVisible();
    const weekday = await currentWeekdayName(page);
    await plan
      .getByText(weekday, { exact: true })
      .locator('..')
      .getByRole('button', { name: 'Gym V2 Upper', exact: true })
      .click();
    await plan.getByLabel('Close').click();

    await expect(page.getByText('Gym V2 Upper', { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Start today's workout", { exact: true })).toBeVisible();
  });

  test('reschedules today without changing the recurring week', async ({ page }) => {
    await fillRoutineName(page, 'Reschedule Day');
    await page.getByText('Add routine', { exact: true }).click();
    await page.getByText('Reschedule Day', { exact: true }).first().click();
    const builder = page.getByRole('dialog');
    await builder.getByLabel('Close').click();

    await page.getByText('Change today', { exact: true }).click();
    const override = page.getByRole('dialog');
    await override.getByText('Reschedule Day', { exact: true }).click();
    await expect(page.getByText('Reschedule Day', { exact: true }).first()).toBeVisible();

    await page.getByText('Move workout to another day', { exact: true }).click();
    const target = await tomorrowDateKey(page);
    const move = page.getByRole('dialog');
    await move.getByRole('textbox', { name: 'New date' }).fill(target);
    await move.getByRole('button', { name: 'Move workout', exact: true }).click();

    await expect(page.getByText('Rest day', { exact: true })).toBeVisible();
    await page.getByText('Plan week', { exact: true }).click();
    const plan = page.getByRole('dialog');
    await expect(
      plan.getByRole('button', { name: 'Reschedule Day', exact: true }).first(),
    ).not.toHaveAttribute('aria-selected', 'true');
    await plan.getByLabel('Close').click();
  });

  test('runs a guided strength set, records a PR, and survives reload', async ({ page }) => {
    await fillRoutineName(page, 'Strength Progress');
    await page.getByText('Add routine', { exact: true }).click();
    await page.getByText('Strength Progress', { exact: true }).first().click();
    const builder = page.getByRole('dialog');
    await builder.getByText('Choose from exercise library', { exact: true }).click();
    await page
      .getByRole('dialog')
      .last()
      .getByRole('button', { name: 'Add Barbell Bench Press' })
      .click();
    await builder.getByRole('textbox', { name: 'Active (seconds)' }).fill('5');
    await builder.getByRole('textbox', { name: 'Target reps min' }).fill('8');
    await builder.getByRole('textbox', { name: 'Target reps max' }).fill('10');
    await builder.getByRole('button', { name: 'Linear', exact: true }).click();
    await builder
      .getByRole('textbox', { name: 'Barbell Bench Press progression increment' })
      .fill('2.5');
    await expect(builder.getByRole('textbox', { name: 'Active (seconds)' })).toHaveValue('5');
    await builder.getByLabel('Close').click();
    await page.getByText('Strength Progress', { exact: true }).first().click();
    const persistedBuilder = page.getByRole('dialog');
    await persistedBuilder.getByText('Barbell Bench Press', { exact: true }).click();
    await expect(
      persistedBuilder.getByRole('textbox', {
        name: 'Barbell Bench Press progression increment',
      }),
    ).toHaveValue('2.5');
    await expect(persistedBuilder.getByRole('textbox', { name: 'Active (seconds)' })).toHaveValue(
      '5',
    );
    await persistedBuilder.getByText('Start workout', { exact: true }).click();

    await expect(page.getByText('Log this set (optional)')).toBeVisible();
    await expect(page.getByText('Progression guidance', { exact: true })).toBeVisible();
    const strengthWeight = page.getByRole('textbox', { name: 'Weight' });
    await strengthWeight.fill('75');
    await strengthWeight.fill('80');
    await expect(strengthWeight).toHaveValue('80');
    await page.getByRole('textbox', { name: 'Reps' }).fill('8');
    await page.getByText('Start', { exact: true }).first().click();
    await page.getByText('Complete set now', { exact: true }).click();
    await expect(page.getByText('Workout complete!')).toBeVisible({ timeout: 15_000 });
    await page.getByLabel('Notes (optional)').fill('Gym V2 strength session');
    await page.getByText('Save and finish', { exact: true }).click();
    await expect(page.getByText('Workout saved')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('New personal records')).toBeVisible();
    await page.getByText('Done', { exact: true }).click();

    await page
      .getByLabel(/Open session from/)
      .first()
      .click();
    const detail = page.getByRole('dialog');
    await expect(detail.getByText('Barbell Bench Press', { exact: true }).first()).toBeVisible();
    await expect(detail.getByText(/80 × 8/)).toBeVisible();
    await expect(detail.getByText(/est\. 1RM 101/)).toBeVisible();

    await page.reload();
    await page.waitForLoadState('load');
    await goToTab(page, 'workout');
    await expect(page.getByLabel(/Open session from/).first()).toBeVisible();
  });

  test('resumes an interrupted guided session with entered measurements', async ({ page }) => {
    await fillRoutineName(page, 'Draft Resume');
    await page.getByText('Add routine', { exact: true }).click();
    await page.getByText('Draft Resume', { exact: true }).first().click();

    const builder = page.getByRole('dialog').filter({ hasText: 'Routine builder' });
    await builder.getByText('Choose from exercise library', { exact: true }).click();
    await page
      .getByRole('dialog')
      .last()
      .getByRole('button', { name: 'Add Barbell Bench Press' })
      .click();
    await builder.getByRole('textbox', { name: 'Active (seconds)' }).fill('5');
    await builder.getByRole('textbox', { name: 'Target reps min' }).fill('6');
    await builder.getByRole('textbox', { name: 'Target reps max' }).fill('8');
    await builder.getByLabel('Close').click();

    await page.getByText('Draft Resume', { exact: true }).first().click();
    await page.getByRole('dialog').getByText('Start workout', { exact: true }).click();
    await expect(page.getByText('Log this set (optional)')).toBeVisible();
    await page.getByRole('textbox', { name: 'Weight' }).fill('70');
    await page.getByRole('textbox', { name: 'Reps' }).fill('8');
    await page.getByText('Start', { exact: true }).first().click();
    await expect(page.getByText('Skip', { exact: true })).toBeVisible();

    await page.reload();
    await page.waitForLoadState('load');
    await goToTab(page, 'workout');
    await expect(page.getByText('Session in progress', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Resume workout · Draft Resume' }).click();
    await expect(page.getByRole('textbox', { name: 'Weight' })).toHaveValue('70');
    await expect(page.getByRole('textbox', { name: 'Reps' })).toHaveValue('8');
    await page.getByText('Skip', { exact: true }).click();
    await expect(page.getByText('Workout complete!')).toBeVisible();
    await page.getByText('Save and finish', { exact: true }).click();
    await expect(page.getByText('Workout saved')).toBeVisible({ timeout: 10_000 });
  });

  test('runs bodyweight, timed, and cardio modalities with typed results', async ({ page }) => {
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
      await expect(page.getByText('Exercise library', { exact: true })).not.toBeVisible();
      await expect(builder.getByText(exerciseName, { exact: true })).toBeVisible();
    }

    for (const exerciseName of ['Push-up', 'Plank', 'Treadmill Walk']) {
      await builder.getByText(exerciseName, { exact: true }).click();
      await builder.getByRole('textbox', { name: `${exerciseName} superset group` }).fill('tour');
      await builder.getByRole('textbox', { name: 'Active (seconds)' }).fill('5');
      await builder.getByRole('textbox', { name: 'Rest (seconds)' }).fill('0');
      if (exerciseName === 'Push-up') {
        await builder.getByRole('textbox', { name: 'Target reps min' }).fill('8');
        await builder.getByRole('textbox', { name: 'Target reps max' }).fill('12');
      } else {
        await builder.getByRole('textbox', { name: 'Target duration (seconds)' }).fill('5');
      }
      if (exerciseName === 'Treadmill Walk') {
        await builder.getByRole('textbox', { name: 'Target distance' }).fill('3');
        await builder.getByRole('textbox', { name: 'Target pace' }).fill('8');
      }
    }
    await builder.getByLabel('Close').click();

    await page.getByText('Modality Tour', { exact: true }).first().click();
    await page.getByRole('dialog').getByText('Start workout', { exact: true }).click();
    await expect(page.getByText(/bodyweight · 8–12 reps/)).toBeVisible();
    await page.getByRole('textbox', { name: 'Reps' }).fill('10');
    await page.getByText('Start', { exact: true }).first().click();
    // Typed bodyweight sets are manual events: the active timer is only a
    // pacing aid and stops without fabricating completion.
    await page.getByText('Complete set now', { exact: true }).click();

    await expect(page.getByText('Plank', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/timed · target/)).toBeVisible();
    await expect(page.getByText('Treadmill Walk', { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/cardio · target/)).toBeVisible();
    await page.getByRole('textbox', { name: 'Distance' }).fill('3.2');
    await page.getByRole('textbox', { name: 'Pace' }).fill('7.5');
    await expect(page.getByText('Workout complete!')).toBeVisible({ timeout: 15_000 });
    await page.getByText('Save and finish', { exact: true }).click();
    await expect(page.getByText('Workout saved')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Done', { exact: true }).click();

    await page
      .getByLabel(/Open session from/)
      .first()
      .click();
    const detail = page.getByRole('dialog');
    await expect(detail.getByText('Push-up', { exact: true })).toBeVisible();
    await expect(detail.getByText('Plank', { exact: true }).first()).toBeVisible();
    await expect(detail.getByText('Treadmill Walk', { exact: true }).first()).toBeVisible();
    await expect(detail.getByText(/3.2 distance/)).toBeVisible();
    await expect(detail.getByText(/pace 7.5/)).toBeVisible();
  });

  test('tracks body weight and an optional goal locally', async ({ page }) => {
    await page.getByText('Log weight', { exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'Weight', exact: true }).fill('80');
    await dialog.getByRole('textbox', { name: 'Goal weight (optional)' }).fill('75');
    await dialog.getByText('Save weight and goal', { exact: true }).click();
    await expect(page.getByText('80 kg', { exact: true })).toBeVisible();
    await expect(page.getByText('Goal · 75 kg', { exact: true })).toBeVisible();

    await page
      .getByLabel(/Edit body weight/)
      .first()
      .click();
    const editDialog = page.getByRole('dialog');
    await editDialog.getByRole('textbox', { name: 'Weight', exact: true }).fill('81');
    await editDialog.getByText('Save changes', { exact: true }).click();
    await expect(page.getByText('81 kg', { exact: true })).toBeVisible();

    await page
      .getByLabel(/Delete body weight/)
      .first()
      .click();
    const confirmDialog = page.getByRole('dialog');
    await confirmDialog.getByText('Delete entry', { exact: true }).click();
    await expect(page.getByText('81 kg', { exact: true })).not.toBeVisible();
    await expect(page.getByText('Goal · 75 kg', { exact: true })).toBeVisible();

    await page.reload();
    await page.waitForLoadState('load');
    await goToTab(page, 'workout');
    await expect(page.getByText('Goal · 75 kg', { exact: true })).toBeVisible();
  });
});
