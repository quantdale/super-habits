import { inkOnFill, tintOver, WCAG_AA_NON_TEXT, WCAG_AA_TEXT } from '@/core/theme/contrast';
import { REWARD_HUES, SECTION_HUES, SECTION_ON_BRIGHT_INK } from '@/constants/sectionColors';

/**
 * Pure visual models for the Planning Hub + Weekly Review surfaces (P21 part A,
 * docs/ui-ux/16-playful-momentum.md §5.1/§5.7/§6 and the §7 "Weekly Review" line).
 *
 * Two hue decisions, both forced by §5.1's rules:
 * - The Planning Hub reads as the **Sky** surface. Every planning surface in the
 *   repo (hub view switcher, objective rows, guided flow) already used Sky; §5.1
 *   reserves Gold for the reward layer ("Gold and Flame appear only on reward
 *   elements"), so planning must never paint a Gold button or Gold text.
 * - The Weekly Review is the "you vs your past weeks" reflection surface, so it
 *   leans on the reward **Gold** as a *tint wash + bright shape* only (never as a
 *   label or a button face, which §5.1 forbids outside XP/reward elements).
 *
 * Every helper resolves its ink against the ACTUAL fill it is painted on: a tint
 * wash or hue face is hue-fixed (it does not follow the theme), so theme-derived
 * ink lands below 4.5:1 on it in several of the 14 themes. Pure module — no
 * React, no DB, no theme read — so `tests/planningContrast.test.ts` can assert
 * every pair across all 14 themes.
 */
const SKY = SECTION_HUES.todos;
const GOLD = REWARD_HUES.accent;

export type PlanningTone = 'sky' | 'gold';

/** Hue triple a planning tone paints with (tint + shape + lip). */
export const PLANNING_TONE_HUES = {
  sky: { bright: SKY.bright, solid: SKY.solid, lip: SKY.lip, text: SKY.solid },
  gold: { bright: GOLD.bright, solid: GOLD.text, lip: GOLD.lip, text: GOLD.text },
} as const satisfies Record<
  PlanningTone,
  { bright: string; solid: string; lip: string; text: string }
>;

/** Exposed for tests: the planning (Sky) hue pair. */
export const PLANNING_SKY = SKY;
/** Exposed for tests: the reflective review (Gold) hue pair. */
export const PLANNING_GOLD = GOLD;

/**
 * Selected/exposed face for a tone: the §6 tint recipe (hue mixed 14% into
 * white in light, 18% into `#1A1F2B` in dark), identical to `OptionRow`'s, so a
 * planning row matches every other selected row in the app.
 */
export function planningTintFace(tone: PlanningTone, appearance: 'light' | 'dark'): string {
  const base = appearance === 'dark' ? '#1A1F2B' : '#FFFFFF';
  return tintOver(base, PLANNING_TONE_HUES[tone].bright, appearance === 'dark' ? 0.18 : 0.14);
}

/**
 * Colored-text tier for a tone on the plain theme surface: §5.1 paints the
 * `solid` hue as text on light surfaces and the `bright` hue on dark ones.
 * Gold never paints text outside reward surfaces, so its `text` tier is used
 * (the reward-ink brown) instead of Gold itself.
 *
 * Non-`light` themes keep their own canvas character (Nord is a mid-tone slate,
 * not a white canvas), so the tier is resolved against the ACTUAL surface: the
 * preferred tier is kept where it clears 4.5:1 and floored to the theme text ink
 * where it does not (the contract `features/settings` already uses for accents
 * on a themed canvas).
 */
export function planningToneText(input: {
  tone: PlanningTone;
  appearance: 'light' | 'dark';
  surface: string;
  text: string;
}): string {
  const { tone, appearance, surface, text } = input;
  const preferred = tone === 'gold' ? GOLD.text : appearance === 'dark' ? SKY.bright : SKY.solid;
  return inkOnFill(surface, preferred, text, WCAG_AA_TEXT);
}

export type PlanningRowVisual = {
  /** Row face (tint when selected, theme surface otherwise). */
  face: string;
  /** 2px border — hue when selected, `border` otherwise. */
  border: string;
  /** 3px lip under the row (hue lip when selected). */
  lip: string;
  /** Label ink on `face`. */
  ink: string;
  /** State-mark (check/dot glyph) ink on `face`, ≥3:1. */
  mark: string;
  /** Trailing check-badge fill (the hue bright shape). */
  badgeFill: string;
  /** Glyph ink inside the badge (§5.1 bright ink). */
  badgeInk: string;
};

/**
 * One selectable planning row (guided-flow priority row, weekly-review decision
 * row). Unselected rows keep the quiet theme surface so a long list stays
 * scannable; selected rows take the hue tint, a 2px hue border and the hue lip,
 * exactly like `OptionRow`.
 */
export function planningRowVisual(input: {
  tone: PlanningTone;
  selected: boolean;
  appearance: 'light' | 'dark';
  surface: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
}): PlanningRowVisual {
  const { tone, selected, appearance, surface, border, borderStrong, text } = input;
  const hue = PLANNING_TONE_HUES[tone];
  const face = selected ? planningTintFace(tone, appearance) : surface;
  // Selection paints the hue tint, so the label must resolve against THAT wash
  // (Sky solid is 4.34:1 on the Sky tint on white, and the dark tint inverts the
  // preferred tier). The label is floored on the wash; the unselected row stays
  // the plain theme surface ink.
  const preferred = planningToneText({ tone, appearance, surface, text });
  const ink = selected ? inkOnFill(face, preferred, text, WCAG_AA_TEXT) : preferred;
  return {
    face,
    border: selected ? inkOnFill(face, hue.solid, hue.bright, WCAG_AA_NON_TEXT) : border,
    lip: selected ? hue.lip : borderStrong,
    ink,
    mark: inkOnFill(face, ink, text, WCAG_AA_NON_TEXT),
    badgeFill: hue.bright,
    badgeInk: SECTION_ON_BRIGHT_INK,
  };
}

export type PlanningStatTileVisual = {
  /** Tile face: the hue tint wash. */
  face: string;
  /** Tile outline: hue solid floored to the 3:1 component boundary. */
  border: string;
  /** Value ink on the tint wash (≥4.5:1). */
  ink: string;
  /** Caption ink on the tint wash (≥4.5:1). */
  caption: string;
};

/**
 * Briefing stat tile — the §6 "section tint + solid glyph" rhythm as one flat
 * tile. The §5.1 table's key insight is that a hue's **solid** tier is what
 * clears 4.5:1 on its own `tintLight` wash; resolving through
 * `readableAccent`/`inkOnFill` keeps the pair valid even for themes that
 * override their section accents.
 */
export function planningStatTileVisual(input: {
  tone: PlanningTone;
  appearance: 'light' | 'dark';
  surface: string;
  text: string;
  textMuted: string;
}): PlanningStatTileVisual {
  const { tone, appearance, surface, text, textMuted } = input;
  const face = planningTintFace(tone, appearance);
  return {
    face,
    border: inkOnFill(surface, PLANNING_TONE_HUES[tone].solid, text, WCAG_AA_NON_TEXT),
    ink: inkOnFill(face, planningToneText({ tone, appearance, surface, text }), text, WCAG_AA_TEXT),
    caption: inkOnFill(face, textMuted, text, WCAG_AA_TEXT),
  };
}

export type PlanningStatusVisual = {
  ink: string;
  face: string;
  border: string;
  icon: string;
  /** Quiet supporting line ink on `face` (floored like `ink`). */
  mutedInk: string;
};

/**
 * Quiet inline status banner (success "Today's plan is set.", warning
 * "A review for this week already exists", danger write failures). §5.2 maps
 * success→Sprout, warning→Gold, danger→Cherry; the theme tokens already carry
 * those trio values, so this helper only *floors* the ink against the ACTUAL
 * face and resolves the outline to the 3:1 component boundary.
 */
export function planningStatusVisual(input: {
  face: string;
  surface: string;
  text: string;
  textMuted: string;
  ink: string;
  border: string;
  solid: string;
}): PlanningStatusVisual {
  const ink = inkOnFill(input.face, input.ink, input.text, WCAG_AA_TEXT);
  return {
    ink,
    face: input.face,
    // A themed banner's own outline is often a tint wash (Gold's `#FFD699` is
    // 1.3:1 on white), so the boundary is resolved against the SURFACE rather
    // than trusted from the token trio (the P13 lesson: `tokens.border` there
    // measures 1.25–1.48:1).
    border: inkOnFill(input.surface, input.solid, input.text, WCAG_AA_NON_TEXT),
    icon: ink,
    // A supporting line inside the wash must not fall back to `textMuted`
    // blind: on a saturated wash a mid-tone theme's muted ink drops to ~4.2:1.
    mutedInk: inkOnFill(input.face, input.textMuted, input.text, WCAG_AA_TEXT),
  };
}

/**
 * Step-progress node fill (labelled multi-step flows: guided planning, weekly
 * review). §5.8 keeps celebration vocabulary for real milestones, so the step
 * strip stays a quiet progress affordance: reached nodes take the hue bright
 * face (ink check), unreached nodes take the theme's sunken track.
 */
export function planningStepNodeFill(input: {
  tone: PlanningTone;
  appearance: 'light' | 'dark';
  surfaceSunken: string;
  reached: boolean;
}): string {
  return input.reached ? PLANNING_TONE_HUES[input.tone].bright : input.surfaceSunken;
}

/** Glyph ink for a step node: bright faces take §5.1 bright ink, rest stay muted. */
export function planningStepNodeInk(input: { reached: boolean; textMuted: string }): string {
  return input.reached ? SECTION_ON_BRIGHT_INK : input.textMuted;
}

/**
 * The one primary CTA face on a planning surface. Sky's `solid` tier carries a
 * white label at 5.19:1 in every theme (§5.1), so the Sky surface keeps ONE
 * consistent primary face rather than flipping tiers per appearance.
 */
export function planningPrimaryFace(tone: PlanningTone = 'sky'): string {
  return tone === 'gold' ? GOLD.bright : SKY.solid;
}
