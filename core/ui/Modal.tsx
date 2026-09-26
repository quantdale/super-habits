import { useEffect, useState, type ReactNode } from 'react';
import {
  Animated,
  Modal as RNModal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/core/providers/themeContext';
import { Text } from '@/core/ui/Text';
import { useKeyboardFocusRing } from '@/core/ui/useKeyboardFocusRing';
import { elevation, layers, layout, radius, size, spacing } from '@/core/theme/designTokens';
import { useReducedMotion } from '@/core/theme/motion';

export type ModalLayout = 'dialog' | 'drawer' | 'bottom-sheet';

export type ModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Fired after the native sheet is fully dismissed (iOS only). */
  onDismiss?: () => void;
  /** When omitted, only the close control is shown (e.g. when an inner `Card variant="header"` supplies the label). */
  title?: string;
  children: ReactNode;
  scroll?: boolean;
  modalLayout?: ModalLayout;
  /** Optional action area that stays visible while a scrollable body moves. */
  footer?: ReactNode;
};

// Android's native RNModal window does not always propagate the provider's
// navigation-bar inset. Keep scrollable dialog actions above that bar when
// the reported inset is zero.
const ANDROID_MODAL_NAVIGATION_FALLBACK = 64;
const MODAL_FOOTER_HEIGHT_RESERVE = 88;

/**
 * Pop overlay surface.
 *
 * The shell is a full-screen scrim plus a rounded panel that springs into
 * place: `bottom-sheet` rises from the bottom edge with a grab handle,
 * `drawer` slides in from the right on wide screens and behaves like a large
 * sheet on phones, `dialog` is the centered card.
 *
 * The close affordance is always the same circular button so muscle memory
 * holds across every overlay in the app.
 */
export function Modal({
  visible,
  onClose,
  onDismiss,
  title,
  children,
  scroll = false,
  modalLayout = 'dialog',
  footer,
}: ModalProps) {
  const { tokens } = useAppTheme();
  const reducedMotion = useReducedMotion();
  const closeFocusRing = useKeyboardFocusRing(tokens.accent);
  const insets = useSafeAreaInsets();
  const [progress] = useState(() => new Animated.Value(0));

  const isDrawer = modalLayout === 'drawer';
  const isBottomSheet = modalLayout === 'bottom-sheet';
  const modalBottomInset =
    Platform.OS === 'android'
      ? Math.max(insets.bottom, ANDROID_MODAL_NAVIGATION_FALLBACK)
      : insets.bottom;
  const scrollBottomPadding = Platform.OS === 'android' ? 32 : insets.bottom + 24;

  useEffect(() => {
    if (!visible) {
      progress.setValue(0);
      return;
    }
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.spring(progress, {
      toValue: 1,
      useNativeDriver: true,
      speed: 16,
      bounciness: 6,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reducedMotion, visible]);

  const slideOffset = isBottomSheet ? 64 : isDrawer ? 48 : 24;
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [slideOffset, 0],
  });
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [slideOffset, 0] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });

  const sheetRadius = { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl };

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      onDismiss={onDismiss}
    >
      <View style={styles.root} accessibilityViewIsModal>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: tokens.overlayScrim, opacity: progress },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <View
          pointerEvents="box-none"
          style={[
            styles.positioner,
            isBottomSheet
              ? { justifyContent: 'flex-end' }
              : isDrawer
                ? {
                    justifyContent: 'flex-end',
                    alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
                  }
                : { justifyContent: 'center', alignItems: 'center' },
          ]}
        >
          <Animated.View
            style={[
              styles.panel,
              {
                backgroundColor: tokens.surface,
                borderColor: tokens.border,
                paddingBottom: isBottomSheet ? Math.max(modalBottomInset, spacing.lg) : 0,
                maxHeight: isBottomSheet ? '92%' : '86%',
                ...(isBottomSheet ? sheetRadius : null),
                ...elevation.level3,
                shadowColor: tokens.shadowColor,
                opacity: progress,
                transform: isBottomSheet
                  ? [{ translateY }]
                  : isDrawer
                    ? [{ translateX }]
                    : [{ scale }],
              },
            ]}
          >
            {isBottomSheet ? (
              <View style={{ alignItems: 'center', paddingTop: spacing.sm }}>
                <View
                  style={{
                    width: 44,
                    height: 5,
                    borderRadius: radius.full,
                    backgroundColor: tokens.borderStrong,
                  }}
                />
              </View>
            ) : null}

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingHorizontal: spacing.xl,
                paddingTop: isBottomSheet ? spacing.md : spacing.xl,
                paddingBottom: spacing.md,
              }}
            >
              <View style={{ minWidth: 0, flex: 1 }}>
                {title ? (
                  <Text variant="titleMd" numberOfLines={2}>
                    {title}
                  </Text>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onFocus={closeFocusRing.onFocus}
                onBlur={closeFocusRing.onBlur}
                onPress={onClose}
                style={[
                  {
                    width: size.touchTargetMin,
                    height: size.touchTargetMin,
                    borderRadius: radius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: tokens.surfaceSunken,
                  },
                  closeFocusRing.focusRingStyle,
                ]}
              >
                <MaterialIcons name="close" size={22} color={tokens.text} />
              </Pressable>
            </View>

            {scroll ? (
              <ScrollView
                style={{ flexGrow: 0 }}
                contentContainerStyle={{
                  paddingHorizontal: spacing.xl,
                  paddingBottom: (footer ? MODAL_FOOTER_HEIGHT_RESERVE : 0) + scrollBottomPadding,
                }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                nestedScrollEnabled
              >
                {children}
              </ScrollView>
            ) : (
              <View
                style={{
                  flexShrink: 1,
                  paddingHorizontal: spacing.xl,
                  paddingBottom: scrollBottomPadding,
                }}
              >
                {children}
              </View>
            )}

            {footer ? (
              <View
                style={{
                  paddingHorizontal: spacing.xl,
                  paddingTop: spacing.md,
                  paddingBottom: Math.max(modalBottomInset, spacing.lg),
                  borderTopWidth: 1,
                  borderTopColor: tokens.border,
                  backgroundColor: tokens.surface,
                }}
              >
                {footer}
              </View>
            ) : null}
          </Animated.View>
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  positioner: {
    flex: 1,
  },
  panel: {
    width: '100%',
    maxWidth: layout.modalMaxWidth + 60,
    alignSelf: 'center',
    borderWidth: 1,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
    zIndex: layers.modal,
  },
});
