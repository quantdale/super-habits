import { PropsWithChildren } from 'react';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type RefreshControlProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/core/providers/themeContext';
import { layout, spacing } from '@/core/theme/designTokens';

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
  /**
   * Rendered above the scroll area and outside it, so a section's hero (title,
   * level strip, day picker) stays put while the content scrolls under it.
   */
  hero?: React.ReactNode;
  /** Pull-to-refresh control forwarded to the scroll view. */
  refreshControl?: React.ReactElement<RefreshControlProps>;
}>;

// Android 15+ edge-to-edge can leave RN's SafeAreaView inset at zero. Reserve
// the standard 48dp three-button navigation bar when no inset is reported.
const ANDROID_NAVIGATION_FALLBACK = 48;

/**
 * The V3 page canvas: neutral background, an optional pinned hero, and a
 * centered content column on wide screens. Surfaces separate through tone,
 * spacing, and hairlines — not an ambient wash (see docs/ui-ux/13 §3; the
 * removed Pop wash rendered as a stray arc at the rail breakpoint).
 */
export function Screen({
  children,
  scroll = false,
  padded = true,
  contentMaxWidth,
  hero,
  refreshControl,
}: ScreenProps) {
  const { width } = useWindowDimensions();
  const { tokens } = useAppTheme();
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const effectiveBottomInset =
    Platform.OS === 'android'
      ? Math.max(safeAreaBottom, ANDROID_NAVIGATION_FALLBACK)
      : safeAreaBottom;
  const bottomPadding = padded ? 144 + effectiveBottomInset : effectiveBottomInset;
  const wideShellStyle: { maxWidth: number } | null =
    width >= WIDE_VIEWPORT_MIN_WIDTH
      ? { maxWidth: contentMaxWidth ?? layout.contentMaxWidth }
      : null;

  const heroBlock = hero ? (
    <View
      style={[
        styles.heroShell,
        { paddingHorizontal: layout.pagePadding, paddingBottom: spacing.lg },
        wideShellStyle,
      ]}
    >
      {hero}
    </View>
  ) : null;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: tokens.background }]}>
      {heroBlock}
      {scroll ? (
        <ScrollView
          style={[styles.scroll, { backgroundColor: 'transparent' }]}
          contentContainerStyle={[
            padded ? styles.scrollContentPadded : styles.scrollContent,
            bottomPadding > 0 ? { paddingBottom: bottomPadding } : null,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          nestedScrollEnabled
          scrollEnabled
          refreshControl={refreshControl}
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
            { paddingBottom: bottomPadding },
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
  heroShell: {
    width: '100%',
    alignSelf: 'center',
    paddingTop: spacing.sm,
    zIndex: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  scrollContentPadded: {
    flexGrow: 1,
    paddingHorizontal: layout.pagePadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  fill: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: layout.pagePadding,
    paddingTop: spacing.md,
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
