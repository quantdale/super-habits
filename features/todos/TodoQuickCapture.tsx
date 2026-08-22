import { useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, TextInput, View } from 'react-native';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { opacity } from '@/core/theme';
import { useAppTheme } from '@/core/providers/themeContext';

type Props = {
  /** Creates the task; resolves after persistence so the input only clears on success. */
  onSubmit: (title: string) => Promise<void>;
};

/**
 * Persistent single-line quick capture pinned above the pending list. Enter or
 * the add button creates a task with just a title; the FAB stays available for
 * detailed capture (due date, priority, project, linked actions).
 */
export function TodoQuickCapture({ onSubmit }: Props) {
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
    <View className="mb-4 flex-row items-center gap-2">
      <TextInput
        accessibilityLabel="Quick add task title"
        className="flex-1 rounded-2xl border px-4 py-3 text-base"
        style={{
          minHeight: 48,
          borderColor: tokens.border,
          backgroundColor: tokens.surfaceElevated,
          color: tokens.text,
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
        className="h-12 w-12 items-center justify-center rounded-2xl"
        style={({ pressed }) => ({
          backgroundColor: SECTION_COLORS.todos,
          opacity: canSubmit ? (pressed ? opacity.pressed : 1) : opacity.disabled,
        })}
      >
        <MaterialIcons name="add" size={24} color={tokens.textOnAccent} />
      </Pressable>
    </View>
  );
}
