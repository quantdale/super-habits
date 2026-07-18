import type { ReactNode } from 'react';
import {
  Modal as RNModal,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/core/providers/ThemeProvider';

export type ModalLayout = 'dialog' | 'drawer' | 'bottom-sheet';

export type ModalProps = {
  visible: boolean;
  onClose: () => void;
  /** When omitted, only the close control is shown (e.g. when an inner `Card variant="header"` supplies the label). */
  title?: string;
  children: ReactNode;
  scroll?: boolean;
  layout?: ModalLayout;
};

export function Modal({
  visible,
  onClose,
  title,
  children,
  scroll = false,
  layout = 'dialog',
}: ModalProps) {
  const { tokens } = useAppTheme();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const isDrawer = layout === 'drawer';
  const isBottomSheet = layout === 'bottom-sheet';
  const scrollMaxHeight = layout === 'dialog' ? windowHeight * 0.88 : windowHeight * 0.92;

  const overlayStyle = isDrawer
    ? {
        alignItems: 'flex-end' as const,
        justifyContent: 'flex-start' as const,
        paddingTop: 16,
        paddingRight: 16,
        paddingBottom: 16,
        paddingLeft: 16,
      }
    : isBottomSheet
      ? { alignItems: 'stretch' as const, justifyContent: 'flex-end' as const, padding: 0 }
      : { alignItems: 'center' as const, justifyContent: 'center' as const, padding: 16 };

  const shellStyle = isDrawer
    ? { width: Math.min(windowWidth - 32, 520) }
    : isBottomSheet
      ? { width: '100%' as const, maxWidth: 720, alignSelf: 'center' as const }
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
    borderTopLeftRadius: isBottomSheet ? 28 : 24,
    borderTopRightRadius: isBottomSheet ? 28 : 24,
    borderBottomLeftRadius: isBottomSheet ? 0 : 24,
    borderBottomRightRadius: isBottomSheet ? 0 : 24,
    maxHeight: isDrawer ? windowHeight - 32 : isBottomSheet ? windowHeight * 0.92 : undefined,
  };

  const bodyContainerStyle = isBottomSheet ? { maxHeight: windowHeight * 0.82 } : undefined;

  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        className="flex-1"
        accessibilityViewIsModal
        style={{ backgroundColor: tokens.overlayScrim, ...overlayStyle }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss dialog"
          className="absolute inset-0"
          onPress={onClose}
        />
        <Pressable onPress={(e) => e.stopPropagation()} style={shellStyle}>
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
                className="h-11 w-11 items-center justify-center rounded-full"
                style={{ backgroundColor: tokens.surfaceElevated }}
              >
                <MaterialIcons name="close" size={24} color={tokens.iconMuted} />
              </Pressable>
            </View>
            {scroll ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
                style={bodyContainerStyle ?? { maxHeight: scrollMaxHeight }}
                contentContainerStyle={isDrawer ? { flexGrow: 1 } : undefined}
              >
                <View className="px-5 pb-5">{children}</View>
              </ScrollView>
            ) : (
              <View className="px-5 pb-5" style={bodyContainerStyle}>
                {children}
              </View>
            )}
          </View>
        </Pressable>
      </View>
    </RNModal>
  );
}
