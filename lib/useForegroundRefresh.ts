import { useEffect } from "react";
import { AppState, Platform } from "react-native";

export function useForegroundRefresh(onRefresh: () => void) {
  useEffect(() => {
    const appStateSubscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        onRefresh();
      }
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        onRefresh();
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
