import React from "react";
import { View, Text, Pressable } from "react-native";

type Props = {
  visible: boolean;
  onDismiss: () => void;
};

export function BackgroundWarning({ visible, onDismiss }: Props) {
  if (!visible) return null;

  return (
    <View className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-rose-700">🍃 You left during a session</Text>
          <Text className="mt-1 text-sm text-rose-600">Stay in the app to keep your plant alive.</Text>
        </View>
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Text className="ml-2 text-sm text-rose-400">✕</Text>
        </Pressable>
      </View>
    </View>
  );
}
