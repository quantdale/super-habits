/**
 * Unit tests for the segmented-control navigation model (pure logic used by
 * `core/ui/SegmentedControl.tsx` web arrow-key handling).
 */
import { describe, expect, it } from 'vitest';
import { nextSegmentValue } from '../core/ui/segmentedControl.model';

const OPTIONS = [
  { value: 'today' },
  { value: 'projects' },
  { value: 'goals' },
  { value: 'progress' },
  { value: 'timeline' },
] as const;

describe('nextSegmentValue', () => {
  it('moves forward one option', () => {
    expect(nextSegmentValue(OPTIONS, 'today', 1)).toBe('projects');
  });

  it('moves backward one option', () => {
    expect(nextSegmentValue(OPTIONS, 'goals', -1)).toBe('projects');
  });

  it('wraps forward from the last option', () => {
    expect(nextSegmentValue(OPTIONS, 'timeline', 1)).toBe('today');
  });

  it('wraps backward from the first option', () => {
    expect(nextSegmentValue(OPTIONS, 'today', -1)).toBe('timeline');
  });

  it('skips disabled options', () => {
    const withDisabled = [{ value: 'a' }, { value: 'b', disabled: true }, { value: 'c' }] as const;
    expect(nextSegmentValue(withDisabled, 'a', 1)).toBe('c');
    expect(nextSegmentValue(withDisabled, 'c', -1)).toBe('a');
  });

  it('stays put when the only enabled option is current', () => {
    const single = [{ value: 'a' }, { value: 'b', disabled: true }] as const;
    expect(nextSegmentValue(single, 'a', 1)).toBe('a');
    expect(nextSegmentValue(single, 'a', -1)).toBe('a');
  });

  it('returns the first enabled option when the current value is disabled/unknown', () => {
    const withDisabled = [{ value: 'a', disabled: true }, { value: 'b' }] as const;
    expect(nextSegmentValue(withDisabled, 'a', 1)).toBe('b');
    expect(nextSegmentValue(OPTIONS, 'unknown' as 'today', 1)).toBe('today');
  });

  it('returns the current value when nothing is enabled', () => {
    const allDisabled = [{ value: 'a', disabled: true }] as const;
    expect(nextSegmentValue(allDisabled, 'a', 1)).toBe('a');
  });
});
