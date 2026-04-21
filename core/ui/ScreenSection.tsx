import type { ReactNode } from "react";
import { View, type ViewProps } from "react-native";

type ScreenSectionProps = ViewProps & {
  children: ReactNode;
  className?: string;
};

export function ScreenSection({ children, className, ...props }: ScreenSectionProps) {
  return (
    <View className={["mb-5", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </View>
  );
}
