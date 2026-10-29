import { View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { Pressable3D } from '@/core/ui/Pressable3D';
import { useCheckBurst } from '@/core/ui/motion/useCheckBurst';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius } from '@/core/theme/designTokens';

/** The node face (§6): 32px visible circle inside a 48pt hit area. */
const NODE_SIZE = 32;
const HIT_SLOP = (48 - NODE_SIZE) / 2;

/** Burst dot ring geometry (§5.8 "Check-in" row: 6-dot burst in section bright). */
const BURST_DOT_SIZE = 5;
const BURST_RADIUS = 22;

type CheckNodeProps = {
  checked: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  /** Section bright fill of the done node (§6); defaults to brand `primaryBright`. */
  accentColor?: string;
  /** Lip slab under the node — the section solid (§6); defaults to the brand lip. */
  lipColor?: string;
  /** Optional 0–1 ring progress around the node for quantitative habits (§6). */
  progress?: number;
  disabled?: boolean;
  testID?: string;
};

/**
 * CheckNode — the v2 check control (Playful Momentum §6): a 32px circle
 * (48pt hit) with a 2px border and a 2px lip riding `Pressable3D`. Done =
 * section bright fill, white ✓ glyph, lip = the section solid. Pressing plays
 * the check-in burst (`useCheckBurst`, §5.8 `light` row) with the dot geometry
 * living here and the motion state in the hook. Quantitative habits ring the
 * node with `progress`. Reduced motion: opacity cross-fade only — no scale,
 * no dots (`burstCount` is 0).
 *
 * Accessibility: a `checkbox` with `accessibilityState.checked` plus
 * `aria-checked` (this react-native-web version does not map
 * `accessibilityState` to the DOM).
 */
export function CheckNode({
  checked,
  onPress,
  accessibilityLabel,
  accentColor,
  lipColor,
  progress,
  disabled = false,
  testID,
}: CheckNodeProps) {
  const { tokens } = useAppTheme();
  const burst = useCheckBurst();
  const accent = accentColor ?? tokens.primaryBright;
  const lip = lipColor ?? tokens.buttonLip;

  // Dots start collapsed at the node centre (hidden behind the face) and
  // spread outward as `burstProgress` runs 0→1 while `burstStyle` fades them.
  const dotSpread = useAnimatedStyle(() => ({
    transform: [{ scale: Math.max(0.01, burst.burstProgress.value) }],
  }));

  const handlePress = () => {
    // The burst fires from the touched control (§4 "juice follows causality").
    burst.trigger();
    onPress();
  };

  const ringRadius = NODE_SIZE / 2 + 4;
  const ringCircumference = 2 * Math.PI * ringRadius;

  return (
    <View
      style={{
        width: NODE_SIZE + 16,
        height: NODE_SIZE + 16,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {progress != null && progress > 0 ? (
        <Svg
          width={(ringRadius + 3) * 2}
          height={(ringRadius + 3) * 2}
          style={{ position: 'absolute' }}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          <Circle
            cx={ringRadius + 3}
            cy={ringRadius + 3}
            r={ringRadius}
            stroke={tokens.surfaceSunken}
            strokeWidth={4}
            fill="none"
          />
          <Circle
            cx={ringRadius + 3}
            cy={ringRadius + 3}
            r={ringRadius}
            stroke={accent}
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={ringCircumference}
            strokeDashoffset={ringCircumference * (1 - Math.min(1, Math.max(0, progress)))}
            transform={`rotate(-90 ${ringRadius + 3} ${ringRadius + 3})`}
          />
        </Svg>
      ) : null}
      <Animated.View style={burst.nodeStyle}>
        {burst.burstCount > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              burst.burstStyle,
              dotSpread,
              {
                position: 'absolute',
                top: 8,
                left: 8,
                width: NODE_SIZE,
                height: NODE_SIZE,
              },
            ]}
          >
            {Array.from({ length: burst.burstCount }, (_, index) => {
              const angle = (index / burst.burstCount) * Math.PI * 2;
              return (
                <View
                  key={index}
                  style={{
                    position: 'absolute',
                    top: NODE_SIZE / 2 - BURST_DOT_SIZE / 2 + Math.sin(angle) * BURST_RADIUS,
                    left: NODE_SIZE / 2 - BURST_DOT_SIZE / 2 + Math.cos(angle) * BURST_RADIUS,
                    width: BURST_DOT_SIZE,
                    height: BURST_DOT_SIZE,
                    borderRadius: radius.full,
                    backgroundColor: accent,
                  }}
                />
              );
            })}
          </Animated.View>
        ) : null}
        <Pressable3D
          lip={2}
          faceColor={checked ? accent : tokens.surface}
          lipColor={checked ? lip : tokens.borderStrong}
          radius={radius.full}
          disabled={disabled}
          onPress={handlePress}
          testID={testID}
          hitSlop={{ top: HIT_SLOP, bottom: HIT_SLOP, left: HIT_SLOP, right: HIT_SLOP }}
          accessibilityRole="checkbox"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ checked, disabled }}
          aria-checked={checked}
          style={{ width: NODE_SIZE, height: NODE_SIZE }}
          faceStyle={{
            width: NODE_SIZE,
            height: NODE_SIZE - 2,
            borderWidth: 2,
            borderColor: checked ? accent : tokens.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          contentStyle={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {checked ? <MaterialIcons name="check" size={20} color="#FFFFFF" /> : null}
        </Pressable3D>
      </Animated.View>
    </View>
  );
}
