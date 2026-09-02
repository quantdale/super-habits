import { PropsWithChildren } from 'react';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/core/providers/themeContext';
import { spacing, layout } from '@/core/theme/designTokens';

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

// Android 15+ edge-to-edge can leave RN's SafeAreaView inset at zero. Reserve
// the standard 48dp three-button navigation bar when no inset is reported.
const ANDROID_NAVIGATION_FALLBACK = 48;
export function Screen({ children, scroll = false, padded = true, contentMaxWidth }: ScreenProps) {
  const { tokens } = useAppTheme();
  const { width } = useWindowDimensions();
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const effectiveBottomInset =
    Platform.OS === 'android'
      ? Math.max(safeAreaBottom, ANDROID_NAVIGATION_FALLBACK)
      : safeAreaBottom;
  const bottomPadding = padded ? 36 + effectiveBottomInset : effectiveBottomInset;
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
          style={[
            styles.scroll,
            effectiveBottomInset > 0 ? { marginBottom: effectiveBottomInset } : null,
            { backgroundColor: tokens.background },
          ]}
          contentContainerStyle={[
            padded ? styles.scrollContentPadded : styles.scrollContent,
            bottomPadding > 0 ? { paddingBottom: bottomPadding } : null,
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
            bottomPadding > 0 ? { paddingBottom: bottomPadding } : null,
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  fill: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  contentShell: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
  },
  contentShellFill: {
    flex: 1,
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
  },
});
