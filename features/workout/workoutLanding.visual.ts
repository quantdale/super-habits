import { inkOnFill, readableAccent, WCAG_AA_NON_TEXT, WCAG_AA_TEXT } from '@/core/theme/contrast';
import { SECTION_HUES, SECTION_ON_BRIGHT_INK } from '@/constants/sectionColors';

/**
 * Pure visual models for the Workout landing (P15, §"Workout landing").
 *
 * Every ink is chosen against the ACTUAL fill it is painted on — the §5.1 Coral
 * bright hero face does not follow the theme, so theme-derived ink lands at
 * ~2.4–2.6:1 on it in the dark themes (e.g. `tokens.text` #F4F6FB on #FF6A4D).
 * The same rule applies to day nodes: a done node fills Coral bright, so its
 * label and its ✓ glyph are resolved against that fill, not against the surface.
 *
 * Pure module: no React, no DB, no theme read — callers pass resolved tokens so
 * every pair is unit-testable across the 14 themes (tests/workoutContrast.test.ts).
 */
const HUE = SECTION_HUES.workout;

export type WorkoutHeroVisual = {
  /** The hero face (§6 bright Coral). */
  fill: string;
  /** Headline/detail ink on the hero face. */
  ink: string;
  /** Muted detail ink on the hero face (still ≥4.5 on the fill). */
  muttedInk: string;
  /** Label ink for a face-less (ghost) control painted on the hero face. */
  ghostInk: string;
  /**
   * Face of the hero's one Coral CTA, following the §5.1 tier rule: a LIGHT
   * appearance paints the `solid` Coral (white label, 5.61:1) and a DARK
   * appearance paints the `bright` Coral (ink label, 6.57:1). Button still
   * enforces the label floor on whatever face it is handed.
   */
  ctaFace: string;
};

/**
 * Hero face + inks. `SECTION_ON_BRIGHT_INK` is the §5.1 bright-fill ink (6.57:1
 * on Coral); the muted line reuses it because no theme's `textMuted` clears the
 * floor on Coral (best case 2.9:1), and the ghost CTA label is nudged toward its
 * theme accent and floored the same way.
 */
export function workoutHeroVisual(input: {
  text: string;
  textMuted: string;
  button: string;
  appearance: 'light' | 'dark';
}): WorkoutHeroVisual {
  const { text, textMuted, button, appearance } = input;
  const ink = inkOnFill(HUE.bright, text, SECTION_ON_BRIGHT_INK);
  return {
    fill: HUE.bright,
    ink,
    muttedInk: inkOnFill(HUE.bright, textMuted, SECTION_ON_BRIGHT_INK),
    ghostInk: inkOnFill(
      HUE.bright,
      readableAccent(button, HUE.bright),
      SECTION_ON_BRIGHT_INK,
      WCAG_AA_TEXT,
    ),
    ctaFace: appearance === 'dark' ? HUE.bright : HUE.solid,
  };
}

export type WorkoutDayState = 'done' | 'rest' | 'planned' | 'unassigned';

export type WorkoutDayNodeVisual = {
  fill: string;
  borderColor: string;
  borderWidth: number;
  /** Day-label ink for the node when it carries the weekday (done face only). */
  ink: string;
  /** Glyph ink for the state mark (check / moon / dot). */
  markInk: string;
  mark: 'check' | 'moon' | 'dot' | 'none';
  /** Inner selection ring colour, `null` unless this node is selected. */
  selectionRing: string | null;
  selectionRingWidth: number;
  selectionRingInset: number;
};

export const DAY_NODE_RING_WIDTH = 2;
export const DAY_NODE_RING_INSET = 1;

/**
 * One "This week" day node.
 *
 * - done      → Coral bright face, ink glyph (§5.1 bright ink), 3.13:1 lip ring
 * - rest      → sunken face with the moon glyph, outline = resolved muted ink
 * - planned   → surface face with a muted outline (≥3:1 component boundary)
 * - unassigned→ same outline, no assignment text (kept distinct by copy)
 *
 * `selected` adds a ring in the Coral lip tier: 3.13:1 on the bright face and
 * independent of the done fill, so a selected+done node stays distinguishable
 * (the P13 Codex lesson).
 */
export function workoutDayNodeVisual(input: {
  state: WorkoutDayState;
  selected: boolean;
  surface: string;
  surfaceSunken: string;
  text: string;
  textMuted: string;
  onSolid: string;
}): WorkoutDayNodeVisual {
  const { state, selected, surface, surfaceSunken, text, textMuted, onSolid } = input;
  // Component-boundary ink: muted when it clears 3:1 on the surface (5.29–8.31
  // across the 14 themes), otherwise the theme text ink. Never `tokens.border`
  // (1.25–1.48:1 — an invisible outline).
  const outline = inkOnFill(surface, textMuted, text, WCAG_AA_NON_TEXT);
  const doneFill = HUE.bright;
  const doneInk = inkOnFill(doneFill, text, SECTION_ON_BRIGHT_INK);
  const doneMark = inkOnFill(doneFill, onSolid, SECTION_ON_BRIGHT_INK, WCAG_AA_NON_TEXT);

  let fill = surface;
  let ink = text;
  let mark: WorkoutDayNodeVisual['mark'] = 'none';
  if (state === 'done') {
    fill = doneFill;
    ink = doneInk;
    mark = 'check';
  } else if (state === 'rest') {
    fill = surfaceSunken;
    ink = outline;
    mark = 'moon';
  } else if (state === 'planned') {
    mark = 'dot';
  }

  return {
    fill,
    borderColor: state === 'done' ? doneFill : outline,
    borderWidth: state === 'done' ? 2 : 1.5,
    ink,
    markInk: state === 'done' ? doneMark : outline,
    mark,
    selectionRing: selected ? HUE.lip : null,
    selectionRingWidth: DAY_NODE_RING_WIDTH,
    selectionRingInset: DAY_NODE_RING_INSET,
  };
}

export type QuickStartCardVisual = {
  /** Tile behind the dumbbell glyph (§5.1 tint wash over the theme surface). */
  iconTile: string;
  /** Dumbbell glyph ink on that tile (accent text, ≥4.5:1). */
  iconInk: string;
};

/**
 * Quick-start routine card lede: the dumbbell hero icon sits on the Coral tint
 * wash. Coral bright itself is 2.16–2.83:1 on a surface, so the glyph uses the
 * theme accent TEXT tier, which the accent resolver already keeps ≥4.5:1 on
 * tinted surfaces.
 */
export function quickStartCardVisual(input: { accentText: string }): QuickStartCardVisual {
  return {
    iconTile: `${HUE.bright}22`,
    iconInk: input.accentText,
  };
}
