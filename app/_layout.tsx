import "@/global.css";
import { Stack } from "expo-router";
import Head from "expo-router/head";
import { StatusBar } from "expo-status-bar";
import { AppProviders } from "@/core/providers/AppProviders";

export default function RootLayout() {
  return (
    <AppProviders>
      <Head>
        <title>SuperHabits</title>
        <meta name="description" content="Master your day with offline-first habit tracking." />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#8B5CF6" />
      </Head>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </AppProviders>
  );
}
