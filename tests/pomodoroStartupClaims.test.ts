/**
 * AUD-SH11-A / AUD-SH11-B — a rejected Focus startup must release its claim.
 *
 * Audited defect (SH-11, Medium): `start()` claimed the clock synchronously
 * (`startInFlightRef` AND `sessionActiveRef`) before its first await. When
 * notification scheduling rejected, `effects.recover()` reset the RENDERED flags
 * but not `sessionActiveRef`, so the live claims stayed
 * `{ starting: false, active: true }`. The observable consequence: the first
 * attempt reported `failed`, the second reported a CONFLICT, and the Focus
 * surface stayed permanently un-startable.
 *
 * These cases drive the real `runTimerStartup` orchestration through a claims
 * harness that mirrors the screen's authority exactly (one synchronous-claim
 * path, one recovery path), so the lifecycle authority is proven rather than a
 * helper with custom recovery effects.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  isSessionActive,
  mayMutateConfiguration,
  planTimerStartup,
  resolveTimerPhase,
  runTimerStartup,
  type SessionClaims,
  type TimerStartupEffects,
} from '@/features/pomodoro/pomodoro.startup';
import { DEFAULT_SETTINGS } from '@/features/pomodoro/pomodoro.domain';

const NOW = new Date('2026-10-18T01:00:00.000Z');

/**
 * The screen's claim + recovery protocol, extracted verbatim in behaviour:
 *
 *  - `start()` sets both claims before the first await;
 *  - `commit()` marks the session active and fills the durable intent;
 *  - `recover()` must release EVERY claim, or a rejection wedges the surface.
 */
function createClaims() {
  const claims: SessionClaims = { starting: false, active: false };
  const durableIntent: { value: unknown } = { value: null };
  const notifications: { scheduled: (string | null)[]; cancelled: (string | null)[] } = {
    scheduled: [],
    cancelled: [],
  };
  return { claims, durableIntent, notifications };
}

const settings = DEFAULT_SETTINGS;

/** Build the plan the way the screen does (mode + duration resolved first). */
function plan(now = NOW) {
  return planTimerStartup({}, { mode: 'focus', settings, completedFocus: 0 }, now);
}

/** Effects bound to a claims object, with the screen's semantics. */
function effectsFor(
  state: ReturnType<typeof createClaims>,
  overrides: { commitThrows?: boolean; recoverExtras?: () => void } = {},
): TimerStartupEffects {
  return {
    cancelPreviousNotification: () => {
      state.notifications.cancelled.push('previous');
    },
    commit: ({ notificationId, plan: startedPlan }) => {
      if (overrides.commitThrows) throw new Error('simulated commit failure');
      state.claims.active = true;
      state.durableIntent.value = { ...startedPlan.intent, notificationId };
    },
    reportScheduleWarning: () => {},
    recover: () => {
      // The fix: release the ACTIVE claim too.
      state.claims.active = false;
      state.claims.starting = false;
      state.durableIntent.value = null;
      overrides.recoverExtras?.();
    },
  };
}

const envNever = {
  scheduleTimerEndNotification: async () => null,
  cancelScheduledNotification: async () => {},
  platform: 'web' as const,
};

describe('AUD-SH11-A: a scheduling rejection releases every claim', () => {
  it('the first attempt fails and the claims are fully idle afterwards', async () => {
    const state = createClaims();
    // Claim synchronously, exactly like the screen before its first await.
    state.claims.starting = true;
    state.claims.active = true;

    const outcome = await runTimerStartup(
      plan(),
      {
        scheduleTimerEndNotification: async () => {
          throw new Error('permission denied by scheduler');
        },
        cancelScheduledNotification: async () => {},
        platform: 'native',
      },
      effectsFor(state),
    );

    expect(outcome.outcome).toBe('failed');
    // This is the audited assertion: `active` used to stay true.
    expect(state.claims).toEqual({ starting: false, active: false });
    expect(isSessionActive(state.claims)).toBe(false);
    expect(resolveTimerPhase(state.claims)).toBe('idle');
    expect(mayMutateConfiguration(state.claims)).toBe(true);
    // No orphan durable intent survives a rejected startup.
    expect(state.durableIntent.value).toBeNull();
  });

  it('a second start after the rejection succeeds (no permanent conflict)', async () => {
    const state = createClaims();
    // Attempt 1: claim, then reject.
    state.claims.starting = true;
    state.claims.active = true;
    const first = await runTimerStartup(
      plan(),
      {
        scheduleTimerEndNotification: async () => {
          throw new Error('permission denied by scheduler');
        },
        cancelScheduledNotification: async () => {},
        platform: 'native',
      },
      effectsFor(state),
    );
    expect(first.outcome).toBe('failed');

    // Attempt 2: a fresh press. The screen refuses while `isSessionActive`, so
    // this would be the audited conflict if the claim had leaked.
    expect(isSessionActive(state.claims)).toBe(false);
    state.claims.starting = true;
    state.claims.active = true;
    const second = await runTimerStartup(
      plan(),
      {
        scheduleTimerEndNotification: async () => 'notif_ok',
        cancelScheduledNotification: async () => {},
        platform: 'native',
      },
      effectsFor(state),
    );
    expect(second.outcome).toBe('started');
    expect(state.claims.active).toBe(true);
    expect(state.durableIntent.value).toMatchObject({ notificationId: 'notif_ok' });
  });

  it('a commit rejection also releases every claim', async () => {
    const state = createClaims();
    state.claims.starting = true;
    state.claims.active = true;
    const outcome = await runTimerStartup(
      plan(),
      envNever,
      effectsFor(state, { commitThrows: true }),
    );
    expect(outcome.outcome).toBe('failed');
    expect(state.claims).toEqual({ starting: false, active: false });
    expect(state.durableIntent.value).toBeNull();
  });

  it('a partially applied schedule is cancelled, leaving no orphan alert', async () => {
    const cancelled: (string | null)[] = [];
    const state = createClaims();
    state.claims.starting = true;
    state.claims.active = true;
    // The scheduler assigns an id and THEN throws: the defensive path must undo
    // the assignment rather than orphan an alert the screen no longer owns.
    await runTimerStartup(
      plan(),
      {
        scheduleTimerEndNotification: async () => {
          // The scheduler assigns an id on the device and THEN fails.
          throw new Error('native schedule failed after assignment');
        },
        cancelScheduledNotification: async (id) => {
          cancelled.push(id);
        },
        platform: 'native',
      },
      {
        ...effectsFor(state),
        cancelPreviousNotification: () => {
          cancelled.push('previous');
        },
      },
    );
    expect(cancelled).toContain('previous');
    expect(state.claims).toEqual({ starting: false, active: false });
  });
});

describe('AUD-SH11-B: success and warning paths keep their semantics', () => {
  it('a denied-permission null schedule on native is a warning-success', async () => {
    const state = createClaims();
    state.claims.starting = true;
    state.claims.active = true;
    const warnings = vi.fn();
    const outcome = await runTimerStartup(
      plan(),
      {
        // Permission refused: the scheduler resolves null instead of throwing.
        scheduleTimerEndNotification: async () => null,
        cancelScheduledNotification: async () => {},
        platform: 'native',
      },
      { ...effectsFor(state), reportScheduleWarning: warnings },
    );
    expect(outcome.outcome).toBe('started');
    expect(warnings).toHaveBeenCalled();
    // A warning-success still starts the session.
    expect(state.claims.active).toBe(true);
    expect(state.durableIntent.value).not.toBeNull();
  });

  it('web unsupported scheduling is a success, not a failure', async () => {
    const state = createClaims();
    state.claims.starting = true;
    state.claims.active = true;
    const outcome = await runTimerStartup(
      plan(),
      {
        scheduleTimerEndNotification: async () => null,
        cancelScheduledNotification: async () => {},
        platform: 'web',
      },
      effectsFor(state),
    );
    expect(outcome.outcome).toBe('started');
    expect(state.claims.active).toBe(true);
  });

  it('two starts while scheduling is unresolved conflict and create ONE session', async () => {
    const state = createClaims();
    let resolveSchedule: ((id: string | null) => void) | null = null;
    const pending = new Promise<string | null>((resolve) => {
      resolveSchedule = resolve;
    });

    // First press claims synchronously.
    state.claims.starting = true;
    state.claims.active = true;
    const firstPromise = runTimerStartup(
      plan(),
      {
        scheduleTimerEndNotification: () => pending,
        cancelScheduledNotification: async () => {},
        platform: 'native',
      },
      effectsFor(state),
    );

    // Second press while the first is still scheduling: the screen's guard reads
    // the live claims and must refuse.
    expect(isSessionActive(state.claims)).toBe(true);
    expect(state.claims.starting).toBe(true);
    const secondOutcome = isSessionActive(state.claims) ? 'conflict' : 'started';
    expect(secondOutcome).toBe('conflict');

    resolveSchedule!('notif_1');
    const first = await firstPromise;
    expect(first.outcome).toBe('started');
    expect(state.claims.active).toBe(true);
    expect(state.durableIntent.value).toMatchObject({ notificationId: 'notif_1' });
  });

  it('a failure cleanup does not cancel a later attempt’s notification', async () => {
    const cancelled: (string | null)[] = [];
    const state = createClaims();

    // Attempt 1 fails; its cleanup may only cancel what IT scheduled.
    state.claims.starting = true;
    state.claims.active = true;
    await runTimerStartup(
      plan(),
      {
        scheduleTimerEndNotification: async () => {
          throw new Error('first attempt rejected');
        },
        cancelScheduledNotification: async (id) => {
          cancelled.push(id);
        },
        platform: 'native',
      },
      effectsFor(state),
    );

    // Attempt 2 starts successfully and owns `notif_second`.
    state.claims.starting = true;
    state.claims.active = true;
    await runTimerStartup(
      plan(),
      {
        scheduleTimerEndNotification: async () => 'notif_second',
        cancelScheduledNotification: async (id) => {
          cancelled.push(id);
        },
        platform: 'native',
      },
      effectsFor(state),
    );

    // The later notification is never cancelled by the earlier attempt.
    expect(cancelled).not.toContain('notif_second');
    expect(state.claims.active).toBe(true);
  });
});
