import { size } from '@/core/theme/designTokens';

/**
 * Pure segmented-control navigation model (no React): computes the next
 * selected value for web arrow-key navigation with wrap-around, skipping
 * disabled options.
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

/** The V3 §6 default: 36pt segment faces inside a 40pt (36 + 2x2) tray. */
export const DEFAULT_SEGMENT_MIN_HEIGHT = 36;

/** Tray padding top/bottom around the segment faces (§6). */
export const SEGMENT_TRACK_PADDING = 2;

/**
 * Upper bound on a requested face height, so a runaway value cannot silently
 * turn a compact tray into a hero surface. 52 is the largest face that keeps
 * the tray inside the phone-width layouts the responsive sweep measures; the
 * sweep's active no-overflow case is what would catch a genuine overrun.
 */
export const MAX_SEGMENT_MIN_HEIGHT = 52;

/**
 * Resolve the requested minimum segment height into a safe, ordered value.
 *
 * Contract this exists to keep (CG-12): the tier is a LAYOUT tier, not a
 * `hitSlop` tier. react-native-web never applies `hitSlop` to the DOM box, so
 * the only way a segment's real hit area reaches 44 CSS px on web is for the
 * face itself to be at least 44. All web callers get that real floor, including
 * omitted/invalid requests; native retains the compact 36pt face plus hitSlop.
 */
export function resolveSegmentMinHeight(request: {
  minSegmentHeight?: number;
  isWeb: boolean;
}): number {
  const { minSegmentHeight, isWeb } = request;
  if (!isWeb) return DEFAULT_SEGMENT_MIN_HEIGHT;
  if (minSegmentHeight === undefined || !Number.isFinite(minSegmentHeight))
    return size.webTouchTargetMin;
  return Math.min(
    Math.max(Math.round(minSegmentHeight), size.webTouchTargetMin),
    MAX_SEGMENT_MIN_HEIGHT,
  );
}
