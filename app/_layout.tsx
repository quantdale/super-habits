import "@/global.css";
import { Stack } from "expo-router";
import Head from "expo-router/head";
import { StatusBar } from "expo-status-bar";
import { AppProviders } from "@/core/providers/AppProviders";
import { useAppTheme } from "@/core/providers/ThemeProvider";
import { InAppNoticeBanner } from "@/core/ui/InAppNoticeBanner";

export default function RootLayout() {
  return (
    <AppProviders>
      <ThemedRoot />
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
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
      <InAppNoticeBanner />
    </>
  );
}
