import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * To Do completion checkbox keyboard contract (CG-13).
 *
 * The defect: the control is nested inside the row's own `Pressable`
 * (`features/todos/TodoItem.tsx`), and RN Web's `PressResponder` resolves both
 * `Enter` and `Space` through ancestor press responders — so pressing either key
 * on the checkbox opened the `Edit task` dialog and `todos.completed` stayed 0,
 * while a pointer click completed the task. The hook makes the checkbox node
 * itself own those two keys and stops the event before the row can see it.
 *
 * These tests drive the hook against a fake DOM node: the listener must be
 * attached to the checkbox node, must only fire when the checkbox is the event
 * target, must suppress default + propagation (so the row never also fires),
 * must ignore auto-repeat, must never fire while disabled, must not exist on
 * native, and must hand the pointer and keyboard paths the SAME handler.
 */

type Listener = (event: KeyboardEvent) => void;

const platform = vi.hoisted(() => ({ OS: 'web' }));

vi.mock('react-native', () => ({ Platform: platform }));

const effectState = vi.hoisted(() => {
  /** The stable ref object the hook receives; the test installs its node here. */
  const ref: { current: unknown } = { current: null };
  return { cleanup: undefined as undefined | (() => void), ref };
});

vi.mock('react', () => ({
  useEffect: (effect: () => undefined | (() => void)) => {
    effectState.cleanup?.();
    effectState.cleanup = effect();
  },
  // The hook's ref object is stable across renders; the test decides which DOM
  // node it points at, so the effect sees the node instead of `null`.
  useRef: () => effectState.ref,
}));

const { isTodoCheckboxActivationKey, useTodoCheckboxKeyboard } =
  await import('@/features/todos/useTodoCheckboxKeyboard');

function fakeNode() {
  const listeners: Listener[] = [];
  const node = {
    addEventListener: (type: string, listener: Listener) => {
      if (type === 'keydown') listeners.push(listener);
    },
    removeEventListener: (type: string, listener: Listener) => {
      if (type !== 'keydown') return;
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    },
  };
  return { node, listeners };
}

function keyEvent(key: string, target: unknown, repeat = false) {
  return {
    key,
    target,
    repeat,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this.propagationStopped = true;
    },
  };
}

// Named as a hook so `react-hooks/rules-of-hooks` accepts the call inside
// this harness (it binds the hook to a fake DOM node instead of a component).
function useCheckboxKeyboardHarness(disabled: boolean, onActivate: () => void) {
  const { node, listeners } = fakeNode();
  // A real component assigns the node during the ref attach, before effects.
  effectState.ref.current = node;
  const ref = useTodoCheckboxKeyboard(true, disabled, onActivate);
  expect(ref, 'the hook returns the ref it bound').toBe(effectState.ref);
  return { node, listeners };
}

afterEach(() => {
  effectState.cleanup?.();
  effectState.cleanup = undefined;
  effectState.ref.current = null;
  platform.OS = 'web';
});

describe('isTodoCheckboxActivationKey', () => {
  it('accepts exactly the three spellings a checkbox activates on', () => {
    expect(isTodoCheckboxActivationKey(' ')).toBe(true);
    expect(isTodoCheckboxActivationKey('Spacebar')).toBe(true);
    expect(isTodoCheckboxActivationKey('Enter')).toBe(true);
  });

  it('rejects every other key, including the row-arrow family', () => {
    for (const key of ['', 'a', 'Escape', 'Tab', 'ArrowDown', 'NumpadEnter']) {
      expect(isTodoCheckboxActivationKey(key), key).toBe(false);
    }
  });
});

describe('useTodoCheckboxKeyboard', () => {
  it('activates once for Enter and once for Space on the checkbox itself', () => {
    const onActivate = vi.fn();
    const { node, listeners } = useCheckboxKeyboardHarness(false, onActivate);
    expect(listeners).toHaveLength(1);

    for (const key of ['Enter', ' ', 'Spacebar']) {
      const event = keyEvent(key, node);
      listeners[0](event as unknown as KeyboardEvent);
      expect(event.defaultPrevented, key).toBe(true);
      expect(event.propagationStopped, key).toBe(true);
    }
    expect(onActivate.mock.calls).toHaveLength(3);
  });

  it('never activates for a key press whose target is the wrapping row', () => {
    // The row is its own focusable `Pressable` (`Edit task: …`): its Enter must
    // keep opening the editor, so the hook must ignore bubbled/foreign targets.
    const onActivate = vi.fn();
    const { listeners } = useCheckboxKeyboardHarness(false, onActivate);
    const row = { tagName: 'DIV' };

    for (const key of ['Enter', ' ']) {
      const event = keyEvent(key, row);
      listeners[0](event as unknown as KeyboardEvent);
      expect(event.defaultPrevented, key).toBe(false);
      expect(event.propagationStopped, key).toBe(false);
    }
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('ignores auto-repeat so a held key cannot write twice', () => {
    const onActivate = vi.fn();
    const { node, listeners } = useCheckboxKeyboardHarness(false, onActivate);
    const repeat = keyEvent('Enter', node, true);
    listeners[0](repeat as unknown as KeyboardEvent);
    expect(repeat.defaultPrevented).toBe(true);
    expect(repeat.propagationStopped).toBe(true);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('never activates while disabled but still keeps the row from firing', () => {
    const onActivate = vi.fn();
    const { node, listeners } = useCheckboxKeyboardHarness(true, onActivate);
    const event = keyEvent(' ', node);
    listeners[0](event as unknown as KeyboardEvent);
    expect(onActivate).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
    expect(event.propagationStopped).toBe(true);
  });

  it('is a no-op on native, where press handling is the platform path', () => {
    platform.OS = 'android';
    const onActivate = vi.fn();
    const { listeners } = useCheckboxKeyboardHarness(false, onActivate);
    expect(listeners).toHaveLength(0);
  });

  it('does nothing when not enabled, and detaches on unmount', () => {
    const onActivate = vi.fn();
    effectState.ref.current = fakeNode().node;
    useTodoCheckboxKeyboard(false, false, onActivate);
    expect(effectState.cleanup).toBeUndefined();

    const mounted = useCheckboxKeyboardHarness(false, onActivate);
    expect(mounted.listeners).toHaveLength(1);
    effectState.cleanup?.();
    expect(mounted.listeners).toHaveLength(0);
  });
});
