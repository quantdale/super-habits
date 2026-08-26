import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REMOTE_PHASE_TIMEOUT_MS, withRemoteTimeout } from '@/core/providers/remotePhase';

describe('withRemoteTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves with the task result when it settles before the deadline', async () => {
    const task = Promise.resolve('ok');
    await expect(withRemoteTimeout(task, 'probe')).resolves.toBe('ok');
  });

  it('rejects when the task is still pending at the deadline', async () => {
    const task = new Promise<string>(() => undefined);
    const awaited = withRemoteTimeout(task, 'hung phase');
    const assertion = expect(awaited).rejects.toThrow('remote phase "hung phase" timed out');
    await vi.advanceTimersByTimeAsync(REMOTE_PHASE_TIMEOUT_MS + 1);
    await assertion;
  });

  it('does not leave a stray timer after the task settles', async () => {
    const task = Promise.resolve('ok');
    await withRemoteTimeout(task, 'probe');
    expect(vi.getTimerCount()).toBe(0);
  });
});
