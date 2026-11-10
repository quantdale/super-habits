import { describe, expect, it } from 'vitest';
import { contrastRatio, WCAG_AA_NON_TEXT, WCAG_AA_TEXT } from '@/core/theme/contrast';
import {
  DARK_THEME_IDS,
  DEFAULT_DARK_THEME_ID,
  DEFAULT_LIGHT_THEME_ID,
  LIGHT_THEME_IDS,
  THEME_IDS,
  THEME_REGISTRY,
  getTheme,
  isThemeId,
} from '@/core/theme/registry';

/** §5.1: bright fills never carry white text; they carry this ink. */
const ON_BRIGHT_INK = '#10131A';
const BRAND_ROLES = [
  'primary',
  'primaryBright',
  'button',
  'buttonHover',
  'buttonActive',
  'buttonLip',
] as const;

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** WCAG relative luminance, mirroring core/theme/contrast.ts (module-private there). */
function luminanceOf(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe('THEME_REGISTRY invariants', () => {
  it('every registry key matches its theme definition id', () => {
    for (const [key, theme] of Object.entries(THEME_REGISTRY)) {
      expect(theme.id).toBe(key);
    }
  });

  it('every id is unique and kebab-case', () => {
    expect(new Set(THEME_IDS).size).toBe(THEME_IDS.length);
    for (const id of THEME_IDS) {
      expect(id).toMatch(KEBAB_CASE);
    }
  });

  it('both default theme ids are registered and match their stated appearance', () => {
    expect(THEME_IDS).toContain(DEFAULT_LIGHT_THEME_ID);
    expect(THEME_IDS).toContain(DEFAULT_DARK_THEME_ID);
    expect(getTheme(DEFAULT_LIGHT_THEME_ID).appearance).toBe('light');
    expect(getTheme(DEFAULT_DARK_THEME_ID).appearance).toBe('dark');
  });

  it('partitions every theme into exactly one of LIGHT_THEME_IDS/DARK_THEME_IDS', () => {
    expect(LIGHT_THEME_IDS.length + DARK_THEME_IDS.length).toBe(THEME_IDS.length);
    for (const id of LIGHT_THEME_IDS) {
      expect(THEME_REGISTRY[id].appearance).toBe('light');
    }
    for (const id of DARK_THEME_IDS) {
      expect(THEME_REGISTRY[id].appearance).toBe('dark');
    }
  });

  it('isThemeId narrows correctly, including for unknown/removed ids', () => {
    expect(isThemeId('light')).toBe(true);
    expect(isThemeId('nord-arctic')).toBe(true);
    expect(isThemeId('does-not-exist')).toBe(false);
    expect(isThemeId(42)).toBe(false);
    expect(isThemeId(null)).toBe(false);
  });

  it('ships at least the 14 catalog themes from the design doc', () => {
    expect(THEME_IDS.length).toBeGreaterThanOrEqual(14);
  });

  it('defaults carry the P1 §5.2/§5.3 token values', () => {
    const l = getTheme(DEFAULT_LIGHT_THEME_ID).tokens;
    expect(l.primary).toBe('#1A7F2B');
    expect(l.primaryBright).toBe('#4DC93A');
    expect(l.buttonLip).toBe('#135B1F');
    expect(l.textSubtle).toBe('#656D80');
    const d = getTheme(DEFAULT_DARK_THEME_ID).tokens;
    expect(d.primary).toBe('#4DC93A');
    expect(d.primaryBright).toBe('#4DC93A');
    expect(d.buttonLip).toBe('#1A7F2B');
    expect(d.textSubtle).toBe('#8A93A6');
  });
});

// Re-validates the *actual shipped* registry with the same WCAG checks as
// scripts/validate-theme-contrast.mjs, closing the gap the design doc flags:
// "later importing the real registry instead of its embedded copy."
describe('THEME_REGISTRY contrast', () => {
  for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
    it(`${id} (${theme.appearance}) meets WCAG AA on every checked pair`, () => {
      const t = theme.tokens;
      const checks: [string, string, string, number][] = [
        ['text on background', t.text, t.background, WCAG_AA_TEXT],
        ['text on surface', t.text, t.surface, WCAG_AA_TEXT],
        ['text on surfaceElevated', t.text, t.surfaceElevated, WCAG_AA_TEXT],
        ['textMuted on surface', t.textMuted, t.surface, WCAG_AA_TEXT],
        ['textMuted on surfaceElevated', t.textMuted, t.surfaceElevated, WCAG_AA_TEXT],
        // §5.4 extends textSubtle to the same surfaces it paints placeholders
        // and meta on (surface, elevated, sunken) instead of surface alone.
        ['textSubtle on surface', t.textSubtle, t.surface, WCAG_AA_TEXT],
        ['textSubtle on surfaceElevated', t.textSubtle, t.surfaceElevated, WCAG_AA_TEXT],
        ['textSubtle on surfaceSunken', t.textSubtle, t.surfaceSunken, WCAG_AA_TEXT],
        ['buttonText on button', t.buttonText, t.button, WCAG_AA_TEXT],
        ['buttonText on buttonHover', t.buttonText, t.buttonHover, WCAG_AA_TEXT],
        ['buttonText on buttonActive', t.buttonText, t.buttonActive, WCAG_AA_TEXT],
        // Press depth under the face — adjacent color (WCAG 1.4.11), matching
        // scripts/validate-theme-contrast.mjs and createTheme.assertContrast.
        ['buttonText on buttonLip (press depth)', t.buttonText, t.buttonLip, WCAG_AA_NON_TEXT],
        ['accent on surface', t.accent, t.surface, WCAG_AA_TEXT],
        ['primary on surface (non-text)', t.primary, t.surface, WCAG_AA_NON_TEXT],
        // §5.4 brand-hue swaps: `primary` also paints colored TEXT (Link,
        // the Overview "Plan today" pill, ghost labels) on the card face, the
        // canvas, raised surfaces and the chip tint — measured, not assumed.
        ['primary on surface (as text)', t.primary, t.surface, WCAG_AA_TEXT],
        ['primary on background (as text)', t.primary, t.background, WCAG_AA_TEXT],
        ['primary on surfaceElevated (as text)', t.primary, t.surfaceElevated, WCAG_AA_TEXT],
        ['primary on chipBackground (as text)', t.primary, t.chipBackground, WCAG_AA_TEXT],
        // §5.1 bright fills carry the bright-fill ink, not white (the ProgressBar,
        // ProgressRing, CheckNode, NumberStepperField and hero Card default).
        ['ink on primaryBright', ON_BRIGHT_INK, t.primaryBright, WCAG_AA_TEXT],
      ];

      for (const [label, fg, bg, min] of checks) {
        const ratio = contrastRatio(fg, bg);
        expect(ratio, `${id}: ${label} — ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(min);
      }
    });
  }
});

// Playful Momentum §5.4: the 12 non-default themes are not Sprout aliases.
// Every theme must ship a real, distinct solid / bright / lip triple with the
// §5.1 roles intact: bright below the face, lip under it.
describe('brand-hue swaps (§5.4)', () => {
  const DEFAULT_IDS = [DEFAULT_LIGHT_THEME_ID, DEFAULT_DARK_THEME_ID];
  const swappedIds = THEME_IDS.filter((id) => !DEFAULT_IDS.includes(id));
  const sprout = new Set(
    ['#1A7F2B', '#4DC93A', '#135B1F', '#17742A', '#3DB52C', '#5AD447'].map((c) => c.toLowerCase()),
  );

  it('covers exactly the 12 non-default themes', () => {
    expect(swappedIds).toHaveLength(12);
  });

  it('each swapped theme has its own solid / bright / lip triple', () => {
    for (const id of swappedIds) {
      const t = THEME_REGISTRY[id].tokens;
      // Non-degenerate roles: the authoring must set them, not inherit them.
      expect(t.primaryBright, id).toBeDefined();
      expect(t.buttonLip, id).toBeDefined();
      expect(t.buttonLip.toLowerCase(), id).not.toBe(t.button.toLowerCase());

      // §5.1 tier order: bright is a SHAPE hue (lighter/brighter than the
      // label-bearing solid in light themes; it may equal `primary` in dark).
      // The invariant that must always hold is that the lip sits BELOW the
      // face and the label clears AA on the face and on the lip itself.
      const face = luminanceOf(t.button);
      expect(luminanceOf(t.buttonLip), `${id}: lip must sit below the face`).toBeLessThan(face);
      expect(
        contrastRatio(t.buttonText, t.buttonLip),
        `${id}: buttonText on buttonLip`,
      ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    }
  });

  it('no swapped theme borrows a Sprout brand colour', () => {
    for (const id of swappedIds) {
      const t = THEME_REGISTRY[id].tokens;
      for (const role of BRAND_ROLES) {
        expect(sprout.has(t[role].toLowerCase()), `${id}.${role} is Sprout ${t[role]}`).toBe(false);
      }
      expect(sprout.has(t.primaryBright.toLowerCase()), `${id}.primaryBright`).toBe(false);
    }
  });

  it('keeps each swapped theme on its own canvas family', () => {
    // §5.4: the swap replaces the brand role, never the canvas.
    const expected: Record<string, { background: string; surface: string; text: string }> = {
      'coffee-brown': { background: '#faf6f0', surface: '#ffffff', text: '#33261c' },
      'ocean-teal': { background: '#f2fafa', surface: '#ffffff', text: '#0f3d3b' },
      'sunset-orange': { background: '#fff9f2', surface: '#ffffff', text: '#3b1d0f' },
      'rose-pink': { background: '#fdf5f8', surface: '#ffffff', text: '#3f1226' },
      solarized: { background: '#fdf6e3', surface: '#fffcf2', text: '#073642' },
      'midnight-blue': { background: '#0a1526', surface: '#112036', text: '#e8f0fb' },
      'forest-green': { background: '#0c1712', surface: '#13211a', text: '#e4eee6' },
      'royal-purple': { background: '#160f2b', surface: '#211a3e', text: '#efeafb' },
      'crimson-red': { background: '#190c10', surface: '#241318', text: '#fbedee' },
      'cyberpunk-neon': { background: '#07080f', surface: '#0e1020', text: '#eaf2ff' },
      'nord-arctic': { background: '#2e3440', surface: '#3b4252', text: '#eceff4' },
      'emerald-dark': { background: '#0a0f0d', surface: '#111917', text: '#e7f0ec' },
    };
    for (const [id, canvas] of Object.entries(expected)) {
      const t = THEME_REGISTRY[id].tokens;
      expect(t.background, `${id}.background`).toBe(canvas.background);
      expect(t.surface, `${id}.surface`).toBe(canvas.surface);
      expect(t.text, `${id}.text`).toBe(canvas.text);
    }
    // The e2e/theming.spec.ts Nord assertion (CSS var `--sh-background`).
    expect(THEME_REGISTRY['nord-arctic'].tokens.background).toBe('#2e3440');
  });

  it('keeps section hues theme-invariant except where a theme overrides them', () => {
    for (const id of swappedIds) {
      if (id === 'cyberpunk-neon') continue; // the one §5.4 sectionOverrides theme
      expect(THEME_REGISTRY[id].sectionOverrides, id).toBeUndefined();
    }
  });
});

// `textOnAccent` is DERIVED from `buttonText` (createTheme:
// `textOnAccent: input.textOnAccent ?? input.buttonText`). P21-C moved
// royal-purple's button onto the §5.3 bright-fill/ink-label pattern, which
// silently flipped that derived token to `#10131A` — 1.13:1 as an icon on the
// theme's velvet card, and the opposite contrast of the amber/rose accent fills
// it also inks. (Codex review finding, PR #208.)
//
// The contract asserted here is a NO-DRIFT contract, not new behaviour:
// `textOnAccent` must equal the theme's PRE-PR value, i.e. each theme's
// pre-brand-hue `buttonText`. light/dark never moved, and the 11 other swapped
// themes kept their label colour, so for them `textOnAccent === buttonText` is
// exactly the pre-PR value. royal-purple is the one theme whose label colour
// DID move, hence its explicit pin.
describe('textOnAccent matches its pre-PR value in every theme', () => {
  /**
   * `buttonText` as shipped on `origin/main` before this PR (i.e. before the
   * P21-C brand-hue swap). `git show origin/main:core/theme/themes/<id>.ts`.
   * A theme that changes its own label colour must pin `textOnAccent` back to
   * this value so the fixed-fill consumers do not silently invert.
   *
   * Royal-purple is the only entry whose current `buttonText` differs; it is
   * therefore also the only entry that has to pin `textOnAccent`.
   */
  const PRE_PR_BUTTON_TEXT: Record<string, string> = {
    light: '#FFFFFF',
    dark: '#10131A',
    'midnight-blue': '#ffffff',
    'forest-green': '#052e1f',
    'ocean-teal': '#ffffff',
    'royal-purple': '#ffffff',
    'crimson-red': '#ffffff',
    'sunset-orange': '#ffffff',
    'rose-pink': '#ffffff',
    'cyberpunk-neon': '#14020f',
    'nord-arctic': '#20262e',
    solarized: '#ffffff',
    'emerald-dark': '#04241a',
    'coffee-brown': '#ffffff',
  };

  it('covers all 14 themes', () => {
    expect(Object.keys(PRE_PR_BUTTON_TEXT).sort()).toEqual([...THEME_IDS].sort());
  });

  it('keeps textOnAccent identical to the pre-PR button label', () => {
    for (const [id, pre] of Object.entries(PRE_PR_BUTTON_TEXT)) {
      const t = THEME_REGISTRY[id].tokens;
      expect(t.textOnAccent, `${id}.textOnAccent`).toBe(pre);
    }
  });

  it('leaves every non-royal-purple label colour untouched by this PR', () => {
    // For those themes the derived token is still their own `buttonText`, so the
    // no-drift assertion above is exactly "the label colour did not move".
    for (const [id, pre] of Object.entries(PRE_PR_BUTTON_TEXT)) {
      if (id === 'royal-purple') continue;
      const t = THEME_REGISTRY[id].tokens;
      expect(t.buttonText, `${id}.buttonText`).toBe(pre);
      expect(t.textOnAccent, `${id}.textOnAccent`).toBe(t.buttonText);
    }
  });

  it('pins royal-purple back to the value the card surfaces were validated on', () => {
    const t = THEME_REGISTRY['royal-purple'].tokens;
    // The label moved (bright fill + ink label); the pin did not.
    expect(t.buttonText).toBe('#10131A');
    expect(t.textOnAccent).toBe('#ffffff');
    // Proof the pin matters: the DERIVED value cannot ink a neutral card face,
    // which is exactly the regression the review measured (1.13:1).
    expect(contrastRatio(t.buttonText, t.surface)).toBeLessThan(WCAG_AA_NON_TEXT);
  });

  it('keeps royal-purple textOnAccent >= 3:1 on the neutral card surface', () => {
    // The exact pair the review measured: a `Card variant="header"` icon on
    // `tokens.surface`. Restoring the pre-PR white yields 16.38:1.
    const t = THEME_REGISTRY['royal-purple'].tokens;
    const ratio = contrastRatio(t.textOnAccent, t.surface);
    expect(
      ratio,
      `royal-purple: textOnAccent on surface — ${ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
  });
});
