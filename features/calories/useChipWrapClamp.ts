import { useCallback, useMemo, useState } from 'react';
import {
  clampChipWrap,
  CHIP_WRAP_MAX_LINES,
  retainChipTops,
  wrapWidthRequiresRemeasure,
  type ChipBox,
} from './chipWrap';

type Measurement = {
  /** Identity of the chip list this geometry belongs to. */
  key: string;
  tops: Record<string, number>;
  /** Last observed wrap-container width; null until the first layout. */
  width: number | null;
  /**
   * Bumped whenever width invalidates geometry so chip views remount and
   * always re-emit onLayout (RN/web may skip layout for content-hugging
   * chips that only change row).
   */
  generation: number;
};

/**
 * Measure-and-clamp driver for the Calories chip wrap (P17 §7 "Frequent foods
 * as 2-line chip wrap").
 *
 * The decision itself is the pure `clampChipWrap`; this hook only owns the
 * layout measurement, so the rule stays unit-testable without a renderer.
 * Chips report their laid-out `y` through `onChipLayout(id, y)`; until every
 * chip has reported, `visibleIds` is `null` and the caller renders all of them
 * (a first paint must never hide content it has not measured).
 *
 * Width changes (rotation, responsive breakpoints) clear every top and bump
 * `generation` so previously hidden chips remount, remasure, and can re-enter
 * the two-line window. Id-list refreshes keep tops for retained ids so chips
 * React preserves by key do not leave the clamp stuck waiting for a layout
 * event they will not re-emit.
 */
export function useChipWrapClamp(ids: readonly string[], maxLines = CHIP_WRAP_MAX_LINES) {
  const key = ids.join('\u0001');
  const [measurement, setMeasurement] = useState<Measurement>({
    key,
    tops: {},
    width: null,
    generation: 0,
  });

  const onChipLayout = useCallback(
    (id: string, top: number) => {
      setMeasurement((previous) => {
        const baseTops = previous.key === key ? previous.tops : retainChipTops(previous.tops, ids);
        if (previous.key === key && baseTops[id] === top) {
          return previous;
        }
        return {
          key,
          tops: { ...baseTops, [id]: top },
          width: previous.width,
          generation: previous.generation,
        };
      });
    },
    [key, ids],
  );

  const onWrapLayout = useCallback(
    (width: number) => {
      setMeasurement((previous) => {
        if (!wrapWidthRequiresRemeasure(previous.width, width)) {
          if (previous.width === width && previous.key === key) return previous;
          // First width report: record it without clearing tops.
          return {
            key: previous.key === key ? previous.key : key,
            tops: previous.key === key ? previous.tops : retainChipTops(previous.tops, ids),
            width,
            generation: previous.generation,
          };
        }
        // Width changed: drop geometry and remount chips for a full remasure.
        return { key, tops: {}, width, generation: previous.generation + 1 };
      });
    },
    [key, ids],
  );

  const tops = useMemo(() => {
    if (measurement.key === key) return measurement.tops;
    return retainChipTops(measurement.tops, ids);
  }, [measurement, key, ids]);

  const { visibleIds, hiddenCount } = useMemo(() => {
    const boxes: ChipBox[] = ids.map((id) => ({ id, top: tops[id] ?? 0 }));
    const fullyMeasured = ids.every((id) => tops[id] !== undefined);
    if (!fullyMeasured) {
      return { visibleIds: null as string[] | null, hiddenCount: 0 };
    }
    return clampChipWrap(boxes, maxLines);
  }, [ids, maxLines, tops]);

  return {
    visibleIds,
    hiddenCount,
    onChipLayout,
    onWrapLayout,
    /** Include in chip keys so a width invalidation remounts every chip. */
    layoutGeneration: measurement.generation,
  };
}
