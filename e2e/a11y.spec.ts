import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { goToTab } from './helpers/navigation';
import { openCommandScreen, parseCommand } from './helpers/commandObservation';
import { auditPage } from './helpers/a11yAudit';

/**
 * DOM-level accessibility conformance check: real rendered colour contrast
 * (WCAG relative luminance against the composited ancestor background),
 * accessible names on controls, duplicate DOM ids, and focusable descendants
 * inside `aria-hidden` subtrees.
 *
 * Why this exists: `npm run validate:themes` checks token *pairs* (140 of
 * them), which cannot see that a component picked the bright `fill` hue where
 * the Pop design system provides a contrast-safe `text` variant. The audit
 * found real AA failures on the Overview stat strip, the Momentum link, the
 * habits meta line, and the tab rail before those call sites were moved onto
 * the `text` variant.
 *
 * Two deliberate exclusions:
 * - Material icon glyphs (font family `material`) are graphics, not text.
 * - `SegmentedControl` labels sit over an absolutely-positioned accent pill
 *   that is a sibling, so ancestor-background resolution cannot see their real
 *   background.
 */

const SECTIONS = ['overview', 'todos', 'habits', 'pomodoro', 'workout', 'calories'] as const;

async function auditSections(page: Page, label: string): Promise<void> {
  for (const section of SECTIONS) {
    if (section !== 'overview') {
      await goToTab(page, section);
      await page.waitForTimeout(1500);
    }
    const result = await page.evaluate(auditPage);
    expect(result.contrast, `${label} ${section}: WCAG AA contrast`).toEqual([]);
    expect(result.nameless, `${label} ${section}: controls without accessible names`).toEqual([]);
    expect(result.duplicateIds, `${label} ${section}: duplicate element ids`).toEqual([]);
    expect(
      result.hiddenFocusable,
      `${label} ${section}: focusable content inside aria-hidden`,
    ).toEqual([]);
  }
}

test.describe('Accessibility conformance', () => {
  test('the six sections have no AA contrast, name, id, or hidden-focus defects', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('tablist', { name: 'Section tabs' }).getByRole('button', { name: 'Today' }),
    ).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(3000);
    await auditSections(page, 'light');
  });

  // Dark appearances swap in brighter section/reward text variants
  // (SECTION_TEXT_COLORS_DARK, getRewardAccents); guard them too so a future
  // palette edit cannot regress dark legibility silently.
  test('the six sections are AA-clean in the dark theme', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.evaluate(() => localStorage.setItem('superhabits.theme.mode', 'dark'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('tablist', { name: 'Section tabs' }).getByRole('button', { name: 'Today' }),
    ).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme')))
      .toBe('dark');
    await page.waitForTimeout(3000);
    await auditSections(page, 'dark');
  });

  // Cyberpunk Neon replaces the whole section accent set with neon hues
  // (sectionOverrides); guard that override path too.
  test('the six sections are AA-clean in an override theme (cyberpunk-neon)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      localStorage.setItem('superhabits.theme.mode', 'dark');
      localStorage.setItem(
        'superhabits.theme.slots.v2',
        JSON.stringify({ lightThemeId: 'light', darkThemeId: 'cyberpunk-neon' }),
      );
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('tablist', { name: 'Section tabs' }).getByRole('button', { name: 'Today' }),
    ).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme-id')))
      .toBe('cyberpunk-neon');
    await page.waitForTimeout(3000);
    await auditSections(page, 'cyberpunk');
  });

  test('the Settings overlay has no name, id, or hidden-focus defects', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Open settings' })).toBeVisible({
      timeout: 30_000,
    });
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: 'Open settings' }).click();
    await page.waitForTimeout(1200);
    const result = await page.evaluate(auditPage);
    expect(result.nameless, 'settings: controls without accessible names').toEqual([]);
    expect(result.duplicateIds, 'settings: duplicate element ids').toEqual([]);
    expect(result.hiddenFocusable, 'settings: focusable content inside aria-hidden').toEqual([]);
  });

  test('the Settings overlay has no AA contrast defects', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: 'Open settings' }).click();
    await page.waitForTimeout(1200);
    const result = await page.evaluate(auditPage);
    expect(result.contrast, 'settings: WCAG AA contrast').toEqual([]);
  });

  // Dark appearances swap in brighter text variants and the gap-19
  // `readableAccent` derivation resolves accent text against theme tints;
  // the light Settings guard above cannot see that path. Audit the open
  // Settings overlay in the dark theme so a future palette/component edit
  // there cannot regress legibility or control naming silently.
  test('the Settings overlay is AA-clean in the dark theme', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.evaluate(() => localStorage.setItem('superhabits.theme.mode', 'dark'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('tablist', { name: 'Section tabs' }).getByRole('button', { name: 'Today' }),
    ).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme')))
      .toBe('dark');
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: 'Open settings' }).click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme')))
      .toBe('dark');
    await page.waitForTimeout(1200);
    const result = await page.evaluate(auditPage);
    expect(result.contrast, 'settings dark: WCAG AA contrast').toEqual([]);
    expect(result.nameless, 'settings dark: controls without accessible names').toEqual([]);
    expect(result.duplicateIds, 'settings dark: duplicate element ids').toEqual([]);
    expect(result.hiddenFocusable, 'settings dark: focusable content inside aria-hidden').toEqual(
      [],
    );
  });

  // Cyberpunk Neon replaces the whole section accent set with neon hues
  // (sectionOverrides); the light/dark Settings guards above cannot see
  // that override path. Audit the open Settings overlay under
  // cyberpunk-neon so a future palette/component edit there cannot regress
  // legibility or control naming silently.
  test('the Settings overlay is AA-clean in the cyberpunk-neon theme', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      localStorage.setItem('superhabits.theme.mode', 'dark');
      localStorage.setItem(
        'superhabits.theme.slots.v2',
        JSON.stringify({ lightThemeId: 'light', darkThemeId: 'cyberpunk-neon' }),
      );
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('tablist', { name: 'Section tabs' }).getByRole('button', { name: 'Today' }),
    ).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme-id')))
      .toBe('cyberpunk-neon');
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: 'Open settings' }).click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme-id')))
      .toBe('cyberpunk-neon');
    await page.waitForTimeout(1200);
    const result = await page.evaluate(auditPage);
    expect(result.contrast, 'settings cyberpunk: WCAG AA contrast').toEqual([]);
    expect(result.nameless, 'settings cyberpunk: controls without accessible names').toEqual([]);
    expect(result.duplicateIds, 'settings cyberpunk: duplicate element ids').toEqual([]);
    expect(
      result.hiddenFocusable,
      'settings cyberpunk: focusable content inside aria-hidden',
    ).toEqual([]);
  });

  // The Command Center is a global overlay with its own input card, mode
  // toggle, parse-result card, and draft preview — none of which the section
  // or Settings audits reach. Guard both the empty Create state and a parsed
  // todo state so a future palette/component edit here cannot regress
  // legibility or control naming silently.
  test('the Command Center overlay has no AA contrast, name, id, or hidden-focus defects', async ({
    page,
  }) => {
    await openCommandScreen(page);
    await expect(page.getByText('Command center', { exact: true })).toBeVisible();
    await page.waitForTimeout(1200);
    const empty = await page.evaluate(auditPage);
    expect(empty.contrast, 'command empty: WCAG AA contrast').toEqual([]);
    expect(empty.nameless, 'command empty: controls without accessible names').toEqual([]);
    expect(empty.duplicateIds, 'command empty: duplicate element ids').toEqual([]);
    expect(empty.hiddenFocusable, 'command empty: focusable content inside aria-hidden').toEqual(
      [],
    );

    await parseCommand(page, 'Add a todo to call mom tomorrow');
    await page.waitForTimeout(1200);
    const parsed = await page.evaluate(auditPage);
    expect(parsed.contrast, 'command parsed: WCAG AA contrast').toEqual([]);
    expect(parsed.nameless, 'command parsed: controls without accessible names').toEqual([]);
    expect(parsed.duplicateIds, 'command parsed: duplicate element ids').toEqual([]);
    expect(parsed.hiddenFocusable, 'command parsed: focusable content inside aria-hidden').toEqual(
      [],
    );
  });

  // Dark appearances swap in brighter text variants
  // (SECTION_TEXT_COLORS_DARK, getRewardAccents); the overlay's input card,
  // mode toggle, parse-result card, and draft preview need the same guard as
  // the light baseline above.
  test('the Command Center overlay is AA-clean in the dark theme', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.evaluate(() => localStorage.setItem('superhabits.theme.mode', 'dark'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('tablist', { name: 'Section tabs' }).getByRole('button', { name: 'Today' }),
    ).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme')))
      .toBe('dark');
    await openCommandScreen(page);
    await expect(page.getByText('Command center', { exact: true })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme')))
      .toBe('dark');
    await page.waitForTimeout(1200);
    const empty = await page.evaluate(auditPage);
    expect(empty.contrast, 'command dark empty: WCAG AA contrast').toEqual([]);
    expect(empty.nameless, 'command dark empty: controls without accessible names').toEqual([]);
    expect(empty.duplicateIds, 'command dark empty: duplicate element ids').toEqual([]);
    expect(
      empty.hiddenFocusable,
      'command dark empty: focusable content inside aria-hidden',
    ).toEqual([]);

    await parseCommand(page, 'Add a todo to call mom tomorrow');
    await page.waitForTimeout(1200);
    const parsed = await page.evaluate(auditPage);
    expect(parsed.contrast, 'command dark parsed: WCAG AA contrast').toEqual([]);
    expect(parsed.nameless, 'command dark parsed: controls without accessible names').toEqual([]);
    expect(parsed.duplicateIds, 'command dark parsed: duplicate element ids').toEqual([]);
    expect(
      parsed.hiddenFocusable,
      'command dark parsed: focusable content inside aria-hidden',
    ).toEqual([]);
  });

  // Cyberpunk Neon replaces the whole section accent set with neon hues
  // (sectionOverrides); the light/dark Command Center guards above cannot
  // see that override path. Audit the overlay's empty Create state and a
  // parsed todo state under cyberpunk-neon — mirroring the dark Command
  // Center test — so a future palette/component edit in the neon overlay
  // surface (input card, mode toggle, parse-result card, draft preview,
  // accent-derived context copy) cannot regress legibility or control
  // naming silently.
  test('the Command Center overlay is AA-clean in the cyberpunk-neon theme', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      localStorage.setItem('superhabits.theme.mode', 'dark');
      localStorage.setItem(
        'superhabits.theme.slots.v2',
        JSON.stringify({ lightThemeId: 'light', darkThemeId: 'cyberpunk-neon' }),
      );
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('tablist', { name: 'Section tabs' }).getByRole('button', { name: 'Today' }),
    ).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme-id')))
      .toBe('cyberpunk-neon');
    await openCommandScreen(page);
    await expect(page.getByText('Command center', { exact: true })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme-id')))
      .toBe('cyberpunk-neon');
    await page.waitForTimeout(1200);
    const empty = await page.evaluate(auditPage);
    expect(empty.contrast, 'command cyberpunk empty: WCAG AA contrast').toEqual([]);
    expect(empty.nameless, 'command cyberpunk empty: controls without accessible names').toEqual(
      [],
    );
    expect(empty.duplicateIds, 'command cyberpunk empty: duplicate element ids').toEqual([]);
    expect(
      empty.hiddenFocusable,
      'command cyberpunk empty: focusable content inside aria-hidden',
    ).toEqual([]);

    await parseCommand(page, 'Add a todo to call mom tomorrow');
    await page.waitForTimeout(1200);
    const parsed = await page.evaluate(auditPage);
    expect(parsed.contrast, 'command cyberpunk parsed: WCAG AA contrast').toEqual([]);
    expect(parsed.nameless, 'command cyberpunk parsed: controls without accessible names').toEqual(
      [],
    );
    expect(parsed.duplicateIds, 'command cyberpunk parsed: duplicate element ids').toEqual([]);
    expect(
      parsed.hiddenFocusable,
      'command cyberpunk parsed: focusable content inside aria-hidden',
    ).toEqual([]);
  });
});
