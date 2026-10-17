import { useState } from 'react';
import { TextInput, type KeyboardTypeOptions } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';

type DraftTextFieldProps = {
  accessibilityLabel: string;
  /**
   * Value loaded from persistence when the field mounts (e.g. the re-fetched
   * entity row). The field then owns its own draft: mid-edit re-renders and
   * late/out-of-order save echoes can never reset what the user is typing.
   * A remount (editor reopen, entity replacement) re-seeds from this value.
   */
  initialValue: string;
  /** Persists each keystroke; may be async. Rejected saves surface via the caller. */
  onCommit: (value: string) => void | Promise<void>;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  className?: string;
};

/**
 * Save-on-change text field for editors whose values are echoed back from
 * re-fetched entity rows. The displayed text is a synchronous draft owned by
 * this component — the same contract as an uncontrolled input, but enforced
 * by React's controlled-value semantics so a `refresh()` re-render (or a
 * late stale echo) cannot reset typing in progress.
 */
export function DraftTextField({
  accessibilityLabel,
  initialValue,
  onCommit,
  placeholder,
  keyboardType,
  className = 'rounded-xl border px-3 py-2 text-sm',
}: DraftTextFieldProps) {
  const { tokens } = useAppTheme();
  const [draft, setDraft] = useState(initialValue);
  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      value={draft}
      onChangeText={(next) => {
        setDraft(next);
        void onCommit(next);
      }}
      placeholder={placeholder}
      placeholderTextColor={tokens.textMuted}
      keyboardType={keyboardType}
      className={className}
      style={{
        borderColor: tokens.border,
        backgroundColor: tokens.surfaceElevated,
        color: tokens.text,
      }}
    />
  );
}
