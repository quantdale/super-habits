import { useEffect, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import {
  applyServiceWorkerUpdate,
  onServiceWorkerUpdateApplied,
  onServiceWorkerUpdateAvailable,
} from '@/core/pwa/registerServiceWorker';

/**
 * Non-blocking "Update available" banner for the PWA. Appears when a new
 * service worker is waiting; applying it activates the worker and reloads the
 * page once the update takes control. Native platforms never render it.
 */
export function UpdateAvailableBanner() {
  const { tokens } = useAppTheme();
  const [updateReady, setUpdateReady] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const unsubscribeAvailable = onServiceWorkerUpdateAvailable(() => setUpdateReady(true));
    const unsubscribeApplied = onServiceWorkerUpdateApplied(() => {
      // The new worker controls the page now; reload to load fresh assets.
      window.location.reload();
    });
    return () => {
      unsubscribeAvailable();
      unsubscribeApplied();
    };
  }, []);

  if (!updateReady) return null;

  return (
    <View pointerEvents="box-none" className="absolute inset-x-0 bottom-0 z-50 px-3 pb-3">
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
          onPress={() => {
            setApplying(true);
            applyServiceWorkerUpdate();
          }}
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
