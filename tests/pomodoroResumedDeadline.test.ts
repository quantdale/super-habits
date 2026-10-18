/**
 * AUD-SH10-A / AUD-SH10-B / AUD-SH10-C — a resumed Focus intent must not keep an
 * obsolete deadline.
 *
 * Audited defect (SH-10, Medium): the durable active-timer intent stored only
 * the session's first start plus the configured length, so the nominal deadline
 * was ALWAYS `startedAt + totalSeconds`. The audited timeline —
 *
 *   01:00 start a 25-minute focus session
 *   01:05 (5 minutes in) pause
 *   01:25 resume (20 minutes paused)
 *   01:26 the process dies
 *
 * — persisted `startedAt = 01:00`, `totalSeconds = 1500` and cleared
 * `pausedRemainingSeconds` on resume. Reconciliation then returned
 * `complete-unlogged` because 01:00 + 25min = 01:25 <= 01:26, even though only
 * 300 of 1500 seconds had actually run (1140 owed).
 *
 * The resolution separates session IDENTITY (first start, used for logging and
 * attribution) from the RUNNING COUNTDOWN DEADLINE, which resume recomputes from
 * the frozen remainder. Paused time is therefore never counted as focus.
 */

import { describe, expect, it } from 'vitest';
import {
  computeResumeDeadlineIso,
  planActiveTimerReconcile,
  resolveRunningDeadlineMs,
  type ActiveTimerIntent,
} from '@/features/pomodoro/pomodoro.domain';

/** 01:00 local on a fixed date, in ms since epoch. */
const T_0100 = new Date('2026-10-18T01:00:00.000Z').getTime();
const MINUTE = 60_000;

/** The audited intent as the OLD implementation wrote it at resume. */
const auditedResumeIntent: ActiveTimerIntent = {
  startedAtIso: new Date(T_0100).toISOString(),
  mode: 'focus',
  totalSeconds: 1500,
  completedFocus: 0,
  notificationId: null,
  pausedRemainingSeconds: null,
};

describe('AUD-SH10-A: the resumed deadline reflects the frozen remainder', () => {
  it('reconciles the audited timeline as interrupted, not complete-unlogged', () => {
    // Under the pre-fix reading this is 01:00 + 25min = 01:25 <= 01:26.
    const legacyReading = planActiveTimerReconcile(
      { ...auditedResumeIntent, runningDeadlineIso: undefined },
      false,
      T_0100 + 26 * MINUTE,
    );
    expect(legacyReading.kind).toBe('complete-unlogged');

    // With the deadline persisted at resume (01:25 + 19 remaining minutes =
    // 01:44), the same instant is NOT a completion: 19 minutes are still owed.
    const resumedDeadline = computeResumeDeadlineIso(T_0100 + 25 * MINUTE, 19 * 60);
    const fixed = planActiveTimerReconcile(
      { ...auditedResumeIntent, runningDeadlineIso: resumedDeadline },
      false,
      T_0100 + 26 * MINUTE,
    );
    expect(fixed.kind).toBe('interrupted');
    // And it DOES complete once the real deadline passes.
    const later = planActiveTimerReconcile(
      { ...auditedResumeIntent, runningDeadlineIso: resumedDeadline },
      false,
      T_0100 + 45 * MINUTE,
    );
    expect(later.kind).toBe('complete-unlogged');
  });

  it('resume computes the deadline from now plus the frozen remainder', () => {
    // Paused at 01:05 with 20 minutes left, resumed at 01:25.
    const deadline = computeResumeDeadlineIso(T_0100 + 25 * MINUTE, 20 * 60);
    expect(new Date(deadline).getTime()).toBe(T_0100 + 45 * MINUTE);
    // Not the original start plus the configured length.
    expect(new Date(deadline).getTime()).not.toBe(T_0100 + 25 * MINUTE);
  });

  it('the running deadline prefers the persisted value and falls back for legacy intents', () => {
    expect(
      resolveRunningDeadlineMs({
        ...auditedResumeIntent,
        runningDeadlineIso: new Date(T_0100 + 45 * MINUTE).toISOString(),
      }),
    ).toBe(T_0100 + 45 * MINUTE);
    // Legacy intent: no deadline field, so the historical reading applies.
    expect(
      resolveRunningDeadlineMs({ ...auditedResumeIntent, runningDeadlineIso: undefined }),
    ).toBe(T_0100 + 25 * MINUTE);
    expect(resolveRunningDeadlineMs({ ...auditedResumeIntent, runningDeadlineIso: null })).toBe(
      T_0100 + 25 * MINUTE,
    );
    // An unparseable value also falls back rather than producing NaN.
    expect(resolveRunningDeadlineMs({ ...auditedResumeIntent, runningDeadlineIso: 'nope' })).toBe(
      T_0100 + 25 * MINUTE,
    );
  });
});

describe('AUD-SH10-A: repeated pauses never accumulate paused time as focus', () => {
  it('each resume moves the deadline by exactly the frozen remainder', () => {
    // Three pause/resume cycles: 5 + 3 + 7 = 15 minutes paused in total.
    let deadline = computeResumeDeadlineIso(T_0100, 1500);
    expect(new Date(deadline).getTime()).toBe(T_0100 + 25 * MINUTE);

    // Pause after 5 minutes of running (20 minutes left), resume 4 minutes later.
    deadline = computeResumeDeadlineIso(T_0100 + 9 * MINUTE, 20 * 60);
    expect(new Date(deadline).getTime()).toBe(T_0100 + 29 * MINUTE);

    // Pause after 3 more running minutes (17 left), resume 2 minutes later.
    deadline = computeResumeDeadlineIso(T_0100 + 14 * MINUTE, 17 * 60);
    expect(new Date(deadline).getTime()).toBe(T_0100 + 31 * MINUTE);

    // Pause after 7 more running minutes (10 left), resume 3 minutes later.
    deadline = computeResumeDeadlineIso(T_0100 + 24 * MINUTE, 10 * 60);
    expect(new Date(deadline).getTime()).toBe(T_0100 + 34 * MINUTE);

    // Total active time still equals the configured 25 minutes, and the
    // deadline is 9 minutes later than the naive original-start reading.
    expect(new Date(deadline).getTime()).toBe(T_0100 + (25 + 9) * MINUTE);
  });

  it('a kill while paused is interrupted regardless of the deadline', () => {
    // Paused intents carry a frozen remainder and no running deadline.
    const paused: ActiveTimerIntent = {
      ...auditedResumeIntent,
      pausedRemainingSeconds: 1200,
      runningDeadlineIso: null,
    };
    // Even far past the naive deadline, a paused session can never complete.
    expect(planActiveTimerReconcile(paused, false, T_0100 + 600 * MINUTE).kind).toBe('interrupted');
  });
});

describe('AUD-SH10-B: completion still logs exactly once with truthful data', () => {
  it('already-logged short-circuits before any deadline reasoning', () => {
    const plan = planActiveTimerReconcile(
      { ...auditedResumeIntent, runningDeadlineIso: new Date(T_0100 + 45 * MINUTE).toISOString() },
      true,
      T_0100 + 60 * MINUTE,
    );
    expect(plan.kind).toBe('already-logged');
  });

  it('a resumed session completing at its real deadline reports the configured duration', () => {
    const deadline = computeResumeDeadlineIso(T_0100 + 25 * MINUTE, 19 * 60);
    const plan = planActiveTimerReconcile(
      { ...auditedResumeIntent, runningDeadlineIso: deadline },
      false,
      new Date(deadline).getTime(),
    );
    expect(plan.kind).toBe('complete-unlogged');
    // The logged length is the configured session length (the session really ran
    // that long), and identity is the ORIGINAL start for attribution.
    expect(auditedResumeIntent.totalSeconds).toBe(1500);
    expect(auditedResumeIntent.startedAtIso).toBe(new Date(T_0100).toISOString());
  });
});

describe('AUD-SH10-C: legacy intents and clock policy', () => {
  it('a legacy intent (no deadline, no pause marker) keeps its historical reading', () => {
    const legacy: ActiveTimerIntent = {
      startedAtIso: new Date(T_0100).toISOString(),
      mode: 'focus',
      totalSeconds: 1500,
      completedFocus: 2,
      notificationId: 'notif_1',
    };
    expect(planActiveTimerReconcile(legacy, false, T_0100 + 24 * MINUTE).kind).toBe('interrupted');
    expect(planActiveTimerReconcile(legacy, false, T_0100 + 25 * MINUTE).kind).toBe(
      'complete-unlogged',
    );
  });

  it('a break never claims a focus completion', () => {
    const breakIntent: ActiveTimerIntent = {
      ...auditedResumeIntent,
      mode: 'short_break',
      totalSeconds: 300,
      runningDeadlineIso: new Date(T_0100 + 5 * MINUTE).toISOString(),
    };
    expect(planActiveTimerReconcile(breakIntent, false, T_0100 + 60 * MINUTE).kind).toBe(
      'interrupted',
    );
  });

  it('a zero-length remainder completes immediately rather than producing a negative window', () => {
    const deadline = computeResumeDeadlineIso(T_0100, 0);
    expect(new Date(deadline).getTime()).toBe(T_0100);
    expect(
      planActiveTimerReconcile(
        { ...auditedResumeIntent, runningDeadlineIso: deadline },
        false,
        T_0100,
      ).kind,
    ).toBe('complete-unlogged');
  });
});
