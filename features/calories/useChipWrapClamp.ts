import { useCallback, useMemo, useState } from 'react';
import { clampChipWrap, CHIP_WRAP_MAX_LINES, type ChipBox } from './chipWrap';

type Measurement = {
  /** Identity of the chip list this geometry belongs to. */
  key: string;
  tops: Record<string, number>;
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
 * State, not a ref: the clamp result IS render output, so geometry lives in
 * state and a measurement that changed nothing schedules no update. The
 * measurement is keyed by the id list, so a different chip set (a new saved meal
 * or a re-ordered frequent set) discards the stale geometry instead of
 * clamping the new list with the old chip's rows.
 */
export function useChipWrapClamp(ids: readonly string[], maxLines = CHIP_WRAP_MAX_LINES) {
  const key = ids.join('\u0001');
  const [measurement, setMeasurement] = useState<Measurement>({ key, tops: {} });
  // A stale key (the chip list changed since the last measurement) reads as
  // "nothing measured yet"; computed inside the memo below so this render-time
  // fallback is not a `useMemo` dependency that changes every render.
  const currentKey = measurement.key === key ? key : null;

  const onChipLayout = useCallback(
    (id: string, top: number) => {
      setMeasurement((previous) => {
        const base = previous.key === key ? previous : { key, tops: {} };
        if (base.tops[id] === top) return base;
        return { key, tops: { ...base.tops, [id]: top } };
      });
    },
    [key],
  );

  const { visibleIds, hiddenCount } = useMemo(() => {
    const tops = currentKey === key ? measurement.tops : {};
    const boxes: ChipBox[] = ids.map((id) => ({ id, top: tops[id] ?? 0 }));
    const fullyMeasured = ids.every((id) => tops[id] !== undefined);
    if (!fullyMeasured) {
      // Unmeasured: render everything. A clamp may only ever remove chips it
      // has actually located.
      return { visibleIds: null as string[] | null, hiddenCount: 0 };
    }
    return clampChipWrap(boxes, maxLines);
  }, [currentKey, key, ids, maxLines, measurement]);

  return { visibleIds, hiddenCount, onChipLayout };
}
