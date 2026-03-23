import type { ReactNode } from "react";
import { View } from "react-native";

type CardProps = {
  children: ReactNode;
  accentColor?: string;
  className?: string;
};

const BORDER = "#e8e8f0";

export function Card({ children, accentColor, className }: CardProps) {
  return (
    <View
      className={`mb-3 overflow-hidden rounded-2xl bg-white ${className ?? ""}`}
      style={{
        borderTopWidth: 1,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderLeftWidth: accentColor ? 4 : 1,
        borderTopColor: BORDER,
        borderRightColor: BORDER,
        borderBottomColor: BORDER,
        borderLeftColor: accentColor ?? BORDER,
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View className={accentColor ? "py-3 pl-2 pr-4" : "px-4 py-3"}>{children}</View>
    </View>
  );
}
