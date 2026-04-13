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
import { ThemeProvider, useAppTheme } from "@/core/providers/ThemeProvider";

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
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <BootstrapGate dbError={dbError}>{children}</BootstrapGate>
        </QueryClientProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function BootstrapGate({ dbError, children }: PropsWithChildren<{ dbError: string | null }>) {
  const { tokens } = useAppTheme();

  if (!dbError) return children;

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: tokens.background, padding: 32 }}>
      <Text style={{ marginBottom: 8, textAlign: "center", fontSize: 18, fontWeight: "600", color: tokens.text }}>
        Unable to start
      </Text>
      <Text style={{ textAlign: "center", fontSize: 14, color: tokens.textMuted }}>{dbError}</Text>
    </View>
  );
}
