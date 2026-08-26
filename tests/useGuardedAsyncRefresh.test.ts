import { describe, expect, it } from 'vitest';

import { createAsyncRefreshGuard } from '@/lib/useGuardedAsyncRefresh';

describe('createAsyncRefreshGuard', () => {
  it('keeps a generation current while it is the newest and the guard is mounted', () => {
    const guard = createAsyncRefreshGuard();
    const isCurrent = guard.begin();
    expect(isCurrent()).toBe(true);
  });

  it('invalidates an older generation when a newer one begins on the same guard', () => {
    const guard = createAsyncRefreshGuard();
    const first = guard.begin();
    const second = guard.begin();
    expect(first()).toBe(false);
    expect(second()).toBe(true);
  });

  it('keeps only the newest of many sequential generations', () => {
    const guard = createAsyncRefreshGuard();
    const first = guard.begin();
    const second = guard.begin();
    const third = guard.begin();
    expect(first()).toBe(false);
    expect(second()).toBe(false);
    expect(third()).toBe(true);
  });

  it('reports every generation stale once the guard reports unmount', () => {
    const guard = createAsyncRefreshGuard();
    const isCurrent = guard.begin();
    expect(isCurrent()).toBe(true);
    guard.setMounted(false);
    expect(isCurrent()).toBe(false);
  });

  it('gives each independent guard its own generation space', () => {
    const screenLevelGuard = createAsyncRefreshGuard();
    const otherStreamGuard = createAsyncRefreshGuard();
    const screenIsCurrent = screenLevelGuard.begin();
    const otherIsCurrent = otherStreamGuard.begin();
    expect(screenIsCurrent()).toBe(true);
    expect(otherIsCurrent()).toBe(true);
  });

  it('shares one generation across all sub-reads of a refresh unit', async () => {
    // Regression shape for the Pomodoro focus-history discard: a refresh
    // fan-out must pass ONE predicate to every concurrent sub-read instead
    // of letting each sub-read begin its own generation.
    const guard = createAsyncRefreshGuard();
    const isCurrent = guard.begin();
    const applied: string[] = [];
    const subRead = async (name: string) => {
      await Promise.resolve();
      if (isCurrent()) applied.push(name);
    };
    await Promise.all([subRead('history'), subRead('settings')]);
    expect(applied).toEqual(['history', 'settings']);
  });
});
