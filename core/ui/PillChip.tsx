import React from "react";
import { Pressable, Text } from "react-native";

type Props = {
  label: string;
  active: boolean;
  color: string; // section accent color
  onPress: () => void;
  icon?: string; // optional emoji or text prefix
};

export function PillChip({ label, active, color, onPress, icon }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: active ? color : "#f1f0f9",
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 7,
        marginRight: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        borderWidth: 1,
        borderColor: active ? color : "#e0ddf0",
      }}
    >
      {icon ? <Text style={{ fontSize: 13 }}>{icon}</Text> : null}
      <Text
        style={{
          fontSize: 13,
          fontWeight: active ? "600" : "400",
          color: active ? "#ffffff" : "#64748b",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
