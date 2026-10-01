import { useCallback, useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { createActivationRefresh, registerForegroundListeners } from '@/lib/foregroundListeners';

/**
 * Refresh on every foreground transition.
 *
 * On web, `AppState` is derived from the DOM `visibilitychange` event, so only
 * the `AppState` listener is registered — adding the DOM listener as well would
 * run the consumer's refresh twice per foreground. See
 * `lib/foregroundListeners.ts` for the contract and its coverage.
 */
export function useForegroundRefresh(onRefresh: () => void | Promise<void>) {
  useEffect(() => {
    return registerForegroundListeners(
      () => {
        void onRefresh();
      },
      {
        appState: AppState,
        appStateIsDomDriven: Platform.OS === 'web',
        document: typeof document !== 'undefined' ? document : undefined,
      },
    );
  }, [onRefresh]);
}

/**
 * Like `useForegroundRefresh`, but also triggers the refresh when `isActive`
 * becomes true instead of when the route gains focus. Use this for screens
 * rendered inside a single-route section switcher.
 */
export function useActiveForegroundRefresh(
  isActive: boolean,
  onRefresh: () => void | Promise<void>,
  dayGeneration = 0,
) {
  const handleRefresh = useCallback(() => {
    void onRefresh();
  }, [onRefresh]);

  useEffect(() => {
    // One refresh per generation bump / activation change, on its own signal.
    createActivationRefresh({ isActive, onRefresh: handleRefresh })();
  }, [dayGeneration, isActive, handleRefresh]);

  useForegroundRefresh(handleRefresh);
}
