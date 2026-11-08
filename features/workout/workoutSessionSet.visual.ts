import { inkOnFill, WCAG_AA_NON_TEXT } from '@/core/theme/contrast';
import { SECTION_HUES, SECTION_ON_BRIGHT_INK } from '@/constants/sectionColors';

/**
 * Visual models for the in-session chrome (P16, §"Workout session").
 *
 * Pure module: no React, no DB, no theme read — callers pass resolved tokens,
 * so every pair is unit-testable across the 14 themes
 * (tests/workoutSessionContrast.test.ts).
 */
const HUE = SECTION_HUES.workout;

export type SetCheckNodeVisual = {
  checked: boolean;
  /** Face of the node (theme surface when actionable, Coral bright when done). */
  face: string;
  /** Face border: ≥3:1 against the face in BOTH states. */
  outline: string;
  /** ✓ glyph ink on the checked face. */
  glyphInk: string;
};

/**
 * The in-session set-completion node.
 *
 * The completed face is the FIXED §5.1 Coral bright, which does not follow the
 * theme, so its glyph is chosen against that ACTUAL fill (the P13–P15 lesson:
 * white reads 2.83:1 there, under the 3:1 glyph floor).
 *
 * - unchecked: the outline is the only thing that says "this is a control".
 *   `tokens.border` measures 1.25–1.48:1 on every surface, so the outline is
 *   resolved muted→text ink instead (5.29–8.31:1 across the 14 themes).
 * - checked: the outline is the Coral `lip` tier — 3.13:1 on Coral bright, the
 *   same pair in every theme — and the ✓ glyph is the §5.1 bright-fill ink,
 *   floored at 3:1 for whichever theme ink the caller prefers.
 */
export function setCheckNodeVisual(input: {
  checked: boolean;
  surface: string;
  text: string;
  textMuted: string;
  onSolid: string;
}): SetCheckNodeVisual {
  const { checked, surface, text, textMuted, onSolid } = input;
  const uncheckedOutline = inkOnFill(surface, textMuted, text, WCAG_AA_NON_TEXT);
  if (!checked) {
    return { checked, face: surface, outline: uncheckedOutline, glyphInk: uncheckedOutline };
  }
  return {
    checked,
    face: HUE.bright,
    outline: HUE.lip,
    glyphInk: inkOnFill(HUE.bright, onSolid, SECTION_ON_BRIGHT_INK, WCAG_AA_NON_TEXT),
  };
}

export type WorkoutSessionHeaderVisual = {
  /** Header band face (the theme surface, so scrolled content never shows through). */
  canvas: string;
  /** Timer + routine-name ink on the band. */
  ink: string;
  /** Quiet "End workout" label ink on the band. */
  mutedInk: string;
  /**
   * Coral Finish face, following the §5.1 tier rule: a LIGHT appearance paints
   * the `solid` Coral (white label, 5.61:1) and a DARK appearance paints the
   * `bright` Coral (ink label, 6.57:1). `Button` still enforces the label floor
   * on the face it is handed (`readableSurface`), which the contrast test
   * measures as the ACTUAL painted pair.
   */
  finishFace: string;
};

/**
 * Sticky header inks. The band is a theme surface, so the headline and muted
 * inks resolve against it (muted falls back to `text` where a theme's
 * `textMuted` misses the floor); only the fixed-hue Finish face needs the
 * appearance-tier rule.
 */
export function workoutSessionHeaderVisual(input: {
  surface: string;
  text: string;
  textMuted: string;
  appearance: 'light' | 'dark';
}): WorkoutSessionHeaderVisual {
  const { surface, text, textMuted, appearance } = input;
  return {
    canvas: surface,
    ink: inkOnFill(surface, text, text),
    mutedInk: inkOnFill(surface, textMuted, text),
    finishFace: appearance === 'dark' ? HUE.bright : HUE.solid,
  };
}
