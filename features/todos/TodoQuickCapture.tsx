import { useRef, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Animated, Pressable, TextInput, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { useReducedMotion } from '@/core/theme/motion';
import { opacity, radius, size, spacing, springs } from '@/core/theme/designTokens';
import { createSubmitGuard } from '@/lib/submitGuard';
import { submitInlineQuickAdd } from '@/features/todos/todoQuickCapture.submit';

type Props = {
  /**
   * Controlled draft text. Owned by the section (TodosScreen) rather than this
   * component so it survives remounts — e.g. the empty<->populated transition
   * swaps Screen's ScrollView/View container and recreates this subtree. Keeping
   * the draft up a level is what makes "never lose unsaved input" hold.
   */
  title: string;
  /** Updates the controlled draft text. */
  onTitleChange: (text: string) => void;
  /** Creates the task; resolves after persistence so the input only clears on success. */
  onSubmit: (title: string) => Promise<void>;
};

/**
 * The single fast-add interaction for To Do (campaign SUR-04): one input +
 * one add button. Enter or the chunky circular add button creates a task with
 * just a title — metadata never blocks saving. Enrichment happens after
 * creation via row disclosure (tap the row → editor); the full composer for
 * details-first creation lives in the page header, clearly separate from this
 * row. The add button sinks and springs back under the finger.
 *
 * Both entry paths funnel through `submitInlineQuickAdd`, which owns the
 * same-tick re-entry guard (see that module for why the `isSubmitting` state
 * alone cannot do this job). `isSubmitting` here is only the button's loading
 * presentation.
 */
export function TodoQuickCapture({ title, onTitleChange, onSubmit }: Props) {
  const { tokens, sectionAccents } = useAppTheme();
  const reducedMotion = useReducedMotion();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pressScale] = useState(() => new Animated.Value(1));
  const submitGuard = useRef(createSubmitGuard());
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
    await submitInlineQuickAdd({
      guard: submitGuard.current,
      canSubmit,
      title: trimmed,
      persist: onSubmit,
      onSubmittingChange: setIsSubmitting,
      onPersisted: () => onTitleChange(''),
    });
  };

  return (
    <View className="mb-3 flex-row items-center" style={{ gap: spacing.sm }}>
      <TextInput
        accessibilityLabel="Quick add task title"
        className="min-w-0 flex-1 text-base"
        style={{
          minHeight: size.touchTargetMin,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: tokens.border,
          backgroundColor: tokens.surfaceSunken,
          color: tokens.text,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        }}
        value={title}
        onChangeText={onTitleChange}
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
    </View>
  );
}
