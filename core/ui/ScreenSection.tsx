import type { ReactNode } from "react";
import { View } from "react-native";

type ScreenSectionProps = {
import { View, type ViewProps } from "react-native";

type ScreenSectionProps = ViewProps & {
  children: ReactNode;
  className?: string;
};

export function ScreenSection({ children, className }: ScreenSectionProps) {
  return <View className={["mb-4", className].filter(Boolean).join(" ")}>{children}</View>;
export function ScreenSection({ children, className, ...props }: ScreenSectionProps) {
  return (
    <View className={["mb-4", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </View>
  );
}
