import '@/global.css';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { Pressable, Text, View } from 'react-native';
import { AppProviders } from '@/core/providers/AppProviders';
import { NavigationProvider } from '@/core/providers/NavigationProvider';
import { useAppTheme } from '@/core/providers/ThemeProvider';
import { InAppNoticeBanner } from '@/core/ui/InAppNoticeBanner';
import {
  CommandCenterProvider,
  GlobalCommandCenterHost,
} from '@/features/command/CommandCenterProvider';
import { AskConversationProvider } from '@/features/command/AskConversationContext';

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
    </>
  );
}
