import { PropsWithChildren } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
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
import { layout, radius, spacing } from '@/core/theme/designTokens';

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
 * The Pop page canvas: soft tinted background, an ambient color wash at the
 * top, an optional pinned hero, and a centered content column on wide screens.
 *
 * The wash is what keeps a light screen from reading as flat grey — it fades
 * the brand hue into the canvas behind the hero, so every section opens with
 * depth instead of a hard empty gap.
 */
export function Screen({
  children,
  scroll = false,
  padded = true,
  contentMaxWidth,
  hero,
  refreshControl,
}: ScreenProps) {
  const { tokens } = useAppTheme();
  const { width } = useWindowDimensions();
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

  const wash = (
    <LinearGradient
      pointerEvents="none"
      colors={[tokens.canvasTint, tokens.background]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.wash}
    />
  );

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
      {wash}
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
  wash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 420,
    borderBottomLeftRadius: radius.xl * 2,
    borderBottomRightRadius: radius.xl * 2,
    opacity: 0.9,
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
