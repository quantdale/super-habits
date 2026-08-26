import { useCallback, useEffect, useMemo } from 'react';

/**
 * Framework-free core of the refresh guard, extracted so the ownership
 * contract is unit-testable without a React render harness.
 *
 * One guard instance represents ONE refresh stream. `begin()` starts a new
 * generation and returns an `isCurrent` predicate that stays true only while
 * that generation is the newest one on this guard and the guard is mounted.
 */
export function createAsyncRefreshGuard() {
  let mounted = true;
  let latestRequestId = 0;

  return {
    setMounted(value: boolean): void {
      mounted = value;
    },
    begin(): () => boolean {
      const requestId = ++latestRequestId;
      return () => mounted && latestRequestId === requestId;
    },
  };
}

export type AsyncRefreshGuard = ReturnType<typeof createAsyncRefreshGuard>;

/**
 * Guards async refresh callbacks against two long-session hazards:
 * setState after unmount, and an older request resolving after a newer one
 * (around local-midnight rollover, rapid section switches, or repeated
 * foreground events) and overwriting fresher state with stale-day results.
 *
 * Ownership rule: acquire the predicate ONCE per refresh unit — the top of
 * the screen's refresh function — and share it across every concurrent
 * sub-read of that unit. Each `begin()` invalidates all earlier predicates
 * from this guard, so per-loader `begin()` calls inside one fan-out would
 * discard the unit's own in-flight results.
 */
export function useGuardedAsyncRefresh() {
  const guard = useMemo(() => createAsyncRefreshGuard(), []);

  useEffect(() => {
    guard.setMounted(true);
    return () => {
      guard.setMounted(false);
    };
  }, [guard]);

  const begin = useCallback(() => guard.begin(), [guard]);

  return { begin };
}
