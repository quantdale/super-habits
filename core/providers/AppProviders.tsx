import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";
import NetInfo from "@react-native-community/netinfo";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Modal, Platform, Text, View } from "react-native";
import { initializeDatabase } from "@/core/db/client";
import { registerServiceWorker } from "@/core/pwa/registerServiceWorker";
import { ensureGuestProfile } from "@/core/auth/guestProfile";
import { syncEngine } from "@/core/sync/sync.engine";
import {
  dismissCurrentRestorePrompt,
  getRestorePreview,
  restoreFromRemoteBackup,
} from "@/core/sync/restore.coordinator";
import { resolveRestorePromptOutcome } from "@/core/providers/restorePromptFlow";
import type { RestorePreview } from "@/core/sync/restore.types";
import { InAppNoticeProvider } from "@/core/providers/InAppNoticeProvider";
import { ensureAnonymousSession, isRemoteEnabled } from "@/lib/supabase";
import { ThemeProvider, useAppTheme } from "@/core/providers/ThemeProvider";
import { Button } from "@/core/ui/Button";
import { Card } from "@/core/ui/Card";

const queryClient = new QueryClient();

type AppBootstrapState = {
  authBootstrapReady: boolean;
};

const AppBootstrapStateContext = createContext<AppBootstrapState>({
  authBootstrapReady: false,
});

export function useAppBootstrapState(): AppBootstrapState {
  return useContext(AppBootstrapStateContext);
}

export function AppProviders({ children }: PropsWithChildren) {
  const [dbError, setDbError] = useState<string | null>(null);
  const [authBootstrapReady, setAuthBootstrapReady] = useState(false);
  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [restorePromptBusy, setRestorePromptBusy] = useState(false);
  const [restorePromptError, setRestorePromptError] = useState<string | null>(null);

  useEffect(() => {
    registerServiceWorker();
    let cancelled = false;

    const bootstrap = async () => {
      try {
        await initializeDatabase();
      } catch (e) {
        console.error("[db] initializeDatabase failed", e);
        if (!cancelled) {
          setDbError(
            Platform.OS === "web"
              ? "This browser does not support the required features to run SuperHabits. Try Chrome or Edge with site data cleared."
              : "Database failed to initialize. Please restart the app.",
          );
        }
        return;
      }

      await ensureGuestProfile().catch(() => undefined);
      await ensureAnonymousSession().catch((e) => {
        console.error("[auth] ensureAnonymousSession failed", e);
      });
      if (!cancelled) {
        setAuthBootstrapReady(true);
      }

      try {
        const preview = await getRestorePreview();
        if (cancelled) return;
        setRestorePreview(preview);
        setShowRestorePrompt(preview.startupPromptEligible);
      } catch (e) {
        console.error("[restore] getRestorePreview failed during bootstrap", e);
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
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

  const handleDismissRestorePrompt = async () => {
    try {
      await dismissCurrentRestorePrompt(restorePreview?.freshnessSignature ?? null);
      setRestorePreview((current) =>
        current
          ? {
              ...current,
              dismissedForCurrentBackup: true,
              startupPromptEligible: false,
            }
          : current,
      );
      setShowRestorePrompt(false);
      setRestorePromptError(null);
    } catch (e) {
      console.error("[restore] dismissCurrentRestorePrompt failed", e);
      setRestorePromptError("Unable to save this dismissal right now.");
    }
  };

  const handleRestoreFromPrompt = async () => {
    setRestorePromptBusy(true);
    setRestorePromptError(null);
    try {
      const result = await restoreFromRemoteBackup();
      const nextPreview = await getRestorePreview();
      setRestorePreview(nextPreview);
      const outcome = resolveRestorePromptOutcome({
        result,
        nextPreview,
      });
      setShowRestorePrompt(!outcome.dismissPrompt);
      setRestorePromptError(outcome.errorMessage);
    } catch (e) {
      console.error("[restore] restoreFromRemoteBackup failed", e);
      setShowRestorePrompt(true);
      setRestorePromptError(
        "Restore failed. Your local data was left unchanged.",
      );
    } finally {
      setRestorePromptBusy(false);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <InAppNoticeProvider>
            <AppBootstrapStateContext.Provider value={{ authBootstrapReady }}>
              <BootstrapGate dbError={dbError}>
                {children}
                <RestorePrompt
                  preview={restorePreview}
                  visible={showRestorePrompt}
                  busy={restorePromptBusy}
                  errorMessage={restorePromptError}
                  onDismiss={handleDismissRestorePrompt}
                  onRestore={handleRestoreFromPrompt}
                />
              </BootstrapGate>
            </AppBootstrapStateContext.Provider>
          </InAppNoticeProvider>
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

function RestorePrompt({
  preview,
  visible,
  busy,
  errorMessage,
  onDismiss,
  onRestore,
}: {
  preview: RestorePreview | null;
  visible: boolean;
  busy: boolean;
  errorMessage: string | null;
  onDismiss: () => void;
  onRestore: () => void;
}) {
  const { tokens } = useAppTheme();

  if (!visible || !preview) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          padding: 24,
          backgroundColor: "rgba(15, 23, 42, 0.55)",
        }}
      >
        <Card
          accentColor="#475569"
          variant="header"
          headerTitle="Restore backup"
          headerSubtitle="A remote backup is available and this device is still empty for synced tables."
          className="mb-0"
        >
          <View className="gap-3">
            <Text style={{ color: tokens.text, fontSize: 14, lineHeight: 20 }}>
              Restoring now imports your backed-up todos, habits, and calorie entries.
            </Text>
            {preview.latestRestorableBackupAt ? (
              <Text style={{ color: tokens.textMuted, fontSize: 13 }}>
                Latest restorable backup: {new Date(preview.latestRestorableBackupAt).toLocaleString()}
              </Text>
            ) : null}
            {preview.disclosures.map((item) => (
              <Text key={item} style={{ color: tokens.textMuted, fontSize: 13, lineHeight: 18 }}>
                {item}
              </Text>
            ))}
            {errorMessage ? (
              <Text style={{ color: "#b91c1c", fontSize: 13, lineHeight: 18 }}>
                {errorMessage}
              </Text>
            ) : null}
            <View className="gap-2">
              <Button
                label={busy ? "Restoring..." : "Restore backup"}
                onPress={onRestore}
                disabled={busy}
                color="#475569"
              />
              <Button
                label="Not now"
                onPress={onDismiss}
                variant="ghost"
                disabled={busy}
              />
            </View>
          </View>
        </Card>
      </View>
    </Modal>
  );
}
