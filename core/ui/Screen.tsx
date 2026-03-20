import { PropsWithChildren } from "react";
import { SafeAreaView, ScrollView, View } from "react-native";

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  padded?: boolean;
}>;

export function Screen({ children, scroll = false, padded = true }: ScreenProps) {
  const paddedClass = padded ? "bg-slate-50 px-4 py-3 pb-8" : "bg-slate-50";
  const scrollContent = <View className={paddedClass}>{children}</View>;
  const fillContent = (
    <View className={padded ? "flex-1 bg-slate-50 px-4 py-3" : "flex-1 bg-slate-50"}>
      {children}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="grow"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {scrollContent}
        </ScrollView>
      ) : (
        fillContent
      )}
    </SafeAreaView>
  );
}
