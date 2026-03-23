import React from "react";
import { View, Text } from "react-native";

type Props = {
  message: string | null;
};

export function ValidationError({ message }: Props) {
  if (!message) return null;
  return (
    <View
      style={{
        backgroundColor: "#fef2f2",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: "#fecaca",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      }}
    >
      <Text style={{ fontSize: 14 }}>⚠️</Text>
      <Text style={{ fontSize: 13, color: "#dc2626", flex: 1 }}>{message}</Text>
    </View>
  );
}
