import { PropsWithChildren, useEffect } from "react";
import NetInfo from "@react-native-community/netinfo";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Platform } from "react-native";
import { initializeDatabase } from "@/core/db/client";
import { registerServiceWorker } from "@/core/pwa/registerServiceWorker";
import { ensureGuestProfile } from "@/core/auth/guestProfile";
import { syncEngine } from "@/core/sync/sync.engine";
import { isRemoteEnabled } from "@/lib/supabase";

const queryClient = new QueryClient();

export function AppProviders({ children }: PropsWithChildren) {
  useEffect(() => {
    initializeDatabase().catch((e) => {
      console.error("[db] initializeDatabase failed", e);
    });
    registerServiceWorker();
    ensureGuestProfile().catch(() => undefined);
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
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </GestureHandlerRootView>
  );
}
