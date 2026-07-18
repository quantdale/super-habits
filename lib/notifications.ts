import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === Notifications.PermissionStatus.GRANTED) {
    return true;
  }

  const request = await Notifications.requestPermissionsAsync();
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  return request.status === Notifications.PermissionStatus.GRANTED;
}

export async function scheduleTimerEndNotification(seconds: number, title: string, body: string) {
  if (Platform.OS === 'web') {
    return null;
  }
  const allowed = await ensureNotificationPermission();
  if (!allowed) {
    return null;
  }

  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
  });
}

export async function cancelScheduledNotification(id: string | null | undefined): Promise<void> {
  if (!id || Platform.OS === 'web') {
    return;
  }
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired or invalid id
  }
}
