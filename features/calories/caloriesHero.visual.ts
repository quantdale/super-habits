import {
  contrastRatio,
  inkOnFill,
  readableAccent,
  WCAG_AA_NON_TEXT,
  WCAG_AA_TEXT,
} from '@/core/theme/contrast';
import { SECTION_HUES } from '@/constants/sectionColors';

/**
 * Pure visual model for the Calories hero (P17, §"Calories" in
 * docs/ui-ux/16-playful-momentum.md).
 *
 * The screen owns ONE hue (Berry) and every berry-shaped element is drawn on
 * the theme's flat card face, so nothing here may assume the theme's own inks
 * fit: the §5.1 `bright` Berry reads 2.58:1 on a white card (under the 3:1
 * non-text floor for a bar), while `solid` Berry reads 5.60:1 there. In dark
 * appearances the `bright` tier is the legible one. This module picks the
 * actual fill/ink pair per appearance and floors each pair, so the shipped
 * geometry is unit-testable across all 14 themes
 * (tests/caloriesContrast.test.ts).
 *
 * No React, no DB, no theme read: callers pass resolved tokens.
 */
const HUE = SECTION_HUES.calories;

/** §6 ProgressBar default height — the daily "kcal left" bar (14px). */
export const CALORIES_HERO_BAR_HEIGHT = 14;

/** Mini bar height for the three labeled macro bars (8px, §6 "bars radius 8"). */
export const CALORIES_MINI_BAR_HEIGHT = 8;

export type CaloriesHeroVisual = {
  /** Fill for the 14px daily bar and the three macro mini bars. */
  barFill: string;
  /** Remaining-kcal metric ink on the flat hero face (≥4.5:1). */
  metricInk: string;
  /** Context/caption ink on the flat hero face (≥4.5:1). */
  mutedInk: string;
  /**
   * Face of the screen's ONE primary action (the Berry "Add entry"/"Add" CTA),
   * following the §5.1 tier rule: a LIGHT appearance paints `solid` Berry
   * (white label, 5.60:1) and a DARK appearance paints `bright` Berry (ink
   * label, 7.20:1). `Button` still enforces the label floor on whatever face it
   * is handed.
   */
  ctaFace: string;
  /**
   * Accent for the Form/Diary SegmentedControl (§6: the selected segment label
   * is painted on the control's own thumb face inside the sunken tray). It is
   * therefore resolved against `surface` — the theme's thumb fill — not against
   * a hardcoded white: `bright` Berry is 2.58:1 on a white card but only
   * 3.90:1 on Nord's #3B4252 surface. Start from the accent TEXT tier (solid
   * Berry in light / bright Berry in dark, 5.60 / 6.38 on the default themes)
   * and deepen/lift the same hue where a theme's own surface disagrees.
   */
  segmentedAccent: string;
};

/** First candidate whose contrast clears `min` against EVERY background. */
function firstClearing(
  candidates: readonly string[],
  backgrounds: readonly string[],
  min: number,
): string {
  for (const candidate of candidates) {
    if (backgrounds.every((background) => contrastRatio(candidate, background) >= min)) {
      return candidate;
    }
  }
  return candidates.at(-1) ?? HUE.solid;
}

/**
 * Berry one-hue hero chrome.
 *
 * - `barFill` must read as a shape against BOTH the sunken track it sits in and
 *   the card face it is drawn on (WCAG 1.4.11 non-text ≥3:1). The §5.1 tier
 *   rule supplies the order: the appearance's accent TEXT tier (solid in light,
 *   bright in dark) first, then `solid` Berry, then `bright` Berry, then the
 *   theme's text ink (never fails in practice, but the list is exhausted).
 * - `metricInk` is the accent text tier when it clears 4.5:1 on the flat face,
 *   otherwise the accent is deepened toward a legible text tone (same hue).
 * - `mutedInk` keeps the theme's muted ink, falling back to `text` where a
 *   theme's `textMuted` misses the floor on the card face.
 * - `ctaFace` follows the §5.1 tier rule and `segmentedAccent` is resolved
 *   against the control's real thumb fill (see the type).
 */
export function caloriesHeroVisual(input: {
  appearance: 'light' | 'dark';
  /** `sectionAccents.calories.fill` (theme-resolved, may be overridden). */
  accentFill: string;
  /** `sectionAccents.calories.text` (solid in light, bright in dark). */
  accentText: string;
  surface: string;
  surfaceSunken: string;
  text: string;
  textMuted: string;
}): CaloriesHeroVisual {
  const { appearance, accentFill, accentText, surface, surfaceSunken, text, textMuted } = input;

  // §5.1 tier rule: light paints `solid` Berry under white-ish text, dark paints
  // `bright` Berry. The candidates below are the SAME hue; the floor decides.
  const tierFill = appearance === 'dark' ? accentFill : HUE.solid;
  const barFill = firstClearing(
    [accentText, tierFill, HUE.solid, HUE.bright, text],
    [surfaceSunken, surface],
    WCAG_AA_NON_TEXT,
  );

  // The accent TEXT tier is already the contrast-guaranteed pair on a themed
  // surface; where an override theme breaks that (a bright override fill in a
  // light appearance), deepen the same hue and finally fall back to the theme
  // text ink so the headline can never sink under the floor.
  const metricInk = inkOnFill(surface, accentText, readableAccent(accentFill, surface));
  const metricFloor = inkOnFill(surface, metricInk, text);

  const mutedInk = contrastRatio(textMuted, surface) >= WCAG_AA_TEXT ? textMuted : text;

  return {
    barFill,
    metricInk: metricFloor,
    mutedInk,
    ctaFace: appearance === 'dark' ? HUE.bright : HUE.solid,
    segmentedAccent: inkOnFill(surface, accentText, readableAccent(accentFill, surface)),
  };
}
