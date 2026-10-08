import { useEffect, useRef } from 'react';
import { Platform, type View } from 'react-native';

/** RN Web's PressResponder accepts Space only for buttons, not ARIA checkboxes.
 * Supply that missing key without duplicating its existing Enter/pointer path.
 * Native press handling is untouched.
 */
export function useHabitCheckboxKeyboard(
  enabled: boolean,
  disabled: boolean,
  onActivate: () => void,
) {
  const ref = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    // SAFETY: this branch is web-only; RN Web forwards View refs to DOM nodes,
    // while RN's portable View ref type cannot express the HTMLElement instance.
    const node = ref.current as unknown as HTMLElement | null;
    if (!node) return;
    const listener = (event: KeyboardEvent) => {
      if (event.target !== node || (event.key !== ' ' && event.key !== 'Spacebar')) return;
      event.preventDefault();
      event.stopPropagation();
      if (!disabled && !event.repeat) onActivate();
    };
    node.addEventListener('keydown', listener);
    return () => node.removeEventListener('keydown', listener);
  }, [disabled, enabled, onActivate]);
  return ref;
}
