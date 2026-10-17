import { useState } from 'react';
import { NumberStepperField } from '@/core/ui/NumberStepperField';

type DraftNumberFieldProps = {
  label: string;
  inputAccessibilityLabel?: string;
  /**
   * Value loaded from persistence when the field mounts (e.g. the re-fetched
   * entity row). The field then owns its own draft: mid-edit re-renders and
   * late/out-of-order save echoes can never reset what the user is typing.
   * A remount (editor reopen, set replacement) re-seeds from this value.
   */
  initialValue: string;
  /** Persists each edit; may be async. Rejected saves surface via the caller. */
  onCommit: (value: string) => void | Promise<void>;
  min?: number;
  max?: number;
  placeholder?: string;
};

/**
 * Save-on-change number field for editors whose values are echoed back from
 * re-fetched entity rows. `NumberStepperField` stays controlled from this
 * component's synchronous draft, so the +/- buttons always act on what the
 * user typed and a `refresh()` landing between keystrokes cannot clobber it.
 */
export function DraftNumberField({
  label,
  inputAccessibilityLabel,
  initialValue,
  onCommit,
  min,
  max,
  placeholder,
}: DraftNumberFieldProps) {
  const [draft, setDraft] = useState(initialValue);
  return (
    <NumberStepperField
      label={label}
      inputAccessibilityLabel={inputAccessibilityLabel}
      value={draft}
      onChange={(next) => {
        setDraft(next);
        void onCommit(next);
      }}
      min={min}
      max={max}
      placeholder={placeholder}
    />
  );
}
