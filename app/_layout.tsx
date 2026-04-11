import "@/global.css";
import { Stack } from "expo-router";
import Head from "expo-router/head";
import { StatusBar } from "expo-status-bar";
import { AppProviders } from "@/core/providers/AppProviders";
import { useAppTheme } from "@/core/theme";

function RootLayoutContent() {
  const { colors } = useAppTheme();

  return (
    <>
      <Head>
        <title>SuperHabits</title>
        <meta name="description" content="Master your day with offline-first habit tracking." />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content={colors.background} />
      </Head>
      <StatusBar style={colors.statusBarStyle} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <RootLayoutContent />
    </AppProviders>
  );
}
