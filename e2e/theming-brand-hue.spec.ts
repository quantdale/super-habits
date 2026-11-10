import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { auditPage } from './helpers/a11yAudit';
import { clearDatabase } from './helpers/db';

/**
 * P21-C — Playful Momentum §5.4 "brand-hue swap" proof.
 *
 * Every non-default theme now replaces Sprout as `primary`/`button` with its
 * OWN solid / bright / lip triple. Two things need evidence on a REAL screen,
 * because the token matrix in `tests/theme.registry.test.ts` cannot see which
 * pair a component actually paints:
 *
 * 1. the swap is live — the theme's authored brand hue reaches the DOM as
 *    `--sh-primary` / `--sh-button` / `--sh-button-lip` / `--sh-primary-bright`,
 *    and it is not a Sprout value;
 * 2. the rendered surfaces stay AA — the fill-vs-surface pairs a component
 *    paints (CTA face, selected chip tint, progress fill on its track,
 *    bright-fill ink, press lip, textSubtle on every neutral) are resolved from
 *    the live CSS custom properties and measured with the same WCAG
 *    relative-luminance math, and the shared DOM audit
 *    (`e2e/helpers/a11yAudit.ts`) runs on the Today screen in every theme.
 */

type ThemeExpectation = {
  id: string;
  appearance: 'light' | 'dark';
  /** §5.4 triple plus the two brand roles that drive fills. */
  primary: string;
  primaryBright: string;
  button: string;
  buttonLip: string;
  buttonText: string;
};

const THEMES: ThemeExpectation[] = [
  // light canvases
  {
    id: 'coffee-brown',
    appearance: 'light',
    primary: '#8B5E3C',
    primaryBright: '#9E785B',
    button: '#6F4E37',
    buttonLip: '#46311F',
    buttonText: '#ffffff',
  },
  {
    id: 'ocean-teal',
    appearance: 'light',
    primary: '#0F766E',
    primaryBright: '#0D9488',
    button: '#0F766E',
    buttonLip: '#134E4A',
    buttonText: '#ffffff',
  },
  {
    id: 'sunset-orange',
    appearance: 'light',
    primary: '#C2410C',
    primaryBright: '#EA580C',
    button: '#C2410C',
    buttonLip: '#7C2D12',
    buttonText: '#ffffff',
  },
  {
    id: 'rose-pink',
    appearance: 'light',
    primary: '#BE185D',
    primaryBright: '#DF3D85',
    button: '#BE185D',
    buttonLip: '#831843',
    buttonText: '#ffffff',
  },
  {
    id: 'solarized',
    appearance: 'light',
    primary: '#1a6e9e',
    primaryBright: '#2588CE',
    button: '#1a6e9e',
    buttonLip: '#104963',
    buttonText: '#ffffff',
  },
  // dark canvases
  {
    id: 'midnight-blue',
    appearance: 'dark',
    primary: '#4A90F7',
    primaryBright: '#60A5FA',
    button: '#2563EB',
    buttonLip: '#1B3A9E',
    buttonText: '#ffffff',
  },
  {
    id: 'forest-green',
    appearance: 'dark',
    primary: '#4ADE80',
    primaryBright: '#4ADE80',
    button: '#34D399',
    buttonLip: '#2AA97A',
    buttonText: '#052e1f',
  },
  {
    id: 'royal-purple',
    appearance: 'dark',
    primary: '#A78BFA',
    primaryBright: '#A78BFA',
    button: '#A78BFA',
    buttonLip: '#8F69F2',
    buttonText: '#10131A',
  },
  {
    id: 'crimson-red',
    appearance: 'dark',
    primary: '#F87171',
    primaryBright: '#F87171',
    button: '#DC2626',
    buttonLip: '#991B1B',
    buttonText: '#ffffff',
  },
  {
    id: 'cyberpunk-neon',
    appearance: 'dark',
    primary: '#FF2ED1',
    primaryBright: '#FF2ED1',
    button: '#FF2ED1',
    buttonLip: '#D927B2',
    buttonText: '#14020f',
  },
  {
    id: 'nord-arctic',
    appearance: 'dark',
    primary: '#88C0D0',
    primaryBright: '#88C0D0',
    button: '#88C0D0',
    buttonLip: '#6994A0',
    buttonText: '#20262e',
  },
  {
    id: 'emerald-dark',
    appearance: 'dark',
    primary: '#10B981',
    primaryBright: '#34D399',
    button: '#10B981',
    buttonLip: '#0E9D6E',
    buttonText: '#04241a',
  },
];

const SPROUT_VALUES = new Set(['#1a7f2b', '#4dc93a', '#135b1f', '#17742a', '#3db52c', '#5ad447']);

/**
 * Findings this audit is allowed to report verbatim, keyed by theme id.
 *
 * The list is currently EMPTY: every swapped theme is AA-clean on the rendered
 * Today screen as of the merged `main` (P20 replaced the reward-card bodies
 * that previously carried Flame's `text` tier over `surfaceElevated` — the
 * streak chip now paints on the canvas at 4.89–4.90:1). The map is kept so a
 * future, deliberately-tolerated finding has one place to live.
 *
 * Strictness is intentional: the assertion is an exact `toEqual`, so ANY
 * finding — new or reintroduced — fails the test immediately.
 */
const PREEXISTING_CONTRAST: Record<string, string[]> = {};

/** Reads the live CSS custom properties a component paints with. */
async function readBrandTokens(page: Page) {
  return page.evaluate(() => {
    const css = (name: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return {
      themeId: document.documentElement.getAttribute('data-theme-id'),
      appearance: document.documentElement.getAttribute('data-theme'),
      primary: css('--sh-primary'),
      primaryBright: css('--sh-primary-bright'),
      button: css('--sh-button'),
      buttonText: css('--sh-button-text'),
      buttonHover: css('--sh-button-hover'),
      buttonActive: css('--sh-button-active'),
      buttonLip: css('--sh-button-lip'),
      surface: css('--sh-surface'),
      surfaceElevated: css('--sh-surface-elevated'),
      surfaceSunken: css('--sh-surface-sunken'),
      background: css('--sh-background'),
      chipBackground: css('--sh-chip-background'),
      textSubtle: css('--sh-text-subtle'),
    };
  });
}

/**
 * Measures the fill pairs that a text-only DOM audit cannot see. Every value is
 * resolved from the live CSS vars above, so this fails if a theme forgets to
 * author (or a derivation regresses) a brand role.
 */
async function measureFillPairs(page: Page, tokens: Awaited<ReturnType<typeof readBrandTokens>>) {
  return page.evaluate((t) => {
    const parse = (color: string) => {
      const m = color.match(/^#([0-9a-fA-F]{6})$/);
      if (!m) return null;
      const h = m[1];
      return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    };
    const luminance = (rgb: number[]) =>
      rgb
        .map((v) => {
          const c = v / 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        })
        .reduce((acc, c, i) => acc + c * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a: string, b: string) => {
      const ca = parse(a);
      const cb = parse(b);
      if (!ca || !cb) return null;
      const [hi, lo] = [luminance(ca), luminance(cb)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const ink = '#10131A';
    /** [label, fg, bg, minimum] — the pairs components actually paint. */
    const pairs: [string, string, string, number][] = [
      ['CTA face vs card surface', t.button, t.surface, 3],
      ['CTA face vs canvas', t.button, t.background, 3],
      ['CTA label on face', t.buttonText, t.button, 4.5],
      ['CTA label on hover', t.buttonText, t.buttonHover, 4.5],
      ['CTA label on pressed', t.buttonText, t.buttonActive, 4.5],
      ['CTA label on press lip', t.buttonText, t.buttonLip, 4.5],
      ['brand mark/text vs surface', t.primary, t.surface, 4.5],
      ['brand mark/text vs canvas', t.primary, t.background, 4.5],
      ['brand text on selected chip', t.primary, t.chipBackground, 4.5],
      ['bright fill vs card surface', t.primaryBright, t.surface, 3],
      ['progress fill vs track', t.primaryBright, t.surfaceSunken, 3],
      ['ink on bright fill', ink, t.primaryBright, 4.5],
      ['textSubtle on surface', t.textSubtle, t.surface, 4.5],
      ['textSubtle on elevated', t.textSubtle, t.surfaceElevated, 4.5],
      ['textSubtle on sunken', t.textSubtle, t.surfaceSunken, 4.5],
    ];
    return pairs.map(([label, fg, bg, min]) => {
      const value = ratio(fg, bg);
      return {
        label,
        fg,
        bg,
        min,
        value: value === null ? null : Number(value.toFixed(2)),
      };
    });
  }, tokens);
}

/** Fix the appearance, fill the matching slot, then reload into the theme. */
async function applyTheme(page: Page, theme: ThemeExpectation) {
  await page.evaluate(({ id, appearance }) => {
    window.localStorage.setItem('superhabits.theme.mode', appearance);
    window.localStorage.setItem(
      'superhabits.theme.slots.v2',
      JSON.stringify(
        appearance === 'dark'
          ? { lightThemeId: 'light', darkThemeId: id }
          : { lightThemeId: id, darkThemeId: 'dark' },
      ),
    );
  }, theme);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme-id')))
    .toBe(theme.id);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme.appearance);
}

test.describe('Theme brand-hue swaps (§5.4)', () => {
  test.beforeEach(async ({ page }) => {
    // Every case must start from a genuinely empty device (AGENTS.md → E2E:
    // `clearDatabase()` runs in `test.beforeEach`; the fixture installs the DB
    // harness but never resets app state). This also wipes the persisted theme
    // slot (`superhabits.theme.mode` / `superhabits.theme.slots.v2`), so each
    // test re-applies its own theme AFTER the reset.
    await page.goto('/');
    await page.waitForLoadState('load');
    await clearDatabase(page);
    await expect(
      page.getByRole('tablist', { name: 'Section tabs' }).getByRole('tab', { name: 'Today' }),
    ).toBeVisible({ timeout: 30_000 });
    // Prove the reset really cleared persisted state: a leaked theme slot would
    // let a previous test's theme bleed into this one, and `applyTheme` below
    // is only meaningful on top of a pristine device.
    expect(
      await page.evaluate(() => window.localStorage.getItem('superhabits.theme.slots.v2')),
    ).toBeNull();
    expect(
      await page.evaluate(() => window.localStorage.getItem('superhabits.theme.mode')),
    ).toBeNull();
  });

  const groups: [string, ThemeExpectation[]][] = [
    ['light', THEMES.filter((theme) => theme.appearance === 'light')],
    ['dark', THEMES.filter((theme) => theme.appearance === 'dark')],
  ];

  for (const [appearance, themes] of groups) {
    test(`the ${appearance} themes paint their own brand hue and stay AA`, async ({ page }) => {
      for (const theme of themes) {
        await applyTheme(page, theme);
        const tokens = await readBrandTokens(page);

        // 1. The swap is live and authored — not an inherited Sprout role.
        expect(tokens.primary, `${theme.id} --sh-primary`).toBe(theme.primary);
        expect(tokens.primaryBright, `${theme.id} --sh-primary-bright`).toBe(theme.primaryBright);
        expect(tokens.button, `${theme.id} --sh-button`).toBe(theme.button);
        expect(tokens.buttonLip, `${theme.id} --sh-button-lip`).toBe(theme.buttonLip);
        expect(tokens.buttonText, `${theme.id} --sh-button-text`).toBe(theme.buttonText);
        expect(
          SPROUT_VALUES.has(tokens.primary.toLowerCase()),
          `${theme.id} still resolves to Sprout (${tokens.primary})`,
        ).toBe(false);

        // 2. Every painted fill pair clears its WCAG floor.
        const pairs = await measureFillPairs(page, tokens);
        const failures = pairs.filter((pair) => pair.value === null || pair.value < pair.min);
        expect(failures, `${theme.id}: fill contrast`).toEqual([]);

        // 3. The rendered Today screen (text on its real composited
        //    background, accessible names, ids, hidden focus) is clean apart
        //    from the documented pre-existing findings above.
        await page.waitForTimeout(400);
        const result = await page.evaluate(auditPage);
        expect(result.contrast, `${theme.id}: WCAG AA contrast`).toEqual(
          PREEXISTING_CONTRAST[theme.id] ?? [],
        );
        expect(result.nameless, `${theme.id}: controls without accessible names`).toEqual([]);
        expect(result.duplicateIds, `${theme.id}: duplicate element ids`).toEqual([]);
        expect(result.hiddenFocusable, `${theme.id}: focusable content in aria-hidden`).toEqual([]);
      }
    });
  }

  // The Settings overlay renders the theme picker tiles, OptionRow-style
  // selections and chunky switch tracks — surfaces the Today screen does not
  // exercise. Audit it in one light and one dark swapped theme.
  test('Settings (picker tiles + switch tracks) is AA-clean in swapped themes', async ({
    page,
  }) => {
    for (const theme of [THEMES[1], THEMES[5]]) {
      await applyTheme(page, theme);
      const tokens = await readBrandTokens(page);
      expect(tokens.button, `${theme.id} settings --sh-button`).toBe(theme.button);
      expect(tokens.primary, `${theme.id} settings --sh-primary`).toBe(theme.primary);

      await page.getByRole('button', { name: 'Open settings' }).click();
      await expect(page.getByText('Theme and display', { exact: true })).toBeVisible();
      await page.waitForTimeout(600);
      const result = await page.evaluate(auditPage);
      expect(result.contrast, `${theme.id} settings: WCAG AA contrast`).toEqual([]);
      expect(result.nameless, `${theme.id} settings: controls without accessible names`).toEqual(
        [],
      );
      expect(result.duplicateIds, `${theme.id} settings: duplicate element ids`).toEqual([]);
      expect(
        result.hiddenFocusable,
        `${theme.id} settings: focusable content in aria-hidden`,
      ).toEqual([]);
      await page.getByRole('button', { name: 'Close settings' }).click();
    }
  });
});
