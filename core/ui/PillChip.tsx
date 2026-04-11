import React from "react";
import { Pressable, Text } from "react-native";
import { useAppTheme } from "@/core/theme";

type Props = {
  label: string;
  active: boolean;
  color: string;
  onPress: () => void;
  icon?: string;
};

export function PillChip({ label, active, color, onPress, icon }: Props) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      className="mr-2 flex-row items-center gap-1 rounded-full border px-[14px] py-[7px]"
      style={
        active
          ? {
              backgroundColor: color,
              borderColor: color,
            }
          : {
              backgroundColor: colors.surfaceMuted,
              borderColor: colors.border,
            }
      }
    >
      {icon ? <Text className="text-[13px]">{icon}</Text> : null}
      <Text
        className="text-[13px]"
        style={{ fontWeight: active ? "600" : "400", color: active ? "#ffffff" : colors.textMuted }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
