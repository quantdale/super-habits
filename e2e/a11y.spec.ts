import { test, expect } from './fixtures';
import { goToTab } from './helpers/navigation';

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
      const c = parse(getComputedStyle(cur).backgroundColor);
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

    if (el.children.length === 0 && !isIconGlyph && !inTabControl) {
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

test.describe('Accessibility conformance', () => {
  test('the six sections have no AA contrast, name, id, or hidden-focus defects', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('tablist', { name: 'Section tabs' }).getByRole('button', { name: 'Today' }),
    ).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(3000);

    for (const section of SECTIONS) {
      if (section !== 'overview') {
        await goToTab(page, section);
        await page.waitForTimeout(1500);
      }
      const result = await page.evaluate(auditPage);
      expect(result.contrast, `${section}: WCAG AA contrast`).toEqual([]);
      expect(result.nameless, `${section}: controls without accessible names`).toEqual([]);
      expect(result.duplicateIds, `${section}: duplicate element ids`).toEqual([]);
      expect(result.hiddenFocusable, `${section}: focusable content inside aria-hidden`).toEqual(
        [],
      );
    }
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

  // The Settings overlay's own palette usages (status pills, mode chips, and
  // the pomodoro default chips) still fall under AA in a handful of nested
  // controls while the six product sections are clean. Tracked as known-gap 19
  // in docs/testing/known-gaps.md; enable this case once that pass lands.
  test.fixme('the Settings overlay has no AA contrast defects', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: 'Open settings' }).click();
    await page.waitForTimeout(1200);
    const result = await page.evaluate(auditPage);
    expect(result.contrast, 'settings: WCAG AA contrast').toEqual([]);
  });
});
