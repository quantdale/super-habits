import { describe, expect, it } from 'vitest';
import {
  SECTION_HUES,
  SECTION_TEXT_COLORS,
  SECTION_TEXT_COLORS_DARK,
  getSectionAccents,
  type SectionKey,
} from '@/constants/sectionColors';
import { contrastRatio, tintOver, WCAG_AA_TEXT } from '@/core/theme/contrast';
import { THEME_REGISTRY } from '@/core/theme/registry';

/**
 * CG-11 (docs/testing/known-gaps.md): a section's coloured TEXT tier was
 * resolved from the APPEARANCE alone, so it was never validated against the
 * ACTIVE theme's own faces. The §5.1 table's "bright on surface D" column is
 * measured on the default dark canvas (`#1A1F2B`); on Nord Arctic's mid-tone
 * slate (`#3B4252`) the same ink reads 3.56–4.35:1 — below the 4.5:1 text
 * floor — while it passes on the canvas it was designed for.
 *
 * The fix is the surface-aware half of the `readableAccent` contract that
 * Settings already used: `getSectionAccents()` accepts the theme's own neutral
 * faces and resolves each `text` tier against them, returning the §5.1 hue
 * BYTE-IDENTICAL whenever it already clears the floor on every face and moving
 * only its lightness (hue preserved) where it does not. That no-op property is
 * what keeps light, dark and every golden-rendered theme pixel-identical, so it
 * is asserted here as hard as the floor itself.
 *
 * The literals in `SHIPPED_TEXT` are the PRE-CHANGE resolver output, captured
 * from `getSectionAccents()` on `main` (b197b401) before this resolver existed.
 * They are not a re-derivation: they are the shipped values, so a future edit
 * that "simplifies" the resolver into re-tinting light or dark fails here
 * instead of silently repainting 30 goldens.
 */

const SECTION_KEYS = Object.keys(SECTION_HUES) as SectionKey[];

/** Pre-change `getSectionAccents('light' | 'dark')` text tiers, verbatim. */
const SHIPPED_TEXT: Record<'light' | 'dark', Record<SectionKey, string>> = {
  light: {
    todos: '#1769D8',
    habits: '#1A7F2B',
    focus: '#6F45E6',
    workout: '#BF351E',
    calories: '#C02670',
    health: '#0B7A72',
  },
  dark: {
    todos: '#2FA8F7',
    habits: '#4DC93A',
    focus: '#B49BFF',
    workout: '#FF6A4D',
    calories: '#FF6FAE',
    health: '#22CCB8',
  },
};

/**
 * The faces a section's coloured TEXT tier is painted on, as the provider hands
 * them to the resolver: the card face, raised surfaces and recessed trays.
 * `tokens.chipBackground` is deliberately NOT a face here — the only component
 * that paints bare `chipBackground` is `core/ui/PillChip`, and its inactive
 * label paints `tokens.text`/`textMuted`, never a section accent. Including it
 * would lift the default dark `todos`/`workout`/`calories` inks (4.31/3.97/4.35
 * on `#24412e`), i.e. repaint the dark goldens to fix a pair nothing renders.
 */
function neutralFaces(tokens: {
  surface: string;
  surfaceElevated: string;
  surfaceSunken: string;
}): string[] {
  return [tokens.surface, tokens.surfaceElevated, tokens.surfaceSunken];
}

/** Effective face under an accent tint: opaque tints paint themselves, translucent ones (Cyberpunk Neon) composite onto the card. */
function tintFace(surface: string, tint: string): string {
  const hex = tint.replace('#', '');
  if (hex.length < 8) return tint;
  return tintOver(surface, `#${hex.slice(0, 6)}`, Number.parseInt(hex.slice(6, 8), 16) / 255);
}

function shippedTier(themeId: string, key: SectionKey): string {
  const theme = THEME_REGISTRY[themeId];
  const override = theme.sectionOverrides?.[key];
  if (override) return override.text;
  return theme.appearance === 'dark' ? SECTION_TEXT_COLORS_DARK[key] : SECTION_TEXT_COLORS[key];
}

function resolvedAccents(themeId: string) {
  const theme = THEME_REGISTRY[themeId];
  const { tokens } = theme;
  return {
    theme,
    accents: getSectionAccents(theme.appearance, theme.sectionOverrides, neutralFaces(tokens)),
  };
}

describe('CG-11: section text tiers clear AA on the ACTIVE theme’s faces (14 themes × 6 hues)', () => {
  const themeIds = Object.keys(THEME_REGISTRY);

  it('covers the whole registry and every section hue', () => {
    expect(themeIds.length).toBe(14);
    expect(SECTION_KEYS.length).toBe(6);
  });

  for (const themeId of themeIds) {
    const theme = THEME_REGISTRY[themeId];

    it(`${themeId} (${theme.appearance}): every resolved text tier clears 4.5 on surface / surfaceElevated / surfaceSunken`, () => {
      const { accents } = resolvedAccents(themeId);
      for (const key of SECTION_KEYS) {
        const ink = accents[key].text;
        for (const [faceName, face] of [
          ['surface', theme.tokens.surface],
          ['surfaceElevated', theme.tokens.surfaceElevated],
          ['surfaceSunken', theme.tokens.surfaceSunken],
        ] as const) {
          const ratio = contrastRatio(ink, face);
          expect(ratio, `${themeId}/${key}: ${ink} on ${faceName} ${face}`).toBeGreaterThanOrEqual(
            WCAG_AA_TEXT,
          );
        }
      }
    });

    it(`${themeId} (${theme.appearance}): every resolved text tier clears 4.5 on the section tint it is painted on inside selected chips/rows`, () => {
      const { accents } = resolvedAccents(themeId);
      for (const key of SECTION_KEYS) {
        const face = tintFace(theme.tokens.surface, accents[key].tint);
        const ratio = contrastRatio(accents[key].text, face);
        expect(
          ratio,
          `${themeId}/${key}: ${accents[key].text} on the ${key} tint face ${face}`,
        ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
      }
    });
  }
});

describe('CG-11: the default themes (and therefore every golden) render BYTE-IDENTICAL', () => {
  for (const appearance of ['light', 'dark'] as const) {
    it(`${appearance}: every accent text tier is exactly the pre-change shipped value`, () => {
      const { accents } = resolvedAccents(appearance);
      for (const key of SECTION_KEYS) {
        expect(accents[key].text, `${appearance}/${key}`).toBe(SHIPPED_TEXT[appearance][key]);
      }
      // ... and the change is a no-op, not a coincidence: the shipped tiers
      // already cleared every face in the default themes.
      for (const key of SECTION_KEYS) {
        const shipped = SHIPPED_TEXT[appearance][key];
        expect(accents[key].text).toBe(
          appearance === 'dark' ? SECTION_TEXT_COLORS_DARK[key] : SECTION_TEXT_COLORS[key],
        );
        expect(shipped.length).toBe(7);
      }
    });

    it(`${appearance}: the fill and tint tiers are untouched (shapes and washes never move)`, () => {
      const plain = getSectionAccents(appearance);
      const surfaceAware = resolvedAccents(appearance).accents;
      for (const key of SECTION_KEYS) {
        expect(surfaceAware[key].fill).toBe(plain[key].fill);
        expect(surfaceAware[key].tint).toBe(plain[key].tint);
      }
    });
  }

  it('the surface-aware resolver is a no-op when no faces are supplied (back-compatible)', () => {
    for (const themeId of Object.keys(THEME_REGISTRY)) {
      const theme = THEME_REGISTRY[themeId];
      const plain = getSectionAccents(theme.appearance, theme.sectionOverrides);
      const surfaceAware = resolvedAccents(themeId).accents;
      for (const key of SECTION_KEYS) {
        // Only a tier that FAILED the floor on this theme's own faces may move.
        const ink = plain[key].text;
        const failedSomewhere = neutralFaces(theme.tokens).some(
          (face) => contrastRatio(ink, face) < WCAG_AA_TEXT,
        );
        if (!failedSomewhere) {
          expect(surfaceAware[key].text, `${themeId}/${key} moved without a defect`).toBe(ink);
        }
      }
    }
  });
});

describe('CG-11: the fix lifts only defective hues, and preserves their hue', () => {
  it('the two themes the sweep measured are lifted exactly where they failed', () => {
    // Nord Arctic — the mid-tone canvas the sweep reported.
    const nord = resolvedAccents('nord-arctic').accents;
    expect(nord.todos.text).not.toBe(SECTION_TEXT_COLORS_DARK.todos);
    expect(nord.workout.text).not.toBe(SECTION_TEXT_COLORS_DARK.workout);
    expect(nord.calories.text).not.toBe(SECTION_TEXT_COLORS_DARK.calories);
    expect(nord.focus.text).not.toBe(SECTION_TEXT_COLORS_DARK.focus);
    // The defects are gone, measured on the canvas the sweep used.
    for (const key of SECTION_KEYS) {
      expect(
        contrastRatio(nord[key].text, '#3B4252'),
        `nord/${key} on the reported #3B4252 canvas`,
      ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    }
  });

  it('keeps each §5.1 hue recognizable: the lift moves lightness, not the dominant channel', () => {
    /** Hue in degrees (HSL) of a 6-digit hex. */
    const hueOf = (hex: string): number => {
      const h = hex.replace('#', '');
      const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16) / 255);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max === min) return 0;
      const d = max - min;
      const raw =
        max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return raw * 60;
    };
    const circularDelta = (a: number, b: number): number => {
      const d = Math.abs(a - b) % 360;
      return d > 180 ? 360 - d : d;
    };

    for (const themeId of Object.keys(THEME_REGISTRY)) {
      const { accents } = resolvedAccents(themeId);
      for (const key of SECTION_KEYS) {
        const shipped = shippedTier(themeId, key);
        const resolved = accents[key].text;
        if (resolved === shipped) continue;
        expect(
          circularDelta(hueOf(shipped), hueOf(resolved)),
          `${themeId}/${key}: ${shipped} → ${resolved} drifted in hue`,
        ).toBeLessThanOrEqual(3);
      }
    }
  });

  it('documents the pre-fix defect class: the appearance-resolved tier ignores the canvas tone', () => {
    // The shipped dark tiers on a mid-tone canvas — the exact CG-11 ratios.
    expect(contrastRatio('#2FA8F7', '#3B4252')).toBeCloseTo(3.86, 2);
    expect(contrastRatio('#FF6A4D', '#3B4252')).toBeCloseTo(3.56, 2);
    expect(contrastRatio('#FF6FAE', '#3B4252')).toBeCloseTo(3.9, 2);
    expect(contrastRatio('#B49BFF', '#3B4252')).toBeCloseTo(4.35, 2);
    // ... while the same inks clear the floor on the canvas §5.1 measured.
    for (const key of ['todos', 'workout', 'calories', 'focus'] as const) {
      expect(contrastRatio(SECTION_TEXT_COLORS_DARK[key], '#1A1F2B')).toBeGreaterThanOrEqual(
        WCAG_AA_TEXT,
      );
    }
  });
});
