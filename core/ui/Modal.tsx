import type { ReactNode } from 'react';
import {
  Modal as RNModal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/core/providers/themeContext';
import { useKeyboardFocusRing } from '@/core/ui/useKeyboardFocusRing';
import { spacing, radius, layout } from '@/core/theme/designTokens';

export type ModalLayout = 'dialog' | 'drawer' | 'bottom-sheet';

export type ModalProps = {
  visible: boolean;
  onClose: () => void;
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
const MODAL_FOOTER_HEIGHT_RESERVE = 80;

export function Modal({
  visible,
  onClose,
  title,
  children,
  scroll = false,
  modalLayout = 'dialog',
  footer,
}: ModalProps) {
  const { tokens } = useAppTheme();
  const closeFocusRing = useKeyboardFocusRing(tokens.accent);
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const isDrawer = modalLayout === 'drawer';
  const isBottomSheet = modalLayout === 'bottom-sheet';
  const modalBottomInset =
    Platform.OS === 'android'
      ? Math.max(safeAreaBottom, ANDROID_MODAL_NAVIGATION_FALLBACK)
      : safeAreaBottom;
  const modalMaxHeight = isBottomSheet
    ? Math.max(0, windowHeight * 0.92 - modalBottomInset)
    : Math.max(0, windowHeight - 32 - modalBottomInset);
  const scrollBottomPadding =
    Platform.OS === 'android' ? modalBottomInset + 24 : safeAreaBottom + (isBottomSheet ? 24 : 0);
  const scrollMaxHeight = Math.max(
    0,
    Math.min(
      (modalLayout === 'dialog' ? windowHeight * 0.88 : windowHeight * 0.92) -
        (footer ? MODAL_FOOTER_HEIGHT_RESERVE : 0),
      modalMaxHeight - 88,
    ),
  );

  const overlayStyle = isDrawer
    ? {
        alignItems: 'flex-end' as const,
        justifyContent: 'flex-start' as const,
        paddingTop: spacing.lg,
        paddingRight: spacing.lg,
        paddingBottom: spacing.lg + modalBottomInset,
        paddingLeft: spacing.lg,
      }
    : isBottomSheet
      ? {
          alignItems: 'stretch' as const,
          justifyContent: 'flex-end' as const,
          paddingTop: 0,
          paddingRight: 0,
          paddingBottom: modalBottomInset,
          paddingLeft: 0,
        }
      : {
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          paddingTop: spacing.lg,
          paddingRight: spacing.lg,
          paddingBottom: spacing.lg + modalBottomInset,
          paddingLeft: spacing.lg,
        };

  const shellStyle = isDrawer
    ? { width: Math.min(windowWidth - spacing.xxl * 2, 520) }
    : isBottomSheet
      ? { width: '100%' as const, maxWidth: layout.contentMaxWidth, alignSelf: 'center' as const }
      : { width: '100%' as const, maxWidth: 448 };

  const surfaceStyle = {
    width: '100%' as const,
    overflow: 'hidden' as const,
    backgroundColor: tokens.surface,
    borderColor: tokens.border,
    borderWidth: 1,
    shadowColor: tokens.shadowColor,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 4,
    borderTopLeftRadius: isBottomSheet ? radius.xl : radius.lg,
    borderTopRightRadius: isBottomSheet ? radius.xl : radius.lg,
    borderBottomLeftRadius: isBottomSheet ? 0 : radius.lg,
    borderBottomRightRadius: isBottomSheet ? 0 : radius.lg,
    maxHeight: modalMaxHeight,
  };

  const bodyContainerStyle = isBottomSheet
    ? {
        maxHeight: Math.max(
          0,
          windowHeight * 0.82 - (footer ? MODAL_FOOTER_HEIGHT_RESERVE : 0) - modalBottomInset,
        ),
      }
    : undefined;
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        className="flex-1"
        accessibilityViewIsModal={visible}
        accessibilityElementsHidden={!visible}
        importantForAccessibility={visible ? 'yes' : 'no-hide-descendants'}
        pointerEvents={visible ? 'auto' : 'none'}
        style={{ backgroundColor: tokens.overlayScrim, ...overlayStyle }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss dialog"
          className="absolute inset-0"
          onPress={onClose}
        />
        {/* Keep the sheet shell non-clickable so descendant ScrollViews can claim
            vertical gestures on native. The backdrop is a sibling, so it still
            owns outside taps without requiring an event-stopping Pressable here. */}
        <View style={shellStyle}>
          <View style={surfaceStyle}>
            <View
              className={`flex-row items-center px-5 pb-4 pt-5 ${title ? 'justify-between' : 'justify-end'}`}
            >
              {title ? (
                <Text className="flex-1 pr-2 text-xl font-bold" style={{ color: tokens.text }}>
                  {title}
                </Text>
              ) : null}
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={4}
                onFocus={closeFocusRing.onFocus}
                onBlur={closeFocusRing.onBlur}
                className="h-11 w-11 items-center justify-center rounded-full"
                style={[
                  { backgroundColor: tokens.surfaceElevated },
                  // Visible keyboard-focus indication on web (Design DNA §15).
                  closeFocusRing.focusRingStyle,
                ]}
              >
                <MaterialIcons name="close" size={24} color={tokens.iconMuted} />
              </Pressable>
            </View>
            {scroll ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
                style={bodyContainerStyle ?? { maxHeight: scrollMaxHeight }}
                contentContainerStyle={[
                  isDrawer ? { flexGrow: 1 } : null,
                  scrollBottomPadding > 0 ? { paddingBottom: scrollBottomPadding } : null,
                ]}
              >
                <View className="px-5 pb-5">{children}</View>
              </ScrollView>
            ) : (
              <View className="px-5 pb-5" style={bodyContainerStyle}>
                {children}
              </View>
            )}
            {footer ? (
              <View
                className="border-t px-5 pt-3"
                style={{
                  borderTopColor: tokens.border,
                  borderTopWidth: 1,
                  paddingBottom: Math.max(16, safeAreaBottom + 16),
                }}
              >
                {footer}
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </RNModal>
  );
}
