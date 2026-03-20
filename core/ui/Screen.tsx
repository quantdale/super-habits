import { PropsWithChildren } from "react";
import { SafeAreaView, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";

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
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="always" keyboardDismissMode="on-drag">
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}
