import { mkdirSync } from 'node:fs';
import { test, expect, type Page } from './fixtures';
import { goToTab } from './helpers/navigation';
import { seedFixture } from './helpers/seed';
import { resetAll } from './helpers/reset';

/**
 * W12 rendered evidence — Weekly Review / Progress / Activity.
 *
 * Opt-in via `VISUAL_AUDIT=1`, exactly like `e2e/visual-audit.spec.ts` and the
 * W11 audit. Captures are `page.screenshot()` evidence for human/model visual
 * inspection (and the W12 defect register), NOT `toHaveScreenshot` assertions;
 * curated regression baselines are the separate W15 deliverable.
 *
 *   VISUAL_AUDIT=1 VISUAL_AUDIT_OUTPUT_DIR=docs/ui-ux/v3-audit/w12/before \
 *     npx playwright test e2e/planning-w12-audit.spec.ts
 */
const OUT = process.env.VISUAL_AUDIT_OUTPUT_DIR ?? 'docs/ui-ux/v3-audit/w12/after';
test.skip(process.env.VISUAL_AUDIT !== '1', 'W12 visual evidence is opt-in');
test.setTimeout(300_000);

async function shot(page: Page, name: string): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${name}.png`, animations: 'disabled' });
}

async function setDark(page: Page, dark: boolean, reload = false): Promise<void> {
  await page.addInitScript(
    ([mode]) => {
      window.localStorage.setItem('superhabits.theme.mode', mode);
    },
    [dark ? 'dark' : 'light'] as const,
  );
  if (reload) {
    await page.evaluate(
      (mode) => window.localStorage.setItem('superhabits.theme.mode', mode),
      dark ? 'dark' : 'light',
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
}

/** Open the Planning Hub and switch it to the Progress view. */
async function openHub(page: Page, view: 'Progress' | 'Timeline'): Promise<void> {
  await goToTab(page, 'overview');
  await page.getByRole('button', { name: 'Plan today' }).click();
  // Planning Hub views are tabs (SegmentedControl), not buttons.
  const tab = page.getByRole('tab', { name: view, exact: true });
  await expect(tab).toBeVisible({ timeout: 20_000 });
  await tab.click();
  await page.waitForTimeout(600);
}

/** Open the Weekly Review overlay from the hub's Progress view. */
async function openWeeklyReview(page: Page): Promise<void> {
  await openHub(page, 'Progress');
  await page.getByRole('button', { name: 'Open weekly review' }).click();
  await expect(
    page.getByRole('dialog').getByText('Weekly Review', { exact: true }).first(),
  ).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(500);
}

const SIZES = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
];

test('W12 reflection surfaces: Progress, Timeline and Weekly Review', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await goToTab(page, 'overview');
  await seedFixture(page, 'TYPICAL');
  await returnToHub(page);

  // --- Progress (populated) ---
  await openHub(page, 'Progress');
  await shot(page, '390-progress-top');
  await page.evaluate(() => window.scrollTo(0, 4000));
  await page.waitForTimeout(300);
  await shot(page, '390-progress-bottom');

  // --- Timeline (populated) ---
  await openHub(page, 'Timeline');
  await shot(page, '390-timeline-top');

  // --- Progress / Timeline across widths ---
  for (const vp of [SIZES[0], SIZES[2], SIZES[3], SIZES[4]]) {
    await page.setViewportSize(vp);
    await openHub(page, 'Progress');
    await shot(page, `${vp.width}-progress`);
    await openHub(page, 'Timeline');
    await shot(page, `${vp.width}-timeline`);
  }

  // --- Weekly Review overlay steps ---
  await page.setViewportSize({ width: 390, height: 844 });
  await openWeeklyReview(page);
  await shot(page, '390-review-step-1');
  const dialog = page.getByRole('dialog');
  const next = dialog.getByRole('button', { name: 'Next', exact: true });
  for (let i = 1; i <= 5; i++) {
    if (!(await next.isVisible().catch(() => false))) break;
    await next.click();
    await page.waitForTimeout(350);
    await shot(page, `390-review-step-${i + 1}`);
  }
  await shot(page, '390-review-preview');
});

test('W12 reflection surfaces: dark theme', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setDark(page, true);
  await goToTab(page, 'overview');
  await seedFixture(page, 'TYPICAL');
  await returnToHub(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await openHub(page, 'Progress');
  await shot(page, '390-dark-progress');
  await openHub(page, 'Timeline');
  await shot(page, '390-dark-timeline');
  await openWeeklyReview(page);
  await shot(page, '390-dark-review');
});

test('W12 reflection surfaces: empty states', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await goToTab(page, 'overview');
  await resetAll(page);
  await returnToHub(page);

  await openHub(page, 'Progress');
  await shot(page, '390-progress-empty');
  await openHub(page, 'Timeline');
  await shot(page, '390-timeline-empty');
});

/** Return to the Today tab after a DB-harness reset. */
async function returnToHub(page: Page): Promise<void> {
  await goToTab(page, 'overview');
}
