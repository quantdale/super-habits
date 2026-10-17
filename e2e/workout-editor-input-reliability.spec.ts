import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { goToTab } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { queryRows } from './helpers/dbHarness';
import { fillRoutineName } from './helpers/forms';

async function openRoutineBuilder(page: Page, routineName: string): Promise<Locator> {
  await fillRoutineName(page, routineName);
  await page.getByText('Add routine', { exact: true }).click();
  await page.getByText(routineName, { exact: true }).first().click();
  return page.getByRole('dialog');
}

test.describe('Workout editor input reliability', () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, 'workout');
    await clearDatabase(page);
    await goToTab(page, 'workout');
  });

  test('clears the add-exercise name and never double-adds on repeat Add', async ({ page }) => {
    const builder = await openRoutineBuilder(page, 'Add field state');
    const nameInput = builder.getByRole('textbox', { name: 'Exercise name' });
    await nameInput.fill('Curls');
    await builder.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(builder.getByText('Curls', { exact: true })).toHaveCount(1);

    // The add field is cleared after a successful add: it must not show stale
    // text that a repeat Add would write as a second row.
    await expect(nameInput).toHaveValue('');
    await builder.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(builder.getByText('Exercise name is required.')).toBeVisible();
    await expect(builder.getByText('Curls', { exact: true })).toHaveCount(1);
  });

  test('keeps rapid keystrokes in the save-on-change target load field', async ({ page }) => {
    const builder = await openRoutineBuilder(page, 'Rapid load typing');
    await builder.getByText('Choose from exercise library', { exact: true }).click();
    await page
      .getByRole('dialog')
      .last()
      .getByRole('button', { name: 'Add Barbell Bench Press' })
      .click();

    const load = builder.getByRole('textbox', { name: 'Target load' });
    await load.fill('');
    await load.pressSequentially('42', { delay: 80 });
    await expect(load).toHaveValue('42');
    // The save → refresh round trip must never reset what is being typed.
    await page.waitForTimeout(1200);
    await expect(load).toHaveValue('42');
  });

  test('keeps rapid keystrokes in builder number steppers and persists them', async ({ page }) => {
    const builder = await openRoutineBuilder(page, 'Rapid stepper typing');
    await builder.getByText('Choose from exercise library', { exact: true }).click();
    await page
      .getByRole('dialog')
      .last()
      .getByRole('button', { name: 'Add Barbell Bench Press' })
      .click();

    const active = builder.getByRole('textbox', { name: 'Active (seconds)' });
    // The +/- stepper buttons start an empty field at the field minimum.
    await active.fill('');
    await builder.getByRole('button', { name: 'Increase Active (seconds)' }).click();
    await expect(active).toHaveValue('5');

    await active.fill('');
    await active.pressSequentially('120', { delay: 80 });
    await expect(active).toHaveValue('120');
    await page.waitForTimeout(1200);
    await expect(active).toHaveValue('120');

    const load = builder.getByRole('textbox', { name: 'Target load' });
    await load.fill('');
    await load.pressSequentially('42', { delay: 80 });
    await expect(load).toHaveValue('42');

    await builder.getByLabel('Close').click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByText('Rapid stepper typing', { exact: true }).first().click();
    const persisted = page.getByRole('dialog');
    await persisted.getByText('Barbell Bench Press', { exact: true }).click();
    await expect(persisted.getByRole('textbox', { name: 'Active (seconds)' })).toHaveValue('120');
    await expect(persisted.getByRole('textbox', { name: 'Target load' })).toHaveValue('42');

    await page.reload();
    await page.waitForLoadState('load');
    await goToTab(page, 'workout');
    const sets = await queryRows(
      page,
      `SELECT active_seconds, target_load FROM routine_exercise_sets`,
    );
    expect(sets).toEqual([{ active_seconds: 120, target_load: 42 }]);
  });
});
