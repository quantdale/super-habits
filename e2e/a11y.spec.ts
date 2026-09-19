import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { goToTab } from './helpers/navigation';
import { openCommandScreen, parseCommand } from './helpers/commandObservation';

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

const auditPage = () => {
  const parse = (c: string) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map((x) => parseFloat(x.trim()));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const luminance = ({ r, g, b }: { r: number; g: number; b: number }) => {
    const f = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (
    a: { r: number; g: number; b: number },
    b: { r: number; g: number; b: number },
  ) => {
    const l1 = luminance(a);
    const l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const over = (
    fg: { r: number; g: number; b: number; a: number },
    bg: { r: number; g: number; b: number; a: number },
  ) => {
    const a = fg.a + bg.a * (1 - fg.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
      g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
      b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
      a,
    };
  };
  const backgroundOf = (el: Element) => {
    let cur: Element | null = el;
    let acc: { r: number; g: number; b: number; a: number } | null = null;
    while (cur && cur !== document.documentElement) {
      const cs2 = getComputedStyle(cur);
      // Gradient-backed surfaces paint with `background-image`; use the first
      // stop so gradient hero/button faces are measured, not skipped.
      const img = cs2.backgroundImage;
      if (img && img !== 'none') {
        const gm = img.match(/rgba?\([^)]+\)/);
        const gc = gm ? parse(gm[0]) : null;
        if (gc) {
          const opaque = { r: gc.r, g: gc.g, b: gc.b, a: 1 };
          acc = acc ? over(acc, opaque) : opaque;
          return acc;
        }
      }
      const c = parse(cs2.backgroundColor);
      if (c && c.a > 0) {
        acc = acc ? over(acc, c) : c;
        if (c.a === 1) return acc;
      }
      cur = cur.parentElement;
    }
    const root = parse(getComputedStyle(document.body).backgroundColor) ?? {
      r: 255,
      g: 255,
      b: 255,
      a: 1,
    };
    return acc ? over(acc, root) : root;
  };

  const contrast: string[] = [];
  const nameless: string[] = [];
  const duplicateIds: string[] = [];
  const hiddenFocusable: string[] = [];
  const seen = new Set<string>();

  for (const el of Array.from(document.querySelectorAll('*'))) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const isIconGlyph = /material/i.test(cs.fontFamily);
    const inTabControl = !!el.closest('[role="tab"], [role="tablist"]');
    // Gradient-faced buttons paint the face with an absolutely-positioned
    // sibling layer, so ancestor resolution would measure the 3D lip instead.
    // The theme validator owns buttonText-vs-button/hover/active pairs.
    const inGradientButton = !!el
      .closest('[role="button"]')
      ?.querySelector('[style*="linear-gradient"]');

    if (el.children.length === 0 && !isIconGlyph && !inTabControl && !inGradientButton) {
      const text = (el.textContent ?? '').trim();
      if (text) {
        const isSvgText = (el as SVGElement).ownerSVGElement != null;
        const fg = parse(isSvgText ? cs.fill : cs.color);
        if (fg && !(isSvgText && cs.fill === 'none')) {
          const bg = backgroundOf(el);
          const composed = fg.a < 1 ? over(fg, bg) : fg;
          const cr = ratio(composed, bg);
          const fontSize = parseFloat(cs.fontSize);
          const weight = parseInt(cs.fontWeight, 10) || 400;
          const large = fontSize >= 24 || (fontSize >= 18.66 && weight >= 700);
          const min = large ? 3 : 4.5;
          if (cr < min - 0.01) {
            const key = `${text.slice(0, 24)}:${cs.color}`;
            if (!seen.has(key)) {
              seen.add(key);
              const bgText = `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`;
              contrast.push(
                `${text.slice(0, 28)} ${cr.toFixed(2)}:1 (needs ${min}) at ${Math.round(fontSize)}px ${cs.color} on ${bgText}`,
              );
            }
          }
        }
      }
    }

    const role = el.getAttribute('role');
    const tag = el.tagName;
    const interactive =
      role === 'button' ||
      role === 'link' ||
      role === 'tab' ||
      role === 'checkbox' ||
      role === 'switch' ||
      tag === 'BUTTON' ||
      tag === 'A' ||
      tag === 'INPUT' ||
      tag === 'SELECT' ||
      tag === 'TEXTAREA';
    if (interactive) {
      const name = (
        el.getAttribute('aria-label') ??
        el.getAttribute('aria-labelledby') ??
        el.getAttribute('title') ??
        el.getAttribute('placeholder') ??
        el.textContent ??
        ''
      ).trim();
      if (!name) {
        const key = `${tag}:${role}`;
        if (!seen.has(key)) {
          seen.add(key);
          nameless.push(`${tag}[${role ?? ''}]`);
        }
      }
    }

    if (el.getAttribute('aria-hidden') === 'true') {
      const focusable = el.querySelector<HTMLElement>(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable && !el.closest('[inert]')) {
        focusable.focus();
        if (document.activeElement === focusable) {
          hiddenFocusable.push(
            `${focusable.tagName}:${(focusable.getAttribute('aria-label') ?? '').slice(0, 40)}`,
          );
        }
      }
    }
  }

  const counts: Record<string, number> = {};
  for (const el of Array.from(document.querySelectorAll('[id]'))) {
    counts[el.id] = (counts[el.id] ?? 0) + 1;
    if (counts[el.id] === 2) duplicateIds.push(el.id);
  }

  return { contrast, nameless, duplicateIds, hiddenFocusable };
};

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

  // Ask and Auto mount their own cards (question input, Ask/Send buttons)
  // that the Create-mode audit never renders. Guard their empty states so a
  // future component edit there cannot regress legibility or naming silently.
  // Selector note: the click happens while still in Create mode, where 'Ask'
  // names only the mode toggle; in Ask mode 'Auto' names only its toggle
  // (the Ask card's buttons are 'Ask'/'Try again', the Auto card's is 'Send').
  test('the Command Center Ask and Auto modes have no AA contrast, name, id, or hidden-focus defects', async ({
    page,
  }) => {
    await openCommandScreen(page);
    await expect(page.getByText('Command center', { exact: true })).toBeVisible();
    await page.waitForTimeout(1200);

    await page.getByRole('button', { name: 'Ask', exact: true }).click({ force: true });
    await expect(page.getByText('Ask a question', { exact: true })).toBeVisible();
    await page.waitForTimeout(1200);
    const ask = await page.evaluate(auditPage);
    expect(ask.contrast, 'command ask: WCAG AA contrast').toEqual([]);
    expect(ask.nameless, 'command ask: controls without accessible names').toEqual([]);
    expect(ask.duplicateIds, 'command ask: duplicate element ids').toEqual([]);
    expect(ask.hiddenFocusable, 'command ask: focusable content inside aria-hidden').toEqual([]);

    await page.getByRole('button', { name: 'Auto', exact: true }).click({ force: true });
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
    await page.waitForTimeout(1200);
    const auto = await page.evaluate(auditPage);
    expect(auto.contrast, 'command auto: WCAG AA contrast').toEqual([]);
    expect(auto.nameless, 'command auto: controls without accessible names').toEqual([]);
    expect(auto.duplicateIds, 'command auto: duplicate element ids').toEqual([]);
    expect(auto.hiddenFocusable, 'command auto: focusable content inside aria-hidden').toEqual([]);
  });
});
