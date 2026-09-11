import { Text } from '@/core/ui/Text';
import { useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Animated, Pressable, TextInput, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { useReducedMotion } from '@/core/theme/motion';
import { opacity, radius, size, spacing, springs } from '@/core/theme/designTokens';

type Props = {
  /** Creates the task; resolves after persistence so the input only clears on success. */
  onSubmit: (title: string) => Promise<void>;
  /** Opens the full task editor for dates, links, recurrence, and rules. */
  onOpenDetails?: () => void;
};

/**
 * Persistent single-line quick capture pinned above the pending list. Enter or
 * the chunky circular add button creates a task with just a title; the optional
 * details action keeps advanced task editing reachable without another
 * floating action. The add button sinks and springs back under the finger.
 */
export function TodoQuickCapture({ onSubmit, onOpenDetails }: Props) {
  const { tokens, sectionAccents } = useAppTheme();
  const reducedMotion = useReducedMotion();
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pressScale] = useState(() => new Animated.Value(1));
  const trimmed = title.trim();
  const canSubmit = trimmed.length > 0 && !isSubmitting;

  const settle = (toValue: number) => {
    if (reducedMotion) {
      pressScale.setValue(toValue);
      return;
    }
    Animated.spring(pressScale, { toValue, useNativeDriver: true, ...springs.press }).start();
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await onSubmit(trimmed);
      setTitle('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="mb-4 flex-row items-center" style={{ gap: spacing.sm }}>
      <TextInput
        accessibilityLabel="Quick add task title"
        className="min-w-0 flex-1 text-base"
        style={{
          minHeight: size.touchTargetMin,
          borderRadius: radius.full,
          borderWidth: 2,
          borderColor: tokens.border,
          backgroundColor: tokens.surfaceElevated,
          color: tokens.text,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        }}
        value={title}
        onChangeText={setTitle}
        placeholder="Quick add"
        placeholderTextColor={tokens.textMuted}
        returnKeyType="done"
        onSubmitEditing={() => void handleSubmit()}
      />
      <Animated.View style={{ transform: [{ scale: pressScale }] }}>
        <Pressable
          onPress={() => void handleSubmit()}
          onPressIn={() => settle(0.88)}
          onPressOut={() => settle(1)}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel="Add task"
          accessibilityState={{ disabled: !canSubmit }}
          className="items-center justify-center"
          style={{
            width: size.touchTargetMin,
            height: size.touchTargetMin,
            borderRadius: radius.full,
            backgroundColor: sectionAccents.todos.fill,
            opacity: canSubmit ? 1 : opacity.disabled,
          }}
        >
          <MaterialIcons name="add" size={26} color={tokens.textOnAccent} />
        </Pressable>
      </Animated.View>
      {onOpenDetails ? (
        <Pressable
          onPress={onOpenDetails}
          accessibilityRole="button"
          accessibilityLabel="Add task"
          accessibilityHint="Open task details"
          className="items-center justify-center border"
          style={{
            minHeight: size.touchTargetMin,
            borderRadius: radius.full,
            borderColor: tokens.border,
            paddingHorizontal: spacing.md,
            backgroundColor: tokens.surface,
          }}
        >
          <Text variant="label" tone="muted">
            Details
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
