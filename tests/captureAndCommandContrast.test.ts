import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  readableSurface,
  WCAG_AA_NON_TEXT,
  WCAG_AA_TEXT,
} from '@/core/theme/contrast';
import { THEME_REGISTRY } from '@/core/theme/registry';
import { getSectionAccents, SECTION_HUES, SECTION_ON_BRIGHT_INK } from '@/constants/sectionColors';
import {
  CAPTURE_TYPE_OPTIONS,
  captureTypeTileVisual,
  duotoneOnFill,
  TILE_BORDER,
  TILE_LIP,
  TILE_MIN_HEIGHT,
  type CaptureTypeAccent,
} from '@/features/quick-capture/captureType.visual';
import { resolveCaptureAccent } from '@/features/quick-capture/captureType.mode';
import { commandRunButtonVisual } from '@/features/command/commandInput.visual';

/**
 * P19 Quick capture type picker contrast matrix
 * (docs/ui-ux/16-playful-momentum.md §7 + §6 OptionRow, §5.1 hue tiers).
 *
 * Every tile paints a FIXED destination hue in its icon chip, so each ink must
 * be chosen against the ACTUAL fill in all 14 themes — the theme's `text`
 * lands at 2.0–2.6:1 on Sprout bright in the dark themes, and white on a
 * `bright` tier is 2.02–3.07:1 everywhere (§5.1 rule 1).
 *
 * Floors: text 4.5:1, non-text glyph/badge 3:1 (WCAG 1.4.11).
 */
const ALL_KEYS = CAPTURE_TYPE_OPTIONS.map((option) => option.key);

/**
 * Destination accents exactly as the picker resolves them — the PRODUCTION
 * resolver, not a re-derivation in the test, so a change to the mapping or to
 * the section-override handling cannot pass here while the sheet drifts.
 */
function accentFor(key: string, theme: (typeof THEME_REGISTRY)[string]): CaptureTypeAccent {
  return resolveCaptureAccent(
    key as (typeof CAPTURE_TYPE_OPTIONS)[number]['key'],
    theme.tokens,
    getSectionAccents(theme.appearance, theme.sectionOverrides),
  );
}

describe('Quick capture type tiles (all 14 themes)', () => {
  for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
    const { tokens } = theme;
    for (const option of CAPTURE_TYPE_OPTIONS) {
      const accent = accentFor(option.key, theme);
      const visual = (selected: boolean) =>
        captureTypeTileVisual({
          selected,
          accent,
          appearance: theme.appearance,
          surface: tokens.surface,
          surfaceSunken: tokens.surfaceSunken,
          border: tokens.border,
          borderStrong: tokens.borderStrong,
          text: tokens.text,
          textMuted: tokens.textMuted,
          iconMuted: tokens.iconMuted,
        });

      it(`${id} ${option.label}: selected label clears 4.5 on its tint`, () => {
        const selected = visual(true);
        expect(
          contrastRatio(selected.labelInk, selected.face),
          `${id} ${option.label}: ${selected.labelInk} on ${selected.face}`,
        ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
      });

      it(`${id} ${option.label}: selected icon clears 3.0 on the hue chip`, () => {
        const selected = visual(true);
        expect(contrastRatio(selected.iconBright, selected.iconChipFace)).toBeGreaterThanOrEqual(
          WCAG_AA_NON_TEXT,
        );
        expect(contrastRatio(selected.iconLip, selected.iconChipFace)).toBeGreaterThanOrEqual(
          WCAG_AA_NON_TEXT,
        );
        // Never the §5.1 forbidden white-on-bright pairing.
        expect(selected.iconBright).not.toBe('#FFFFFF');
      });

      it(`${id} ${option.label}: selected border/lip keep the tile visible (3.0)`, () => {
        const selected = visual(true);
        expect(contrastRatio(selected.borderColor, selected.face)).toBeGreaterThanOrEqual(
          WCAG_AA_NON_TEXT,
        );
        expect(contrastRatio(selected.lipColor, tokens.surface)).toBeGreaterThanOrEqual(
          WCAG_AA_NON_TEXT,
        );
      });

      it(`${id} ${option.label}: idle label clears 4.5 and the idle icon keeps its duotone`, () => {
        const idle = visual(false);
        expect(contrastRatio(idle.labelInk, idle.face)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
        expect(contrastRatio(idle.iconBright, idle.iconChipFace)).toBeGreaterThanOrEqual(
          WCAG_AA_NON_TEXT,
        );
        expect(contrastRatio(idle.iconLip, idle.iconChipFace)).toBeGreaterThanOrEqual(
          WCAG_AA_NON_TEXT,
        );
        // Both passes distinct, so the icon is never a flat silhouette (P10 r2).
        expect(idle.iconLip).not.toBe(idle.iconBright);
        expect(selectedDistinct(visual, theme)).toBe(true);
      });
    }
  }

  it('the picker exposes exactly the six pinned labels', () => {
    expect(CAPTURE_TYPE_OPTIONS.map((option) => option.label)).toEqual([
      'Task',
      'Habit',
      'Calorie',
      'Project',
      'Goal',
      'Focus',
    ]);
    expect(ALL_KEYS).toHaveLength(6);
  });

  it('tiles ride the §5.7 md lip with the §6 option grammar', () => {
    expect(TILE_LIP).toBe(3);
    expect(TILE_BORDER).toBe(2);
    expect(TILE_MIN_HEIGHT).toBeGreaterThanOrEqual(44);
  });
});

/** Selection must be visible without relying on the icon hue alone. */
function selectedDistinct(
  visual: (selected: boolean) => ReturnType<typeof captureTypeTileVisual>,
  theme: (typeof THEME_REGISTRY)[string],
): boolean {
  const idle = visual(false);
  const selected = visual(true);
  return (
    selected.face !== idle.face &&
    selected.borderColor !== idle.borderColor &&
    selected.iconChipFace !== idle.iconChipFace &&
    // §5.7: the lip becomes the section solid, so the press depth changes too.
    selected.lipColor !== idle.lipColor &&
    theme.tokens.surface !== selected.lipColor
  );
}

describe('duotoneOnFill', () => {
  it('keeps the §5.1 bright-fill ink and a distinct 3:1 detail on every section hue', () => {
    for (const [key, hue] of Object.entries(SECTION_HUES)) {
      const result = duotoneOnFill({ fill: hue.bright, lip: hue.lip });
      expect(result.bright, `${key} shape`).toBe(SECTION_ON_BRIGHT_INK);
      expect(contrastRatio(result.lip, hue.bright), `${key} detail`).toBeGreaterThanOrEqual(
        WCAG_AA_NON_TEXT,
      );
      expect(result.lip, `${key} detail is not the shape`).not.toBe(result.bright);
    }
  });

  it('is not vacuous: white on a bright hue fails the 3:1 floor', () => {
    expect(contrastRatio('#FFFFFF', SECTION_HUES.habits.bright)).toBeLessThan(WCAG_AA_NON_TEXT);
  });
});

describe('Command Center run button tier (all 14 themes)', () => {
  for (const [id, theme] of Object.entries(THEME_REGISTRY)) {
    const { tokens } = theme;

    it(`${id} (${theme.appearance}): the Sprout face keeps its label at AA`, () => {
      const visual = commandRunButtonVisual({ appearance: theme.appearance });
      // `Button` deepens a caller hue until `buttonText` clears AA, so the
      // saturated §5.1 tiers must reach the floor after that same bump: the
      // LIGHT face is Sprout solid (5.10:1 under white), the DARK face is
      // Sprout bright (8.61:1 under the ink label).
      const bumped = readableSurface(visual.face, tokens.buttonText);
      expect(
        contrastRatio(bumped, tokens.buttonText),
        `${id}: ${tokens.buttonText} on ${bumped}`,
      ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });

    it(`${id} (${theme.appearance}): the run face is a §5.1 Sprout tier`, () => {
      const visual = commandRunButtonVisual({ appearance: theme.appearance });
      expect(visual.face).toBe(
        theme.appearance === 'dark' ? SECTION_HUES.habits.bright : SECTION_HUES.habits.solid,
      );
      expect(visual.inkLabel).toBe(theme.appearance === 'dark');
      // The lip is the tier below the face, never the face itself.
      expect(visual.lip).not.toBe(visual.face);
    });
  }

  it('is not vacuous: white on Sprout bright cannot carry the label', () => {
    // §5.1 rule 1 — the reason the dark appearance must use the ink label.
    expect(contrastRatio('#FFFFFF', SECTION_HUES.habits.bright)).toBeLessThan(WCAG_AA_TEXT);
  });
});
