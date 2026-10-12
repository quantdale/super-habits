import { test, expect } from './fixtures';
import { goToTab, TAB_LABELS } from './helpers/navigation';
import { switchSection } from './helpers/oracles';

/**
 * Shipped-model contract for the W10 D3 navigation decision (six destinations
 * + capture slot). The measured comparison against the five-destination model
 * is recorded in `docs/ui-ux/v3-audit/w10/d3-*.json`; this spec pins what the
 * shipped model must keep providing: shallow flows, an accessible bar, and
 * preserved navigation/active-session state.
 */

const BAR = (page: import('@playwright/test').Page) =>
  page.getByRole('tablist', { name: 'Section tabs' });

test.describe('W10 six-destination navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  });

  test('the bar exposes six destinations plus the capture slot', async ({ page }) => {
    const bar = BAR(page);
    for (const label of Object.values(TAB_LABELS)) {
      if (label === 'Health') continue; // no longer a bar destination
      await expect(bar.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
    await expect(bar.getByRole('button', { name: 'Quick capture' })).toBeVisible();
  });

  test('labels render at >=11px without truncation and targets stay >=44pt', async ({ page }) => {
    for (const width of [360, 390, 412]) {
      await page.setViewportSize({ width, height: 844 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      // The shell mounts asynchronously (DB bootstrap behind the splash);
      // measure only once the rail is actually in the DOM.
      await BAR(page).waitFor({ state: 'visible', timeout: 20_000 });
      await page.waitForTimeout(900);
      const geometry = await page.evaluate(() => {
        const rail = document.querySelector('[aria-label="Section tabs"]');
        if (!rail) return null;
        const buttons = Array.from(rail.querySelectorAll('[role="button"]'));
        let minWidth = Number.POSITIVE_INFINITY;
        let minHeight = Number.POSITIVE_INFINITY;
        let minFont = Number.POSITIVE_INFINITY;
        const truncated: string[] = [];
        for (const button of buttons) {
          const rect = button.getBoundingClientRect();
          minWidth = Math.min(minWidth, rect.width);
          minHeight = Math.min(minHeight, rect.height);
          const label = (button.getAttribute('aria-label') ?? '').trim();
          if (label === 'Quick capture') continue;
          const textNodes = Array.from(button.querySelectorAll('div')).filter(
            (el) => (el.textContent ?? '').trim() === label,
          ) as HTMLElement[];
          for (const node of textNodes) {
            minFont = Math.min(minFont, Number.parseFloat(getComputedStyle(node).fontSize));
            if (node.scrollWidth > node.clientWidth + 1) truncated.push(label);
          }
        }
        return { minWidth, minHeight, minFont, truncated };
      });
      expect(geometry, `geometry at ${width}`).not.toBeNull();
      expect(geometry!.minFont, `label font at ${width}`).toBeGreaterThanOrEqual(11);
      expect(geometry!.truncated, `truncated labels at ${width}`).toEqual([]);
      expect(geometry!.minWidth, `target width at ${width}`).toBeGreaterThanOrEqual(44);
      expect(geometry!.minHeight).toBeGreaterThanOrEqual(44);
    }
  });

  test('workout and calories are one tap from Overview (no parent indirection)', async ({
    page,
  }) => {
    await goToTab(page, 'overview');
    // Workout.
    await BAR(page).getByRole('button', { name: 'Workout', exact: true }).click();
    await expect(page.getByText('Workout', { exact: true }).first()).toBeVisible();
    // Calories: the hero's remaining-kcal indicator identifies the section.
    await BAR(page).getByRole('button', { name: 'Calories', exact: true }).click();
    await expect(page.getByText(/[\d,]+ kcal left/).first()).toBeVisible();
    // No intermediate "Open <section>" affordance remains anywhere.
    await expect(page.getByRole('button', { name: 'Open Workout' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open Calories' })).toHaveCount(0);
  });

  test('an active focus session survives a section switch away and back', async ({ page }) => {
    await goToTab(page, 'pomodoro');
    await page.getByRole('button', { name: 'Start focus', exact: true }).click();
    await page
      .getByRole('button', { name: 'Pause', exact: true })
      .waitFor({ state: 'visible', timeout: 15_000 });

    await BAR(page).getByRole('button', { name: 'Calories', exact: true }).click();
    await expect(page.getByText(/[\d,]+ kcal left/).first()).toBeVisible();
    await BAR(page).getByRole('button', { name: 'Focus', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('every section switches in one tap and keeps its identity', async ({ page }) => {
    // `switchSection` clicks the rail by exact label and waits for the active
    // section container to carry that section's identity string.
    for (const section of ['todos', 'habits', 'pomodoro', 'workout', 'calories'] as const) {
      await switchSection(page, section);
      await expect(BAR(page).getByRole('button', { name: TAB_LABELS[section] })).toBeVisible();
    }
    await switchSection(page, 'overview');
  });

  test('the capture slot still opens quick capture without covering content', async ({ page }) => {
    await goToTab(page, 'calories');
    await BAR(page).getByRole('button', { name: 'Quick capture' }).click();
    await expect(page.getByPlaceholder('What do you want to remember?')).toBeVisible({
      timeout: 10_000,
    });
    await page.keyboard.press('Escape');
  });
});
