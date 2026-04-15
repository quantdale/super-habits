import type { ReactNode } from "react";
import { Modal as RNModal, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/core/providers/ThemeProvider";

export type ModalProps = {
  visible: boolean;
  onClose: () => void;
  /** When omitted, only the close control is shown (e.g. when an inner `Card variant="header"` supplies the label). */
  title?: string;
  children: ReactNode;
  scroll?: boolean;
};

export function Modal({ visible, onClose, title, children, scroll = false }: ModalProps) {
  const { tokens } = useAppTheme();
  const { height: windowHeight } = useWindowDimensions();
  const scrollMaxHeight = windowHeight * 0.88;

  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center p-4" style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss dialog"
          className="absolute inset-0"
          onPress={onClose}
        />
        <Pressable onPress={(e) => e.stopPropagation()} className="w-full max-w-md">
          <View
            className="w-full max-w-md overflow-hidden rounded-2xl"
            style={{ backgroundColor: tokens.background, borderColor: tokens.border, borderWidth: 1 }}
          >
            <View
              className={`flex-row items-center px-5 pb-4 pt-5 ${title ? "justify-between" : "justify-end"}`}
            >
              {title ? (
                <Text className="flex-1 pr-2 text-xl font-bold" style={{ color: tokens.text }}>{title}</Text>
              ) : null}
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
              >
                <MaterialIcons name="close" size={24} color={tokens.iconMuted} />
              </Pressable>
            </View>
            {scroll ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
                style={{ maxHeight: scrollMaxHeight }}
              >
                <View className="px-5 pb-5">{children}</View>
              </ScrollView>
            ) : (
              <View className="px-5 pb-5">{children}</View>
            )}
          </View>
        </Pressable>
      </View>
    </RNModal>
  );
}
