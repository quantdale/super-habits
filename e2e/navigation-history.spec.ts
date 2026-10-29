import { test, expect } from './fixtures';
import { sectionRail, sectionTab, TAB_LABELS } from './helpers/navigation';

/**
 * Runtime robustness: browser back/forward between sections must walk the
 * section history instead of abandoning the app. Section switches stamp
 * `history.state.superhabitsSection`, so Back returns to the previous section,
 * Forward re-enters the newer one, and a reload stays on the current section.
 */

const BAR = (page: import('@playwright/test').Page) => sectionRail(page);

async function expectActive(page: import('@playwright/test').Page, label: string) {
  await expect(sectionTab(page, label)).toHaveAttribute('aria-selected', 'true');
}

/**
 * The Health section panel oracle: Health is a valid AppSection (deep links,
 * linked actions, command routing) without a rail destination, so its active
 * state is read from the panel's `aria-hidden` rather than a rail tab.
 * React Native Web renders `aria-hidden="true"` for inactive panels and drops
 * the attribute entirely when the panel is active (probe-verified), so active
 * asserts the attribute is NOT "true".
 */
const HEALTH_PANEL = (page: import('@playwright/test').Page) =>
  page.locator('#sh-section-panel-health');
const OVERVIEW_PANEL = (page: import('@playwright/test').Page) =>
  page.locator('#sh-section-panel-overview');

async function expectHealthActive(page: import('@playwright/test').Page) {
  await expect(HEALTH_PANEL(page)).not.toHaveAttribute('aria-hidden', 'true');
  await expect(OVERVIEW_PANEL(page)).toHaveAttribute('aria-hidden', 'true');
}

test.describe('Deep-linked section hashes', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test('direct load of /#health adopts the Health section and keeps the hash', async ({ page }) => {
    await page.goto('/#health', { waitUntil: 'domcontentloaded' });
    await BAR(page).waitFor({ state: 'visible', timeout: 20_000 });
    await expectHealthActive(page);
    // expo-router history re-syncs run after the shell settles; the stamped
    // hash must survive them and the section must not fall back to overview.
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => window.location.hash)).toBe('#health');
    await expectHealthActive(page);
  });

  test('back returns to a deep-linked non-rail section', async ({ page }) => {
    await page.goto('/#health', { waitUntil: 'domcontentloaded' });
    await BAR(page).waitFor({ state: 'visible', timeout: 20_000 });
    await expectHealthActive(page);

    await sectionTab(page, TAB_LABELS.habits).click();
    await expectActive(page, TAB_LABELS.habits);

    await page.goBack();
    await expect(BAR(page)).toBeVisible();
    await expectHealthActive(page);
    expect(await page.evaluate(() => window.location.hash)).toBe('#health');
  });
});

test.describe('Browser back/forward between sections', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await BAR(page).waitFor({ state: 'visible', timeout: 20_000 });
    await expectActive(page, TAB_LABELS.overview);
  });

  test('back returns to the previous section instead of leaving the app', async ({ page }) => {
    await sectionTab(page, TAB_LABELS.todos).click();
    await expectActive(page, TAB_LABELS.todos);
    await sectionTab(page, TAB_LABELS.habits).click();
    await expectActive(page, TAB_LABELS.habits);

    await page.goBack();
    // The app must still be on screen, one section back.
    await expect(BAR(page)).toBeVisible();
    await expectActive(page, TAB_LABELS.todos);

    await page.goBack();
    await expectActive(page, TAB_LABELS.overview);
  });

  // Forward navigation history: popstate fires ONCE with a TRANSIENT empty
  // hash and expo-router settles the location to `#section` without firing a
  // second event. NavigationProvider's bounded recheck schedule
  // (POPSTATE_RECHECK_MS) re-reads the URL after the settle and adopts the
  // stamped section; this test pins that recovery.
  test('forward re-enters the newer section', async ({ page }) => {
    await sectionTab(page, TAB_LABELS.habits).click();
    await expectActive(page, TAB_LABELS.habits);

    await page.goBack();
    await expectActive(page, TAB_LABELS.overview);

    await page.goForward();
    await expect(BAR(page)).toBeVisible();
    await expectActive(page, TAB_LABELS.habits);
  });

  test('a reload stays on the current section', async ({ page }) => {
    await sectionTab(page, TAB_LABELS.calories).click();
    await expectActive(page, TAB_LABELS.calories);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await BAR(page).waitFor({ state: 'visible', timeout: 20_000 });
    await expectActive(page, TAB_LABELS.calories);
  });
});
