import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_PRESETS,
  findPresetById,
  normalizePomodoroPresets,
  shouldAutoStartNext,
  type PomodoroPreset,
} from '@/features/pomodoro/pomodoro.domain';

describe('normalizePomodoroPresets', () => {
  it('returns built-in presets for non-array input', () => {
    expect(normalizePomodoroPresets(null)).toEqual(BUILT_IN_PRESETS);
    expect(normalizePomodoroPresets('junk')).toEqual(BUILT_IN_PRESETS);
    expect(normalizePomodoroPresets({})).toEqual(BUILT_IN_PRESETS);
  });

  it('returns built-in presets for empty storage', () => {
    expect(normalizePomodoroPresets([])).toEqual(BUILT_IN_PRESETS);
  });

  it('drops malformed entries and keeps valid ones', () => {
    const result = normalizePomodoroPresets([
      null,
      'nope',
      { noId: true },
      {
        id: 'classic',
        name: 'Custom Classic',
        focusMinutes: 30,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        sessionsBeforeLongBreak: 4,
        autoStartBreaks: true,
        autoStartFocus: false,
      },
    ]);
    expect(result).toHaveLength(3); // classic + the two missing built-ins
    const classic = result.find((p) => p.id === 'classic');
    expect(classic?.name).toBe('Custom Classic');
    expect(classic?.focusMinutes).toBe(30);
    expect(classic?.autoStartBreaks).toBe(true);
    // Built-ins are always present.
    expect(result.map((p) => p.id)).toContain('deep');
    expect(result.map((p) => p.id)).toContain('sprint');
  });

  it('clamps out-of-range values to fallbacks', () => {
    const result = normalizePomodoroPresets([
      { id: 'classic', focusMinutes: 999, shortBreakMinutes: -5, sessionsBeforeLongBreak: 1 },
    ]);
    const classic = result[0];
    expect(classic.focusMinutes).toBe(25);
    expect(classic.shortBreakMinutes).toBe(5);
    expect(classic.sessionsBeforeLongBreak).toBe(4);
  });

  it('deduplicates by id keeping the first occurrence', () => {
    const result = normalizePomodoroPresets([
      { id: 'classic', name: 'First' },
      { id: 'classic', name: 'Second' },
    ]);
    expect(result.filter((p) => p.id === 'classic')).toHaveLength(1);
    expect(result.find((p) => p.id === 'classic')?.name).toBe('First');
  });

  it('accepts custom (non-builtin) ids with sane defaults', () => {
    const result = normalizePomodoroPresets([{ id: 'custom-1', name: 'Mine' }]);
    const custom = result.find((p) => p.id === 'custom-1');
    expect(custom?.focusMinutes).toBe(25);
    expect(custom?.autoStartFocus).toBe(false);
  });
});

describe('findPresetById', () => {
  it('finds a preset by id', () => {
    expect(findPresetById(BUILT_IN_PRESETS, 'deep')?.name).toBe('Deep Work');
  });

  it('returns null for missing/null id', () => {
    expect(findPresetById(BUILT_IN_PRESETS, 'missing')).toBeNull();
    expect(findPresetById(BUILT_IN_PRESETS, null)).toBeNull();
    expect(findPresetById(BUILT_IN_PRESETS, undefined)).toBeNull();
  });
});

describe('shouldAutoStartNext', () => {
  const preset: PomodoroPreset = {
    ...BUILT_IN_PRESETS[0],
    autoStartBreaks: true,
    autoStartFocus: false,
  };

  it('uses autoStartBreaks after focus completes', () => {
    expect(shouldAutoStartNext('focus', preset)).toBe(true);
  });

  it('uses autoStartFocus after breaks complete', () => {
    expect(shouldAutoStartNext('short_break', preset)).toBe(false);
    expect(shouldAutoStartNext('long_break', preset)).toBe(false);
  });
});
