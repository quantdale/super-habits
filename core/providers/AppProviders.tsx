import { PropsWithChildren, useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Platform, Text, View } from "react-native";
import { initializeDatabase } from "@/core/db/client";
import { registerServiceWorker } from "@/core/pwa/registerServiceWorker";
import { ensureGuestProfile } from "@/core/auth/guestProfile";
import { syncEngine } from "@/core/sync/sync.engine";
import { ensureAnonymousSession, isRemoteEnabled } from "@/lib/supabase";

const queryClient = new QueryClient();

export function AppProviders({ children }: PropsWithChildren) {
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    initializeDatabase().catch((e) => {
      console.error("[db] initializeDatabase failed", e);
      setDbError(
        Platform.OS === "web"
          ? "This browser does not support the required features to run SuperHabits. Try Chrome or Edge with site data cleared."
          : "Database failed to initialize. Please restart the app.",
      );
    });
    registerServiceWorker();
    ensureGuestProfile().catch(() => undefined);
    ensureAnonymousSession().catch((e) => {
      console.error("[auth] ensureAnonymousSession failed", e);
    });
  }, []);

  useEffect(() => {
    if (!isRemoteEnabled()) return;

    const flush = () => {
      void syncEngine.flush().catch((e) => {
        console.error("[sync] flush failed", e);
      });
    };

    const intervalId = setInterval(flush, 30_000);

    let removeVisibilityListener: (() => void) | undefined;
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const onVisibilityChange = () => {
        if (document.visibilityState === "hidden") flush();
      };
      document.addEventListener("visibilitychange", onVisibilityChange);
      removeVisibilityListener = () =>
        document.removeEventListener("visibilitychange", onVisibilityChange);
    }

    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      if (state.isConnected) flush();
    });

    return () => {
      clearInterval(intervalId);
      removeVisibilityListener?.();
      unsubscribeNetInfo();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        {dbError ? (
          <View className="flex-1 items-center justify-center bg-slate-50 p-8">
            <Text className="mb-2 text-center text-lg font-semibold text-slate-800">
              Unable to start
            </Text>
            <Text className="text-center text-sm text-slate-500">{dbError}</Text>
          </View>
        ) : (
          children
        )}
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
