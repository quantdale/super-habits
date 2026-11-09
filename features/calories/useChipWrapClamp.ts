import { useCallback, useMemo, useState } from 'react';
import {
  clampChipWrap,
  CHIP_WRAP_MAX_LINES,
  chipWrapMeasurementKey,
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
   * Bumped whenever geometry invalidates so chip views remount and always
   * re-emit onLayout (RN/web may skip layout for content-hugging chips that
   * only change row).
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
 * Width changes, id-list refreshes, and displayed-label changes all clear
 * every top and bump `generation` so chips remount and remasure. Label text is
 * part of the measurement key because a count like `9×` → `10×` can widen a
 * chip and reflow rows without changing ids; RN-web size observers then skip
 * row-only moves and would leave a stale clamp.
 */
export function useChipWrapClamp(
  ids: readonly string[],
  maxLines = CHIP_WRAP_MAX_LINES,
  labelSignature = '',
) {
  const key = chipWrapMeasurementKey(ids, labelSignature);
  const [measurement, setMeasurement] = useState<Measurement>({
    key,
    tops: {},
    width: null,
    generation: 0,
  });

  const onChipLayout = useCallback(
    (id: string, top: number) => {
      setMeasurement((previous) => {
        // Key change (ids or labels): drop tops and bump generation so retained
        // chips remount and re-emit layout.
        if (previous.key !== key) {
          return {
            key,
            tops: { [id]: top },
            width: previous.width,
            generation: previous.generation + 1,
          };
        }
        if (previous.tops[id] === top) return previous;
        return {
          key,
          tops: { ...previous.tops, [id]: top },
          width: previous.width,
          generation: previous.generation,
        };
      });
    },
    [key],
  );

  const onWrapLayout = useCallback(
    (width: number) => {
      setMeasurement((previous) => {
        if (!wrapWidthRequiresRemeasure(previous.width, width)) {
          if (previous.width === width && previous.key === key) return previous;
          if (previous.key !== key) {
            return {
              key,
              tops: {},
              width,
              generation: previous.generation + 1,
            };
          }
          return {
            key,
            tops: previous.tops,
            width,
            generation: previous.generation,
          };
        }
        return { key, tops: {}, width, generation: previous.generation + 1 };
      });
    },
    [key],
  );

  const tops = useMemo(() => {
    if (measurement.key !== key) return {};
    return measurement.tops;
  }, [measurement, key]);

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
    layoutGeneration: measurement.generation,
  };
}
