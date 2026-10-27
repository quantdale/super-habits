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
      page.getByRole('tablist', { name: 'Section tabs' }).getByRole('tab', { name: 'Today' }),
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
      page.getByRole('tablist', { name: 'Section tabs' }).getByRole('tab', { name: 'Today' }),
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
      page.getByRole('tablist', { name: 'Section tabs' }).getByRole('tab', { name: 'Today' }),
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
      page.getByRole('tablist', { name: 'Section tabs' }).getByRole('tab', { name: 'Today' }),
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
      page.getByRole('tablist', { name: 'Section tabs' }).getByRole('tab', { name: 'Today' }),
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
      page.getByRole('tablist', { name: 'Section tabs' }).getByRole('tab', { name: 'Today' }),
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
      page.getByRole('tablist', { name: 'Section tabs' }).getByRole('tab', { name: 'Today' }),
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

  // Audit C §11: the primary navigation is the most-used control in the app and
  // it emitted a `tablist` whose children were `button`s. A `tablist` with
  // button children is invalid ARIA — assistive tech neither announces
  // position/count nor honours `aria-selected` — so this pins the correct
  // `tab`/`tablist` idiom (matching core/ui/SegmentedControl.tsx) and the
  // `aria-controls` link to each section panel.
  test('the section tabs are ARIA tabs wired to their section panels', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const rail = page.getByRole('tablist', { name: 'Section tabs' });
    await expect(rail).toBeVisible({ timeout: 30_000 });
    await rail.getByRole('tab', { name: 'Today' }).waitFor({ timeout: 30_000 });

    // Every destination is a `tab`, and none of them is a `button` any more.
    const tabs = rail.getByRole('tab');
    expect(await tabs.count()).toBeGreaterThanOrEqual(6);
    expect(await rail.getByRole('button', { name: 'Today', exact: true }).count()).toBe(0);

    // Exactly one tab is selected, and aria-selected tracks navigation.
    await expect(rail.getByRole('tab', { selected: true })).toHaveCount(1);
    await expect(rail.getByRole('tab', { name: 'Today' })).toHaveAttribute('aria-selected', 'true');

    // Every tab controls a real section panel that labels itself by that tab.
    const wiring = await page.evaluate(() => {
      const tablist = document.querySelector('[aria-label="Section tabs"]');
      if (!tablist) return null;
      return Array.from(tablist.querySelectorAll('[role="tab"]')).map((tab) => {
        const controlsId = tab.getAttribute('aria-controls');
        const panel = controlsId ? document.getElementById(controlsId) : null;
        return {
          label: tab.getAttribute('aria-label'),
          selected: tab.getAttribute('aria-selected'),
          controlsId,
          panelExists: panel != null,
          panelRole: panel?.getAttribute('role') ?? null,
          panelLabelledBy: panel?.getAttribute('aria-labelledby') ?? null,
          tabId: tab.getAttribute('id'),
        };
      });
    });
    expect(wiring, 'the tablist is present').not.toBeNull();
    expect(wiring!.length).toBeGreaterThanOrEqual(6);
    for (const tab of wiring!) {
      expect(tab.controlsId, `${tab.label} has aria-controls`).toBeTruthy();
      expect(tab.panelExists, `${tab.label} controls an existing panel`).toBe(true);
      expect(tab.panelRole, `${tab.label} panel is a tabpanel`).toBe('tabpanel');
      expect(tab.panelLabelledBy, `${tab.label} panel is labelled by its tab`).toBe(tab.tabId);
    }
    expect(wiring!.filter((tab) => tab.selected === 'true')).toHaveLength(1);

    // Navigation moves the selection rather than adding a second selected tab.
    await rail.getByRole('tab', { name: 'To Do', exact: true }).click();
    await expect(rail.getByRole('tab', { name: 'To Do', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(rail.getByRole('tab', { name: 'Today' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    await expect(rail.getByRole('tab', { selected: true })).toHaveCount(1);
  });

  // Audit C §11: nothing emitted `role="dialog"` with a name, so the web focus
  // trap that queries `[role="dialog"]` had nothing to describe. Modal sheets
  // must now render a named, modal dialog so the trap and screen readers agree
  // on the same container.
  test('modal sheets are named, modal dialogs', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Open settings' }).click();

    const dialog = page.getByRole('dialog', { name: 'Settings' });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog).toHaveAttribute('aria-modal', 'true');

    // The named dialog is the container that actually holds the sheet body, so
    // a focus trap scoped to it can reach the content.
    await expect(dialog.getByRole('button', { name: 'Close' }).first()).toBeVisible();

    // Dismissing removes the dialog from the role query entirely.
    await dialog.getByRole('button', { name: 'Close' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Settings' })).toHaveCount(0);

    // A second, differently-titled sheet proves the name is the sheet's own
    // title and not a constant applied to every modal.
    await page.getByRole('button', { name: 'Quick capture' }).click();
    await expect(page.getByRole('dialog', { name: 'Add' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('dialog', { name: 'Add' })).toHaveAttribute('aria-modal', 'true');
  });
});
