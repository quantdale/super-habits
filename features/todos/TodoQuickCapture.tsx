import { useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { opacity } from '@/core/theme';
import { useAppTheme } from '@/core/providers/themeContext';
import { spacing, radius, size } from '@/core/theme/designTokens';

type Props = {
  /** Creates the task; resolves after persistence so the input only clears on success. */
  onSubmit: (title: string) => Promise<void>;
  /** Opens the full task editor for dates, links, recurrence, and rules. */
  onOpenDetails?: () => void;
};

/**
 * Persistent single-line quick capture pinned above the pending list. Enter or
 * the add button creates a task with just a title; the optional details action
 * keeps advanced task editing reachable without another floating action.
 */
export function TodoQuickCapture({ onSubmit, onOpenDetails }: Props) {
  const { tokens } = useAppTheme();
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const trimmed = title.trim();
  const canSubmit = trimmed.length > 0 && !isSubmitting;

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
        className="flex-1 text-base"
        style={{
          minHeight: size.touchTargetMin,
          borderRadius: radius.lg,
          borderWidth: 1,
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
      <Pressable
        onPress={() => void handleSubmit()}
        disabled={!canSubmit}
        accessibilityRole="button"
        accessibilityLabel="Add task"
        accessibilityState={{ disabled: !canSubmit }}
        className="items-center justify-center"
        style={{
          width: size.touchTargetMin,
          height: size.touchTargetMin,
          borderRadius: radius.lg,
          backgroundColor: SECTION_COLORS.todos,
          opacity: canSubmit ? 1 : opacity.disabled,
        }}
      >
        <MaterialIcons name="add" size={24} color={tokens.textOnAccent} />
      </Pressable>
      {onOpenDetails ? (
        <Pressable
          onPress={onOpenDetails}
          accessibilityRole="button"
          accessibilityLabel="Add task"
          accessibilityHint="Open task details"
          className="justify-center"
          style={{
            minHeight: size.touchTargetMin,
            borderRadius: radius.md,
            paddingHorizontal: spacing.sm,
          }}
        >
          <Text className="text-xs font-semibold" style={{ color: tokens.textMuted }}>
            Details
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
