import type { ReactNode } from 'react';
import {
  Pressable,
  View,
  type AccessibilityRole,
  type AccessibilityState,
  type Insets,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { useAppTheme } from '@/core/providers/themeContext';
import { usePressDepth } from '@/core/ui/motion/usePressDepth';
import { useKeyboardFocusRing } from '@/core/ui/useKeyboardFocusRing';

/**
 * Pressable3D — the single depth primitive of the v2 pressable system
 * (Playful Momentum §5.7, §6). A solid slab: an outer `View` painted in the
 * lip color with the corner radius, and an `Animated` face sitting on a
 * `marginBottom: lip` band of that lip color. No gradients, no blur shadows.
 *
 * Press (§5.8 "Press" row, via `usePressDepth`): the face travels down by
 * exactly `lip` and covers the band — the lip collapses under the face while
 * the outer box keeps its height, so siblings never reflow. 80ms down /
 * 120ms up. Reduced motion: no translate at all; the pressed state is a
 * 120ms opacity cross-fade only.
 *
 * The web `:focus-visible` ring (P3 `useKeyboardFocusRing`, 2px `accent` at
 * offset 3) is applied to the interactive face; a pointer click shows no ring.
 *
 * Used by Button, IconButton and (P6+) OptionRow, PathNode and pressable Card.
 */
export type Pressable3DLip = 2 | 3 | 4;

export type Pressable3DProps = {
  /** Lip depth in px (§5.7): 2 (sm/chips), 3 (md/option rows), 4 (lg/nodes). */
  lip: Pressable3DLip;
  /** Flat solid fill of the face. */
  faceColor: string;
  /** The lip slab colour under the face (`tokens.buttonLip`, `borderStrong`…). */
  lipColor: string;
  /** Corner radius of the slab and face. */
  radius: number;
  disabled?: boolean;
  onPress: () => void;
  children?: ReactNode;
  /** Layout of the lip slab (outer box). */
  style?: StyleProp<ViewStyle>;
  /** Layout of the animated face (borders, min height, tinted fills). */
  faceStyle?: StyleProp<ViewStyle>;
  /** Layout of the interactive content row (padding, hit geometry). */
  contentStyle?: StyleProp<ViewStyle>;
  /** NativeWind classes for the interactive face (e.g. compact hit sizes). */
  className?: string;
  hitSlop?: Insets;
  testID?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
};

export function Pressable3D({
  lip,
  faceColor,
  lipColor,
  radius,
  disabled = false,
  onPress,
  children,
  style,
  faceStyle,
  contentStyle,
  className,
  hitSlop,
  testID,
  accessibilityRole,
  accessibilityLabel,
  accessibilityState,
}: Pressable3DProps) {
  const { tokens } = useAppTheme();
  const focusRing = useKeyboardFocusRing(tokens.accent);
  const { onPressIn, onPressOut, animatedStyle } = usePressDepth({ lip });

  return (
    <View style={[style, { backgroundColor: lipColor, borderRadius: radius }]}>
      <Animated.View
        style={[
          { marginBottom: lip, borderRadius: radius, backgroundColor: faceColor },
          animatedStyle,
          faceStyle,
        ]}
      >
        <Pressable
          disabled={disabled}
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          hitSlop={hitSlop}
          testID={testID}
          accessibilityRole={accessibilityRole}
          accessibilityLabel={accessibilityLabel}
          accessibilityState={accessibilityState}
          onFocus={focusRing.onFocus}
          onBlur={focusRing.onBlur}
          className={className}
          style={[{ borderRadius: radius }, contentStyle, focusRing.focusRingStyle]}
        >
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}
