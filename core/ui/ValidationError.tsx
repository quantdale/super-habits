import React from "react";
import { View, Text } from "react-native";
import { useAppTheme } from "@/core/providers/ThemeProvider";

type Props = {
  message: string | null;
};

export function ValidationError({ message }: Props) {
  const { tokens } = useAppTheme();

  if (!message) return null;
  return (
    <View
      style={{
        backgroundColor: tokens.dangerBackground,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: tokens.dangerBorder,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      }}
    >
      <Text style={{ fontSize: 14 }}>⚠️</Text>
      <Text style={{ fontSize: 13, color: tokens.dangerText, flex: 1 }}>{message}</Text>
    </View>
  );
}
