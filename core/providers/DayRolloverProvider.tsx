import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState, Platform } from 'react-native';
import { toDateKey } from '@/lib/time';

const DayRolloverContext = createContext(0);

/** Return true only when the local calendar day has changed. */
export function didLocalDayRollOver(previousDayKey: string, currentDayKey: string): boolean {
  return previousDayKey !== currentDayKey;
}

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
    // One app-wide check is deliberately shared by all mounted sections. The
    // short interval also lets deterministic browser-clock journeys observe a
    // setSystemTime() day jump without requiring a reload or a user gesture.
    const intervalId = setInterval(checkDay, 1_000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkDay();
    };
    let removeVisibilityListener: (() => void) | undefined;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
      removeVisibilityListener = () =>
        document.removeEventListener('visibilitychange', onVisibilityChange);
    }

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') checkDay();
    });

    return () => {
      clearInterval(intervalId);
      removeVisibilityListener?.();
      appStateSubscription.remove();
    };
  }, [checkDay]);

  return <DayRolloverContext.Provider value={generation}>{children}</DayRolloverContext.Provider>;
}

export function useDayRolloverGeneration(): number {
  return useContext(DayRolloverContext);
}
