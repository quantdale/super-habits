import { mkdirSync } from 'node:fs';
import { test, expect, type Page } from './fixtures';
import { goToTab } from './helpers/navigation';
import { seedFixture } from './helpers/seed';
import { resetAll } from './helpers/reset';

/**
 * W13 rendered evidence — Settings / Command Center / Achievements.
 *
 * Opt-in via `VISUAL_AUDIT=1`, the established convention for the campaign's
 * rendered-truth instruments. Captures are `page.screenshot()` evidence for
 * human/model inspection, NOT `toHaveScreenshot` assertions; W15 owns curated
 * baselines.
 *
 *   VISUAL_AUDIT=1 VISUAL_AUDIT_OUTPUT_DIR=docs/ui-ux/v3-audit/w13/before \
 *     E2E_PORT=8086 npx playwright test e2e/secondary-surface-w13-audit.spec.ts
 */
const OUT = process.env.VISUAL_AUDIT_OUTPUT_DIR ?? 'docs/ui-ux/v3-audit/w13/after';
test.skip(process.env.VISUAL_AUDIT !== '1', 'W13 visual evidence is opt-in');
test.setTimeout(300_000);

async function shot(page: Page, name: string): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${name}.png`, animations: 'disabled' });
}

async function openSettings(page: Page): Promise<void> {
  await goToTab(page, 'overview');
  await page.getByRole('button', { name: 'Open settings' }).click();
  await expect(page.getByText('Appearance', { exact: true }).first()).toBeVisible({
    timeout: 20_000,
  });
  await page.waitForTimeout(400);
}

async function openCommandCenter(page: Page): Promise<void> {
  await goToTab(page, 'overview');
  await page.getByRole('button', { name: 'Quick capture' }).click();
  await page
    .getByPlaceholder('What do you want to remember?')
    .waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByRole('button', { name: 'Describe it' }).click();
  await page.waitForTimeout(800);
}

async function openAchievements(page: Page): Promise<void> {
  await goToTab(page, 'overview');
  await page.getByRole('button', { name: /Level & Streaks card — open achievements/ }).click();
  await expect(page.getByText('Level & Achievements')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(500);
}

const SIZES = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
];

test('W13 Settings: top, sections and backup across widths', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await goToTab(page, 'overview');
  await seedFixture(page, 'TYPICAL');

  await openSettings(page);
  await shot(page, '390-settings-top');
  // Scroll the modal body to successive offsets and capture each; the section
  // list is long enough that label-based scrollIntoView is flaky across widths.
  for (const [offset, name] of [
    [900, '390-settings-mid'],
    [2200, '390-settings-backup'],
    [4200, '390-settings-bottom'],
  ] as const) {
    await page.evaluate((y) => window.scrollTo(0, y), offset);
    await page.waitForTimeout(300);
    await shot(page, name);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);

  for (const vp of [SIZES[0], SIZES[2], SIZES[3], SIZES[4]]) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(300);
    await shot(page, `${vp.width}-settings-top`);
  }
});

test('W13 Command Center: empty, populated and parse result', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await goToTab(page, 'overview');
  await seedFixture(page, 'TYPICAL');

  await openCommandCenter(page);
  await shot(page, '390-command-empty');

  const field = page.getByPlaceholder(/Add a todo|Call mom/i).first();
  if (await field.isVisible().catch(() => false)) {
    await field.fill('Add a todo to call mom tomorrow');
    await page.waitForTimeout(300);
    await shot(page, '390-command-typed');
  }

  for (const vp of [SIZES[0], SIZES[3], SIZES[4]]) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(300);
    await shot(page, `${vp.width}-command`);
  }
});

test('W13 Achievements: earned and locked states', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await goToTab(page, 'overview');
  await seedFixture(page, 'TYPICAL');
  await openAchievements(page);
  await shot(page, '390-achievements-top');
  await page.evaluate(() => window.scrollTo(0, 4000));
  await page.waitForTimeout(300);
  await shot(page, '390-achievements-bottom');

  for (const vp of [SIZES[0], SIZES[3], SIZES[4]]) {
    await page.setViewportSize(vp);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await shot(page, `${vp.width}-achievements`);
  }
});

test('W13 Achievements: empty device state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await goToTab(page, 'overview');
  await resetAll(page);
  await goToTab(page, 'overview');
  await openAchievements(page);
  await shot(page, '390-achievements-empty');
});

test('W13 secondary surfaces: dark theme', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => window.localStorage.setItem('superhabits.theme.mode', 'dark'));
  await goToTab(page, 'overview');
  await seedFixture(page, 'TYPICAL');
  await goToTab(page, 'overview');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await openSettings(page);
  await shot(page, '390-dark-settings-top');
  await openCommandCenter(page);
  await shot(page, '390-dark-command');
  await openAchievements(page);
  await shot(page, '390-dark-achievements');
});
