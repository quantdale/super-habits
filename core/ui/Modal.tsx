import type { ReactNode } from "react";
import { Modal as RNModal, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

export type ModalProps = {
  visible: boolean;
  onClose: () => void;
  /** When omitted, only the close control is shown (e.g. when an inner `Card variant="header"` supplies the label). */
  title?: string;
  children: ReactNode;
  scroll?: boolean;
};

export function Modal({ visible, onClose, title, children, scroll = false }: ModalProps) {
  const { height: windowHeight } = useWindowDimensions();
  const scrollMaxHeight = windowHeight * 0.88;

  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/50 p-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss dialog"
          className="absolute inset-0"
          onPress={onClose}
        />
        <Pressable onPress={(e) => e.stopPropagation()} className="w-full max-w-md">
          <View className="w-full max-w-md overflow-hidden rounded-2xl bg-[#f8f7ff]">
            <View
              className={`flex-row items-center px-4 pb-3 pt-4 ${title ? "justify-between" : "justify-end"}`}
            >
              {title ? (
                <Text className="flex-1 pr-2 text-xl font-bold text-slate-900">{title}</Text>
              ) : null}
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
              >
                <MaterialIcons name="close" size={24} color="#94a3b8" />
              </Pressable>
            </View>
            {scroll ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
                style={{ maxHeight: scrollMaxHeight }}
              >
                <View className="px-4 pb-4">{children}</View>
              </ScrollView>
            ) : (
              <View className="px-4 pb-4">{children}</View>
            )}
          </View>
        </Pressable>
      </View>
    </RNModal>
  );
}
