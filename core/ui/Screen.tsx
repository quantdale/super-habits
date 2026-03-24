import { PropsWithChildren } from "react";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  padded?: boolean;
}>;

const SURFACE = "#f8f7ff";

export function Screen({ children, scroll = false, padded = true }: ScreenProps) {
  return (
    <SafeAreaView style={styles.root}>
      {scroll ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={padded ? styles.scrollContentPadded : styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          nestedScrollEnabled
          scrollEnabled
        >
          {children}
        </ScrollView>
      ) : (
        <View style={padded ? [styles.fill, styles.padded] : styles.fill}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SURFACE,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: SURFACE,
  },
  scrollContentPadded: {
    flexGrow: 1,
    backgroundColor: SURFACE,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  fill: {
    flex: 1,
    backgroundColor: SURFACE,
  },
  padded: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
});
