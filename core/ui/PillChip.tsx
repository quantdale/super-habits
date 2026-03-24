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
      className={`mr-2 flex-row items-center gap-1 rounded-full border px-[14px] py-[7px] ${
        active ? "border" : "border border-slate-200 bg-slate-100"
      }`}
      style={
        active
          ? {
              backgroundColor: color,
              borderColor: color,
            }
          : undefined
      }
    >
      {icon ? <Text className="text-[13px]">{icon}</Text> : null}
      <Text
        className={`text-[13px] ${active ? "font-semibold text-white" : "font-normal text-slate-500"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
