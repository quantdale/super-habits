import { expect, test } from '@playwright/test';
import { clearDatabase } from './helpers/db';

async function dismissStartupRestorePromptIfPresent(page: import('@playwright/test').Page) {
  const dismissButton = page.getByText('Not now', { exact: true });
  if (await dismissButton.isVisible().catch(() => false)) {
    await dismissButton.click();
  }
}

function getThemeIdAttr(page: import('@playwright/test').Page) {
  return page.evaluate(() => document.documentElement.getAttribute('data-theme-id'));
}

function getCssVar(page: import('@playwright/test').Page, name: string) {
  return page.evaluate(
    (varName) => getComputedStyle(document.documentElement).getPropertyValue(varName).trim(),
    name,
  );
}

test.describe('Theming', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');
    await clearDatabase(page);
  });

  test('defaults to the Light theme in Light mode', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await dismissStartupRestorePromptIfPresent(page);

    await page.getByRole('button', { name: 'Light', exact: true }).click();

    await expect.poll(() => getThemeIdAttr(page)).toBe('light');
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe(
      'light',
    );
  });

  test('selecting a night theme applies it immediately and persists across reload', async ({
    page,
  }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await dismissStartupRestorePromptIfPresent(page);

    // Fix mode to Dark first: in `system` mode, filling the night slot alone
    // doesn't flip visible appearance if the OS/browser reports light — that's
    // the intended no-surprise-theme-change behavior, not what this test covers.
    await page.getByRole('button', { name: 'Dark', exact: true }).click();
    await page.getByText('Night theme', { exact: true }).scrollIntoViewIfNeeded();
    await page.getByRole('radio', { name: /Nord Arctic, dark theme/i }).click();

    await expect.poll(() => getThemeIdAttr(page)).toBe('nord-arctic');
    // Nord Arctic's background token (#2e3440) should now be live as a CSS var.
    await expect.poll(() => getCssVar(page, '--sh-background')).toBe('#2e3440');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => getThemeIdAttr(page)).toBe('nord-arctic');
  });

  test('mode chips show the correct slot theme without losing the other slot', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await dismissStartupRestorePromptIfPresent(page);

    await page.getByRole('button', { name: 'Dark', exact: true }).click();
    await page.getByText('Night theme', { exact: true }).scrollIntoViewIfNeeded();
    await page.getByRole('radio', { name: /Cyberpunk Neon, dark theme/i }).click();
    await expect.poll(() => getThemeIdAttr(page)).toBe('cyberpunk-neon');

    await page.getByText('Day theme', { exact: true }).scrollIntoViewIfNeeded();
    await page.getByRole('radio', { name: /Ocean Teal, light theme/i }).click();
    await expect.poll(() => getThemeIdAttr(page)).toBe('ocean-teal');

    // Switching back to dark mode should still show Cyberpunk Neon, not the default Dark.
    await page.getByRole('button', { name: 'Dark', exact: true }).click();
    await expect.poll(() => getThemeIdAttr(page)).toBe('cyberpunk-neon');
  });
});
