import { describe, expect, it } from 'vitest';
import {
  chipWrapWasClamped,
  clampChipWrap,
  CHIP_WRAP_MAX_LINES,
} from '@/features/calories/chipWrap';

/**
 * P17 acceptance: "Frequent foods as 2-line chip wrap" / "chip wrap ≤2 lines"
 * (docs/ui-ux/16-playful-momentum.md §7 Calories + §10 P17 row).
 *
 * The Calories quick-log card wraps food chips instead of truncating (SYS-18);
 * an unbounded catalog would push the entry form below the fold, so the wrap is
 * clamped to two rows with the overflow left reachable through "Browse saved
 * meals". The rule is pure so it is asserted here without a renderer; the
 * measurement driver is `useChipWrapClamp` and the E2E instrument is
 * `e2e/calories-p17-wrap.spec.ts`.
 */
describe('Calories chip wrap clamp (P17: ≤ 2 lines)', () => {
  it('keeps everything when all chips fit in one row', () => {
    const boxes = [
      { id: 'a', top: 0 },
      { id: 'b', top: 0 },
      { id: 'c', top: 0 },
    ];
    expect(clampChipWrap(boxes)).toEqual({ visibleIds: ['a', 'b', 'c'], hiddenCount: 0 });
  });

  it('keeps both permitted rows when the chips wrap onto two', () => {
    const boxes = [
      { id: 'a', top: 0 },
      { id: 'b', top: 0 },
      { id: 'c', top: 48 },
      { id: 'd', top: 48 },
    ];
    expect(clampChipWrap(boxes)).toEqual({
      visibleIds: ['a', 'b', 'c', 'd'],
      hiddenCount: 0,
    });
  });

  it('drops the third row onward and reports how many chips it hid', () => {
    const boxes = [
      { id: 'a', top: 0 },
      { id: 'b', top: 0 },
      { id: 'c', top: 48 },
      { id: 'd', top: 48 },
      { id: 'e', top: 96 },
      { id: 'f', top: 96 },
      { id: 'g', top: 144 },
    ];
    const clamp = clampChipWrap(boxes);
    expect(clamp.visibleIds).toEqual(['a', 'b', 'c', 'd']);
    expect(clamp.hiddenCount).toBe(3);
    expect(chipWrapWasClamped(clamp)).toBe(true);
  });

  it('preserves the original chip order in the surviving rows', () => {
    const boxes = [
      { id: 'z', top: 48 },
      { id: 'a', top: 0 },
      { id: 'm', top: 0 },
      { id: 'q', top: 96 },
    ];
    expect(clampChipWrap(boxes).visibleIds).toEqual(['z', 'a', 'm']);
  });

  it('treats sub-pixel row differences as one row (layout jitter is not a new line)', () => {
    const boxes = [
      { id: 'a', top: 0 },
      { id: 'b', top: 0.5 },
      { id: 'c', top: 44 },
    ];
    expect(clampChipWrap(boxes).hiddenCount).toBe(0);
  });

  it('renders everything until layout has measured (top 0 is not "row 0 of many")', () => {
    // A first paint reports 0 for every chip before layout settles; clamping on
    // that guess would hide content the user can still scroll to.
    expect(clampChipWrap([]).visibleIds).toEqual([]);
    const unmeasured = [
      { id: 'a', top: 0 },
      { id: 'b', top: 0 },
    ];
    expect(clampChipWrap(unmeasured).hiddenCount).toBe(0);
  });

  it('honours an explicit maxLines and coerces nonsensical limits safely', () => {
    const boxes = [
      { id: 'a', top: 0 },
      { id: 'b', top: 48 },
      { id: 'c', top: 96 },
    ];
    expect(clampChipWrap(boxes, 1)).toEqual({ visibleIds: ['a'], hiddenCount: 2 });
    expect(clampChipWrap(boxes, 0)).toEqual({ visibleIds: [], hiddenCount: 3 });
    expect(CHIP_WRAP_MAX_LINES).toBe(2);
  });
});
