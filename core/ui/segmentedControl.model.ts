/**
 * Pure segmented-control navigation model (no React): computes the next
 * selected value for web arrow-key navigation with wrap-around, skipping
 * disabled options. Unit-tested in `tests/segmented-control.model.test.ts`.
 */
export type SegmentOptionLike<T extends string> = {
  value: T;
  disabled?: boolean;
};

/**
 * Next value when the user presses Left (-1) or Right (+1) on a segmented
 * control. Wraps around at the ends and skips disabled options. Returns the
 * current value when there is nothing enabled to move to, or when the
 * current value is itself the only enabled option.
 */
export function nextSegmentValue<T extends string>(
  options: readonly SegmentOptionLike<T>[],
  currentValue: T,
  direction: -1 | 1,
): T {
  const enabled = options.filter((option) => !option.disabled);
  if (enabled.length === 0) return currentValue;
  const currentIndex = enabled.findIndex((option) => option.value === currentValue);
  if (currentIndex < 0) return enabled[0].value;
  if (enabled.length === 1) return enabled[0].value;
  const nextIndex = (currentIndex + direction + enabled.length) % enabled.length;
  return enabled[nextIndex].value;
}
