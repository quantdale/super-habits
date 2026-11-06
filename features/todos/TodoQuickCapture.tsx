import { useRef, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { TextInput, View } from 'react-native';
import { SECTION_HUES, SECTION_ON_BRIGHT_INK } from '@/constants/sectionColors';
import { Pressable3D } from '@/core/ui/Pressable3D';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius, spacing } from '@/core/theme/designTokens';
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
  /**
   * Surfaces a failed write (mandatory CORR-A-02 scenario 8: a write that
   * rejects after the optimistic loading presentation). The typed input is
   * preserved either way; this slot exists so the failure is reported instead
   * of disappearing into an unhandled rejection.
   */
  onPersistError?: (error: unknown) => void;
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
export function TodoQuickCapture({ title, onTitleChange, onSubmit, onPersistError }: Props) {
  const { tokens } = useAppTheme();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focused, setFocused] = useState(false);
  const submitGuard = useRef(createSubmitGuard());
  const trimmed = title.trim();
  const canSubmit = trimmed.length > 0 && !isSubmitting;
  const hue = SECTION_HUES.todos;

  const handleSubmit = async () => {
    await submitInlineQuickAdd({
      guard: submitGuard.current,
      canSubmit,
      title: trimmed,
      persist: onSubmit,
      onSubmittingChange: setIsSubmitting,
      onPersisted: () => onTitleChange(''),
      onPersistFailed: (error) => onPersistError?.(error),
    });
  };

  return (
    <View className="mb-3 flex-row items-center" style={{ gap: spacing.sm }}>
      <TextInput
        accessibilityLabel="Quick add task title"
        className="min-w-0 flex-1 text-base"
        style={{
          minHeight: 52,
          borderRadius: radius.sm,
          borderWidth: 2,
          borderColor: focused ? tokens.accent : 'transparent',
          backgroundColor: focused ? tokens.surface : tokens.surfaceSunken,
          color: tokens.text,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        }}
        value={title}
        onChangeText={onTitleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Quick add"
        placeholderTextColor={tokens.textSubtle}
        returnKeyType="done"
        onSubmitEditing={() => void handleSubmit()}
      />
      {/* The one "Add task" control (§7 composer): 52px Sky round Pressable3D
          — bright face, ink glyph (§5.1), 4px Sky lip sinking under the press. */}
      <Pressable3D
        lip={4}
        faceColor={canSubmit ? hue.bright : tokens.surfaceSunken}
        lipColor={canSubmit ? hue.lip : tokens.border}
        radius={radius.full}
        onPress={() => void handleSubmit()}
        disabled={!canSubmit}
        accessibilityRole="button"
        accessibilityLabel="Add task"
        accessibilityState={{ disabled: !canSubmit }}
        style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}
        faceStyle={{ alignItems: 'center', justifyContent: 'center' }}
      >
        {/* §5.1: `bright` is never under white — ink label on the bright fill. */}
        <MaterialIcons
          name="add"
          size={28}
          color={canSubmit ? SECTION_ON_BRIGHT_INK : tokens.textSubtle}
        />
      </Pressable3D>
    </View>
  );
}
