import { PropsWithChildren } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { layout } from '@/core/theme/designTokens';

/** Viewport widths above this get a centered, width-capped content column. */
const WIDE_VIEWPORT_MIN_WIDTH = 768;

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  padded?: boolean;
  /**
   * Wide-viewport-only cap for the centered content column
   * (defaults to `layout.contentMaxWidth`). Narrow viewports are unaffected.
   */
  contentMaxWidth?: number;
}>;

export function Screen({ children, scroll = false, padded = true, contentMaxWidth }: ScreenProps) {
  const { tokens } = useAppTheme();
  const { width } = useWindowDimensions();

  // Phones/narrow viewports keep the legacy shell styles untouched; only wide
  // viewports tighten the existing 1180 cap down to the content column width.
  const wideShellStyle: { maxWidth: number } | null =
    width > WIDE_VIEWPORT_MIN_WIDTH
      ? { maxWidth: contentMaxWidth ?? layout.contentMaxWidth }
      : null;

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
          <View
            style={wideShellStyle ? [styles.contentShell, wideShellStyle] : styles.contentShell}
          >
            {children}
          </View>
        </ScrollView>
      ) : (
        <View
          style={[
            padded ? [styles.fill, styles.padded] : styles.fill,
            { backgroundColor: tokens.background },
          ]}
        >
          <View
            style={
              wideShellStyle ? [styles.contentShellFill, wideShellStyle] : styles.contentShellFill
            }
          >
            {children}
          </View>
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
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
  },
  contentShellFill: {
    flex: 1,
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
  },
});
