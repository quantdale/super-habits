/**
 * Chip wrap line clamp (Playful Momentum P17, §7 "Calories": "Frequent foods as
 * 2-line chip wrap"; §6 Chip: "At most one row; overflow goes to a 'More' sheet").
 *
 * The Calories quick-log card renders content-hugging food chips that wrap
 * instead of truncating (SYS-18). A long saved-meal catalog can produce an
 * unbounded number of rows, which buries the entry form below the fold — so the
 * wrap is clamped to the P17 maximum of TWO lines and the rest stays reachable
 * through the card's existing "Browse saved meals" disclosure.
 *
 * Measurement, not guessing: the component reports each chip's laid-out top
 * edge relative to the wrap container, and this pure function decides which
 * rows survive. Kept pure and React-free so the rule is unit-testable
 * (`tests/caloriesChipWrap.test.ts`).
 */

export type ChipBox = {
  /** Stable identity (meal id, or a composite for frequent foods). */
  id: string;
  /** Laid-out top edge relative to the wrapping row, in px. */
  top: number;
};

export type ChipWrapClamp = {
  /** Ids that survive the clamp, in their original order. */
  visibleIds: string[];
  /** How many chips the clamp dropped (0 when everything fits). */
  hiddenCount: number;
};

/** P17 acceptance: the chip wrap never exceeds two lines. */
export const CHIP_WRAP_MAX_LINES = 2;

/**
 * Two boxes belong to the same row when their tops differ by less than half of
 * the smaller chip height — i.e. they overlap vertically rather than stacking.
 * Chips are laid out in a wrap row, so a row change always moves the top by at
 * least one chip height (≥40px), far above this tolerance.
 */
const ROW_TOP_TOLERANCE = 20;

/**
 * Keep the first `maxLines` rows of a wrapped chip list.
 *
 * Rows are recognised from the laid-out tops (post-layout order), so a
 * measurement that arrives before layout (`top === 0` for every box, or an
 * empty list) yields "all visible" — the clamp only removes chips once it
 * actually knows where they landed, never on a guess.
 */
export function clampChipWrap(
  boxes: readonly ChipBox[],
  maxLines: number = CHIP_WRAP_MAX_LINES,
): ChipWrapClamp {
  if (boxes.length === 0) return { visibleIds: [], hiddenCount: 0 };
  if (maxLines <= 0) return { visibleIds: [], hiddenCount: boxes.length };

  const unmeasured = boxes.every((box) => box.top === 0);
  if (unmeasured) {
    return { visibleIds: boxes.map((box) => box.id), hiddenCount: 0 };
  }

  // Distinct row tops in layout order; keep the first `maxLines` of them.
  const rowTops: number[] = [];
  for (const box of boxes) {
    const rowTop = rowTops.find((top) => Math.abs(top - box.top) < ROW_TOP_TOLERANCE);
    if (rowTop === undefined) rowTops.push(box.top);
  }
  const keptTops = rowTops.slice(0, maxLines);

  const visibleIds = boxes
    .filter((box) => keptTops.some((top) => Math.abs(top - box.top) < ROW_TOP_TOLERANCE))
    .map((box) => box.id);

  return { visibleIds, hiddenCount: boxes.length - visibleIds.length };
}

/** True when a clamp dropped chips (drives the caller's quiet "more" hint). */
export function chipWrapWasClamped(clamp: ChipWrapClamp): boolean {
  return clamp.hiddenCount > 0;
}

/**
 * Keep laid-out tops for chip ids that are still in the list. Used when the
 * catalog refreshes so retained chips do not wait for a layout event they may
 * never re-emit (React preserves them by key).
 */
export function retainChipTops(
  previousTops: Readonly<Record<string, number>>,
  ids: readonly string[],
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const id of ids) {
    if (previousTops[id] !== undefined) next[id] = previousTops[id];
  }
  return next;
}

/**
 * Decide whether a wrap-container width report should drop every chip top so
 * the list remasures. Equal widths are a no-op; the first report only records
 * the width (nothing to invalidate yet).
 */
export function wrapWidthRequiresRemeasure(
  previousWidth: number | null,
  nextWidth: number,
): boolean {
  if (previousWidth === null) return false;
  return previousWidth !== nextWidth;
}

/**
 * Identity for chip-wrap geometry. Ids alone miss label edits that change chip
 * width without changing identity (e.g. frequent-food count `9×` → `10×`); RN-web
 * size observers then skip row-only moves and leave stale clamps. Fold the
 * displayed labels into the key so those edits force a full remasure.
 */
export function chipWrapMeasurementKey(
  ids: readonly string[],
  labelSignature: string = '',
): string {
  return ids.join('\u0001') + '\u0002' + labelSignature;
}
