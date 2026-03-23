import type { ReactNode } from "react";
import { View } from "react-native";

type CardProps = {
  children: ReactNode;
  accentColor?: string;
  className?: string;
  /** Use for content with horizontal ScrollView (e.g. heatmaps) so the scroll area is not clipped. */
  overflowVisible?: boolean;
};

export function Card({ children, accentColor, className, overflowVisible }: CardProps) {
  return (
    <View
      className={`mb-3 rounded-2xl bg-white ${overflowVisible ? "" : "overflow-hidden"} ${className ?? ""}`}
      style={{
        borderWidth: 1,
        borderColor: "#e8e8f0",
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
        overflow: overflowVisible ? "visible" : "hidden",
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
