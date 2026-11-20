import { test, expect } from './fixtures';
import { clearDatabase } from './helpers/db';
import { goToTab, sectionTab } from './helpers/navigation';
import { fillRoutineName } from './helpers/forms';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await goToTab(page, 'workout');
  await clearDatabase(page);
  await goToTab(page, 'workout');
});

test('workout repetition steppers leave enough room to read their values', async ({ page }) => {
  await fillRoutineName(page, 'Readable prescriptions');
  await page.getByText('Add routine', { exact: true }).click();
  await page.getByText('Readable prescriptions', { exact: true }).first().click();
  await page.getByText('Choose from exercise library', { exact: true }).click();
  await page.getByRole('button', { name: 'Add Barbell Bench Press', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Configure Barbell Bench Press exercise' }),
  ).toBeVisible();

  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((mode) => localStorage.setItem('superhabits.theme.mode', mode), theme);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await sectionTab(page, 'Workout').click();
    await page.getByText('Readable prescriptions', { exact: true }).first().click();
    await page.getByRole('button', { name: 'Configure Barbell Bench Press exercise' }).click();
    const dialog = page.getByRole('dialog');
    for (const width of [360, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [label, value] of [
        ['Target reps min', '8'],
        ['Target reps max', '200'],
      ]) {
        const input = dialog.getByRole('textbox', { name: label, exact: true });
        await input.fill(value);
        await expect(input).toHaveValue(value);
        const geometry = await input.evaluate((node) => {
          const input = node as HTMLInputElement;
          const style = getComputedStyle(input);
          const context = document.createElement('canvas').getContext('2d')!;
          context.font = style.font;
          return {
            available:
              input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
            required: context.measureText(input.value).width,
          };
        });
        expect
          .soft(geometry.available, `${theme} ${width} ${label}: ${JSON.stringify(geometry)}`)
          .toBeGreaterThanOrEqual(geometry.required);
      }
      if (process.env.CX_UI_SHOTS) {
        await page.screenshot({ path: `${process.env.CX_UI_SHOTS}/reps-${theme}-${width}.png` });
      }
    }
  }
});
