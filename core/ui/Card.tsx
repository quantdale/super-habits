import { PropsWithChildren } from "react";
import { View } from "react-native";

type CardProps = PropsWithChildren<{
  accentColor?: string; // hex color for left strip
  className?: string;
}>;

export function Card({ children, accentColor, className }: CardProps) {
  return (
    <View
      className={`mb-3 overflow-hidden rounded-2xl bg-white ${className ?? ""}`}
      style={{
        shadowColor: "#6366f1",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      {accentColor ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            backgroundColor: accentColor,
            borderTopLeftRadius: 16,
            borderBottomLeftRadius: 16,
          }}
        />
      ) : null}
      <View className={accentColor ? "py-3 pl-3 pr-4" : "px-4 py-3"}>{children}</View>
    </View>
  );
}
