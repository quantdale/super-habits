import { useCallback, useState } from "react";
import { Alert, Platform, Text, View } from "react-native";
import { useAppTheme } from "@/core/providers/ThemeProvider";
import { Button } from "./Button";
import { Modal } from "./Modal";

type ConfirmationOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "danger";
  color?: string;
};

type PendingConfirmation = ConfirmationOptions & {
  resolve: (confirmed: boolean) => void;
};

export function useConfirmationDialog() {
  const { tokens } = useAppTheme();
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);

  const confirm = useCallback((options: ConfirmationOptions) => {
    if (Platform.OS !== "web") {
      return new Promise<boolean>((resolve) => {
        Alert.alert(options.title, options.message, [
          {
            text: options.cancelLabel ?? "Cancel",
            style: "cancel",
            onPress: () => resolve(false),
          },
          {
            text: options.confirmLabel,
            style: options.confirmVariant === "danger" ? "destructive" : "default",
            onPress: () => resolve(true),
          },
        ]);
      });
    }

    return new Promise<boolean>((resolve) => {
      setPendingConfirmation({
        ...options,
        resolve,
      });
    });
  }, []);

  const resolvePendingConfirmation = useCallback((confirmed: boolean) => {
    setPendingConfirmation((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }, []);

  const confirmationDialog = (
    <Modal
      visible={pendingConfirmation !== null}
      onClose={() => resolvePendingConfirmation(false)}
      title={pendingConfirmation?.title}
    >
      <Text className="text-sm" style={{ color: tokens.textMuted }}>
        {pendingConfirmation?.message}
      </Text>
      <View className="mt-4 flex-row gap-2">
        <Button
          label={pendingConfirmation?.cancelLabel ?? "Cancel"}
          variant="ghost"
          onPress={() => resolvePendingConfirmation(false)}
        />
        <Button
          label={pendingConfirmation?.confirmLabel ?? "Confirm"}
          variant={pendingConfirmation?.confirmVariant ?? "primary"}
          color={pendingConfirmation?.color}
          onPress={() => resolvePendingConfirmation(true)}
        />
      </View>
    </Modal>
  );

  return {
    confirm,
    confirmationDialog,
  };
}
