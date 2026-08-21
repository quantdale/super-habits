import type { PomodoroSession } from './types';
import type { HeatmapDay } from '@/features/shared/activityTypes';
import { buildDateRangeOldestFirst, timestampToLocalDateKey } from '@/lib/time';

export type PomodoroState = 'idle' | 'running' | 'finished';

export type PomodoroMode = 'focus' | 'short_break' | 'long_break';

export type PomodoroSettings = {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
};

export const DEFAULT_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
};

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? value
    : fallback;
}

/** Normalize persisted settings so malformed app_meta JSON cannot poison timer state. */
export function normalizePomodoroSettings(value: unknown): PomodoroSettings {
  const candidate = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    focusMinutes: boundedInteger(candidate.focusMinutes, DEFAULT_SETTINGS.focusMinutes, 1, 120),
    shortBreakMinutes: boundedInteger(
      candidate.shortBreakMinutes,
      DEFAULT_SETTINGS.shortBreakMinutes,
      1,
      60,
    ),
    longBreakMinutes: boundedInteger(
      candidate.longBreakMinutes,
      DEFAULT_SETTINGS.longBreakMinutes,
      1,
      120,
    ),
    sessionsBeforeLongBreak: boundedInteger(
      candidate.sessionsBeforeLongBreak,
      DEFAULT_SETTINGS.sessionsBeforeLongBreak,
      2,
      10,
    ),
  };
}

export function applySettingsToTimerState(
  nextSettings: PomodoroSettings,
  state: {
    currentMode: PomodoroMode;
    isRunning: boolean;
    isPaused: boolean;
    totalSeconds: number;
    remaining: number;
  },
): { settings: PomodoroSettings; totalSeconds: number; remaining: number } {
  if (state.isRunning || state.isPaused) {
    return {
      settings: nextSettings,
      totalSeconds: state.totalSeconds,
      remaining: state.remaining,
    };
  }

  const duration = getModeDuration(state.currentMode, nextSettings);
  return { settings: nextSettings, totalSeconds: duration, remaining: duration };
}

/** Kept for backward compatibility with existing tests */
export const FOCUS_SECONDS = DEFAULT_SETTINGS.focusMinutes * 60;

/**
 * Get duration in seconds for a given mode and settings.
 */
export function getModeDuration(mode: PomodoroMode, settings: PomodoroSettings): number {
  switch (mode) {
    case 'focus':
      return settings.focusMinutes * 60;
    case 'short_break':
      return settings.shortBreakMinutes * 60;
    case 'long_break':
      return settings.longBreakMinutes * 60;
  }
}

/**
 * Get the next mode in the classic Pomodoro sequence.
 *
 * completedFocusSessions: how many focus sessions have been
 * completed in the current cycle (resets after long break).
 *
 * Sequence:
 *   focus(1) → short_break → focus(2) → short_break →
 *   focus(3) → short_break → focus(4) → long_break → repeat
 */
export function getNextMode(
  currentMode: PomodoroMode,
  completedFocusSessions: number,
  settings: PomodoroSettings,
): PomodoroMode {
  if (currentMode === 'short_break' || currentMode === 'long_break') {
    return 'focus';
  }
  // currentMode === "focus"
  // Guard: at least one session must be completed before
  // a long break can be suggested (0 % N === 0 for all N).
  if (
    completedFocusSessions > 0 &&
    completedFocusSessions % settings.sessionsBeforeLongBreak === 0
  ) {
    return 'long_break';
  }
  return 'short_break';
}

export function getModeLabel(mode: PomodoroMode): string {
  switch (mode) {
    case 'focus':
      return 'Focus';
    case 'short_break':
      return 'Short Break';
    case 'long_break':
      return 'Long Break';
  }
}

/**
 * Returns a Tailwind color class prefix for each mode.
 * Used to tint the timer display and progress bar.
 */
export function getModeColor(mode: PomodoroMode): { bg: string; text: string; bar: string } {
  switch (mode) {
    case 'focus':
      return { bg: 'bg-brand-500', text: 'text-brand-500', bar: 'bg-brand-500' };
    case 'short_break':
      return { bg: 'bg-emerald-500', text: 'text-emerald-500', bar: 'bg-emerald-500' };
    case 'long_break':
      return { bg: 'bg-violet-500', text: 'text-violet-500', bar: 'bg-violet-500' };
  }
}

/**
 * Parse "MM:SS" string into { minutes, seconds }.
 * Returns null for invalid input.
 */
export function parseMinutesSeconds(input: string): { minutes: number; seconds: number } | null {
  const parts = input.split(':');
  if (parts.length !== 2) return null;
  const m = parseInt(parts[0], 10);
  const s = parseInt(parts[1], 10);
  if (!Number.isFinite(m) || !Number.isFinite(s) || m < 0 || s < 0 || s > 59) return null;
  return { minutes: m, seconds: s };
}

export function nextPomodoroState(remainingSeconds: number, isRunning: boolean): PomodoroState {
  if (remainingSeconds <= 0) return 'finished';
  if (isRunning) return 'running';
  return 'idle';
}

/**
 * Returns a 0–1 growth value based on how much of the session
 * has elapsed. 0 = just started (seedling), 1 = fully grown.
 *
 * Uses elapsed time rather than remaining so the plant grows
 * forward, not shrinks — more satisfying visually.
 */
export function calculateGrowthProgress(
  remainingSeconds: number,
  totalSeconds: number = DEFAULT_SETTINGS.focusMinutes * 60,
): number {
  if (totalSeconds <= 0) return 0;
  const elapsed = totalSeconds - remainingSeconds;
  return Math.min(1, Math.max(0, elapsed / totalSeconds));
}

export type PlantStage =
  | 'seed' // 0–10% — small bump in soil
  | 'sprout' // 10–35% — first shoot appears
  | 'seedling' // 35–65% — small plant with leaves
  | 'growing' // 65–90% — taller plant
  | 'grown'; // 90–100% — full plant

export function getPlantStage(progress: number): PlantStage {
  if (progress < 0.1) return 'seed';
  if (progress < 0.35) return 'sprout';
  if (progress < 0.65) return 'seedling';
  if (progress < 0.9) return 'growing';
  return 'grown';
}

/**
 * Format completed session length for the garden grid (e.g. "25m", "45s").
 */
export function formatSessionDuration(seconds: number): string {
  if (seconds >= 60) return `${Math.round(seconds / 60)}m`;
  return `${seconds}s`;
}

/**
 * Format a pomodoro session for display in the garden grid tooltip.
 * Returns "Today 14:30" or "Mar 21 09:15".
 */
export function formatSessionTime(startedAt: string): string {
  const date = new Date(startedAt);
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  const time = date.toLocaleTimeString('en', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  if (isToday) return `Today ${time}`;
  return (
    date.toLocaleDateString('en', {
      month: 'short',
      day: 'numeric',
    }) + ` ${time}`
  );
}

export function buildPomodoroHeatmapDays(
  sessions: PomodoroSession[],
  days: number = 364,
): HeatmapDay[] {
  const map = new Map<string, number>();
  for (const s of sessions) {
    // Break rows never count toward the focus heatmap/streak.
    if (!isFocusSession(s)) continue;
    const key = timestampToLocalDateKey(s.started_at);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return buildDateRangeOldestFirst(days).map((dateKey) => {
    const count = map.get(dateKey) ?? 0;
    return {
      dateKey,
      value: count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : 3,
    };
  });
}

/** Consecutive days with activity, counting from today backward (uses heatmap values). */
export function computePomodoroStreakFromHeatmapDays(heatmapDays: HeatmapDay[]): number {
  if (heatmapDays.length === 0) return 0;
  let streak = 0;
  for (let i = heatmapDays.length - 1; i >= 0; i--) {
    if (heatmapDays[i].value > 0) streak++;
    else break;
  }
  return streak;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export type PomodoroPreset = {
  id: string;
  name: string;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
  /** Automatically begin the suggested break when a focus session completes. */
  autoStartBreaks: boolean;
  /** Automatically begin the next focus when a break completes. */
  autoStartFocus: boolean;
};

export const BUILT_IN_PRESETS: PomodoroPreset[] = [
  {
    id: 'classic',
    name: 'Classic',
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    sessionsBeforeLongBreak: 4,
    autoStartBreaks: false,
    autoStartFocus: false,
  },
  {
    id: 'deep',
    name: 'Deep Work',
    focusMinutes: 50,
    shortBreakMinutes: 10,
    longBreakMinutes: 30,
    sessionsBeforeLongBreak: 2,
    autoStartBreaks: true,
    autoStartFocus: false,
  },
  {
    id: 'sprint',
    name: 'Sprint',
    focusMinutes: 15,
    shortBreakMinutes: 3,
    longBreakMinutes: 10,
    sessionsBeforeLongBreak: 4,
    autoStartBreaks: true,
    autoStartFocus: true,
  },
];

function normalizePreset(
  candidate: Record<string, unknown>,
  fallback: PomodoroPreset,
): PomodoroPreset {
  const name =
    typeof candidate.name === 'string' && candidate.name.trim().length > 0
      ? candidate.name.trim().slice(0, 40)
      : fallback.name;
  return {
    id: typeof candidate.id === 'string' && candidate.id.length > 0 ? candidate.id : fallback.id,
    name,
    focusMinutes: boundedInteger(candidate.focusMinutes, fallback.focusMinutes, 1, 120),
    shortBreakMinutes: boundedInteger(
      candidate.shortBreakMinutes,
      fallback.shortBreakMinutes,
      1,
      60,
    ),
    longBreakMinutes: boundedInteger(candidate.longBreakMinutes, fallback.longBreakMinutes, 1, 120),
    sessionsBeforeLongBreak: boundedInteger(
      candidate.sessionsBeforeLongBreak,
      fallback.sessionsBeforeLongBreak,
      2,
      10,
    ),
    autoStartBreaks:
      typeof candidate.autoStartBreaks === 'boolean'
        ? candidate.autoStartBreaks
        : fallback.autoStartBreaks,
    autoStartFocus:
      typeof candidate.autoStartFocus === 'boolean'
        ? candidate.autoStartFocus
        : fallback.autoStartFocus,
  };
}

/**
 * Normalize persisted preset JSON so malformed AsyncStorage data cannot poison
 * the timer. Built-in presets always survive (matched by id); unrecognized or
 * malformed entries are dropped. Returns the built-in set when nothing valid
 * remains.
 */
export function normalizePomodoroPresets(value: unknown): PomodoroPreset[] {
  if (!Array.isArray(value)) return [...BUILT_IN_PRESETS];
  const byId = new Map(BUILT_IN_PRESETS.map((p) => [p.id, p]));
  const result: PomodoroPreset[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const candidate = raw as Record<string, unknown>;
    if (typeof candidate.id !== 'string') continue;
    const fallback = byId.get(candidate.id) ?? {
      id: candidate.id,
      name: 'Custom',
      ...DEFAULT_SETTINGS,
      autoStartBreaks: false,
      autoStartFocus: false,
    };
    const preset = normalizePreset(candidate, fallback);
    if (seen.has(preset.id)) continue;
    seen.add(preset.id);
    result.push(preset);
  }
  for (const builtin of BUILT_IN_PRESETS) {
    if (!seen.has(builtin.id)) result.push(builtin);
  }
  return result;
}

export function findPresetById(
  presets: PomodoroPreset[],
  id: string | null | undefined,
): PomodoroPreset | null {
  if (!id) return null;
  return presets.find((p) => p.id === id) ?? null;
}

/**
 * Whether the timer should automatically begin the suggested next mode after
 * the current one completes. Breaks follow `autoStartBreaks`, focus follows
 * `autoStartFocus`.
 */
export function shouldAutoStartNext(completedMode: PomodoroMode, preset: PomodoroPreset): boolean {
  return completedMode === 'focus' ? preset.autoStartBreaks : preset.autoStartFocus;
}

/** First preset whose durations exactly match the given settings, or null. */
export function matchPresetBySettings(
  presets: PomodoroPreset[],
  settings: PomodoroSettings,
): PomodoroPreset | null {
  return (
    presets.find(
      (p) =>
        p.focusMinutes === settings.focusMinutes &&
        p.shortBreakMinutes === settings.shortBreakMinutes &&
        p.longBreakMinutes === settings.longBreakMinutes &&
        p.sessionsBeforeLongBreak === settings.sessionsBeforeLongBreak,
    ) ?? null
  );
}

/**
 * Resolve the preset that drives timer BEHAVIOR (auto-start flags): the stored
 * selection when valid, else the preset whose durations match the current
 * settings, else Classic. The duration-match fallback fixes the silent-Classic
 * gap where saved durations matching e.g. Deep Work kept auto-start off.
 */
export function resolveActivePreset(
  presets: PomodoroPreset[],
  activePresetId: string | null | undefined,
  settings: PomodoroSettings,
): PomodoroPreset {
  return (
    findPresetById(presets, activePresetId) ??
    matchPresetBySettings(presets, settings) ??
    BUILT_IN_PRESETS[0]
  );
}

// ---------------------------------------------------------------------------
// Session completion planning (pure extraction of the timer's completion path)
// ---------------------------------------------------------------------------

export type CompletedFocusLogPlan = {
  startedAtIso: string;
  /**
   * Active-time semantics: `started_at + duration_seconds`, NOT the wall-clock
   * moment the JS interval observed zero. Pauses and background-tab throttling
   * shift wall clock but never change nominal duration (see pomodoro.data.ts).
   */
  endedAtIso: string;
  durationSeconds: number;
};

export type SessionCompletionPlan = {
  /** Row to insert; null for breaks (breaks are never logged). */
  log: CompletedFocusLogPlan | null;
  nextMode: PomodoroMode;
  nextDurationSeconds: number;
  nextCompletedFocus: number;
  autoStartNext: boolean;
};

/**
 * Pure completion path for one finished countdown. Called by the screen when
 * the remaining ref crosses zero; because it is pure, an accidental double
 * invocation produces identical plans and cannot itself duplicate rows.
 */
export function planSessionCompletion(input: {
  mode: PomodoroMode;
  startedAtIso: string | null;
  totalSeconds: number;
  completedFocus: number;
  settings: PomodoroSettings;
  preset: PomodoroPreset;
}): SessionCompletionPlan {
  const log: CompletedFocusLogPlan | null =
    input.mode === 'focus' && input.startedAtIso !== null
      ? {
          startedAtIso: input.startedAtIso,
          endedAtIso: new Date(
            new Date(input.startedAtIso).getTime() + input.totalSeconds * 1000,
          ).toISOString(),
          durationSeconds: input.totalSeconds,
        }
      : null;

  const nextCompletedFocus =
    input.mode === 'focus'
      ? input.completedFocus + 1
      : input.mode === 'long_break'
        ? 0
        : input.completedFocus;
  const nextMode = getNextMode(input.mode, nextCompletedFocus, input.settings);

  return {
    log,
    nextMode,
    nextDurationSeconds: getModeDuration(nextMode, input.settings),
    nextCompletedFocus,
    autoStartNext: shouldAutoStartNext(input.mode, input.preset),
  };
}

// ---------------------------------------------------------------------------
// Crash/reload reconciliation planning (durable active-timer intent)
// ---------------------------------------------------------------------------

/** Durable intent persisted at start so a killed process can be reconciled. */
export type ActiveTimerIntent = {
  startedAtIso: string;
  mode: PomodoroMode;
  totalSeconds: number;
  completedFocus: number;
  notificationId: string | null;
};

export type ActiveTimerReconciliation =
  | { kind: 'already-logged'; notificationId: string | null }
  | { kind: 'complete-unlogged'; notificationId: string | null }
  | { kind: 'interrupted'; notificationId: string | null };

/**
 * Decide what happened to a session whose process died mid-run.
 * - Row already logged → completion survived; only cycle position needs restore.
 * - Focus countdown passed with no row → honor the completed focus.
 * - Anything else → interrupted mid-session; per product contract interrupted
 *   sessions are never logged, so surface a notice and cancel the orphan OS
 *   notification.
 */
export function planActiveTimerReconcile(
  intent: ActiveTimerIntent,
  hasLoggedRow: boolean,
  nowMs: number,
): ActiveTimerReconciliation {
  if (hasLoggedRow) return { kind: 'already-logged', notificationId: intent.notificationId };
  const endMs = new Date(intent.startedAtIso).getTime() + intent.totalSeconds * 1000;
  if (intent.mode === 'focus' && nowMs >= endMs) {
    return { kind: 'complete-unlogged', notificationId: intent.notificationId };
  }
  return { kind: 'interrupted', notificationId: intent.notificationId };
}

// ---------------------------------------------------------------------------
// Focus stats
// ---------------------------------------------------------------------------

export type FocusStats = {
  todayMinutes: number;
  todaySessions: number;
  weekMinutes: number;
  weekSessions: number;
  thirtyDayMinutes: number;
  thirtyDaySessions: number;
  bestDay: { dateKey: string; minutes: number } | null;
};

function isFocusSession(session: Pick<PomodoroSession, 'session_type'>): boolean {
  return session.session_type === 'focus';
}

/**
 * Aggregate completed focus sessions into headline stats. Only rows with
 * `session_type === 'focus'` count toward minutes/sessions; breaks never do.
 * Day bucketing uses the local calendar via `timestampToLocalDateKey`.
 */
export function computeFocusStats(sessions: PomodoroSession[], today: Date): FocusStats {
  const perDay = new Map<string, { minutes: number; sessions: number }>();
  let todayMinutes = 0;
  let todaySessions = 0;

  const todayDateKey = timestampToLocalDateKey(today.toISOString());

  for (const s of sessions) {
    if (!isFocusSession(s)) continue;
    const dateKey = timestampToLocalDateKey(s.started_at);
    const minutes = Math.max(0, Math.round(s.duration_seconds / 60));
    const entry = perDay.get(dateKey) ?? { minutes: 0, sessions: 0 };
    entry.minutes += minutes;
    entry.sessions += 1;
    perDay.set(dateKey, entry);
    if (dateKey === todayDateKey) {
      todayMinutes += minutes;
      todaySessions += 1;
    }
  }

  const windowKeys = new Set<string>();
  for (let offset = 0; offset < 7; offset++) {
    const d = new Date(today);
    d.setDate(d.getDate() - offset);
    windowKeys.add(timestampToLocalDateKey(d.toISOString()));
  }
  let weekMinutes = 0;
  let weekSessions = 0;
  for (const key of windowKeys) {
    const entry = perDay.get(key);
    if (entry) {
      weekMinutes += entry.minutes;
      weekSessions += entry.sessions;
    }
  }

  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 29);
  const cutoffKey = timestampToLocalDateKey(cutoff.toISOString());
  let thirtyDayMinutes = 0;
  let thirtyDaySessions = 0;
  let bestDay: FocusStats['bestDay'] = null;
  for (const [dateKey, entry] of perDay) {
    if (dateKey < cutoffKey) continue;
    thirtyDayMinutes += entry.minutes;
    thirtyDaySessions += entry.sessions;
    if (!bestDay || entry.minutes > bestDay.minutes) {
      bestDay = { dateKey, minutes: entry.minutes };
    }
  }

  return {
    todayMinutes,
    todaySessions,
    weekMinutes,
    weekSessions,
    thirtyDayMinutes,
    thirtyDaySessions,
    bestDay,
  };
}

// ---------------------------------------------------------------------------
// Interruption / abandon copy
// ---------------------------------------------------------------------------

export type TimerPhase = 'idle' | 'running' | 'paused';

export type AbandonNotice = { title: string; body: string };

/**
 * UX copy clarifying what happens when the user abandons (resets) a session.
 * Returns null when there is nothing in progress worth explaining. The core
 * guarantee is stated explicitly: an interrupted session is never logged.
 */
export function getAbandonNotice(input: {
  mode: PomodoroMode;
  phase: TimerPhase;
  remaining: number;
  totalSeconds: number;
}): AbandonNotice | null {
  if (input.phase === 'idle') return null;
  const elapsed = input.totalSeconds - input.remaining;
  if (elapsed <= 0) return null;

  if (input.mode === 'focus') {
    const minutes = Math.round(elapsed / 60);
    return {
      title: input.phase === 'paused' ? 'Discard paused focus?' : 'Abandon this focus?',
      body:
        `${minutes} minute${minutes === 1 ? '' : 's'} of focus will be discarded. ` +
        'Interrupted sessions are never logged, so your history stays clean.',
    };
  }
  return {
    title: input.phase === 'paused' ? 'Discard paused break?' : 'Skip this break?',
    body: 'Breaks are not logged. Your focus streak and history are unaffected.',
  };
}
