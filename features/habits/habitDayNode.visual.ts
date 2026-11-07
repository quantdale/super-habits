import { inkOnFill, readableSurface } from '@/core/theme/contrast';
import { SECTION_HUES, SECTION_ON_BRIGHT_INK } from '@/constants/sectionColors';

/**
 * Visual model for one day node, factored out of `HabitDayStrip`'s JSX so the
 * selection × completion combinations are testable as values (the repository
 * has no React renderer for component tests).
 *
 * Codex P2 on #193: selection must never be expressed only by the completed
 * fill. When a day is both selected and complete, completion used to win every
 * property (fill, border, label ink), so picking a done day produced NO visible
 * change. Completion keeps the §5.1 Sprout face and its ink; selection adds an
 * inner ring in the Sprout `lip` tier — a token that is independent of the
 * completed `bright` fill (3.83:1 against it, past the 3:1 non-text floor) and
 * theme-invariant, so a selected done day stays distinct in every theme without
 * touching the unselected or non-complete states.
 *
 * Pure module: no React, no DB, no theme read — callers pass the resolved
 * tokens, so the derivation can be asserted in unit tests.
 */
const HUE = SECTION_HUES.habits;

export type HabitDayNodeVisual = {
  fill: string;
  borderColor: string;
  borderWidth: number;
  lip: string;
  ink: string;
  /** Inner selection ring; `null` unless the node is selected AND complete. */
  selectionRing: string | null;
  selectionRingWidth: number;
  /** Inset from the face edge, so the ring hugs the border and clears the glyphs. */
  selectionRingInset: number;
};

/**
 * Geometry of the inner selection ring, in logical points. The face is 44pt
 * with a 1-2pt border, so a 2pt ring inset 1pt rides just inside the border and
 * leaves the 40pt centre free for the weekday + date glyphs.
 */
export const SELECTION_RING_WIDTH = 2;
export const SELECTION_RING_INSET = 1;

export function habitDayNodeVisual(input: {
  allComplete: boolean;
  selected: boolean;
  isToday: boolean;
  surface: string;
  border: string;
  text: string;
  onSolid: string;
}): HabitDayNodeVisual {
  const { allComplete, selected, isToday, surface, border, text, onSolid } = input;
  const activeFill = readableSurface(HUE.bright, onSolid);
  // The done face is the FIXED §5.1 Sprout bright, which is not theme-aware, so
  // the label ink must be chosen against that actual fill — not against the
  // theme. `tokens.text` reads 7.19:1 on it in the light default but only
  // 2.00:1 in dark, so light keeps its native ink and dark falls back to the
  // §5.1 bright-fill ink (8.61:1).
  const doneInk = inkOnFill(HUE.bright, text, SECTION_ON_BRIGHT_INK);
  return {
    fill: allComplete ? HUE.bright : selected ? activeFill : surface,
    lip: allComplete ? HUE.lip : 'transparent',
    borderWidth: isToday ? 2 : 1,
    borderColor: isToday
      ? allComplete
        ? HUE.solid
        : HUE.bright
      : allComplete
        ? HUE.bright
        : selected
          ? activeFill
          : border,
    // Selected fills the `readableSurface` deep tint, whose whole purpose is to
    // be dark enough for `onSolid` (white clears 5.41:1 there).
    ink: allComplete ? doneInk : selected ? onSolid : text,
    // ONLY the combination that had no visual difference: completion wins the
    // fill, so selection needs its own shape-coded mark. A selected
    // non-completed day already changes fill (readableSurface) and an
    // unselected day is untouched, so neither gets a ring — that keeps the
    // existing goldens and states exactly as they were.
    selectionRing: allComplete && selected ? HUE.lip : null,
    selectionRingWidth: SELECTION_RING_WIDTH,
    selectionRingInset: SELECTION_RING_INSET,
  };
}
