import type { ReactNode } from 'react';
import { Modal as RNModal, Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/core/providers/themeContext';
import { useKeyboardFocusRing } from '@/core/ui/useKeyboardFocusRing';

export type MenuItem = {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
  /** Renders the item with semantic danger styling. */
  destructive?: boolean;
};

type MenuSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Optional context line shown above the items. */
  title?: string;
  items: MenuItem[];
  /** Optional preview content (e.g. the row title) between title and items. */
  children?: ReactNode;
};

/**
 * Bottom action sheet listing explicit menu actions. This is the accessible,
 * non-gesture equivalent for operations that are also available through
 * swipes or long-presses (Design DNA §15: "swipe/drag has an equivalent
 * control").
 */
export function MenuSheet({ visible, onClose, title, items, children }: MenuSheetProps) {
  const { tokens } = useAppTheme();
  const cancelFocusRing = useKeyboardFocusRing(tokens.accent);

  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        className="flex-1 justify-end"
        accessibilityViewIsModal
        style={{ backgroundColor: tokens.overlayScrim }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss menu"
          className="absolute inset-0"
          onPress={onClose}
        />
        <Pressable
          className="mx-auto w-full self-stretch"
          style={{ maxWidth: 720 }}
          onPress={(e) => e.stopPropagation()}
        >
          <View
            className="px-4 pb-6 pt-3"
            style={{
              backgroundColor: tokens.surface,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              borderColor: tokens.border,
              borderWidth: 1,
            }}
          >
            <View
              className="mb-3 h-1 w-10 self-center rounded-full"
              style={{ backgroundColor: tokens.border }}
            />
            {title ? (
              <Text
                className="mb-2 text-center text-sm font-semibold"
                style={{ color: tokens.text }}
              >
                {title}
              </Text>
            ) : null}
            {children}
            <View className="mt-2 gap-1">
              {items.map((item) => (
                <MenuSheetItem
                  key={item.label}
                  icon={item.icon}
                  label={item.label}
                  destructive={item.destructive}
                  onPress={() => {
                    onClose();
                    item.onPress();
                  }}
                />
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                onFocus={cancelFocusRing.onFocus}
                onBlur={cancelFocusRing.onBlur}
                className="mt-2 min-h-[48px] items-center justify-center rounded-2xl px-4 py-3"
                style={({ pressed }) => [
                  {
                    backgroundColor: pressed ? tokens.surfaceActive : tokens.surfaceElevated,
                    borderColor: tokens.border,
                    borderWidth: 1,
                  },
                  // Visible keyboard-focus indication on web (Design DNA §15).
                  cancelFocusRing.focusRingStyle,
                ]}
                onPress={onClose}
              >
                <Text className="text-base font-semibold" style={{ color: tokens.text }}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </View>
    </RNModal>
  );
}

/**
 * Single menu row. Extracted so each item can own its keyboard-focus ring
 * (hooks cannot live inside the parent's `.map()`); behavior and styling are
 * unchanged from the previous inline Pressable.
 */
function MenuSheetItem({ icon, label, destructive, onPress }: MenuItem) {
  const { tokens } = useAppTheme();
  const focusRing = useKeyboardFocusRing(tokens.accent);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onFocus={focusRing.onFocus}
      onBlur={focusRing.onBlur}
      className="min-h-[48px] flex-row items-center gap-3 rounded-2xl px-4 py-3"
      style={({ pressed }) => [
        { backgroundColor: pressed ? tokens.surfaceActive : 'transparent' },
        // Visible keyboard-focus indication on web (Design DNA §15).
        focusRing.focusRingStyle,
      ]}
      onPress={onPress}
    >
      <MaterialIcons name={icon} size={22} color={destructive ? tokens.dangerText : tokens.text} />
      <Text
        className="flex-1 text-base"
        style={{ color: destructive ? tokens.dangerText : tokens.text }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
