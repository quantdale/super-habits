import { PropsWithChildren } from "react";
import { SafeAreaView, ScrollView, View } from "react-native";

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  padded?: boolean;
}>;

export function Screen({ children, scroll = false, padded = true }: ScreenProps) {
  const content = (
    <View className={padded ? "flex-1 bg-slate-50 px-4 py-3" : "flex-1 bg-slate-50"}>
      {children}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {scroll ? <ScrollView>{content}</ScrollView> : content}
    </SafeAreaView>
  );
}
