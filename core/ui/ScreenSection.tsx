import type { ReactNode } from "react";
import { View } from "react-native";

type ScreenSectionProps = {
  children: ReactNode;
  className?: string;
};

export function ScreenSection({ children, className }: ScreenSectionProps) {
  return <View className={["mb-4", className].filter(Boolean).join(" ")}>{children}</View>;
}
