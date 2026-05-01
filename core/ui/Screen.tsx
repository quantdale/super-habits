import { PropsWithChildren } from "react";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { useAppTheme } from "@/core/providers/ThemeProvider";

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  padded?: boolean;
}>;

export function Screen({ children, scroll = false, padded = true }: ScreenProps) {
  const { tokens } = useAppTheme();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: tokens.background }]}>
      {scroll ? (
        <ScrollView
          style={[styles.scroll, { backgroundColor: tokens.background }]}
          contentContainerStyle={[
            padded ? styles.scrollContentPadded : styles.scrollContent,
            { backgroundColor: tokens.background },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          nestedScrollEnabled
          scrollEnabled
        >
          <View style={styles.contentShell}>{children}</View>
        </ScrollView>
      ) : (
        <View
          style={[
            padded ? [styles.fill, styles.padded] : styles.fill,
            { backgroundColor: tokens.background },
          ]}
        >
          <View style={styles.contentShellFill}>{children}</View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  scrollContentPadded: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 36,
  },
  fill: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 36,
  },
  contentShell: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
  },
  contentShellFill: {
    flex: 1,
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
  },
});
