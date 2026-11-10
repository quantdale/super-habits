import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SEGMENT_MIN_HEIGHT,
  MAX_SEGMENT_MIN_HEIGHT,
  resolveSegmentMinHeight,
  SEGMENT_TRACK_PADDING,
} from '@/core/ui/segmentedControl.model';

/**
 * CG-12 first slice (`docs/testing/known-gaps.md`): the Focus (pomodoro) mode
 * tabs must expose a >= 44 CSS px DOM box on web. react-native-web never
 * applies `hitSlop` to the DOM box (documented in `core/ui/PillChip.tsx`), so
 * the only honest fix is a taller FACE, and the only safe way to ship it is an
 * opt-in tier that leaves every other `SegmentedControl` caller untouched.
 *
 * This pins that tier's model: the default is bit-for-bit the V3 §6 geometry,
 * and the opt-in can only ever *raise* the face on web.
 */
describe('SegmentedControl segment sizing (CG-12)', () => {
  it('keeps the V3 §6 default: 36pt faces in a 40pt tray', () => {
    expect(DEFAULT_SEGMENT_MIN_HEIGHT).toBe(36);
    expect(SEGMENT_TRACK_PADDING).toBe(2);
    expect(DEFAULT_SEGMENT_MIN_HEIGHT + SEGMENT_TRACK_PADDING * 2).toBe(40);
  });

  it('resolves every non-opted caller to the untouched default on web', () => {
    expect(resolveSegmentMinHeight({ isWeb: true })).toBe(36);
    expect(resolveSegmentMinHeight({ minSegmentHeight: undefined, isWeb: true })).toBe(36);
  });

  it('ignores the opt-in off-web, where hitSlop still applies', () => {
    expect(resolveSegmentMinHeight({ minSegmentHeight: 44, isWeb: false })).toBe(36);
  });

  it('cannot lower the face: a sub-default request is the default', () => {
    for (const requested of [0, 20, 35, 36, -44]) {
      expect(resolveSegmentMinHeight({ minSegmentHeight: requested, isWeb: true })).toBe(36);
    }
  });

  it('cannot emit a garbage height', () => {
    for (const requested of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(resolveSegmentMinHeight({ minSegmentHeight: requested, isWeb: true })).toBe(36);
    }
  });

  it('honours the Focus opt-in and clamps it to the documented ceiling', () => {
    // What `features/pomodoro/PomodoroScreen.tsx` asks for: a real 44pt face
    // (48pt tray), not a slop.
    expect(resolveSegmentMinHeight({ minSegmentHeight: 44, isWeb: true })).toBe(44);
    expect(resolveSegmentMinHeight({ minSegmentHeight: 47.6, isWeb: true })).toBe(48);
    expect(resolveSegmentMinHeight({ minSegmentHeight: MAX_SEGMENT_MIN_HEIGHT, isWeb: true })).toBe(
      MAX_SEGMENT_MIN_HEIGHT,
    );
    expect(resolveSegmentMinHeight({ minSegmentHeight: 500, isWeb: true })).toBe(
      MAX_SEGMENT_MIN_HEIGHT,
    );
  });

  it('reaches the web 44px contract only through the opt-in tier', () => {
    const touchTarget = 44;
    const trayHeight = (face: number) => face + SEGMENT_TRACK_PADDING * 2;
    // Default callers keep the 40pt tray (CG-12 stays open for their surfaces).
    expect(trayHeight(resolveSegmentMinHeight({ isWeb: true }))).toBe(40);
    // Focus opts in: the face itself is the hit area, so it clears 44.
    expect(resolveSegmentMinHeight({ minSegmentHeight: 44, isWeb: true })).toBeGreaterThanOrEqual(
      touchTarget,
    );
  });
});
