import { readableAccent, tintOver } from '@/core/theme/contrast';
import { SECTION_HUES } from '@/constants/sectionColors';

/**
 * Pure visual models for Progress Insights (P21b, §5.1/§6).
 *
 * Progress lives inside the Planning Hub drawer, so its chrome is Sky
 * (`SECTION_HUES.todos`) exactly like the hub's own `SegmentedControl` and
 * like To Do: one hue per surface, and the window chips are the surface's only
 * colored controls. Metric values stay theme ink — a mid-tone section hue
 * measures ~2.2–2.8:1 on a white card, and a comparison is data, not a section
 * identity.
 *
 * The one hue on data is the comparison bar: a Sky **bright** track fill on a
 * `surfaceSunken` rail. No label is painted on the fill (the number beside it
 * carries the value, the bar carries proportion), so the §5.1 rule "never put
 * white text on `bright`" cannot be broken by a future row.
 *
 * Pure module: no React, no DB, no theme read. Callers pass resolved tokens so
 * every pair is unit-testable across the 14 themes
 * (`tests/secondarySurfaceVisual.test.ts`).
 */
const SKY = SECTION_HUES.todos;

/**
 * This window's share of the LARGER of the two windows, as a whole percent.
 * Using `max(current, previous)` rather than `current` alone means a decrease
 * still renders a truthful proportion (a drop to 3 from 12 shows the 3 at 25%
 * of the prior high-water mark) instead of a bar that reads as "finished".
 */
export function comparisonPercent(current: number, previous: number): number {
  const ceiling = Math.max(current, previous);
  if (!Number.isFinite(ceiling) || ceiling <= 0) return 0;
  const share = (current / ceiling) * 100;
  return Math.min(100, Math.max(0, Math.round(share)));
}

export type ProgressBarVisual = {
  /** Fill hue (§5.1 bright tier — a shape, never a text face). */
  fill: string;
  /** Recessed rail behind the fill. */
  track: string;
};

export function progressBarVisual(input: { surfaceSunken: string }): ProgressBarVisual {
  return { fill: SKY.bright, track: input.surfaceSunken };
}

export type ProgressChipVisual = {
  /** Selected chip face: the §5.1 tint mixed into the card face. */
  selectedFill: string;
  /**
   * Selected chip outline. P6 `Chip` paints its `color` prop as the active
   * border, and this screen hands it the Sky **bright** tier, so the model
   * mirrors that exactly rather than inventing a second boundary tier.
   */
  selectedBorder: string;
  /** Selected chip label — accent text floored at 4.5:1 on that tint. */
  selectedInk: string;
};

/**
 * Window chips. `Chip`/`PillChip` derives these same values inline (P6); the
 * model is replicated here so the contrast matrix asserts the pairs the screen
 * actually renders instead of trusting a copy of the component's formula to
 * stay in step.
 */
export function progressChipVisual(input: { appearance: 'light' | 'dark' }): ProgressChipVisual {
  const tintBase = input.appearance === 'dark' ? '#1A1F2B' : '#FFFFFF';
  const selectedFill = tintOver(tintBase, SKY.bright, input.appearance === 'dark' ? 0.18 : 0.14);
  return {
    selectedFill,
    selectedBorder: SKY.bright,
    selectedInk: readableAccent(SKY.bright, selectedFill),
  };
}
