import React from "react";
import { View, Text } from "react-native";
import { useAppTheme } from "@/core/theme";

type Props = {
  message: string | null;
};

export function ValidationError({ message }: Props) {
  const { colors } = useAppTheme();

  if (!message) return null;
  return (
    <View
      style={{
        backgroundColor: colors.dangerBackground,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.dangerBorder,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      }}
    >
      <Text style={{ fontSize: 14 }}>⚠️</Text>
      <Text style={{ fontSize: 13, color: colors.dangerText, flex: 1 }}>{message}</Text>
    </View>
  );
}
