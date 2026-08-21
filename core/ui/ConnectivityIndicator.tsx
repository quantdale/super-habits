import { useEffect, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useAppTheme } from '@/core/providers/themeContext';

/**
 * Offline/online connectivity indicator. Renders nothing while online;
 * shows a small non-blocking "Offline" pill (fixed to the top of the screen,
 * below notice banners) whenever the device loses connectivity.
 */
export function ConnectivityIndicator() {
  const { tokens } = useAppTheme();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setOffline(!state.isConnected);
    });
    void NetInfo.fetch().then((state) => setOffline(!state.isConnected));
    return () => unsubscribe();
  }, []);

  if (!offline) return null;

  return (
    <View pointerEvents="none" className="absolute inset-x-0 top-0 z-40 items-center pt-2">
      <View
        className="flex-row items-center gap-1.5 rounded-full border px-3 py-1.5"
        style={{
          borderColor: tokens.border,
          backgroundColor: tokens.warningBackground,
        }}
      >
        <MaterialIcons name="cloud-off" size={14} color={tokens.warningText} />
        <Text className="text-xs font-semibold" style={{ color: tokens.warningText }}>
          Offline — changes stay on this device
        </Text>
      </View>
    </View>
  );
}
