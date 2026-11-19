import { test, expect } from './fixtures';
import { clearDatabase } from './helpers/db';
import { openSettingsScreen } from './helpers/commandObservation';
import { WEEKLY_REVIEW_REMINDER_STORAGE_KEY } from '@/features/weekly-review/weeklyReviewReminder.domain';

test('saving a weekly reminder time preserves its off state across reload', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await clearDatabase(page);
  await openSettingsScreen(page);
  const toggle = page.getByRole('switch', { name: 'Weekly review reminder', exact: true });
  await expect(toggle).toBeEnabled();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('button', { name: 'Weekly review on Fri', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Weekly review reminder time', exact: true })
    .fill('09:05');
  await page.getByRole('button', { name: 'Save weekly review reminder time', exact: true }).click();
  await expect(toggle).toBeEnabled();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
        WEEKLY_REVIEW_REMINDER_STORAGE_KEY,
      ),
    )
    .toEqual({ enabled: false, weekday: 5, hour: 9, minute: 5 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await openSettingsScreen(page);
  await expect(
    page.getByRole('switch', { name: 'Weekly review reminder', exact: true }),
  ).toHaveAttribute('aria-checked', 'false');
  await expect(
    page.getByRole('textbox', { name: 'Weekly review reminder time', exact: true }),
  ).toHaveValue('09:05');
  await expect(
    page.getByRole('button', { name: 'Weekly review on Fri', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('enabling a weekly reminder rejects an invalid time instead of storing a different schedule', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await clearDatabase(page);
  await openSettingsScreen(page);
  const toggle = page.getByRole('switch', { name: 'Weekly review reminder', exact: true });
  await expect(toggle).toBeEnabled();
  await page
    .getByRole('textbox', { name: 'Weekly review reminder time', exact: true })
    .fill('25:00');
  await toggle.click();
  await expect(toggle).toBeEnabled();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('alert')).toContainText('Enter a valid time as HH:mm');
  expect(
    await page.evaluate((key) => localStorage.getItem(key), WEEKLY_REVIEW_REMINDER_STORAGE_KEY),
  ).toBeNull();
});

test('turning a reminder off with an invalid draft retains its last valid schedule', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await clearDatabase(page);
  await openSettingsScreen(page);
  const toggle = page.getByRole('switch', { name: 'Weekly review reminder', exact: true });
  const time = page.getByRole('textbox', { name: 'Weekly review reminder time', exact: true });
  await expect(toggle).toBeEnabled();
  await time.fill('09:05');
  await toggle.click();
  await expect(toggle).toBeEnabled();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await time.fill('25:00');
  await toggle.click();
  await expect(toggle).toBeEnabled();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
        WEEKLY_REVIEW_REMINDER_STORAGE_KEY,
      ),
    )
    .toEqual({ enabled: false, weekday: 0, hour: 9, minute: 5 });
});
