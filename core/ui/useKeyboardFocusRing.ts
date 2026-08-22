import { useCallback, useState } from 'react';
import { Platform, type ViewStyle } from 'react-native';

export type KeyboardFocusRing = {
  /** Spread onto the Pressable that should show the focus ring. */
  onFocus: () => void;
  onBlur: () => void;
  /**
   * Merge into the component's style array: a solid 2px outline in
   * `ringColor` while focused on web; null otherwise.
   */
  focusRingStyle: ViewStyle | null;
};

/**
 * Shared keyboard-focus indication for core/ui primitives (Design DNA §15:
 * on keyboard-capable platforms focus indication must be high-contrast and
 * obvious). Mirrors the app tab-rail pattern in `app/index.tsx`: focus is
 * tracked via onFocus/onBlur (functional on web) and drawn as a solid 2px
 * outline. On native the style stays null so pressed/disabled states are
 * untouched — focus rings are a web/keyboard concern only.
 */
export function useKeyboardFocusRing(ringColor: string): KeyboardFocusRing {
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const isWeb = Platform.OS === 'web';

  return {
    onFocus: useCallback(() => {
      if (isWeb) setKeyboardFocused(true);
    }, [isWeb]),
    onBlur: useCallback(() => {
      if (isWeb) setKeyboardFocused(false);
    }, [isWeb]),
    focusRingStyle:
      isWeb && keyboardFocused
        ? { outlineColor: ringColor, outlineStyle: 'solid', outlineWidth: 2 }
        : null,
  };
}
