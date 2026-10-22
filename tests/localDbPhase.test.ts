import { describe, expect, it, vi } from 'vitest';

import {
  LOCAL_DB_PHASE_TIMEOUT_MS,
  LocalDbPhaseTimeoutError,
  getDbBootstrapTimeoutMessage,
  isLocalDbPhaseTimeout,
  withLocalDbTimeout,
} from '@/core/providers/localDbPhase';

/**
 * The local database bootstrap phase used to be the ONE unbounded phase in
 * startup: every remote phase was bounded by `withRemoteTimeout`, but
 * `await initializeDatabase()` was not. On web a second tab holding the
 * origin-wide OPFS write lock can make `openDatabaseAsync` STALL rather than
 * reject, which left the gate on "Preparing local workspace" forever — and the
 * gate only renders "Try again" when `dbError` is set, so there was no escape.
 *
 * These tests pin the contract that closes that gap, and they deliberately pin
 * the two properties that make the fix safe: a task that finishes in time is
 * never failed, and the underlying work is never cancelled.
 */
describe('withLocalDbTimeout', () => {
  it('resolves with the task result when it settles in time', async () => {
    await expect(withLocalDbTimeout(Promise.resolve('db'), 'local database', 50)).resolves.toBe(
      'db',
    );
  });

  it('rejects with a distinguishable timeout error when the task stalls', async () => {
    vi.useFakeTimers();
    try {
      // A promise that never settles models a stalled openDatabaseAsync.
      const never = new Promise<string>(() => undefined);
      const bounded = withLocalDbTimeout(never, 'local database', 30_000);
      const assertion = expect(bounded).rejects.toBeInstanceOf(LocalDbPhaseTimeoutError);
      await vi.advanceTimersByTimeAsync(30_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not cancel or consume the underlying task', async () => {
    // The stall must be recoverable: the real bootstrap keeps running and its
    // eventual success is still usable, so a retry adopts it instead of
    // re-opening the database.
    vi.useFakeTimers();
    try {
      let settle: (value: string) => void = () => undefined;
      const task = new Promise<string>((resolve) => {
        settle = resolve;
      });
      const bounded = withLocalDbTimeout(task, 'local database', 1000);
      const assertion = expect(bounded).rejects.toBeInstanceOf(LocalDbPhaseTimeoutError);
      await vi.advanceTimersByTimeAsync(1000);
      await assertion;

      settle('eventually-opened');
      await expect(task).resolves.toBe('eventually-opened');
    } finally {
      vi.useRealTimers();
    }
  });

  it('propagates the task error unchanged rather than masking it as a timeout', async () => {
    const boom = new Error('real bootstrap failure');
    await expect(withLocalDbTimeout(Promise.reject(boom), 'local database', 50)).rejects.toBe(boom);
  });

  it('treats a non-positive or non-finite budget as "unbounded"', async () => {
    // Escape hatch for callers (and tests) that explicitly want the old
    // behaviour; keeps the helper harmless where no bound is wanted.
    await expect(withLocalDbTimeout(Promise.resolve(1), 'x', 0)).resolves.toBe(1);
    await expect(
      withLocalDbTimeout(Promise.resolve(2), 'x', Number.POSITIVE_INFINITY),
    ).resolves.toBe(2);
  });

  it('uses a budget generous enough to survive a cold first-launch migration', () => {
    // The bound must not fail a legitimately SLOW start, only a genuine stall.
    // A too-tight value would convert a working slow launch into an error gate.
    expect(LOCAL_DB_PHASE_TIMEOUT_MS).toBeGreaterThanOrEqual(20_000);
    // ...while still being far short of "forever".
    expect(LOCAL_DB_PHASE_TIMEOUT_MS).toBeLessThanOrEqual(60_000);
  });

  it('narrows error types so the caller can pick the right copy', () => {
    expect(isLocalDbPhaseTimeout(new LocalDbPhaseTimeoutError('local database'))).toBe(true);
    expect(isLocalDbPhaseTimeout(new Error('timed out'))).toBe(false);
    expect(isLocalDbPhaseTimeout(null)).toBe(false);
  });
});

describe('getDbBootstrapTimeoutMessage', () => {
  it('names the real cause on web without claiming the browser is unsupported', () => {
    const message = getDbBootstrapTimeoutMessage({ platformOs: 'web' });
    // The distinguishing failure mode of a stall is another tab holding the lock.
    expect(message).toMatch(/another tab|other .*tabs/i);
    // A stall is NOT evidence of missing browser capability — that copy belongs
    // to the SharedArrayBuffer failure path only.
    expect(message).not.toMatch(/does not support/i);
    // Reassurance is mandatory: local-first means this is the only copy.
    expect(message).toMatch(/still safe on this device/i);
  });

  it('never advises clearing site data, which would destroy the user database', () => {
    for (const platformOs of ['web', 'ios', 'android']) {
      const message = getDbBootstrapTimeoutMessage({ platformOs });
      expect(message).not.toMatch(/clear (?:site |browser )?data/i);
      expect(message).not.toMatch(/delete the database/i);
      expect(message).toMatch(/still safe on this device/i);
    }
  });

  it('drops the tab hint on native, where the OPFS lock cannot apply', () => {
    const native = getDbBootstrapTimeoutMessage({ platformOs: 'android' });
    expect(native).not.toMatch(/another tab/i);
    expect(native).toMatch(/try again/i);
  });
});
