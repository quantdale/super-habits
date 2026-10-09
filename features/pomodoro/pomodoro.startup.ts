/**
 * Focus timer startup lifecycle (no React, no I/O, no DB): the explicit
 * IDLE → STARTING → RUNNING → PAUSED authority, the start sequence whose only
 * asynchronous boundary is end-notification scheduling, and the recovery path
 * for a startup that never becomes a session.
 *
 * `PomodoroScreen` mirrors the claims into `startInFlightRef` /
 * `sessionActiveRef` (synchronous) and `isStarting` / `isRunning` / `isPaused`
 * (rendered) and routes every configuration callback, the command bridge, and
 * the durable-intent write through this module. Because the safety predicates
 * read refs rather than a render closure, a queued press, a keyboard event, a
 * callback captured before Start, and an automated action racing the startup
 * all get the same answer: a session accepted for start already owns its mode,
 * duration, and start timestamp.
 *
 * Cancellation and abandonment stay on the confirmed End path; this module only
 * decides whether a startup was accepted, what it became, and how a rejected
 * startup returns to idle.
 */
import {
  getModeDuration,
  getModeLabel,
  timerEndNotificationCopy,
  type ActiveTimerIntent,
  type PomodoroMode,
  type PomodoroSettings,
} from './pomodoro.domain';

/** Explicit timer lifecycle, in the order a session moves through it. */
export type TimerPhase = 'idle' | 'starting' | 'running' | 'paused';

/**
 * The claims a Focus screen can read synchronously. Both live in refs that are
 * written where the phase changes, so no callback — however stale — can
 * observe a session that has already been claimed.
 */
export type SessionClaims = {
  /** A start was accepted and its end-notification scheduling is still pending. */
  starting: boolean;
  /** A session exists: starting, running, or paused. */
  active: boolean;
};

/**
 * The lifecycle phase implied by the synchronous claims. Running and paused
 * are one safety class — configuration is forbidden, End confirms, a second
 * start conflicts — so the claims resolve far enough for every guard; the
 * screen separates them for copy from its own render state.
 */
export function resolveTimerPhase(claims: SessionClaims): TimerPhase {
  if (claims.starting) return 'starting';
  if (claims.active) return 'running';
  return 'idle';
}

/** The single active-session predicate every guard reads. */
export function isSessionActive(claims: SessionClaims): boolean {
  return resolveTimerPhase(claims) !== 'idle';
}

/**
 * Configuration (mode, preset, duration, todo link, history) is only mutable
 * while the timer is idle. Starting counts: the session owns its clock from
 * the moment the press is accepted, which is before the notification promise
 * resolves, so no later interaction may rewrite any part of it.
 */
export function mayMutateConfiguration(claims: SessionClaims): boolean {
  return resolveTimerPhase(claims) === 'idle';
}

/**
 * Whether the configuration surfaces should render at all. Hiding them is a
 * courtesy; `mayMutateConfiguration` is the actual invariant.
 */
export function mayOfferConfiguration(
  claims: SessionClaims,
  completedSummaryVisible: boolean,
): boolean {
  return !isSessionActive(claims) && !completedSummaryVisible;
}

/** Rendered phase booleans; safe to read from the render-time closure. */
export type RenderedTimerState = {
  isStarting: boolean;
  isRunning: boolean;
  isPaused: boolean;
};

/** Phase copy for the timer region label; `starting` never says "running". */
export function resolvePhaseHeadline(state: RenderedTimerState, modeLabel: string): string {
  if (state.isStarting) return `Starting · ${modeLabel}`;
  if (state.isPaused) return `Paused · ${modeLabel}`;
  return modeLabel;
}

/** Polite phase announcement, published once per phase change. */
export function resolvePhaseAnnouncement(
  state: RenderedTimerState,
  mode: PomodoroMode,
  durationSeconds: number,
): string {
  const minutes = Math.round(durationSeconds / 60);
  if (state.isStarting) return `${getModeLabel(mode)} starting — ${minutes} minutes`;
  if (state.isRunning) return `${getModeLabel(mode)} started — ${minutes} minutes`;
  if (state.isPaused) return 'Paused';
  return `Ready — ${minutes} minutes selected`;
}

/** On-request timer status: phase plus remaining time, never per second. */
export function resolveTimerStatus(
  state: RenderedTimerState,
  modeLabel: string,
  clock: string,
): string {
  if (state.isStarting) return `Starting — ${clock} selected`;
  if (state.isRunning) return `${modeLabel} running, ${clock} remaining`;
  if (state.isPaused) return `Paused, ${clock} remaining`;
  return `Ready, ${clock} selected`;
}

/**
 * Tri-state start classification. A null notification id is NOT a timer
 * failure: web has no native scheduling, and a denied permission only removes
 * the end alert while the countdown stays valid.
 */
export type TimerEndSchedule =
  | { kind: 'scheduled'; notificationId: string; warning: null }
  | { kind: 'unsupported'; notificationId: null; warning: null }
  | { kind: 'permission-denied'; notificationId: null; warning: 'notification' };

export function classifyTimerEndSchedule(
  notificationId: string | null,
  platform: 'web' | 'native',
): TimerEndSchedule {
  if (typeof notificationId === 'string' && notificationId.length > 0) {
    return { kind: 'scheduled', notificationId, warning: null };
  }
  if (platform === 'web') return { kind: 'unsupported', notificationId: null, warning: null };
  return { kind: 'permission-denied', notificationId: null, warning: 'notification' };
}

/** What a start request asks for; `undefined` means "the selected mode". */
export type TimerStartRequest = {
  requestedDurationMinutes?: number;
};

/** Coherent configuration snapshot read when the start is accepted. */
export type TimerStartConfiguration = {
  /** Live selected mode; a command start always forces focus. */
  mode: PomodoroMode;
  settings: PomodoroSettings;
  completedFocus: number;
};

/**
 * Everything one accepted start produces, in the exact shape the durable intent
 * expects. Built once, synchronously, so the clock, the notification, and the
 * persisted snapshot can never disagree about mode, duration, or start
 * timestamp — not even while scheduling is still pending.
 */
export type TimerStartupPlan = {
  mode: PomodoroMode;
  durationSeconds: number;
  startedAt: Date;
  startedAtIso: string;
  notificationCopy: { title: string; body: string };
  announcement: string;
  /** Snapshot to persist once scheduling resolves; `notificationId` is filled by the commit. */
  intent: ActiveTimerIntent;
};

export function planTimerStartup(
  request: TimerStartRequest,
  config: TimerStartConfiguration,
  now: Date,
): TimerStartupPlan {
  // Resolve mode and duration before any await: a preset or settings write
  // landing mid-start must not change what this session became.
  const mode: PomodoroMode = request.requestedDurationMinutes === undefined ? config.mode : 'focus';
  const durationSeconds =
    request.requestedDurationMinutes === undefined
      ? getModeDuration(mode, config.settings)
      : Math.round(request.requestedDurationMinutes * 60);
  const startedAtIso = now.toISOString();
  return {
    mode,
    durationSeconds,
    startedAt: now,
    startedAtIso,
    notificationCopy: timerEndNotificationCopy(mode),
    announcement: `${getModeLabel(mode)} started — ${Math.round(durationSeconds / 60)} minutes`,
    intent: {
      startedAtIso,
      mode,
      totalSeconds: durationSeconds,
      completedFocus: config.completedFocus,
      // Filled in once scheduling resolves; the intent is only written after.
      notificationId: null,
    },
  };
}

/** Side effects the startup sequence needs; the screen supplies its own setters. */
export type TimerStartupEnvironment = {
  /**
   * Injectable only so tests can hold the promise open; production passes the
   * real scheduler, whose native permission prompt is the real-world delay.
   */
  scheduleTimerEndNotification: (
    seconds: number,
    title: string,
    body: string,
  ) => Promise<string | null>;
  /** `web` short-circuits native scheduling; a null id there is not a failure. */
  platform: 'web' | 'native';
  cancelScheduledNotification: (id: string | null) => Promise<void> | void;
};

export type TimerStartupEffects = {
  /** Drop the previous end notification before the new one is scheduled. */
  cancelPreviousNotification: () => void;
  /** Commit the accepted session: clock, phase, configuration dismissal. */
  commit: (input: {
    plan: TimerStartupPlan;
    notificationId: string | null;
    schedule: TimerEndSchedule;
  }) => void | Promise<void>;
  /** Report that the end notification will not fire (native only). */
  reportScheduleWarning: (schedule: TimerEndSchedule) => void;
  /** A rejected startup: return to idle with no session, intent, or orphan. */
  recover: (message: string) => void | Promise<void>;
};

export type TimerStartupOutcome =
  | { outcome: 'started'; plan: TimerStartupPlan; schedule: TimerEndSchedule }
  | { outcome: 'failed'; message: string };

/**
 * Run one accepted start to completion. The caller holds the start claim for
 * the whole await, so no configuration callback can run against a
 * half-started session.
 *
 * Failure contract: a rejected scheduling call cancels anything it managed to
 * schedule, writes no durable intent, restores the idle clock, and leaves the
 * timer startable again. A null id with permission denied — or on web — is a
 * successful start carrying a warning, never a failure.
 */
export async function runTimerStartup(
  plan: TimerStartupPlan,
  env: TimerStartupEnvironment,
  effects: TimerStartupEffects,
): Promise<TimerStartupOutcome> {
  effects.cancelPreviousNotification();

  let notificationId: string | null = null;
  try {
    notificationId = await env.scheduleTimerEndNotification(
      plan.durationSeconds,
      plan.notificationCopy.title,
      plan.notificationCopy.body,
    );
  } catch (error) {
    // Defensive: a partially applied native schedule must never survive a
    // rejected startup as an orphan alert the screen no longer owns.
    await env.cancelScheduledNotification(notificationId);
    const message = startupFailureMessage(error);
    await effects.recover(message);
    return { outcome: 'failed', message };
  }

  const schedule = classifyTimerEndSchedule(notificationId, env.platform);
  if (schedule.warning !== null) effects.reportScheduleWarning(schedule);

  try {
    await effects.commit({ plan, notificationId: schedule.notificationId, schedule });
  } catch (error) {
    // The commit is the screen's own state write; if it rejects the session is
    // not reliably running, so undo the scheduling and return to idle.
    await env.cancelScheduledNotification(schedule.notificationId);
    const message = startupFailureMessage(error);
    await effects.recover(message);
    return { outcome: 'failed', message };
  }

  return { outcome: 'started', plan, schedule };
}

function startupFailureMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : 'The timer could not be started.';
}
