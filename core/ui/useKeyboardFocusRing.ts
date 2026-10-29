import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, type ViewStyle } from 'react-native';

export type KeyboardFocusRing = {
  /** Spread onto the Pressable that should show the focus ring. */
  onFocus: () => void;
  onBlur: () => void;
  /**
   * Merge into the component's style array: a solid 2px outline in `ringColor`
   * while keyboard-focused on web; null otherwise.
   */
  focusRingStyle: ViewStyle | null;
};

/**
 * Shared keyboard-focus indication for core/ui primitives (Design DNA §15:
 * on keyboard-capable platforms focus indication must be high-contrast and
 * obvious; v2 §5.7/§10-P3: **a pointer click shows no ring**).
 *
 * RN has no `:focus-visible`, so the modality question is delegated to the
 * platform's own implementation on web: when a focus event lands, the hook asks
 * `document.activeElement.matches(':focus-visible')`. Chromium answers with the
 * real heuristic (keyboard/script focus gets a ring, mouse or touch focus does
 * not), so a tab-rail click stops painting the blue ring that RN-Web's plain
 * `onFocus` used to paint after every tap.
 *
 * Two supporting pieces:
 * - a document-level pointerdown listener re-evaluates the *already focused*
 *   control, because pressing an already-focused element does not emit a new
 *   focus event but does change `:focus-visible`; likewise the first keydown
 *   after pointer input re-evaluates it, because a user who clicks a control and
 *   then switches to the keyboard without moving focus flips `:focus-visible`
 *   to true without any new focus event;
 * - the ring is drawn *outside* the control (`outlineOffset: 3`, §5.7) so focus
 *   indication never changes the box the control occupies — geometry, touch
 *   targets and goldens stay put.
 *
 * Where `:focus-visible` is unavailable (native, or a DOM without the selector)
 * the hook degrades to "ring while focused", which is the pre-P3 behaviour and
 * never hides focus from a keyboard user.
 */
const RING_WIDTH = 2;
/** §5.7: 3px of air between the control's edge and the ring. */
const RING_OFFSET = 3;

/**
 * Real `:focus-visible` for the currently focused element. Returns true when the
 * platform cannot answer (native, older engines) so focus is never invisible.
 */
function isFocusVisible(): boolean {
  if (typeof document === 'undefined') return true;
  const active: (Element & { matches?: (s: string) => boolean }) | null = document.activeElement;
  if (!active || typeof active.matches !== 'function') return true;
  try {
    return active.matches(':focus-visible');
  } catch {
    return true;
  }
}

/**
 * One document listener pair serves every hook instance (a screen can have
 * dozens) and simply tells them to re-read `:focus-visible`.
 */
let listenersInstalled = false;
const subscribers = new Set<() => void>();

function notify(): void {
  for (const subscriber of subscribers) subscriber();
}

/**
 * True after pointer input until a keydown has re-read `:focus-visible`, so
 * ordinary typing (already keyboard modality) does not fan out to every hook.
 */
let pointerModality = false;

function handlePointerDown(): void {
  pointerModality = true;
  // Deferred so the platform has finished updating :focus-visible for the
  // pointer press before the ring re-reads it.
  queueMicrotask(notify);
}

function handleKeyDown(): void {
  if (!pointerModality) return;
  // Deferred like pointerdown: the platform flips :focus-visible on the
  // keyboard interaction itself, then the focused control re-reads it.
  queueMicrotask(() => {
    if (isFocusVisible()) pointerModality = false;
    notify();
  });
}

function installListeners(): void {
  if (listenersInstalled || typeof document === 'undefined') return;
  listenersInstalled = true;
  document.addEventListener('mousedown', handlePointerDown, true);
  document.addEventListener('touchstart', handlePointerDown, true);
  document.addEventListener('keydown', handleKeyDown, true);
}

export function useKeyboardFocusRing(ringColor: string): KeyboardFocusRing {
  const isWeb = Platform.OS === 'web';
  // `ringVisible` is only meaningful while focused: it is the `:focus-visible`
  // answer captured at focus time (and refreshed on pointer input and on the
  // first keydown after pointer input).
  const [focused, setFocused] = useState(false);
  const [ringVisible, setRingVisible] = useState(true);

  const refresh = useCallback(() => {
    setRingVisible(isFocusVisible());
  }, []);

  useEffect(() => {
    if (!isWeb) return;
    installListeners();
    subscribers.add(refresh);
    return () => {
      subscribers.delete(refresh);
    };
  }, [isWeb, refresh]);

  const onFocus = useCallback(() => {
    if (!isWeb) return;
    setFocused(true);
    setRingVisible(isFocusVisible());
  }, [isWeb]);

  const onBlur = useCallback(() => {
    if (isWeb) setFocused(false);
  }, [isWeb]);

  const focusRingStyle = useMemo<ViewStyle | null>(() => {
    if (!isWeb || !focused || !ringVisible) return null;
    return {
      outlineColor: ringColor,
      outlineStyle: 'solid',
      outlineWidth: RING_WIDTH,
      outlineOffset: RING_OFFSET,
    };
  }, [isWeb, focused, ringVisible, ringColor]);

  return { onFocus, onBlur, focusRingStyle };
}
