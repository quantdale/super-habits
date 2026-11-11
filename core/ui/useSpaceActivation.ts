import { useEffect, useRef } from 'react';
import { Platform, type View } from 'react-native';

/**
 * Space activation for the non-`button` ARIA roles react-native-web's
 * `PressResponder` refuses to serve (`docs/testing/known-gaps.md` CG-13).
 *
 * RN-Web's `isValidKeyPress` accepts `Enter` for any role but `Space` only for
 * button-shaped targets (`button` tag, or `role="button"` / `"menuitem"`), so a
 * `role="tab"` segmented option and a `role="radio"` option row are inert on
 * Space even though a pointer click and `Enter` both work. The repo already
 * closes this gap in two places — `features/habits/useHabitCheckboxKeyboard.ts`
 * (a `keydown` listener on the checkbox node) and `core/ui/Switch.tsx` (a
 * `keydown` listener on its track) — and this is that same contract lifted into
 * one shared place so the remaining shapes cannot drift from it:
 *
 * - one activation per press, on `keydown` (the timing both existing bindings
 *   use), never on keyup, so a press cannot fire twice,
 * - `preventDefault()` so Space never scrolls the page or the sheet behind it,
 * - `stopPropagation()` so an ancestor control never also reacts to the key,
 * - ignores auto-repeat while the key is held down,
 * - never fires for a `disabled` control,
 * - only when the focused element IS the control this component owns, so a
 *   nested interactive child (a real `button`, a `link`, a preview tile) keeps
 *   its own native Space handling,
 * - web-only: native has no DOM key events and needs no binding,
 * - and it does not touch `Enter` (RN-Web already resolves it) or any pointer
 *   path, so neither a key nor a pointer click can double-fire.
 */

/** `key` values browsers report for the space bar (`Spacebar` is legacy). */
const SPACE_KEYS = new Set([' ', 'Spacebar']);

export type SpaceActivationInput = {
  /** `KeyboardEvent.key`. */
  key: string;
  /** `KeyboardEvent.repeat` — auto-repeat while the key is held down. */
  repeat: boolean;
  /** The control's own disabled state. */
  disabled: boolean;
  /** Whether the focused element is this component's own control. */
  onOwnControl: boolean;
};

/**
 * `activate` — Space on this component's own control: swallow the default
 * action and run the press. `swallow` — Space on the same control while it is
 * disabled or the key is auto-repeating: still stop the page scrolling, do not
 * activate. `ignore` — not our key, or not our control.
 */
export type SpaceActivationDecision = 'ignore' | 'swallow' | 'activate';

/** Pure decision table behind the hook (unit-tested in `tests/spaceActivation.test.ts`). */
export function spaceActivationDecision(input: SpaceActivationInput): SpaceActivationDecision {
  const { key, repeat, disabled, onOwnControl } = input;
  if (!SPACE_KEYS.has(key) || !onOwnControl) return 'ignore';
  if (disabled || repeat) return 'swallow';
  return 'activate';
}

/** The DOM surface the hook needs: enough to find and listen to one node. */
export type ControlNode = {
  getAttribute: (name: string) => string | null;
  closest: (selector: string) => ControlNode | null;
  addEventListener: (type: string, listener: (event: KeyboardEvent) => void) => void;
  removeEventListener: (type: string, listener: (event: KeyboardEvent) => void) => void;
};

/**
 * The control this component owns, from the node its ref landed on: that node
 * itself when it carries the role (a segmented option's own `Pressable`), or
 * the nearest role-bearing ancestor when the ref is attached to any node inside
 * the control (an option row's inner content wrapper — `Pressable3D` hands out
 * no ref, and pointing the ref at an existing child keeps every caller's
 * rendered tree byte-identical).
 */
export function resolveControlNode(node: ControlNode, role: string): ControlNode | null {
  if (node.getAttribute('role') === role) return node;
  return node.closest(`[role="${role}"]`);
}

export type SpaceActivationOptions = {
  /** The non-`button` role this component owns (`tab`, `radio`, …). */
  role: string;
  /** Runs the same callback the pointer press runs. */
  onActivate: () => void;
  disabled?: boolean;
};

/**
 * Returns the ref to attach inside the element carrying the component's `role`,
 * and binds the Space listener on that control. Off-web the ref is inert.
 *
 * The listener is re-bound after every render (the same shape `Switch` uses) so
 * a control node replaced by a re-render never leaves a stale listener behind.
 */
export function useSpaceActivation<T extends View = View>({
  role,
  onActivate,
  disabled = false,
}: SpaceActivationOptions) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    // SAFETY: this branch is web-only; RN Web forwards View refs to DOM nodes,
    // while RN's portable View ref type cannot express the HTMLElement instance.
    const node = ref.current as unknown as ControlNode | null;
    if (!node) return undefined;
    const control = resolveControlNode(node, role);
    if (!control) return undefined;
    const listener = (event: KeyboardEvent) => {
      const decision = spaceActivationDecision({
        key: event.key,
        repeat: event.repeat,
        disabled,
        onOwnControl: (event.target as unknown) === control,
      });
      if (decision === 'ignore') return;
      // Space would otherwise scroll the page (or the sheet behind the row).
      event.preventDefault();
      event.stopPropagation();
      if (decision === 'activate') onActivate();
    };
    control.addEventListener('keydown', listener);
    return () => control.removeEventListener('keydown', listener);
  });
  return ref;
}
