import { PropsWithChildren } from "react";
import { View } from "react-native";

export function Card({ children }: PropsWithChildren) {
  return <View className="mb-3 rounded-2xl bg-white p-4 shadow-sm">{children}</View>;
}
