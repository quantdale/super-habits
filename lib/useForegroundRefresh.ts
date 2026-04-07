import { useCallback, useEffect } from "react";
import { useFocusEffect } from "expo-router";
import { AppState, Platform } from "react-native";

export function useForegroundRefresh(onRefresh: () => void | Promise<void>) {
  useEffect(() => {
    const appStateSubscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        void onRefresh();
      }
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void onRefresh();
      }
    };

    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      appStateSubscription.remove();
      if (Platform.OS === "web" && typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
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
