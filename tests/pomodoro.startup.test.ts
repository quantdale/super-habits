import { describe, expect, it, vi } from 'vitest';
import {
  BUILT_IN_PRESETS,
  DEFAULT_SETTINGS,
  planSessionCompletion,
  planActiveTimerReconcile,
  timerEndNotificationCopy,
  type ActiveTimerIntent,
  type PomodoroMode,
  type PomodoroPreset,
  type PomodoroSettings,
} from '@/features/pomodoro/pomodoro.domain';
import {
  classifyTimerEndSchedule,
  isSessionActive,
  mayMutateConfiguration,
  mayOfferConfiguration,
  planTimerStartup,
  resolvePhaseHeadline,
  resolvePhaseAnnouncement,
  resolveTimerPhase,
  resolveTimerStatus,
  runTimerStartup,
  type SessionClaims,
} from '@/features/pomodoro/pomodoro.startup';

/**
 * These tests own the W8.5 invariant: a start that has been accepted owns its
 * mode, duration, start timestamp, governing preset, and durable intent before
 * its end-notification promise resolves.
 *
 * `makeTimerHarness()` mirrors the wiring of `PomodoroScreen.start()` around
 * the production `runTimerStartup()` sequence — the same refs are claimed
 * synchronously, the same plan is committed to the clock, and the same
 * predicate screens every configuration callback. Nothing here is a
 * test-only reimplementation of the rule: `mayMutateConfiguration` and
 * `runTimerStartup` are the shipped implementations, and the E2E lane covers
 * the rendered wiring (`e2e/pomodoro.spec.ts`).
 */

type HarnessState = {
  mode: PomodoroMode;
  settings: PomodoroSettings;
  completedFocus: number;
  remaining: number;
  totalSeconds: number;
  startedAt: Date | null;
  startInFlight: boolean;
  isRunning: boolean;
  isPaused: boolean;
  /** Preset governing auto-start; frozen for the duration of a session. */
  governingPreset: PomodoroPreset;
  /** Durable active-timer intent, exactly as persisted. */
  intent: ActiveTimerIntent | null;
  warning: 'notification' | null;
  recovered: string | null;
  /** Focus rows written by the completion path. */
  logged: ActiveTimerIntent[];
};

function makeTimerHarness(options?: { platform?: 'web' | 'native' }) {
  const platform = options?.platform ?? 'native';
  const state: HarnessState = {
    mode: 'focus',
    settings: { ...DEFAULT_SETTINGS },
    completedFocus: 0,
    remaining: DEFAULT_SETTINGS.focusMinutes * 60,
    totalSeconds: DEFAULT_SETTINGS.focusMinutes * 60,
    startedAt: null,
    startInFlight: false,
    isRunning: false,
    isPaused: false,
    governingPreset: BUILT_IN_PRESETS[0],
    intent: null,
    warning: null,
    recovered: null,
    logged: [],
  };

  const cancelCalls: (string | null)[] = [];
  const scheduleCalls: { seconds: number; title: string; body: string }[] = [];

  /** Live claims read by every guard — refs, never a render closure. */
  const claims = (): SessionClaims => ({
    starting: state.startInFlight,
    active: state.isRunning || state.isPaused,
  });

  const applyRemaining = (value: number) => {
    state.remaining = value;
  };

  /** Mirror of the screen's mode-segment callback. */
  const selectMode = (mode: PomodoroMode) => {
    if (!mayMutateConfiguration(claims())) return { applied: false as const };
    state.mode = mode;
    const duration = modeDuration(mode, state.settings);
    state.totalSeconds = duration;
    applyRemaining(duration);
    state.startedAt = null;
    return { applied: true as const };
  };

  /** Mirror of the screen's preset callback. */
  const selectPreset = (preset: PomodoroPreset) => {
    const sessionActive = isSessionActive(claims());
    if (!sessionActive) {
      state.governingPreset = preset;
      state.settings = { ...state.settings, ...preset };
      const duration = modeDuration(state.mode, state.settings);
      state.totalSeconds = duration;
      applyRemaining(duration);
    }
    return { applied: !sessionActive, governingPreset: state.governingPreset };
  };

  /** Mirror of the screen's inline duration save. */
  const saveSettings = (settings: PomodoroSettings) => {
    state.settings = settings;
    if (isSessionActive(claims())) return { applied: false as const };
    const duration = modeDuration(state.mode, settings);
    state.totalSeconds = duration;
    applyRemaining(duration);
    return { applied: true as const };
  };

  /** Mirror of the screen's `start()`: claim, plan, commit, sequence. */
  const start = async (
    requestedDurationMinutes?: number,
    schedule?: (seconds: number, title: string, body: string) => Promise<string | null>,
  ) => {
    if (!mayMutateConfiguration(claims())) {
      return { outcome: 'conflict' as const, message: 'already active' };
    }
    state.startInFlight = true;
    state.warning = null;
    state.recovered = null;
    const plan = planTimerStartup(
      { requestedDurationMinutes },
      {
        mode: state.mode,
        settings: state.settings,
        completedFocus: state.completedFocus,
      },
      new Date(),
    );
    // Synchronous clock commit from the plan (never from state).
    state.mode = plan.mode;
    state.startedAt = plan.startedAt;
    applyRemaining(plan.durationSeconds);
    state.totalSeconds = plan.durationSeconds;

    const outcome = await runTimerStartup(
      plan,
      {
        scheduleTimerEndNotification: async (seconds, title, body) => {
          scheduleCalls.push({ seconds, title, body });
          return schedule ? schedule(seconds, title, body) : `notif_${scheduleCalls.length}`;
        },
        platform,
        cancelScheduledNotification: (id) => {
          cancelCalls.push(id);
        },
      },
      {
        cancelPreviousNotification: () => {
          cancelCalls.push(state.intent?.notificationId ?? null);
        },
        commit: ({ notificationId }) => {
          state.isRunning = true;
          state.isPaused = false;
          state.intent = { ...plan.intent, notificationId };
        },
        reportScheduleWarning: () => {
          state.warning = 'notification';
        },
        recover: () => {
          state.isRunning = false;
          state.isPaused = false;
          state.startedAt = null;
          state.intent = null;
          const idle = modeDuration(state.mode, state.settings);
          applyRemaining(idle);
          state.totalSeconds = idle;
        },
      },
    );

    state.startInFlight = false;
    return outcome.outcome === 'failed'
      ? { outcome: 'failed' as const, message: outcome.message }
      : { outcome: 'started' as const };
  };

  /** Natural completion: the pure completion path, exactly as the screen runs it. */
  const completeNaturally = () => {
    const plan = planSessionCompletion({
      mode: state.mode,
      startedAtIso: state.startedAt?.toISOString() ?? null,
      totalSeconds: state.totalSeconds,
      completedFocus: state.completedFocus,
      settings: state.settings,
      preset: state.governingPreset,
    });
    state.intent = null;
    state.isRunning = false;
    state.isPaused = false;
    state.completedFocus = plan.nextCompletedFocus;
    state.mode = plan.nextMode;
    state.totalSeconds = plan.nextDurationSeconds;
    applyRemaining(plan.nextDurationSeconds);
    state.startedAt = null;
    if (plan.log) state.logged.push({ ...plan.log } as unknown as ActiveTimerIntent);
    return plan;
  };

  /** Confirmed End: nothing is ever logged. */
  const confirmEnd = () => {
    state.isRunning = false;
    state.isPaused = false;
    state.startedAt = null;
    state.intent = null;
    applyRemaining(modeDuration(state.mode, state.settings));
  };

  return {
    state,
    claims,
    cancelCalls,
    scheduleCalls,
    selectMode,
    selectPreset,
    saveSettings,
    start,
    completeNaturally,
    confirmEnd,
  };
}

function modeDuration(mode: PomodoroMode, settings: PomodoroSettings): number {
  return mode === 'focus'
    ? settings.focusMinutes * 60
    : mode === 'short_break'
      ? settings.shortBreakMinutes * 60
      : settings.longBreakMinutes * 60;
}

/** A promise the test resolves on demand, for holding the scheduling boundary. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ---------------------------------------------------------------------------
// Phase authority

describe('timer phase authority', () => {
  it('treats starting as an active session, never as idle', () => {
    expect(resolveTimerPhase({ starting: true, active: true })).toBe('starting');
    expect(resolveTimerPhase({ starting: true, active: false })).toBe('starting');
    expect(resolveTimerPhase({ starting: false, active: true })).toBe('running');
    expect(resolveTimerPhase({ starting: false, active: false })).toBe('idle');
  });

  it('forbids configuration mutation while starting, running, or paused', () => {
    expect(mayMutateConfiguration({ starting: true, active: true })).toBe(false);
    expect(mayMutateConfiguration({ starting: false, active: true })).toBe(false);
    expect(mayMutateConfiguration({ starting: false, active: false })).toBe(true);
  });

  it('offers configuration only while idle with no completion summary visible', () => {
    expect(mayOfferConfiguration({ starting: false, active: false }, false)).toBe(true);
    expect(mayOfferConfiguration({ starting: false, active: false }, true)).toBe(false);
    expect(mayOfferConfiguration({ starting: true, active: true }, false)).toBe(false);
    expect(mayOfferConfiguration({ starting: false, active: true }, false)).toBe(false);
  });

  it('never labels a starting session as running', () => {
    expect(
      resolvePhaseHeadline({ isStarting: true, isRunning: false, isPaused: false }, 'Focus'),
    ).toBe('Starting · Focus');
    expect(
      resolvePhaseHeadline({ isStarting: false, isRunning: true, isPaused: false }, 'Focus'),
    ).toBe('Focus');
    expect(
      resolvePhaseHeadline({ isStarting: false, isRunning: false, isPaused: true }, 'Focus'),
    ).toBe('Paused · Focus');
  });

  it('announces the starting phase separately from the started phase', () => {
    const starting = { isStarting: true, isRunning: false, isPaused: false };
    const running = { isStarting: false, isRunning: true, isPaused: false };
    expect(resolvePhaseAnnouncement(starting, 'focus', 1500)).toBe('Focus starting — 25 minutes');
    expect(resolvePhaseAnnouncement(running, 'focus', 1500)).toBe('Focus started — 25 minutes');
  });

  it('reports a status that names starting rather than counting', () => {
    expect(
      resolveTimerStatus({ isStarting: true, isRunning: false, isPaused: false }, 'Focus', '25:00'),
    ).toBe('Starting — 25:00 selected');
    expect(
      resolveTimerStatus({ isStarting: false, isRunning: true, isPaused: false }, 'Focus', '24:59'),
    ).toBe('Focus running, 24:59 remaining');
    expect(
      resolveTimerStatus(
        { isStarting: false, isRunning: false, isPaused: false },
        'Focus',
        '25:00',
      ),
    ).toBe('Ready, 25:00 selected');
  });

  it('syncs the announcing union with the derived phase', () => {
    const claims: SessionClaims = { starting: true, active: true };
    expect(isSessionActive(claims)).toBe(true);
    expect(mayMutateConfiguration(claims)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// End-notification classification

describe('end-notification classification', () => {
  it('treats a web null as unsupported, not as a failure', () => {
    expect(classifyTimerEndSchedule(null, 'web')).toEqual({
      kind: 'unsupported',
      notificationId: null,
      warning: null,
    });
  });

  it('treats a native null as permission denied and warns', () => {
    expect(classifyTimerEndSchedule(null, 'native')).toEqual({
      kind: 'permission-denied',
      notificationId: null,
      warning: 'notification',
    });
  });

  it('treats a returned id as scheduled', () => {
    expect(classifyTimerEndSchedule('notif_1', 'native')).toEqual({
      kind: 'scheduled',
      notificationId: 'notif_1',
      warning: null,
    });
  });

  it('rejects an empty-string id rather than pretending it scheduled', () => {
    expect(classifyTimerEndSchedule('', 'native').kind).toBe('permission-denied');
  });
});

// ---------------------------------------------------------------------------
// Startup plan

describe('startup plan', () => {
  const now = new Date('2026-10-09T10:00:00.000Z');

  it('builds one coherent snapshot for a plain press', () => {
    const plan = planTimerStartup(
      {},
      { mode: 'focus', settings: DEFAULT_SETTINGS, completedFocus: 2 },
      now,
    );
    expect(plan).toMatchObject({
      mode: 'focus',
      durationSeconds: 1500,
      startedAtIso: now.toISOString(),
      notificationCopy: timerEndNotificationCopy('focus'),
      intent: {
        startedAtIso: now.toISOString(),
        mode: 'focus',
        totalSeconds: 1500,
        completedFocus: 2,
        notificationId: null,
      },
    });
  });

  it('forces focus for a command request with an explicit duration', () => {
    const plan = planTimerStartup(
      { requestedDurationMinutes: 45 },
      { mode: 'long_break', settings: DEFAULT_SETTINGS, completedFocus: 0 },
      now,
    );
    expect(plan.mode).toBe('focus');
    expect(plan.durationSeconds).toBe(2700);
    expect(plan.intent.totalSeconds).toBe(2700);
    expect(plan.intent.mode).toBe('focus');
  });

  it('honors the live selected break mode for a plain press', () => {
    const plan = planTimerStartup(
      {},
      { mode: 'short_break', settings: DEFAULT_SETTINGS, completedFocus: 1 },
      now,
    );
    expect(plan.mode).toBe('short_break');
    expect(plan.durationSeconds).toBe(DEFAULT_SETTINGS.shortBreakMinutes * 60);
  });
});

// ---------------------------------------------------------------------------
// The startup race

describe('timer-start race against in-flight configuration', () => {
  it('holds the accepted session steady while notification scheduling is pending', async () => {
    const gate = deferred<string | null>();
    const harness = makeTimerHarness();
    const startedAtBefore = new Date();

    // 1. Start is accepted; 2. scheduling stays unresolved.
    const startPromise = harness.start(undefined, () => gate.promise);
    expect(harness.state.startInFlight).toBe(true);
    expect(harness.state.isRunning).toBe(false);
    // Exactly one scheduling attempt belongs to the accepted press.
    expect(harness.scheduleCalls).toEqual([
      { seconds: 1500, title: 'Focus complete', body: 'Great work. Time for a short break.' },
    ]);

    // 3. Mode change while starting.
    expect(harness.selectMode('long_break')).toEqual({ applied: false });
    expect(harness.state.mode).toBe('focus');
    expect(harness.state.totalSeconds).toBe(DEFAULT_SETTINGS.focusMinutes * 60);
    expect(harness.state.startedAt).not.toBeNull();

    // 4. Preset selection while starting (governing preset must be frozen).
    const deepWork = { ...BUILT_IN_PRESETS[0], id: 'deep', name: 'Deep', focusMinutes: 50 };
    const presetResult = harness.selectPreset(deepWork);
    expect(presetResult.applied).toBe(false);
    expect(presetResult.governingPreset).toBe(BUILT_IN_PRESETS[0]);
    expect(harness.state.settings.focusMinutes).toBe(DEFAULT_SETTINGS.focusMinutes);

    // 4b. Duration editing while starting.
    expect(harness.saveSettings({ ...DEFAULT_SETTINGS, focusMinutes: 90 })).toEqual({
      applied: false,
    });
    expect(harness.state.totalSeconds).toBe(DEFAULT_SETTINGS.focusMinutes * 60);

    // 5. A second Start while starting.
    const second = await harness.start();
    expect(second).toMatchObject({ outcome: 'conflict' });
    // The racing press never reached the scheduler.
    expect(harness.scheduleCalls).toHaveLength(1);

    // 6. Release the pending notification promise.
    gate.resolve('notif_race');
    const first = await startPromise;
    expect(first).toEqual({ outcome: 'started' });

    // 7. Final mode, duration, remaining, start timestamp.
    expect(harness.state.mode).toBe('focus');
    expect(harness.state.totalSeconds).toBe(DEFAULT_SETTINGS.focusMinutes * 60);
    expect(harness.state.remaining).toBe(DEFAULT_SETTINGS.focusMinutes * 60);
    expect(harness.state.startedAt!.getTime()).toBeGreaterThanOrEqual(startedAtBefore.getTime());
    expect(harness.state.startedAt).not.toBeNull();

    // 8. Exactly one session is running.
    expect(harness.state.isRunning).toBe(true);
    expect(harness.state.isPaused).toBe(false);
    expect(harness.claims()).toEqual({ starting: false, active: true });

    // 9. Durable intent matches the started session.
    expect(harness.state.intent).toMatchObject({
      mode: 'focus',
      totalSeconds: DEFAULT_SETTINGS.focusMinutes * 60,
      completedFocus: 0,
      notificationId: 'notif_race',
    });
    expect(harness.state.intent!.startedAtIso).toBe(harness.state.startedAt!.toISOString());
    expect(harness.state.warning).toBeNull();

    // 10. Completion logs exactly one focus row; abandon logs nothing.
    harness.completeNaturally();
    expect(harness.state.logged).toHaveLength(1);
    expect(harness.state.completedFocus).toBe(1);
  });

  it('leaves the clock untouched when a mode change is attempted after a completed start', async () => {
    const harness = makeTimerHarness();
    await harness.start();
    const before = { ...harness.state };

    expect(harness.selectMode('short_break')).toEqual({ applied: false });
    expect(harness.state.mode).toBe(before.mode);
    expect(harness.state.totalSeconds).toBe(before.totalSeconds);
    expect(harness.state.remaining).toBe(before.remaining);
    expect(harness.state.startedAt).toBe(before.startedAt);
  });

  it('keeps the governing preset of the accepted session when a preset lands mid-start', async () => {
    const gate = deferred<string | null>();
    const harness = makeTimerHarness();
    const autoStartPreset = {
      ...BUILT_IN_PRESETS[0],
      id: 'auto',
      name: 'Auto',
      autoStartBreaks: true,
    };
    harness.selectPreset(autoStartPreset);
    expect(harness.state.governingPreset.id).toBe('auto');

    const startPromise = harness.start(undefined, () => gate.promise);
    const intruder = { ...BUILT_IN_PRESETS[0], id: 'intruder', name: 'Intruder' };
    harness.selectPreset(intruder);

    gate.resolve('notif_preset');
    await startPromise;

    // The racing selection governs the NEXT timer, never this session.
    expect(harness.state.governingPreset.id).toBe('auto');
    const completion = harness.completeNaturally();
    expect(completion.autoStartNext).toBe(true);
  });

  it('applies a preset chosen while a session runs to the next timer only', async () => {
    const harness = makeTimerHarness();
    await harness.start();
    const runningTotal = harness.state.totalSeconds;
    const runningPreset = harness.state.governingPreset;

    const nextRound = { ...BUILT_IN_PRESETS[0], id: 'next', name: 'Next round' };
    const result = harness.selectPreset(nextRound);

    expect(result.applied).toBe(false);
    expect(harness.state.governingPreset).toBe(runningPreset);
    expect(harness.state.totalSeconds).toBe(runningTotal);
    expect(harness.state.remaining).toBe(runningTotal);

    // Once the session is over the selection governs the next timer.
    harness.confirmEnd();
    expect(harness.selectPreset(nextRound).applied).toBe(true);
    expect(harness.state.governingPreset.id).toBe('next');
  });

  it('does not rewrite the running clock when a settings save lands mid-start', async () => {
    const gate = deferred<string | null>();
    const harness = makeTimerHarness();
    const startPromise = harness.start(undefined, () => gate.promise);

    // A durable defaults write resolving during the startup.
    expect(harness.saveSettings({ ...DEFAULT_SETTINGS, focusMinutes: 60 })).toEqual({
      applied: false,
    });

    gate.resolve('notif_settings');
    await startPromise;

    expect(harness.state.totalSeconds).toBe(DEFAULT_SETTINGS.focusMinutes * 60);
    expect(harness.state.remaining).toBe(DEFAULT_SETTINGS.focusMinutes * 60);
    expect(harness.state.intent).toMatchObject({
      totalSeconds: DEFAULT_SETTINGS.focusMinutes * 60,
      notificationId: 'notif_settings',
    });
  });

  it('starts a command-requested focus even when a break mode was selected', async () => {
    const harness = makeTimerHarness();
    harness.selectMode('long_break');
    expect(harness.state.mode).toBe('long_break');

    await harness.start(45);

    expect(harness.state.mode).toBe('focus');
    expect(harness.state.totalSeconds).toBe(45 * 60);
    expect(harness.state.intent).toMatchObject({ mode: 'focus', totalSeconds: 45 * 60 });
  });
});

// ---------------------------------------------------------------------------
// Startup failure and recovery paths

describe('startup failure paths', () => {
  it('starts the timer when notification permission is denied', async () => {
    const harness = makeTimerHarness();
    const result = await harness.start(undefined, async () => null);

    expect(result).toEqual({ outcome: 'started' });
    expect(harness.state.isRunning).toBe(true);
    expect(harness.state.warning).toBe('notification');
    expect(harness.state.intent).toMatchObject({ notificationId: null });
    expect(harness.scheduleCalls).toEqual([
      { seconds: 1500, title: 'Focus complete', body: 'Great work. Time for a short break.' },
    ]);
  });

  it('starts the timer on web where a null id is by design', async () => {
    const harness = makeTimerHarness({ platform: 'web' });
    const result = await harness.start(undefined, async () => null);

    expect(result).toEqual({ outcome: 'started' });
    expect(harness.state.warning).toBeNull();
    expect(harness.state.intent).toMatchObject({ notificationId: null });
  });

  it('returns to idle, with no intent and no orphan, when scheduling throws', async () => {
    const harness = makeTimerHarness();
    const result = await harness.start(undefined, async () => {
      throw new Error('Scheduling failed');
    });

    expect(result).toEqual({ outcome: 'failed', message: 'Scheduling failed' });
    expect(harness.state.isRunning).toBe(false);
    expect(harness.state.isPaused).toBe(false);
    expect(harness.state.startInFlight).toBe(false);
    expect(harness.state.intent).toBeNull();
    expect(harness.state.startedAt).toBeNull();
    expect(harness.state.remaining).toBe(DEFAULT_SETTINGS.focusMinutes * 60);
    expect(harness.state.totalSeconds).toBe(DEFAULT_SETTINGS.focusMinutes * 60);
    expect(harness.cancelCalls).toContain(null);
  });

  it('leaves the timer startable again after a failed startup', async () => {
    const harness = makeTimerHarness();
    await harness.start(undefined, async () => {
      throw new Error('nope');
    });

    const retry = await harness.start();
    expect(retry).toEqual({ outcome: 'started' });
    expect(harness.state.isRunning).toBe(true);
    expect(harness.state.intent).not.toBeNull();
    expect(harness.state.logged).toHaveLength(0);
  });

  it('uses a generic recovery message when the rejection carries none', async () => {
    const harness = makeTimerHarness();
    const result = await harness.start(undefined, async () => {
      throw new Error('');
    });
    expect(result).toEqual({
      outcome: 'failed',
      message: 'The timer could not be started.',
    });
  });

  it('starts exactly one session under rapid repeated presses', async () => {
    const gate = deferred<string | null>();
    const harness = makeTimerHarness();
    const scheduler = vi.fn(() => gate.promise);

    const first = harness.start(undefined, scheduler);
    const second = await harness.start(undefined, scheduler);
    const third = await harness.start(undefined, scheduler);

    expect(second).toMatchObject({ outcome: 'conflict' });
    expect(third).toMatchObject({ outcome: 'conflict' });
    // The accepted press made exactly one scheduling attempt; the two racing
    // presses never reached the scheduler at all.
    expect(scheduler).toHaveBeenCalledTimes(1);

    gate.resolve('notif_once');
    expect(await first).toEqual({ outcome: 'started' });
    expect(scheduler).toHaveBeenCalledTimes(1);
    expect(harness.state.isRunning).toBe(true);
    expect(harness.state.intent).toMatchObject({ notificationId: 'notif_once' });
  });

  it('releases the previous notification slot before scheduling a new one', async () => {
    const harness = makeTimerHarness();
    await harness.start();
    expect(harness.cancelCalls).toEqual([null]);

    // Confirmed End, like the screen, drops the notification id it already
    // cancelled; the next start therefore releases an empty slot.
    harness.confirmEnd();
    await harness.start();
    expect(harness.cancelCalls).toEqual([null, null]);
  });
});

// ---------------------------------------------------------------------------
// Completion behaviour after a raced startup

describe('completion after a raced startup', () => {
  it('logs the focus session exactly once and never logs a break', async () => {
    const harness = makeTimerHarness();
    await harness.start();
    const startedAtIso = harness.state.startedAt!.toISOString();
    const plan = harness.completeNaturally();

    expect(plan.log).toEqual({
      startedAtIso,
      endedAtIso: expect.any(String),
      durationSeconds: DEFAULT_SETTINGS.focusMinutes * 60,
    });
    expect(harness.state.logged).toHaveLength(1);
    expect(plan.nextMode).toBe('short_break');

    // The successor is a break: it completes without ever writing a focus row.
    await harness.start();
    const breakPlan = harness.completeNaturally();
    expect(breakPlan.log).toBeNull();
    expect(harness.state.logged).toHaveLength(1);
    expect(breakPlan.nextMode).toBe('focus');
  });

  it('keeps the long-break cadence after a raced startup', async () => {
    const harness = makeTimerHarness();
    const cadence: PomodoroMode[] = [];
    for (let focus = 1; focus <= 4; focus += 1) {
      // Idle again after each completion: the focus mode is freely selectable.
      expect(harness.selectMode('focus').applied).toBe(true);
      await harness.start(undefined, async () => null);
      cadence.push(harness.completeNaturally().nextMode);

      // The successor break also completes, and never writes a focus row.
      await harness.start();
      expect(harness.completeNaturally().log).toBeNull();
    }
    expect(cadence).toEqual(['short_break', 'short_break', 'short_break', 'long_break']);
    expect(harness.state.logged).toHaveLength(4);
  });

  it('reconciles a raced startup intent as complete once its deadline passed', async () => {
    const harness = makeTimerHarness();
    await harness.start();
    const intent = harness.state.intent!;
    const afterDeadline = Date.now() + 26 * 60 * 1000;
    expect(planActiveTimerReconcile(intent, false, afterDeadline).kind).toBe('complete-unlogged');
    expect(planActiveTimerReconcile(intent, true, afterDeadline).kind).toBe('already-logged');
  });

  it('leaves no durable intent behind after a confirmed end', async () => {
    const harness = makeTimerHarness();
    await harness.start();
    expect(harness.state.intent).not.toBeNull();

    harness.confirmEnd();
    expect(harness.state.intent).toBeNull();
    expect(harness.state.isRunning).toBe(false);
    expect(harness.state.logged).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Race diagnosis: the corruption the unguarded path produced

describe('race diagnosis', () => {
  /**
   * The pre-W8.5 mode selector applied the selection unconditionally, and the
   * surface rendered it whenever `isRunning`/`isPaused` were both false —
   * exactly the window between an accepted Start and the resolved
   * end-notification promise. Reproduced here against the same pure completion
   * and reconcile paths so the damage is measured, not asserted by analogy.
   */
  it('reproduces the mid-start corruption an unguarded mode selector caused', async () => {
    const gate = deferred<string | null>();
    const harness = makeTimerHarness();
    const startPromise = harness.start(undefined, () => gate.promise);

    // Unguarded callback, as the screen ran it before the W8.5 fix.
    const unguardedSelectMode = (mode: PomodoroMode) => {
      harness.state.mode = mode;
      harness.state.totalSeconds = modeDuration(mode, harness.state.settings);
      harness.state.remaining = harness.state.totalSeconds;
      harness.state.startedAt = null;
    };
    unguardedSelectMode('long_break');
    gate.resolve('notif_race');
    await startPromise;

    // The durable intent the committed startup wrote, captured before the
    // completion path clears it.
    const racedIntent = harness.state.intent;

    // The focus session ran on the long-break clock it never selected.
    expect(harness.state.mode).toBe('long_break');
    expect(harness.state.totalSeconds).toBe(DEFAULT_SETTINGS.longBreakMinutes * 60);

    // Its start timestamp was reset, so the completion plan has nothing to
    // log: a finished focus session silently produced no history row.
    expect(harness.state.startedAt).toBeNull();
    expect(harness.completeNaturally().log).toBeNull();

    // The durable intent still claimed the 25-minute focus that never ran, so
    // a reload would reconcile against a clock the UI never displayed.
    expect(racedIntent).toMatchObject({ mode: 'focus', totalSeconds: 1500 });
  });

  it('reproduces the un-endable session left behind a reset start timestamp', async () => {
    const gate = deferred<string | null>();
    const harness = makeTimerHarness();
    const startPromise = harness.start(undefined, () => gate.promise);
    const unguardedSelectMode = () => {
      harness.state.mode = 'short_break';
      harness.state.totalSeconds = DEFAULT_SETTINGS.shortBreakMinutes * 60;
      harness.state.remaining = harness.state.totalSeconds;
      harness.state.startedAt = null;
    };
    unguardedSelectMode();
    gate.resolve('notif_race');
    await startPromise;

    // The End confirmation is gated on a live start timestamp, so a session
    // whose mode was switched mid-start could not be ended at all.
    expect(harness.state.startedAt).toBeNull();
    expect(canEndSession(harness.state)).toBe(false);
  });
});

/** The screen's End precondition: an active session with a live start timestamp. */
function canEndSession(state: HarnessState): boolean {
  return (state.isRunning || state.isPaused || state.startInFlight) && state.startedAt !== null;
}
