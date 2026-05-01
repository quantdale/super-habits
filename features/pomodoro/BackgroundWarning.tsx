import React from "react";
import { View, Text, Pressable } from "react-native";
import { useAppTheme } from "@/core/providers/ThemeProvider";

type Props = {
  visible: boolean;
  onDismiss: () => void;
};

export function BackgroundWarning({ visible, onDismiss }: Props) {
  const { tokens } = useAppTheme();

  if (!visible) return null;

  return (
    <View
      className="mb-3 rounded-2xl border px-4 py-3"
      style={{ borderColor: "#fecaca", backgroundColor: "#fff7f7" }}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-rose-700">🍃 You left during a session</Text>
          <Text className="mt-1 text-sm text-rose-600">Stay in the app to keep your plant alive.</Text>
        </View>
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Text className="ml-2 text-sm" style={{ color: tokens.iconMuted }}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
}
