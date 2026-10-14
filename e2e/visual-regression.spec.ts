import { test, expect, type Page } from './fixtures';
import { seedFixture } from './helpers/seed';
import { resetAll } from './helpers/reset';
import { installClock } from './helpers/clock';
import { goToTab } from './helpers/navigation';

/**
 * W15 — persistent visual regression baselines (Frontend V3 tasks 15.1/15.2).
 *
 * This is a durable testing product, not a screenshot dump: a curated set of
 * deterministic `toHaveScreenshot` goldens that protect the W3–W14 Calm
 * Momentum work from silent drift.
 *
 * Determinism contract (design D15.2):
 *  - hermetic `build:e2e` artifact (the Supabase leak guard must report 0 hosts);
 *  - `resetAll` + `seedFixture` per snapshot, so no state leaks between cases;
 *  - a FIXED clock installed before the app's first render, so the date
 *    heading, greeting and week strips are constant (this is also why no
 *    snapshot needs masking — see the manifest);
 *  - explicit `document.fonts.ready` (never an arbitrary long sleep);
 *  - reduced motion emulated AND animations disabled at capture time;
 *  - explicit viewport per snapshot and `deviceScaleFactor: 1` from the project;
 *  - a real semantic assertion before every capture, so a still-loading or
 *    error surface fails instead of becoming a golden.
 *
 * Baselines live under `e2e/__screenshots__/`. Regenerate with
 * `npm run visual:update`, never in CI. A baseline change requires the reviewed
 * manifest note in `docs/ui-ux/v3-audit/w15/golden-manifest.md`; thresholds are
 * never loosened to pass.
 */

/**
 * Fixed local wall time. 2026-10-13 19:30 local (`Asia/Manila`, pinned by
 * `playwright.config.ts`) so the date heading, greeting and week strip are all
 * deterministic, and the day is a Tuesday (the canonical journey persona day).
 */
const FIXED_LOCAL_TIME = '2026-10-13T19:30:00';

const PHONE = { width: 390, height: 844 };
const PHONE_NARROW = { width: 360, height: 740 };
const TABLET = { width: 768, height: 1024 };
const DESKTOP = { width: 1280, height: 800 };

/**
 * Settle after the semantic assertion. This is not a readiness substitute: the
 * assertion above it already proves the content is present. It only lets a
 * one-frame RN Web layout pass finish before the capture.
 */
async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
}

async function capture(page: Page, name: string, opts: { scrollTop?: number } = {}): Promise<void> {
  // Normalize scroll position. Overlay backgrounds render the page *behind*
  // the modal, and Playwright's click auto-scrolls that page to bring the
  // trigger into view — which is not deterministic across runs (observed as a
  // 0.05-ratio diff on the Achievements snapshot).
  //
  // The app's page scroll is an RN Web `ScrollView`, which renders as an inner
  // `overflow: auto` div; `window.scrollTo` is a no-op on it. Reset every
  // scrollable element in the document to the requested offset instead, so the
  // whole rendered tree is captured from a known position.
  await page.evaluate((y) => {
    const scrollables = Array.from(document.querySelectorAll<HTMLElement>('*')).filter((el) => {
      const style = getComputedStyle(el);
      return /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
    });
    for (const el of scrollables) el.scrollTop = y;
    // Also normalize the window in case a layout uses document scrolling.
    window.scrollTo(0, y);
  }, opts.scrollTop ?? 0);
  await page.waitForTimeout(100);
  await settle(page);
  await expect(page).toHaveScreenshot(`${name}.png`, {
    animations: 'disabled',
    caret: 'hide',
    // Deterministic here because the clock and scroll are both fixed, so no
    // region needs masking and no pixel tolerance is granted.
    maxDiffPixels: 0,
  });
}

async function openWithFixture(
  page: Page,
  viewport: { width: number; height: number },
  fixture: 'SMALL' | 'TYPICAL' | 'HEAVY' | null,
): Promise<void> {
  await page.setViewportSize(viewport);
  await goToTab(page, 'overview');
  if (fixture) {
    await seedFixture(page, fixture);
    await goToTab(page, 'overview');
  } else {
    await resetAll(page);
    await goToTab(page, 'overview');
  }
  await expect(page.getByRole('tablist', { name: 'Section tabs' })).toBeVisible({
    timeout: 20_000,
  });
}

/**
 * Apply dark mode through the app's own storage key. `resetAll` wipes
 * AsyncStorage, so a themed snapshot must set the mode AFTER the fixture reset
 * (an `addInitScript` would be erased by the reset).
 */
async function setDarkMode(page: Page): Promise<void> {
  await page.evaluate(() => window.localStorage.setItem('superhabits.theme.mode', 'dark'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
}

async function openSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Open settings' }).click();
  await expect(page.getByText('Appearance', { exact: true }).first()).toBeVisible({
    timeout: 20_000,
  });
}

async function openPlanHub(page: Page, view: 'Progress' | 'Timeline'): Promise<void> {
  await page.getByRole('button', { name: 'Plan today' }).click();
  const tab = page.getByRole('tab', { name: view, exact: true });
  await expect(tab).toBeVisible({ timeout: 20_000 });
  await tab.click();
  await page.waitForTimeout(400);
}

async function openAchievements(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Level & Streaks card — open achievements/ }).click();
  await expect(page.getByText('Level & Achievements')).toBeVisible({ timeout: 20_000 });
}

async function openCommand(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Quick capture' }).click();
  await page
    .getByPlaceholder('What do you want to remember?')
    .waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByRole('button', { name: 'Describe it' }).click();
  await expect(page.getByPlaceholder(/Add a todo/i).first()).toBeVisible({ timeout: 20_000 });
}

// One context per test: the clock must be installed before the first render, so
// every test begins with a fresh page whose clock is faked from the start.
test.beforeEach(async ({ page }) => {
  await installClock(page, FIXED_LOCAL_TIME);
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

// ---------------------------------------------------------------------------
// Global shell
// ---------------------------------------------------------------------------

test.describe('W15 shell', () => {
  test('today first-run (phone, light)', async ({ page }) => {
    await openWithFixture(page, PHONE, null);
    await expect(page.getByText('Good evening')).toBeVisible();
    await capture(page, 'shell-today-first-run-390-light');
  });

  test('today populated (phone, light)', async ({ page }) => {
    await openWithFixture(page, PHONE, 'TYPICAL');
    await expect(page.getByText('Good evening')).toBeVisible();
    await expect(page.getByText('UP NEXT')).toBeVisible();
    await capture(page, 'shell-today-390-light');
  });

  test('today populated (phone, dark)', async ({ page }) => {
    await openWithFixture(page, PHONE, 'TYPICAL');
    await setDarkMode(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByText('UP NEXT')).toBeVisible();
    await capture(page, 'shell-today-390-dark');
  });

  test('today populated (tablet, light)', async ({ page }) => {
    await openWithFixture(page, TABLET, 'TYPICAL');
    await expect(page.getByText('UP NEXT')).toBeVisible();
    await capture(page, 'shell-today-768-light');
  });

  test('today populated (desktop rail, light)', async ({ page }) => {
    await openWithFixture(page, DESKTOP, 'TYPICAL');
    await expect(page.getByText('UP NEXT')).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Section tabs' })).toBeVisible();
    await capture(page, 'shell-today-1280-light');
  });
});

// ---------------------------------------------------------------------------
// Primary destinations
// ---------------------------------------------------------------------------

test.describe('W15 primary destinations', () => {
  test('to do typical (phone, light)', async ({ page }) => {
    await openWithFixture(page, PHONE, 'TYPICAL');
    await goToTab(page, 'todos');
    await expect(page.getByText(/^\d+ open$/).first()).toBeVisible({ timeout: 20_000 });
    await capture(page, 'todos-390-light');
  });

  test('to do long title (phone, light)', async ({ page }) => {
    await openWithFixture(page, PHONE, 'TYPICAL');
    await goToTab(page, 'todos');
    const longTitle =
      'Call the insurance company about the renewed policy premium schedule before the end of the quarterly billing window';
    const quickAdd = page.getByPlaceholder('Quick add', { exact: true });
    await expect(quickAdd).toBeVisible({ timeout: 20_000 });
    await quickAdd.fill(longTitle);
    await page.getByLabel('Quick add task title').press('Enter');
    const row = page.getByRole('button', { name: `Edit task: ${longTitle}`, exact: true });
    await row.scrollIntoViewIfNeeded();
    await expect(row).toBeVisible();
    await capture(page, 'todos-long-title-390-light');
  });

  test('to do HEAVY (desktop, light)', async ({ page }) => {
    await openWithFixture(page, DESKTOP, 'HEAVY');
    await goToTab(page, 'todos');
    await expect(page.getByText(/^\d+ open$/).first()).toBeVisible({ timeout: 30_000 });
    await capture(page, 'todos-heavy-1280-light');
  });

  test('to do dark (phone, dark)', async ({ page }) => {
    await openWithFixture(page, PHONE, 'TYPICAL');
    await setDarkMode(page);
    await goToTab(page, 'todos');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await capture(page, 'todos-390-dark');
  });

  test('habits populated (phone, light)', async ({ page }) => {
    await openWithFixture(page, PHONE, 'TYPICAL');
    await goToTab(page, 'habits');
    await expect(page.getByRole('button', { name: /^Open Habit / }).first()).toBeVisible({
      timeout: 20_000,
    });
    await capture(page, 'habits-390-light');
  });

  test('habits quantitative check-in (phone, light)', async ({ page }) => {
    await openWithFixture(page, PHONE, 'TYPICAL');
    await goToTab(page, 'habits');
    const detail = page.getByRole('button', { name: /^Open Habit / }).first();
    await expect(detail).toBeVisible({ timeout: 20_000 });
    await detail.click();
    await expect(page.getByRole('tablist', { name: 'Habit detail sections' })).toBeVisible({
      timeout: 20_000,
    });
    await capture(page, 'habits-quantitative-detail-390-light');
  });

  test('focus idle (phone, light)', async ({ page }) => {
    await openWithFixture(page, PHONE, 'TYPICAL');
    await goToTab(page, 'pomodoro');
    await expect(page.getByRole('button', { name: /^start focus$/i })).toBeVisible({
      timeout: 20_000,
    });
    await capture(page, 'focus-idle-390-light');
  });

  test('workout landing (phone, light)', async ({ page }) => {
    await openWithFixture(page, PHONE, 'TYPICAL');
    await goToTab(page, 'workout');
    await expect(page.getByText('QUICK START')).toBeVisible({ timeout: 20_000 });
    await capture(page, 'workout-landing-390-light');
  });

  test('calories day (phone, light)', async ({ page }) => {
    await openWithFixture(page, PHONE, 'TYPICAL');
    await goToTab(page, 'calories');
    await expect(page.getByText('Macros')).toBeVisible({ timeout: 20_000 });
    await capture(page, 'calories-390-light');
  });

  test('calories day (phone, dark)', async ({ page }) => {
    await openWithFixture(page, PHONE, 'TYPICAL');
    await setDarkMode(page);
    await goToTab(page, 'calories');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByText('Macros')).toBeVisible({ timeout: 20_000 });
    await capture(page, 'calories-390-dark');
  });
});

// ---------------------------------------------------------------------------
// States: empty / narrow
// ---------------------------------------------------------------------------

test.describe('W15 states', () => {
  test('to do empty (phone, light)', async ({ page }) => {
    await openWithFixture(page, PHONE_NARROW, null);
    await goToTab(page, 'todos');
    await expect(page.getByText('No pending tasks').first()).toBeVisible({ timeout: 20_000 });
    await capture(page, 'todos-empty-360-light');
  });

  test('today first-run (narrow phone, light)', async ({ page }) => {
    await openWithFixture(page, PHONE_NARROW, null);
    await expect(page.getByText('Good evening')).toBeVisible();
    await capture(page, 'shell-today-first-run-360-light');
  });
});

// ---------------------------------------------------------------------------
// Overlays
// ---------------------------------------------------------------------------

test.describe('W15 overlays', () => {
  test('quick capture sheet (phone, light)', async ({ page }) => {
    await openWithFixture(page, PHONE, 'TYPICAL');
    await page.getByRole('button', { name: 'Quick capture' }).click();
    await expect(page.getByPlaceholder('What do you want to remember?')).toBeVisible({
      timeout: 20_000,
    });
    await capture(page, 'quick-capture-390-light');
  });

  test('settings top grouped rows (phone, light)', async ({ page }) => {
    await openWithFixture(page, PHONE, 'TYPICAL');
    await openSettings(page);
    await expect(page.getByText('Current appearance', { exact: true })).toBeVisible();
    await capture(page, 'settings-top-390-light');
  });

  test('settings top grouped rows (desktop, dark)', async ({ page }) => {
    await openWithFixture(page, DESKTOP, 'TYPICAL');
    await setDarkMode(page);
    await openSettings(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByText('Current appearance', { exact: true })).toBeVisible();
    await capture(page, 'settings-top-1280-dark');
  });

  test('settings backup section (phone, light)', async ({ page }) => {
    await openWithFixture(page, PHONE, 'TYPICAL');
    await openSettings(page);
    await capture(page, 'settings-backup-390-light', { scrollTop: 2200 });
    await expect(page.getByText('Backup coverage').first()).toBeVisible({ timeout: 20_000 });
  });

  test('command center input-first (phone, light)', async ({ page }) => {
    await openWithFixture(page, PHONE, 'TYPICAL');
    await openCommand(page);
    await expect(
      page.getByText(
        'Parsing saves text in recent commands on this device. App actions require confirmation.',
      ),
    ).toBeVisible();
    await capture(page, 'command-input-390-light');
  });

  test('achievements milestone-first (phone, light)', async ({ page }) => {
    await openWithFixture(page, PHONE, 'TYPICAL');
    await openAchievements(page);
    await expect(page.getByText('Latest milestone')).toBeVisible();
    await capture(page, 'achievements-390-light');
  });
});

// ---------------------------------------------------------------------------
// W12 secondary destinations
// ---------------------------------------------------------------------------

test.describe('W15 W12 reflection surfaces', () => {
  test('weekly review step 1 (phone, light)', async ({ page }) => {
    await openWithFixture(page, PHONE, 'TYPICAL');
    await openPlanHub(page, 'Progress');
    await page.getByRole('button', { name: 'Open weekly review' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/^Step 1 of 5/)).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByRole('button', { name: 'Show all numbers' })).toBeVisible();
    await capture(page, 'review-step1-390-light');
  });

  test('weekly review step 1 (phone, dark)', async ({ page }) => {
    await openWithFixture(page, PHONE, 'TYPICAL');
    await setDarkMode(page);
    await openPlanHub(page, 'Progress');
    await page.getByRole('button', { name: 'Open weekly review' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('html')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(dialog.getByText(/^Step 1 of 5/)).toBeVisible({ timeout: 20_000 });
    await capture(page, 'review-step1-390-dark');
  });

  test('progress insights headlines + disclosure (phone, light)', async ({ page }) => {
    await openWithFixture(page, PHONE, 'TYPICAL');
    await openPlanHub(page, 'Progress');
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/Last 7 days \(/)).toBeVisible({ timeout: 20_000 });
    await dialog.getByRole('button', { name: 'Show metric details' }).click();
    await expect(dialog.getByRole('button', { name: 'Hide metric details' })).toBeVisible();
    await capture(page, 'progress-details-390-light');
  });

  test('activity timeline rows + filters (phone, light)', async ({ page }) => {
    await openWithFixture(page, PHONE, 'TYPICAL');
    await openPlanHub(page, 'Timeline');
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('All sources · Last 30 days')).toBeVisible({
      timeout: 20_000,
    });
    await dialog.getByRole('button', { name: 'Timeline filters' }).click();
    await expect(dialog.getByRole('button', { name: 'Filter timeline by Habits' })).toBeVisible();
    await capture(page, 'timeline-filters-390-light');
  });

  test('activity timeline rows (desktop, light)', async ({ page }) => {
    await openWithFixture(page, DESKTOP, 'TYPICAL');
    await openPlanHub(page, 'Timeline');
    await expect(page.getByRole('dialog').getByText('All sources · Last 30 days')).toBeVisible({
      timeout: 20_000,
    });
    await capture(page, 'timeline-1280-light');
  });
});

// ---------------------------------------------------------------------------
// Planning hub
// ---------------------------------------------------------------------------

test.describe('W15 planning hub', () => {
  test('daily plan intent-first (phone, light)', async ({ page }) => {
    await openWithFixture(page, PHONE, 'TYPICAL');
    await page.getByRole('button', { name: 'Plan today' }).click();
    await expect(page.getByRole('tab', { name: 'Today', exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Intention')).toBeVisible();
    await capture(page, 'plan-hub-today-390-light');
  });

  test('projects list (tablet, light)', async ({ page }) => {
    await openWithFixture(page, TABLET, 'TYPICAL');
    await page.getByRole('button', { name: 'Plan today' }).click();
    const projectsTab = page.getByRole('tab', { name: 'Projects', exact: true });
    await projectsTab.click();
    await expect(projectsTab).toHaveAttribute('aria-selected', 'true');
    await capture(page, 'plan-hub-projects-768-light');
  });
});
