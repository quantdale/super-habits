import { useCallback, useEffect, useRef } from 'react';

/**
 * Guards async refresh callbacks against two long-session hazards:
 * setState after unmount, and an older request resolving after a newer one
 * (around local-midnight rollover, rapid section switches, or repeated
 * foreground events) and overwriting fresher state with stale-day results.
 *
 * Call `begin()` at the top of each refresh run; the returned `isCurrent`
 * predicate is true only while that run is still the newest one and the
 * component remains mounted. Check it before applying any state.
 */
export function useGuardedAsyncRefresh() {
  const mountedRef = useRef(true);
  const requestRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const begin = useCallback(() => {
    const requestId = ++requestRef.current;
    return () => mountedRef.current && requestRef.current === requestId;
  }, []);

  return { begin };
}
