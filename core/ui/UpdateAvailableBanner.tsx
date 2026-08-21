import { useCallback, useEffect, useRef, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import {
  applyServiceWorkerUpdate,
  onServiceWorkerUpdateApplied,
  onServiceWorkerUpdateAvailable,
} from '@/core/pwa/registerServiceWorker';

/**
 * Safety net for a lost activation (audit AREA 9 F4): if the applied event
 * never arrives after SKIP_WAITING, recover with a plain reload instead of
 * leaving the button disabled on "Updating…" forever.
 */
const FALLBACK_RELOAD_MS = 10_000;

/**
 * Non-blocking "Update available" banner for the PWA. Appears when a new
 * service worker is waiting; applying it activates the worker and reloads the
 * page once the update takes control. The reload fires only in the tab that
 * pressed Refresh (registerServiceWorker gates the applied event on its
 * applyRequested flag), so first-visit claims and bystander tabs never
 * auto-reload. Native platforms never render it.
 *
 * Stacks above the Command Center launcher (zIndex 80 in
 * CommandCenterProvider) so the launcher never intercepts presses on this
 * banner's actions while an update is pending.
 */
export function UpdateAvailableBanner() {
  const { tokens } = useAppTheme();
  const [updateReady, setUpdateReady] = useState(false);
  const [applying, setApplying] = useState(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current !== null) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const unsubscribeAvailable = onServiceWorkerUpdateAvailable(() => setUpdateReady(true));
    const unsubscribeApplied = onServiceWorkerUpdateApplied(() => {
      // Gated: this tab requested the update and the new worker now controls
      // it — reload to load fresh assets.
      clearFallbackTimer();
      window.location.reload();
    });
    return () => {
      unsubscribeAvailable();
      unsubscribeApplied();
      clearFallbackTimer();
    };
  }, [clearFallbackTimer]);

  const handleApply = () => {
    setApplying(true);
    const hasWaiting = applyServiceWorkerUpdate();
    if (!hasWaiting) {
      // Nothing to activate (another tab applied it, or the worker went
      // redundant): a plain reload lets the browser promote the newest
      // worker instead of posting SKIP_WAITING into the void.
      window.location.reload();
      return;
    }
    fallbackTimerRef.current = setTimeout(() => {
      fallbackTimerRef.current = null;
      window.location.reload();
    }, FALLBACK_RELOAD_MS);
  };

  if (!updateReady) return null;

  return (
    <View pointerEvents="box-none" className="absolute inset-x-0 bottom-0 z-[90] px-3 pb-3">
      <View
        className="flex-row items-center gap-3 rounded-2xl border px-4 py-3"
        style={{
          borderColor: tokens.accent,
          backgroundColor: tokens.surface,
          shadowColor: tokens.shadowColor,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
          elevation: 6,
        }}
      >
        <View
          className="h-9 w-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${tokens.accent}16` }}
        >
          <MaterialIcons name="system-update" size={18} color={tokens.accent} />
        </View>
        <Text className="min-w-0 flex-1 text-sm font-medium" style={{ color: tokens.text }}>
          Update available
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={applying ? 'Updating app' : 'Apply app update'}
          disabled={applying}
          className="rounded-full px-4 py-2"
          style={{ backgroundColor: tokens.accent }}
          onPress={handleApply}
        >
          <Text className="text-sm font-semibold" style={{ color: tokens.textOnAccent }}>
            {applying ? 'Updating…' : 'Refresh'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss update banner"
          hitSlop={4}
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: tokens.surfaceElevated }}
          onPress={() => setUpdateReady(false)}
        >
          <MaterialIcons name="close" size={18} color={tokens.iconMuted} />
        </Pressable>
      </View>
    </View>
  );
}
