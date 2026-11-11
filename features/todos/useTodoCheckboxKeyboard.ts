import { useEffect, useRef } from 'react';
import { Platform, type View } from 'react-native';

/**
 * RN Web's `PressResponder` accepts `Enter` from every target and `Space` only
 * from button-shaped roles (`isValidKeyPress`), so an ARIA `checkbox` that sits
 * inside another `Pressable` loses BOTH keys to the wrapping control. This hook
 * gives the checkbox those two keys with the same contract the habits check-in
 * uses (`features/habits/useHabitCheckboxKeyboard.ts`) — plus `Enter`, which a
 * nested checkbox also needs because the ancestor's press responder would
 * otherwise resolve it — and it stops the press from bubbling so the wrapping
 * row can never also activate. Native press handling is untouched.
 */
export function useTodoCheckboxKeyboard(
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
      // Only the checkbox itself owns these keys: a press on the wrapping row
      // (which is its own focusable control) must keep RN Web's behaviour.
      if (event.target !== node || !isTodoCheckboxActivationKey(event.key)) return;
      // Exactly one activation per press: the row's press responder resolves
      // `Enter`/`Space` on keyup, so the event must never reach it, and the
      // browser's own Space scroll is suppressed.
      event.preventDefault();
      event.stopPropagation();
      if (!disabled && !event.repeat) onActivate();
    };
    node.addEventListener('keydown', listener);
    return () => node.removeEventListener('keydown', listener);
  }, [disabled, enabled, onActivate]);
  return ref;
}

/**
 * The keys that complete a To Do from its own completion checkbox. `Spacebar`
 * is the legacy `KeyboardEvent.key` spelling some engines still emit.
 */
export function isTodoCheckboxActivationKey(key: string): boolean {
  return key === ' ' || key === 'Spacebar' || key === 'Enter';
}
