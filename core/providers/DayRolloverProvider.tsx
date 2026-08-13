import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import { toDateKey } from '@/lib/time';
import { didLocalDayRollOver, getMillisecondsUntilNextLocalMidnight } from './dayRollover';
import { DayRolloverContext } from './dayRolloverContext';

const MAX_TIMER_DELAY_MS = 2_147_000_000;

export function DayRolloverProvider({ children }: PropsWithChildren) {
  const lastDayKeyRef = useRef(toDateKey());
  const [generation, setGeneration] = useState(0);

  const checkDay = useCallback(() => {
    const currentDayKey = toDateKey();
    if (!didLocalDayRollOver(lastDayKeyRef.current, currentDayKey)) return;

    lastDayKeyRef.current = currentDayKey;
    setGeneration((current) => current + 1);
  }, []);

  useEffect(() => {
    // One app-wide timer is shared by all mounted sections. It wakes at the
    // next local midnight; foreground/visibility events handle sleep, clock,
    // and timezone changes without a permanent high-frequency poll.
    let timerId: ReturnType<typeof setTimeout> | undefined;
    const scheduleNextCheck = () => {
      if (timerId !== undefined) clearTimeout(timerId);
      const delay = Math.min(getMillisecondsUntilNextLocalMidnight(), MAX_TIMER_DELAY_MS);
      timerId = setTimeout(() => {
        checkDay();
        scheduleNextCheck();
      }, delay);
    };
    const checkAndReschedule = () => {
      checkDay();
      scheduleNextCheck();
    };

    scheduleNextCheck();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkAndReschedule();
    };
    let removeVisibilityListener: (() => void) | undefined;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
      removeVisibilityListener = () =>
        document.removeEventListener('visibilitychange', onVisibilityChange);
    }

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') checkAndReschedule();
    });

    return () => {
      if (timerId !== undefined) clearTimeout(timerId);
      removeVisibilityListener?.();
      appStateSubscription.remove();
    };
  }, [checkDay]);

  return <DayRolloverContext.Provider value={generation}>{children}</DayRolloverContext.Provider>;
}
