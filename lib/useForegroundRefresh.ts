import { useCallback, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState, Platform } from 'react-native';

export function useForegroundRefresh(onRefresh: () => void | Promise<void>) {
  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        void onRefresh();
      }
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void onRefresh();
      }
    };

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      appStateSubscription.remove();
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [onRefresh]);
}

export function useFocusForegroundRefresh(onRefresh: () => void | Promise<void>) {
  const handleRefresh = useCallback(() => {
    void onRefresh();
  }, [onRefresh]);

  useFocusEffect(handleRefresh);
  useForegroundRefresh(handleRefresh);
}

/**
 * Like `useFocusForegroundRefresh`, but triggers the refresh when `isActive`
 * becomes true instead of when the route gains focus. Use this for screens
 * rendered inside a single-route section switcher.
 */
export function useActiveForegroundRefresh(
  isActive: boolean,
  onRefresh: () => void | Promise<void>,
) {
  const handleRefresh = useCallback(() => {
    void onRefresh();
  }, [onRefresh]);

  useEffect(() => {
    if (isActive) {
      handleRefresh();
    }
  }, [isActive, handleRefresh]);

  useForegroundRefresh(handleRefresh);
}
