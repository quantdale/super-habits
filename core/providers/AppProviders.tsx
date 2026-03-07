import { PropsWithChildren, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { initializeDatabase } from "@/core/db/client";
import { registerServiceWorker } from "@/core/pwa/registerServiceWorker";
import { ensureGuestProfile } from "@/core/auth/guestProfile";

const queryClient = new QueryClient();

export function AppProviders({ children }: PropsWithChildren) {
  useEffect(() => {
    initializeDatabase().catch(() => undefined);
    registerServiceWorker();
    ensureGuestProfile().catch(() => undefined);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </GestureHandlerRootView>
  );
}
