import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  nextPomodoroState,
  calculateGrowthProgress,
  getPlantStage,
  formatSessionTime,
  formatSessionDuration,
  getModeDuration,
  getNextMode,
  getModeLabel,
  getModeColor,
  parseMinutesSeconds,
  DEFAULT_SETTINGS,
  BUILT_IN_PRESETS,
  buildPomodoroHeatmapDays,
  applySettingsToTimerState,
  computePomodoroStreakFromHeatmapDays,
  matchPresetBySettings,
  planActiveTimerReconcile,
  planSessionCompletion,
  resolveActivePreset,
  type ActiveTimerIntent,
} from '@/features/pomodoro/pomodoro.domain';
import type { PomodoroSession } from '@/core/db/types';
import { toDateKey } from '@/lib/time';

describe('getModeColor', () => {
  it('returns brand classes for focus', () => {
    expect(getModeColor('focus')).toEqual({
      bg: 'bg-brand-500',
      text: 'text-brand-500',
      bar: 'bg-brand-500',
    });
  });

  it('returns emerald classes for short break', () => {
    expect(getModeColor('short_break')).toEqual({
      bg: 'bg-emerald-500',
      text: 'text-emerald-500',
      bar: 'bg-emerald-500',
    });
  });

  it('returns violet classes for long break', () => {
    expect(getModeColor('long_break')).toEqual({
      bg: 'bg-violet-500',
      text: 'text-violet-500',
      bar: 'bg-violet-500',
    });
  });
});

describe('nextPomodoroState', () => {
  it('returns finished at zero', () => {
    expect(nextPomodoroState(0, true)).toBe('finished');
  });

  it('returns running when active', () => {
    expect(nextPomodoroState(300, true)).toBe('running');
  });

  it('returns idle when paused and remaining', () => {
    expect(nextPomodoroState(300, false)).toBe('idle');
  });
});

describe('calculateGrowthProgress', () => {
  it('returns 0 at full remaining (just started)', () => {
    expect(calculateGrowthProgress(1500, 1500)).toBe(0);
  });

  it('returns 1 at 0 remaining (complete)', () => {
    expect(calculateGrowthProgress(0, 1500)).toBe(1);
  });

  it('returns 0.5 at halfway', () => {
    expect(calculateGrowthProgress(750, 1500)).toBe(0.5);
  });

  it('clamps to 0 if remaining exceeds total', () => {
    expect(calculateGrowthProgress(2000, 1500)).toBe(0);
  });

  it('clamps to 1 if remaining is negative', () => {
    expect(calculateGrowthProgress(-10, 1500)).toBe(1);
  });
});

describe('getPlantStage', () => {
  it('seed at 0', () => expect(getPlantStage(0)).toBe('seed'));
  it('sprout at 0.2', () => expect(getPlantStage(0.2)).toBe('sprout'));
  it('seedling at 0.5', () => expect(getPlantStage(0.5)).toBe('seedling'));
  it('growing at 0.8', () => expect(getPlantStage(0.8)).toBe('growing'));
  it('grown at 1', () => expect(getPlantStage(1)).toBe('grown'));
});

describe('formatSessionDuration', () => {
  it('returns minutes with m suffix when seconds >= 60', () => {
    expect(formatSessionDuration(60)).toBe('1m');
    expect(formatSessionDuration(1500)).toBe('25m');
  });
  it('returns seconds with s suffix when seconds < 60', () => {
    expect(formatSessionDuration(0)).toBe('0s');
    expect(formatSessionDuration(45)).toBe('45s');
    expect(formatSessionDuration(59)).toBe('59s');
  });
});

describe('formatSessionTime', () => {
  it("returns 'Today HH:MM' for today's session", () => {
    const now = new Date().toISOString();
    expect(formatSessionTime(now)).toMatch(/^Today \d{2}:\d{2}$/);
  });

  it("returns 'Mon DD HH:MM' for past sessions", () => {
    const past = '2025-01-15T09:30:00.000Z';
    const result = formatSessionTime(past);
    expect(result).toMatch(/\d{2}:\d{2}$/);
  });
});

describe('getModeDuration', () => {
  it('returns focus duration in seconds', () => {
    expect(getModeDuration('focus', DEFAULT_SETTINGS)).toBe(25 * 60);
  });
  it('returns short break duration in seconds', () => {
    expect(getModeDuration('short_break', DEFAULT_SETTINGS)).toBe(5 * 60);
  });
  it('returns long break duration in seconds', () => {
    expect(getModeDuration('long_break', DEFAULT_SETTINGS)).toBe(15 * 60);
  });
  it('respects custom settings', () => {
    const custom = { ...DEFAULT_SETTINGS, focusMinutes: 50 };
    expect(getModeDuration('focus', custom)).toBe(50 * 60);
  });
});

describe('applySettingsToTimerState', () => {
  const updated = { ...DEFAULT_SETTINGS, focusMinutes: 40 };

  it('updates an idle timer to the new mode duration', () => {
    expect(
      applySettingsToTimerState(updated, {
        currentMode: 'focus',
        isRunning: false,
        isPaused: false,
        totalSeconds: 25 * 60,
        remaining: 25 * 60,
      }),
    ).toEqual({ settings: updated, totalSeconds: 40 * 60, remaining: 40 * 60 });
  });

  it('keeps a running timer state while updating settings', () => {
    expect(
      applySettingsToTimerState(updated, {
        currentMode: 'focus',
        isRunning: true,
        isPaused: false,
        totalSeconds: 25 * 60,
        remaining: 21 * 60,
      }),
    ).toEqual({ settings: updated, totalSeconds: 25 * 60, remaining: 21 * 60 });
  });

  it('keeps a paused timer state while updating settings', () => {
    expect(
      applySettingsToTimerState(updated, {
        currentMode: 'focus',
        isRunning: false,
        isPaused: true,
        totalSeconds: 25 * 60,
        remaining: 18 * 60 + 12,
      }),
    ).toEqual({ settings: updated, totalSeconds: 25 * 60, remaining: 18 * 60 + 12 });
  });
});

describe('getNextMode', () => {
  it('focus → short_break at 0 sessions (never long_break at start)', () => {
    expect(getNextMode('focus', 0, DEFAULT_SETTINGS)).toBe('short_break');
  });
  it('focus → short_break when zero completed sessions for any sessionsBeforeLongBreak', () => {
    for (const n of [1, 2, 3, 4, 8]) {
      const settings = { ...DEFAULT_SETTINGS, sessionsBeforeLongBreak: n };
      expect(getNextMode('focus', 0, settings)).toBe('short_break');
    }
  });
  it('focus → long_break only after 4 completed sessions', () => {
    expect(getNextMode('focus', 4, DEFAULT_SETTINGS)).toBe('long_break');
  });
  it('focus → short_break at 1 session', () => {
    expect(getNextMode('focus', 1, DEFAULT_SETTINGS)).toBe('short_break');
  });
  it('short_break → focus', () => {
    expect(getNextMode('short_break', 1, DEFAULT_SETTINGS)).toBe('focus');
  });
  it('long_break → focus', () => {
    expect(getNextMode('long_break', 4, DEFAULT_SETTINGS)).toBe('focus');
  });
  it('respects custom sessionsBeforeLongBreak', () => {
    const custom = { ...DEFAULT_SETTINGS, sessionsBeforeLongBreak: 2 };
    expect(getNextMode('focus', 2, custom)).toBe('long_break');
    expect(getNextMode('focus', 1, custom)).toBe('short_break');
  });
});

describe('getModeLabel', () => {
  it('returns correct labels', () => {
    expect(getModeLabel('focus')).toBe('Focus');
    expect(getModeLabel('short_break')).toBe('Short Break');
    expect(getModeLabel('long_break')).toBe('Long Break');
  });
});

describe('parseMinutesSeconds', () => {
  it('returns null for malformed input', () => {
    expect(parseMinutesSeconds('abc')).toBeNull();
    expect(parseMinutesSeconds('12:')).toBeNull();
    expect(parseMinutesSeconds(':34')).toBeNull();
    expect(parseMinutesSeconds('12:60')).toBeNull();
    expect(parseMinutesSeconds('-1:30')).toBeNull();
  });
  it('parses valid input', () => {
    expect(parseMinutesSeconds('1:30')).toEqual({ minutes: 1, seconds: 30 });
  });
  it('parses valid MM:SS', () => {
    expect(parseMinutesSeconds('25:00')).toEqual({ minutes: 25, seconds: 0 });
    expect(parseMinutesSeconds('5:30')).toEqual({ minutes: 5, seconds: 30 });
  });
  it('returns null for invalid input', () => {
    expect(parseMinutesSeconds('abc')).toBeNull();
    expect(parseMinutesSeconds('25')).toBeNull();
    expect(parseMinutesSeconds('5:99')).toBeNull();
  });
});

function pomSession(startedAt: string): PomodoroSession {
  return {
    id: 'pom_test',
    started_at: startedAt,
    ended_at: startedAt,
    duration_seconds: 1500,
    session_type: 'focus',
    created_at: startedAt,
  };
}

describe('buildPomodoroHeatmapDays', () => {
  it('returns N days oldest-first with zeros when no sessions', () => {
    const days = buildPomodoroHeatmapDays([], 30);
    expect(days).toHaveLength(30);
    expect(days[0].dateKey < days[29].dateKey).toBe(true);
    expect(days.every((d) => d.value === 0)).toBe(true);
  });

  it('maps session counts to bucket values 1–3', () => {
    const iso = new Date().toISOString();
    const days = buildPomodoroHeatmapDays([pomSession(iso), pomSession(iso), pomSession(iso)], 30);
    const y = new Date().getFullYear();
    const m = String(new Date().getMonth() + 1).padStart(2, '0');
    const dd = String(new Date().getDate()).padStart(2, '0');
    const todayKey = `${y}-${m}-${dd}`;
    const today = days.find((d) => d.dateKey === todayKey);
    expect(today?.value).toBe(3);
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 2, 12, 0, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps sessions on opposite sides of local midnight on separate days', () => {
    const jan1Key = toDateKey(new Date(2026, 0, 1, 12, 0, 0, 0));
    const jan2Key = toDateKey(new Date(2026, 0, 2, 12, 0, 0, 0));
    const days = buildPomodoroHeatmapDays(
      [
        pomSession(new Date(2026, 0, 1, 23, 30, 0, 0).toISOString()),
        pomSession(new Date(2026, 0, 2, 0, 30, 0, 0).toISOString()),
      ],
      2,
    );

    expect(days).toEqual([
      { dateKey: jan1Key, value: 1 },
      { dateKey: jan2Key, value: 1 },
    ]);
  });
});

describe('computePomodoroStreakFromHeatmapDays', () => {
  it('counts consecutive days with activity from today backward', () => {
    expect(
      computePomodoroStreakFromHeatmapDays([
        { dateKey: '2025-01-01', value: 0 },
        { dateKey: '2025-01-02', value: 1 },
        { dateKey: '2025-01-03', value: 1 },
      ]),
    ).toBe(2);
  });

  it('returns 0 when today has no activity', () => {
    expect(
      computePomodoroStreakFromHeatmapDays([
        { dateKey: '2025-01-01', value: 1 },
        { dateKey: '2025-01-02', value: 0 },
      ]),
    ).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Session completion planning (pure extraction of the timer completion path)
// ---------------------------------------------------------------------------

describe('planSessionCompletion', () => {
  const base = {
    mode: 'focus' as const,
    startedAtIso: '2026-04-16T10:00:00.000Z',
    totalSeconds: 1500,
    completedFocus: 0,
    settings: DEFAULT_SETTINGS,
    preset: BUILT_IN_PRESETS[0],
  };

  it('plans a focus log with active-time ended_at = started_at + duration', () => {
    const plan = planSessionCompletion(base);
    expect(plan.log).not.toBeNull();
    expect(plan.log?.startedAtIso).toBe('2026-04-16T10:00:00.000Z');
    // Active-time semantics: nominal deadline, not wall-clock completion.
    expect(plan.log?.endedAtIso).toBe('2026-04-16T10:25:00.000Z');
    expect(plan.log?.durationSeconds).toBe(1500);
    expect(plan.nextCompletedFocus).toBe(1);
    expect(plan.nextMode).toBe('short_break');
    expect(plan.nextDurationSeconds).toBe(DEFAULT_SETTINGS.shortBreakMinutes * 60);
    expect(plan.autoStartNext).toBe(false); // Classic preset
  });

  it('never logs breaks and resets the cycle after a long break', () => {
    const breakPlan = planSessionCompletion({ ...base, mode: 'short_break' });
    expect(breakPlan.log).toBeNull();
    expect(breakPlan.nextCompletedFocus).toBe(0);

    const longBreakPlan = planSessionCompletion({
      ...base,
      mode: 'long_break',
      completedFocus: 4,
    });
    expect(longBreakPlan.log).toBeNull();
    expect(longBreakPlan.nextCompletedFocus).toBe(0);
    expect(longBreakPlan.nextMode).toBe('focus');
  });

  it('suggests a long break once the cycle count is reached', () => {
    const plan = planSessionCompletion({
      ...base,
      completedFocus: DEFAULT_SETTINGS.sessionsBeforeLongBreak - 1,
    });
    expect(plan.nextCompletedFocus).toBe(DEFAULT_SETTINGS.sessionsBeforeLongBreak);
    expect(plan.nextMode).toBe('long_break');
  });

  it('honors preset auto-start flags per completed mode', () => {
    const sprint = BUILT_IN_PRESETS[2];
    expect(planSessionCompletion({ ...base, preset: sprint }).autoStartNext).toBe(true);
    expect(
      planSessionCompletion({ ...base, mode: 'short_break', preset: sprint }).autoStartNext,
    ).toBe(true);
  });

  it('is deterministic: a replayed invocation produces an identical plan', () => {
    // Regression guard for the duplicate-row vector: because the planner is
    // pure, a double-fired completion computes the same log twice instead of
    // minting two different session rows.
    expect(planSessionCompletion(base)).toEqual(planSessionCompletion(base));
  });

  it('skips the log when no start time survived (defensive)', () => {
    const plan = planSessionCompletion({ ...base, startedAtIso: null });
    expect(plan.log).toBeNull();
    expect(plan.nextCompletedFocus).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Crash/reload reconciliation planning
// ---------------------------------------------------------------------------

describe('planActiveTimerReconcile', () => {
  const intent: ActiveTimerIntent = {
    startedAtIso: '2026-04-16T10:00:00.000Z',
    mode: 'focus',
    totalSeconds: 1500,
    completedFocus: 2,
    notificationId: 'notif-1',
  };
  const endMs = new Date('2026-04-16T10:25:00.000Z').getTime();

  it('reports already-logged when the row survived the crash', () => {
    expect(planActiveTimerReconcile(intent, true, endMs - 1)).toEqual({
      kind: 'already-logged',
      notificationId: 'notif-1',
    });
  });

  it('honors a focus whose countdown passed with no row', () => {
    expect(planActiveTimerReconcile(intent, false, endMs)).toEqual({
      kind: 'complete-unlogged',
      notificationId: 'notif-1',
    });
    expect(planActiveTimerReconcile(intent, false, endMs + 86_400_000).kind).toBe(
      'complete-unlogged',
    );
  });

  it('treats a mid-countdown death as interrupted (never logged)', () => {
    expect(planActiveTimerReconcile(intent, false, endMs - 1000)).toEqual({
      kind: 'interrupted',
      notificationId: 'notif-1',
    });
  });

  it('never logs a break even after its countdown passed', () => {
    const breakIntent: ActiveTimerIntent = { ...intent, mode: 'short_break' };
    expect(planActiveTimerReconcile(breakIntent, false, endMs).kind).toBe('interrupted');
  });
});

// ---------------------------------------------------------------------------
// Preset resolution (highlight + behavior fallbacks)
// ---------------------------------------------------------------------------

describe('matchPresetBySettings / resolveActivePreset', () => {
  const deepSettings = {
    focusMinutes: 50,
    shortBreakMinutes: 10,
    longBreakMinutes: 30,
    sessionsBeforeLongBreak: 2,
  };

  it('matches a preset by exact durations', () => {
    expect(matchPresetBySettings(BUILT_IN_PRESETS, deepSettings)?.id).toBe('deep');
    expect(
      matchPresetBySettings(BUILT_IN_PRESETS, { ...deepSettings, focusMinutes: 51 }),
    ).toBeNull();
  });

  it('prefers the stored selection for behavior, then duration match, then Classic', () => {
    expect(resolveActivePreset(BUILT_IN_PRESETS, 'sprint', deepSettings).id).toBe('sprint');
    // Silent-Classic fix: saved Deep Work durations resolve to Deep Work.
    expect(resolveActivePreset(BUILT_IN_PRESETS, null, deepSettings).id).toBe('deep');
    expect(resolveActivePreset(BUILT_IN_PRESETS, null, DEFAULT_SETTINGS).id).toBe('classic');
    expect(resolveActivePreset(BUILT_IN_PRESETS, 'bogus', deepSettings).id).toBe('deep');
  });
});
