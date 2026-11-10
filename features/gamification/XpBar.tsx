import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { REWARD_HUES } from '@/constants/sectionColors';
import { radius } from '@/core/theme/designTokens';
import { useReducedMotion } from '@/core/theme/motion';

export type XpBarProps = {
  /** 0..1 fill. */
  progress: number;
  color: string;
  trackColor: string;
  height?: number;
  durationMs?: number;
  accessibilityLabel?: string;
};

/**
 * Reward progress bar (docs/ui-ux/16-playful-momentum.md §6 ProgressBar,
 * §7 "QuestRow = depth.card with a Gold progress bar").
 *
 * Same contract as before (width Animated from the previous value, reduced
 * motion snaps, `progressbar` role + accessibilityValue, no animation on first
 * mount) with the v2 object treatment: a rounded fill whose lip-colored depth
 * peeks out 2px below, and the §6 4px lighter top highlight so the bar reads as
 * a solid Gold slab rather than a tinted rectangle.
 */
export function XpBar({
  progress,
  color,
  trackColor,
  height = 10,
  durationMs = 550,
  accessibilityLabel,
}: XpBarProps) {
  const reducedMotion = useReducedMotion();
  const clamped = Math.min(1, Math.max(0, progress));
  // A lazily-created animated value: state keeps it stable for the component's
  // lifetime without reading a ref during render.
  const [animated] = useState(() => new Animated.Value(clamped));
  // Animation is reserved for a *change*: sweeping from zero at mount costs JS
  // frames on every cold start and reads as noise rather than progress.
  const lastTarget = useRef(clamped);

  useEffect(() => {
    if (lastTarget.current === clamped) {
      animated.setValue(clamped);
      return;
    }
    lastTarget.current = clamped;
    if (reducedMotion || durationMs <= 0) {
      animated.setValue(clamped);
      return;
    }
    const animation = Animated.timing(animated, {
      toValue: clamped,
      duration: durationMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [animated, clamped, durationMs, reducedMotion]);

  // §5.7 depth: the lip is the reward hue's darker tier, so the bar keeps its
  // 3D edge in both appearances (the bright Gold face never carries text).
  const lipColor = REWARD_HUES.accent.lip;
  const lip = Math.min(3, Math.max(2, Math.round(height / 4)));

  return (
    <View
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{ paddingBottom: lip }}
    >
      <View
        style={{
          height,
          borderRadius: height / 2,
          backgroundColor: trackColor,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={{
            height: '100%',
            borderRadius: height / 2,
            backgroundColor: color,
            width: animated.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }}
        >
          {/* §6 static lighter top highlight — the "chunky object" read. */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: Math.max(2, Math.round(height / 3)),
              backgroundColor: 'rgba(255,255,255,0.35)',
            }}
          />
        </Animated.View>
      </View>
      {/* The lip sits under the track and only shows beneath the filled part,
          so the bar never reads as a full-width slab. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: lip,
          borderRadius: radius.full,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={{
            height: '100%',
            backgroundColor: lipColor,
            width: animated.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }}
        />
      </View>
    </View>
  );
}
