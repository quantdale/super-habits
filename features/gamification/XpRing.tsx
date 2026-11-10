import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { REWARD_HUES } from '@/constants/sectionColors';
import { useReducedMotion } from '@/core/theme/motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type XpRingProps = {
  size: number;
  strokeWidth: number;
  /** 0..1 progress towards the next level. */
  progress: number;
  color: string;
  trackColor: string;
  /** Duration of the fill animation in ms; 0 (reduced motion) jumps to the value. */
  durationMs?: number;
  children?: React.ReactNode;
};

/**
 * Animated SVG progress ring (docs/ui-ux/16-playful-momentum.md §6
 * ProgressRing, §7 "LevelHero / XpRing polish per tokens"). The Gold arc sits
 * on a Gold-lip depth ring two pixels wider, so the ring reads as a solid slab
 * with an edge instead of a hairline stroke. The offset animates from the
 * previous value to the new one, so a level-up reads as growth; reduced motion
 * collapses the duration to 0 and the ring simply shows the final value.
 */
export function XpRing({
  size,
  strokeWidth,
  progress,
  color,
  trackColor,
  durationMs = 600,
  children,
}: XpRingProps) {
  const reducedMotion = useReducedMotion();
  const radius = size / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));
  const offset = circumference * (1 - clamped);
  const [animatedOffset] = useState(() => new Animated.Value(offset));
  // Animation is reserved for a *change*: sweeping from empty at mount costs JS
  // frames on every cold start and reads as noise rather than progress.
  const lastOffset = useRef(offset);

  useEffect(() => {
    if (lastOffset.current === offset) {
      animatedOffset.setValue(offset);
      return;
    }
    lastOffset.current = offset;
    if (reducedMotion || durationMs <= 0) {
      animatedOffset.setValue(offset);
      return;
    }
    const animation = Animated.timing(animatedOffset, {
      toValue: offset,
      duration: durationMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [animatedOffset, durationMs, offset, reducedMotion]);

  // The lip band is the reward hue's darker tier painted directly under the arc
  // (2px wider, same dash geometry) so the filled segment owns a visible edge
  // while the empty track stays flat.
  const lipWidth = strokeWidth + 2;
  const lipRadius = size / 2 - lipWidth / 2;
  const lipCircumference = 2 * Math.PI * lipRadius;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}
      >
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={lipRadius}
          fill="none"
          stroke={REWARD_HUES.accent.lip}
          strokeWidth={lipWidth}
          strokeLinecap="round"
          strokeDasharray={`${lipCircumference} ${lipCircumference}`}
          strokeDashoffset={animatedOffset.interpolate({
            inputRange: [0, circumference],
            outputRange: [0, lipCircumference],
            extrapolate: 'clamp',
          })}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={animatedOffset}
        />
      </Svg>
      {children}
    </View>
  );
}
