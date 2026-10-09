import { Text } from '@/core/ui/Text';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Button } from './Button';
import { Modal } from './Modal';

type ConfirmationOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  color?: string;
};

/** Topmost open dialog (confirmations overlay any sheet already open). */
function topmostDialog(): HTMLElement | null {
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]'));
  return dialogs.length > 0 ? dialogs[dialogs.length - 1] : null;
}

export function useConfirmationDialog() {
  const { tokens } = useAppTheme();
  const [pendingConfirmation, setPendingConfirmation] = useState<ConfirmationOptions | null>(null);
  const pendingResolveRef = useRef<((confirmed: boolean) => void) | null>(null);
  /** True when the last resolution dismissed without confirming (cancel/close). */
  const dismissedRef = useRef(false);

  const confirm = useCallback((options: ConfirmationOptions) => {
    if (Platform.OS !== 'web') {
      return new Promise<boolean>((resolve) => {
        Alert.alert(options.title, options.message, [
          {
            text: options.cancelLabel ?? 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: options.confirmLabel,
            style: options.confirmVariant === 'danger' ? 'destructive' : 'default',
            onPress: () => resolve(true),
          },
        ]);
      });
    }

    return new Promise<boolean>((resolve) => {
      pendingResolveRef.current = resolve;
      setPendingConfirmation(options);
    });
  }, []);

  // Resolve via the ref, outside the state updater: updaters must be pure
  // (StrictMode double-invokes them, which double-resolved the promise).
  const resolvePendingConfirmation = useCallback((confirmed: boolean) => {
    dismissedRef.current = !confirmed;
    const resolve = pendingResolveRef.current;
    pendingResolveRef.current = null;
    setPendingConfirmation(null);
    resolve?.(confirmed);
  }, []);

  // Web keyboard contract: focus moves into the dialog on open, Tab stays
  // inside until the dialog is confirmed or dismissed, and a dismissal
  // returns focus to the invoking control (Focus end confirmation is the
  // reference contract). Native confirms use the system Alert and skip this.
  useEffect(() => {
    if (Platform.OS !== 'web' || pendingConfirmation === null) return;
    const activeBefore = document.activeElement as HTMLElement | null;
    const focusFrame = requestAnimationFrame(() => {
      topmostDialog()?.querySelector<HTMLElement>('button')?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const dialog = topmostDialog();
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea'),
      ).filter((el) => !el.hasAttribute('disabled'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!dialog.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown, true);
      // Only a dismissal restores focus; a confirmed action lets the caller
      // move focus deliberately to whatever it opens next.
      if (dismissedRef.current) activeBefore?.focus?.();
      dismissedRef.current = false;
    };
  }, [pendingConfirmation]);

  const confirmationDialog = (
    <Modal
      visible={pendingConfirmation !== null}
      onClose={() => resolvePendingConfirmation(false)}
      title={pendingConfirmation?.title}
    >
      <Text className="text-sm" style={{ color: tokens.textMuted }}>
        {pendingConfirmation?.message}
      </Text>
      <View className="mt-4 flex-row flex-wrap justify-end gap-2">
        <Button
          label={pendingConfirmation?.cancelLabel ?? 'Cancel'}
          variant="ghost"
          onPress={() => resolvePendingConfirmation(false)}
        />
        <Button
          label={pendingConfirmation?.confirmLabel ?? 'Confirm'}
          variant={pendingConfirmation?.confirmVariant ?? 'primary'}
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
