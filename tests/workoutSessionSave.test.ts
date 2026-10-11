import { describe, expect, it } from 'vitest';
import { resolveSessionSave } from '@/features/workout/workoutSessionView';
import { createSubmitGuard } from '@/lib/submitGuard';

/**
 * W9.5 save-integrity decision contract.
 *
 * `WorkoutSessionScreen.handleFinish()` decides saved-vs-not-saved through
 * `resolveSessionSave()`. A workout is saved only when the log write returned
 * `applied` AND a non-empty log id; `logWorkoutSession()` can return
 * `skipped` without throwing (its routine was soft-deleted mid-session), and
 * an applied result without an id fails closed. These tests pin that
 * decision and the exactly-once finish guard so a double Finish press can
 * never produce a second committed session or reward.
 */

describe('resolveSessionSave — durable-success contract', () => {
  it('treats an applied result with a log id as saved', () => {
    const decision = resolveSessionSave({
      status: 'applied',
      logId: 'wrk_123',
    });
    expect(decision).toEqual({ saved: true, logId: 'wrk_123', message: null });
  });

  it('never treats a skipped result as saved', () => {
    const decision = resolveSessionSave({
      status: 'skipped',
      logId: null,
      reason: 'target_missing',
    });
    expect(decision.saved).toBe(false);
    expect(decision.logId).toBeNull();
  });

  it('names the missing routine when the routine is no longer available', () => {
    const decision = resolveSessionSave({
      status: 'skipped',
      logId: null,
      reason: 'target_missing',
    });
    expect(decision.message).toContain("wasn't saved");
    expect(decision.message).toContain('routine is no longer available');
    expect(decision.message).toContain('entered sets are still here');
    // It must not promise resume of a session whose routine is gone.
    expect(decision.message).not.toMatch(/resume|recover|restore/i);
  });

  it('fails closed on an inconsistent applied result without a log id', () => {
    expect(resolveSessionSave({ status: 'applied', logId: null }).saved).toBe(false);
    expect(resolveSessionSave({ status: 'applied', logId: '' }).saved).toBe(false);
  });

  it('gives a retryable message when no specific reason is known', () => {
    const decision = resolveSessionSave({ status: 'skipped', logId: null });
    expect(decision.saved).toBe(false);
    expect(decision.message).toContain("wasn't saved");
    expect(decision.message).toContain('try again');
  });

  it('never clears or rewards on any non-saved decision', () => {
    // The success branch is keyed on `saved && logId`; every non-saved shape
    // must fail that predicate.
    const shapes = [
      { status: 'skipped' as const, logId: null },
      { status: 'skipped' as const, logId: null, reason: 'target_missing' },
      { status: 'applied' as const, logId: null },
      { status: 'applied' as const, logId: '' },
    ];
    for (const shape of shapes) {
      const decision = resolveSessionSave(shape);
      expect(Boolean(decision.saved && decision.logId)).toBe(false);
      expect(typeof decision.message).toBe('string');
      expect(decision.message!.length).toBeGreaterThan(0);
    }
  });
});

describe('createSubmitGuard — double Finish cannot double-write', () => {
  it('drops a second concurrent submission', async () => {
    const guard = createSubmitGuard();
    expect(guard.tryStart()).toBe(true);
    let secondRan = false;
    if (guard.tryStart()) secondRan = true;
    expect(secondRan).toBe(false);
    guard.finish();
    expect(guard.tryStart()).toBe(true);
  });

  it('serializes rapid sequential finishes into exactly one write', async () => {
    const guard = createSubmitGuard();
    let writes = 0;
    const finish = async () => {
      if (!guard.tryStart()) return;
      try {
        await Promise.resolve();
        writes += 1;
      } finally {
        guard.finish();
      }
    };
    await Promise.all([finish(), finish(), finish()]);
    expect(writes).toBe(1);
  });
});
