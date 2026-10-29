import { useEffect, useMemo, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import {
  REWARD_COLORS,
  REWARD_HUES,
  REWARD_TEXT_COLORS,
  SECTION_ON_BRIGHT_INK,
  type RewardKey,
} from '@/constants/sectionColors';
import { useAppTheme } from '@/core/providers/themeContext';
import { layers, radius, spacing, typography } from '@/core/theme/designTokens';
import { useReducedMotion } from '@/core/theme/motion';
import { Button } from '@/core/ui/Button';
import { useGamification } from './gamificationContext';
import type { CelebrationTier } from './gamification.types';

/**
 * Reward celebration (Refero: Brilliant "You leveled up!", Duolingo "You earned
 * Legendary").
 *
 * Deliberately NOT a modal and NOT centred: it is a top-anchored banner that
 * floats above the app with `pointerEvents: box-none`, so every control the
 * user was reaching for stays clickable and a suspended auto-dismiss timer can
 * never trap them behind an overlay. Rules from the design DNA it keeps — the
 * user never waits for animation before continuing, and a celebration stays
 * dismissible.
 *
 * Only rare moments reach it; the provider decides (a plain check-off never
 * shows this).
 */

const CONFETTI_COUNT = 24;
/** Long enough to read one line, short enough to stay out of the way. The duration contract is pinned behaviorally in `tests/rewardCelebrationOverlay.test.ts` (spy on the scheduled auto-dismiss). */
const AUTO_DISMISS_MS = 2800;

type TierVisual = {
  color: string;
  /** Solid lip under the reward-hue bright face (§5.7 depth, no blur shadow). */
  lipColor: string;
  /** Readable text tone for the tier on light appearance (§5.1 text column). */
  textColor: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  surface: 'accent' | 'surface';
};

function tierVisual(
  tier: CelebrationTier,
  tokens: ReturnType<typeof useAppTheme>['tokens'],
  appearance: 'light' | 'dark',
): TierVisual {
  // The bright hue stays the shape/wash color; text on the near-white chip
  // needs the appearance-aware text tone (Gold ink, Flame/Ice solids, …).
  const reward = (key: RewardKey, fill: string) => ({
    color: fill,
    lipColor: REWARD_HUES[key].lip,
    textColor: appearance === 'light' ? REWARD_TEXT_COLORS[key] : fill,
  });
  switch (tier) {
    case 'level':
      return {
        ...reward('accent', REWARD_COLORS.accent),
        icon: 'military-tech',
        surface: 'accent',
      };
    case 'badge':
      return { ...reward('badge', REWARD_COLORS.badge), icon: 'emoji-events', surface: 'accent' };
    case 'day':
      return { ...reward('day', REWARD_COLORS.day), icon: 'task-alt', surface: 'accent' };
    case 'streak':
      return {
        ...reward('streak', REWARD_COLORS.streak),
        icon: 'local-fire-department',
        surface: 'accent',
      };
    case 'quest':
      return { ...reward('quest', REWARD_COLORS.quest), icon: 'check-circle', surface: 'accent' };
    case 'small':
      return {
        color: tokens.accent,
        lipColor: tokens.borderStrong,
        textColor: tokens.accent,
        icon: 'bolt',
        surface: 'surface',
      };
  }
}

/** Deterministic pseudo-random so particles do not jump between renders. */
function pseudoRandom(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function Confetti({ colors, active }: { colors: readonly string[]; active: boolean }) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!active) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 1600,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [active, progress]);

  const particles = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, index) => {
        const seed = index + 1;
        return {
          id: `confetti-${index}`,
          left: pseudoRandom(seed) * 100,
          delay: Math.round(pseudoRandom(seed * 2.3) * 320),
          drift: (pseudoRandom(seed * 3.7) - 0.5) * 90,
          rotate: Math.round(pseudoRandom(seed * 4.1) * 540 - 270),
          size: 6 + Math.round(pseudoRandom(seed * 5.9) * 6),
          color: colors[index % colors.length],
        };
      }),
    [colors],
  );

  if (!active) return null;

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}
      aria-hidden
    >
      {particles.map((particle) => {
        const start = particle.delay / 1600;
        return (
          <Animated.View
            key={particle.id}
            style={{
              position: 'absolute',
              top: -24,
              left: `${particle.left}%`,
              width: particle.size,
              height: particle.size * 1.6,
              borderRadius: particle.size / 3,
              backgroundColor: particle.color,
              opacity: progress.interpolate({
                inputRange: [0, start, Math.min(0.95, start + 0.5), 1],
                outputRange: [0, 1, 1, 0],
                extrapolate: 'clamp',
              }),
              transform: [
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-24, 520],
                  }),
                },
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, particle.drift],
                  }),
                },
                {
                  rotate: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', `${particle.rotate}deg`],
                  }),
                },
              ],
            }}
          />
        );
      })}
    </View>
  );
}

/**
 * Renders whenever the provider has a queued celebration. Mounted once at the
 * app root so any section's action can trigger it.
 */
export function RewardCelebrationOverlay() {
  const { tokens, resolvedTheme } = useAppTheme();
  const reducedMotion = useReducedMotion();
  const { celebration, dismissCelebration } = useGamification();
  const visible = celebration !== null;
  // Restart the auto-dismiss timer only for a genuinely new celebration.
  const celebrationKey = celebration ? `${celebration.title}:${celebration.xp}` : '';

  useEffect(() => {
    if (!visible) return;
    const timeout = setTimeout(dismissCelebration, AUTO_DISMISS_MS);
    return () => clearTimeout(timeout);
  }, [celebrationKey, dismissCelebration, visible]);

  if (!celebration) return null;

  const visual = tierVisual(celebration.tier, tokens, resolvedTheme);
  const confettiColors = [visual.color, REWARD_COLORS.accent, tokens.accent, REWARD_COLORS.badge];
  // Milestone tiers paint the reward hue's bright face; ink on bright is the
  // only label contrast that passes §5.1 on every hue (SECTION_ON_BRIGHT_INK).
  const brightFace = visual.surface === 'accent';
  const faceColor = brightFace ? visual.color : tokens.surface;
  const ink = brightFace ? SECTION_ON_BRIGHT_INK : tokens.text;
  const inkMuted = brightFace ? SECTION_ON_BRIGHT_INK : tokens.textMuted;

  return (
    <View
      pointerEvents="box-none"
      style={{
        ...StyleSheet.absoluteFillObject,
        zIndex: layers.toast,
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: spacing.xxxl,
        paddingHorizontal: spacing.lg,
      }}
    >
      <Confetti colors={confettiColors} active={!reducedMotion} />
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={`${celebration.title}. ${celebration.message}`}
        style={{
          width: '100%',
          maxWidth: Platform.OS === 'web' ? 420 : undefined,
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.xl,
          paddingHorizontal: spacing.xl,
          borderRadius: radius.xl,
          backgroundColor: faceColor,
          // §5.7 celebration card: 2px ring + solid lip edge, never a blur halo.
          borderWidth: 2,
          borderColor: brightFace ? visual.lipColor : tokens.border,
          borderBottomWidth: 4,
          borderBottomColor: visual.lipColor,
          shadowColor: tokens.shadowColor,
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.18,
          shadowRadius: 32,
          elevation: 4,
        }}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tokens.surface,
            borderWidth: 2,
            borderColor: visual.color,
          }}
        >
          <MaterialIcons name={visual.icon} size={36} color={visual.color} />
        </View>
        <Text style={{ ...typography.titleLg, color: ink, textAlign: 'center' }}>
          {celebration.title}
        </Text>
        <Text style={{ ...typography.bodyMd, color: inkMuted, textAlign: 'center' }}>
          {celebration.message}
        </Text>
        {celebration.xp > 0 ? (
          <Text style={{ ...typography.display, color: ink, textAlign: 'center' }}>
            +{celebration.xp} XP
          </Text>
        ) : null}
        <Button
          label="Continue"
          variant="celebrate"
          onPress={dismissCelebration}
          className="mt-2"
        />
      </View>
    </View>
  );
}
