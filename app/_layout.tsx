import '@/global.css';
import { useCallback, useEffect, useRef } from 'react';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { Platform, Pressable, Text, View } from 'react-native';
import { AppProviders } from '@/core/providers/AppProviders';
import { useAppBootstrapState } from '@/core/providers/appBootstrapContext';
import { NavigationProvider } from '@/core/providers/NavigationProvider';
import { useAppNavigation } from '@/core/providers/navigationContext';
import { useAppTheme } from '@/core/providers/themeContext';
import { InAppNoticeBanner } from '@/core/ui/InAppNoticeBanner';
import { UpdateAvailableBanner } from '@/core/ui/UpdateAvailableBanner';
import { ConnectivityIndicator } from '@/core/ui/ConnectivityIndicator';
import {
  CommandCenterProvider,
  GlobalCommandCenterHost,
} from '@/features/command/CommandCenterProvider';
import { AskConversationProvider } from '@/features/command/AskConversationContext';
import * as Notifications from 'expo-notifications';
import {
  dispatchNotificationResponse,
  getNotificationResponseFingerprint,
} from '@/core/notifications/notificationResponseDispatcher';
import { setNotificationResponseHandler } from '@/core/notifications/notificationResponseBridge';
import {
  completeHabitReminderAction,
  snoozeHabitReminderAction,
} from '@/features/habits/habitReminderActions';
import { useInAppNotices } from '@/core/providers/inAppNoticeContext';

/**
 * Route-level error boundary so a render-time exception shows recovery UI
 * instead of a blank screen. Deliberately styled with plain literals and no
 * theme hook: ThemeProvider itself may be what crashed.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8f7ff',
        padding: 32,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: '600', color: '#0f172a', textAlign: 'center' }}>
        Something went wrong
      </Text>
      <Text
        style={{ marginTop: 8, fontSize: 14, color: '#64748b', textAlign: 'center' }}
        numberOfLines={4}
      >
        {error.message}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Try again"
        onPress={() => void retry()}
        style={{
          marginTop: 20,
          borderRadius: 12,
          backgroundColor: '#0f172a',
          paddingHorizontal: 24,
          paddingVertical: 12,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff' }}>Try again</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <NavigationProvider>
        <AskConversationProvider>
          <CommandCenterProvider>
            <ThemedRoot />
          </CommandCenterProvider>
        </AskConversationProvider>
      </NavigationProvider>
    </AppProviders>
  );
}

function ThemedRoot() {
  const { tokens } = useAppTheme();

  return (
    <>
      <Head>
        <title>SuperHabits</title>
        <meta name="description" content="Master your day with offline-first habit tracking." />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content={tokens.webThemeColor} />
      </Head>
      <StatusBar style={tokens.statusBarStyle} />
      <Stack screenOptions={{ headerShown: false }} />
      <GlobalCommandCenterHost />
      <InAppNoticeBanner />
      <UpdateAvailableBanner />
      <ConnectivityIndicator />
      <HabitReminderResponseHost />
    </>
  );
}

function HabitReminderResponseHost() {
  const { authBootstrapReady } = useAppBootstrapState();
  const { openHabit } = useAppNavigation();
  const { showNotice } = useInAppNotices();
  const handledFingerprints = useRef<string[]>([]);
  const responseQueue = useRef(Promise.resolve());

  const handleResponse = useCallback(
    (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const fingerprint = getNotificationResponseFingerprint(response);
      if (handledFingerprints.current.includes(fingerprint)) return;
      handledFingerprints.current.push(fingerprint);
      if (handledFingerprints.current.length > 64) handledFingerprints.current.shift();

      const task = responseQueue.current.then(async () => {
        try {
          await dispatchNotificationResponse(response, {
            openHabit,
            markComplete: async (input) => {
              const result = await completeHabitReminderAction(input);
              for (const notice of result.linkedActions.notices) showNotice(notice);
              openHabit(input.habitId);
            },
            snooze: async (input) => {
              await snoozeHabitReminderAction(input);
              openHabit(input.habitId);
            },
          });
        } catch (error) {
          console.error('[notifications] response dispatch failed', error);
        } finally {
          try {
            Notifications.clearLastNotificationResponse();
          } catch {
            // The response may already have been cleared by the native runtime.
          }
        }
      });
      responseQueue.current = task.catch(() => undefined);
    },
    [openHabit, showNotice],
  );

  useEffect(() => {
    if (!authBootstrapReady || Platform.OS === 'web') return undefined;
    setNotificationResponseHandler(handleResponse);
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handleResponse(response);
    });
    try {
      handleResponse(Notifications.getLastNotificationResponse());
    } catch (error) {
      console.warn('[notifications] last response unavailable', error);
    }
    return () => {
      subscription.remove();
      setNotificationResponseHandler(null);
    };
  }, [authBootstrapReady, handleResponse]);

  return null;
}
