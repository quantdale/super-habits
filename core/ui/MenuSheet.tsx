import type { ReactNode } from 'react';
import { Modal as RNModal, Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/core/providers/themeContext';

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
                <Pressable
                  key={item.label}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  className="min-h-[48px] flex-row items-center gap-3 rounded-2xl px-4 py-3"
                  style={({ pressed }) => [
                    { backgroundColor: pressed ? tokens.surfaceActive : 'transparent' },
                  ]}
                  onPress={() => {
                    onClose();
                    item.onPress();
                  }}
                >
                  <MaterialIcons
                    name={item.icon}
                    size={22}
                    color={item.destructive ? tokens.dangerText : tokens.text}
                  />
                  <Text
                    className="flex-1 text-base"
                    style={{ color: item.destructive ? tokens.dangerText : tokens.text }}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                className="mt-2 min-h-[48px] items-center justify-center rounded-2xl px-4 py-3"
                style={({ pressed }) => [
                  {
                    backgroundColor: pressed ? tokens.surfaceActive : tokens.surfaceElevated,
                    borderColor: tokens.border,
                    borderWidth: 1,
                  },
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
