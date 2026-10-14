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
 * The Nunito families the app registers. `document.fonts.ready` is NOT
 * sufficient: it resolves while some faces are still `unloaded`, so Chromium
 * lazily loads `Nunito_400Regular` on first use and whether that completes
 * before a capture is a race (measured: 2 of 6 runs produced a different
 * rasterisation of the same screen, with `Nunito_400Regular` reported
 * `unloaded` after `fonts.ready` had already resolved).
 */
const APP_FONT_FAMILIES = [
  'Nunito_400Regular',
  'Nunito_600SemiBold',
  'Nunito_700Bold',
  'Nunito_800ExtraBold',
  'Nunito_900Black',
] as const;

/**
 * How long the cross-fade settle may wait before readiness fails closed.
 * Bounded on purpose: long enough for the measured 200ms fade (completion
 * ~260ms) plus layout slack, short enough to fail fast on a stuck section.
 */
const SETTLE_TIMEOUT_MS = 4000;

/**
 * Settle after the semantic assertion. This is not a readiness substitute: the
 * assertion above it already proves the content is present.
 *
 * It waits on the THREE real sources of capture drift found by measurement:
 *
 * 1. **Section cross-fade.** `SectionContainer` in `app/index.tsx` animates the
 *    outgoing section's opacity over 200ms (translate 240ms) with RN Web's
 *    `Animated`, which drives inline styles from rAF — so Playwright's
 *    `animations: 'disabled'` cannot neutralise it. Measured on the To Do
 *    snapshot: the previous section sat at `opacity: 0.647` ~60ms after the
 *    switch and reached 0 by ~260ms, so a capture at 150ms intermittently caught
 *    it bleeding through the new section (50% of runs produced a visibly
 *    different image). Wait for every other section container to reach opacity
 *    0 before capturing.
 * 2. **Font faces.** `document.fonts.ready` resolves while some faces are still
 *    `unloaded`, so Chromium lazily loads `Nunito_400Regular` on first use.
 *    Load every app family explicitly.
 * 3. **Layout pass.** A bounded settle for the final one-frame layout commit.
 *
 * FAIL-CLOSED contract (spec `visual-capture-readiness`): readiness is proven,
 * not assumed. If the bounded wait ends while an inactive hidden section is
 * still not fully transparent, or a required font face rejects its load,
 * `settle()` throws a named diagnostic and the capture never reaches
 * `toHaveScreenshot`. A non-finite computed opacity counts as UNMET — it is a
 * readiness failure, not a pass. The negative controls in the "capture
 * readiness self-checks" describe block pin these branches.
 */
async function settle(page: Page): Promise<void> {
  const diagnostics = await page.evaluate(
    async ({ families, timeoutMs }: { families: readonly string[]; timeoutMs: number }) => {
      const fontFailures: string[] = [];
      await Promise.all(
        families.map(async (family) => {
          try {
            await document.fonts.load(`16px ${family}`);
          } catch (error) {
            fontFailures.push(
              `${family} (${error instanceof Error ? error.message : String(error)})`,
            );
          }
        }),
      );
      // A rejected required face is a capture failure. Never swallow it and
      // never continue toward a screenshot after it (spec
      // `visual-capture-readiness`, "A failed required font load fails the
      // capture").
      if (fontFailures.length > 0) {
        return { fontFailures, unmetSections: [] as string[] };
      }
      await document.fonts.ready;

      const describeSection = (el: HTMLElement): string => {
        const opacity = Number.parseFloat(getComputedStyle(el).opacity);
        const id = el.id ? `#${el.id}` : '';
        const classes =
          typeof el.className === 'string' && el.className.trim().length > 0
            ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}`
            : '';
        return `${el.tagName}${id}${classes} opacity=${Number.isFinite(opacity) ? opacity : 'non-finite'}`;
      };

      // Inactive sections hidden from assistive technology must be fully
      // transparent before a golden comparison. A non-finite computed opacity is
      // UNMET (fail closed), not a pass.
      const unmetSections = () =>
        Array.from(document.querySelectorAll<HTMLElement>('[aria-hidden="true"]')).filter((el) => {
          if (!el.hasAttribute('inert')) return false;
          const opacity = Number.parseFloat(getComputedStyle(el).opacity);
          return !(Number.isFinite(opacity) && opacity <= 0.001);
        });

      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline && unmetSections().length > 0) {
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      }
      await document.fonts.ready;
      return {
        fontFailures,
        unmetSections: unmetSections().map(describeSection),
      };
    },
    { families: APP_FONT_FAMILIES, timeoutMs: SETTLE_TIMEOUT_MS },
  );

  if (diagnostics.fontFailures.length > 0) {
    throw new Error(
      `visual settle: required font load failed — ${diagnostics.fontFailures.join('; ')}. ` +
        'Capture refused before toHaveScreenshot.',
    );
  }
  if (diagnostics.unmetSections.length > 0) {
    throw new Error(
      `visual settle: section readiness unmet after ${SETTLE_TIMEOUT_MS}ms — ` +
        `${diagnostics.unmetSections.length} inactive hidden section(s) still not fully transparent: ` +
        `${diagnostics.unmetSections.join('; ')}. Capture refused before toHaveScreenshot.`,
    );
  }
  await page.waitForTimeout(80);
}

/**
 * Capture-time normalization shared by `capture()` and the strict-comparison
 * self-check: reset every scrollable element, let the scroll land, then settle.
 */
async function prepareCapture(page: Page, scrollTop = 0): Promise<void> {
  await page.evaluate((y) => {
    const scrollables = Array.from(document.querySelectorAll<HTMLElement>('*')).filter((el) => {
      const style = getComputedStyle(el);
      return /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
    });
    for (const el of scrollables) el.scrollTop = y;
    // Also normalize the window in case a layout uses document scrolling.
    window.scrollTo(0, y);
  }, scrollTop);
  await page.waitForTimeout(100);
  await settle(page);
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
  await prepareCapture(page, opts.scrollTop ?? 0);
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

// ---------------------------------------------------------------------------
// Capture readiness self-checks (negative controls, spec
// `visual-capture-readiness`)
//
// These tests never create or compare a golden except the strict-comparison
// control, which compares against an already-committed golden and refuses to
// run under `--update-snapshots`. Each control stubs a readiness failure in
// the page (via page.evaluate) and requires the capture path to FAIL with a
// named diagnostic instead of silently comparing a screenshot. They pin the
// fail-closed branches of `settle()`: a stuck opaque inactive hidden section,
// a non-finite computed opacity, and a rejected required font face.
// ---------------------------------------------------------------------------

/**
 * Run `settle()` and require it to fail with a diagnostic matching `diagnostic`.
 * The capture contract is fail-closed: an unmet readiness condition must throw
 * a named error BEFORE `toHaveScreenshot`, never resolve silently.
 */
async function expectSettleFailure(page: Page, diagnostic: RegExp): Promise<void> {
  let failure: string | null = null;
  try {
    await settle(page);
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }
  if (failure === null) {
    throw new Error('settle() unexpectedly succeeded — readiness must fail closed here');
  }
  expect(failure).toMatch(diagnostic);
}

test.describe('W15 capture readiness self-checks', () => {
  test('an inactive hidden section stuck opaque fails the capture with a named readiness diagnostic', async ({
    page,
  }) => {
    // This control drives the FULL capture path — `capture()`, not just
    // `settle()` — so it proves toHaveScreenshot is unreachable after an unmet
    // readiness condition even if capture() ever wrapped settle's error. If
    // the failure ever stopped failing closed, capture() would proceed to
    // `toHaveScreenshot` against a committed golden, so this control also
    // refuses to run under `--update-snapshots`.
    const updateMode = test.info().config.updateSnapshots;
    test.skip(
      updateMode === 'all' || updateMode === 'changed',
      'capture-level readiness control only runs in comparison mode, never in --update-snapshots mode',
    );
    await openWithFixture(page, PHONE, null);
    // A stubbed inactive hidden section that never fades: through the whole
    // bounded settle wait it must keep the capture from comparing a golden.
    await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.className = 'readiness-probe-stuck';
      probe.setAttribute('aria-hidden', 'true');
      probe.setAttribute('inert', '');
      probe.style.opacity = '1';
      document.body.appendChild(probe);
    });
    let failure: string | null = null;
    try {
      await capture(page, 'shell-today-first-run-390-light');
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
    if (failure === null) {
      throw new Error('capture() reached toHaveScreenshot despite unmet section readiness');
    }
    // The propagated failure must be settle()'s named readiness diagnostic;
    // a toHaveScreenshot comparison failure must NOT count as fail-closed.
    expect(failure).toMatch(/visual settle: section readiness unmet[\s\S]*readiness-probe-stuck/);
    expect(failure).not.toMatch(/Screenshot comparison failed/);
  });

  test('a non-finite computed opacity is unmet readiness, not a pass', async ({ page }) => {
    await openWithFixture(page, PHONE, null);
    // Same stuck section, but its computed opacity reads as non-finite. The
    // old helper treated non-finite as settled; readiness must fail closed.
    await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.className = 'readiness-probe-nonfinite';
      probe.setAttribute('aria-hidden', 'true');
      probe.setAttribute('inert', '');
      document.body.appendChild(probe);
      const originalGetComputedStyle = window.getComputedStyle.bind(window);
      (
        window as unknown as { getComputedStyle: typeof originalGetComputedStyle }
      ).getComputedStyle = (element, pseudoElt) => {
        const style = originalGetComputedStyle(element, pseudoElt);
        if (element !== probe) return style;
        return new Proxy(style, {
          get: (target, property) =>
            property === 'opacity' ? 'not-a-number' : Reflect.get(target, property),
        });
      };
    });
    await expectSettleFailure(page, /section readiness unmet[\s\S]*non-finite/);
  });

  test('a rejected required font load fails the capture naming the family', async ({ page }) => {
    await openWithFixture(page, PHONE, null);
    // Reject one required app family's explicit load. The old helper swallowed
    // the rejection and captured anyway; the family must be named instead.
    await page.evaluate(() => {
      const original = document.fonts.load.bind(document.fonts);
      document.fonts.load = (font: string, text?: string): Promise<FontFace[]> =>
        font.includes('Nunito_700Bold')
          ? Promise.reject(new Error('probe: required face rejected'))
          : original(font, text);
    });
    await expectSettleFailure(page, /required font load failed[\s\S]*Nunito_700Bold/);
  });

  test('a settled capture still compares strictly: a deliberate pixel perturbation fails', async ({
    page,
  }) => {
    // This control compares against a COMMITTED golden; under
    // `--update-snapshots` it must never run (it would rewrite the golden it
    // is supposed to protect).
    const updateMode = test.info().config.updateSnapshots;
    test.skip(
      updateMode === 'all' || updateMode === 'changed',
      'strict-comparison control only runs in comparison mode, never in --update-snapshots mode',
    );
    // Mirror the `shell-today-390-light` state exactly.
    await openWithFixture(page, PHONE, 'TYPICAL');
    await expect(page.getByText('Good evening')).toBeVisible();
    await expect(page.getByText('UP NEXT')).toBeVisible();
    await prepareCapture(page);
    const strict = {
      animations: 'disabled' as const,
      caret: 'hide' as const,
      maxDiffPixels: 0,
    };
    // The settled, unperturbed capture matches the committed golden at zero
    // pixel tolerance ...
    await expect(page).toHaveScreenshot('shell-today-390-light.png', strict);
    // ... and a deliberate pixel perturbation still fails that comparison.
    await page.evaluate(() => {
      const marker = document.createElement('div');
      marker.setAttribute('data-visual-perturbation', 'strict-comparison-control');
      marker.style.cssText =
        'position:fixed;top:0;right:0;width:16px;height:16px;background:#ff0000;z-index:2147483647;';
      document.body.appendChild(marker);
    });
    let comparisonFailure: string | null = null;
    try {
      await expect(page).toHaveScreenshot('shell-today-390-light.png', strict);
    } catch (error) {
      comparisonFailure = error instanceof Error ? error.message : String(error);
    }
    if (comparisonFailure === null) {
      throw new Error('the strict golden comparison accepted a perturbed capture');
    }
    // The rejection must be the pixel comparison itself — a readiness failure
    // or an unrelated throw must NOT count as proof of strictness.
    expect(comparisonFailure).toMatch(/screenshot|snapshot/i);
    expect(comparisonFailure).not.toMatch(/visual settle:/);
  });
});
