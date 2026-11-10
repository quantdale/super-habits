import { MaterialIcons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { REWARD_HUES } from '@/constants/sectionColors';
import { inkOnFill, WCAG_AA_TEXT } from '@/core/theme/contrast';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius, spacing, typography } from '@/core/theme/designTokens';
import { Text as AppText } from '@/core/ui/Text';
import { FlameIcon, FreezeShieldIcon } from '@/core/ui/illustrations/icons';
import { XpBar } from './XpBar';
import { XpRing } from './XpRing';
import { levelRingVisual } from './gamificationSurfaces.visual';
import type { LevelProgress, StreakFreezeState, StreakSummary } from './gamification.types';

export type LevelHeroProps = {
  level: LevelProgress;
  streak: StreakSummary;
  freezes: StreakFreezeState;
  /** `compact` is the dashboard-card scale; `full` is the achievements header. */
  size?: 'compact' | 'full';
};

/**
 * Reward pill: a tinted capsule carrying the reward icon and the count, with
 * the count painted in the appearance-resolved reward text tone (Flame
 * `#B34D00` on its light wash 4.75:1, Flame bright on its dark wash 5.56:1;
 * Ice 5.21:1 / 6.05:1). Icons are the P9 hero SVGs — no emoji in chrome.
 */
function RewardPill({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant: 'streak' | 'frozen';
}) {
  const { tokens, rewardAccents, resolvedTheme } = useAppTheme();
  const hue = REWARD_HUES[variant];
  const tint = resolvedTheme === 'dark' ? hue.tintDark : hue.tintLight;
  // The pill face is the reward tint wash, so its label ink must clear the text
  // floor against THAT wash, not against the card surface (Cyberpunk Neon's
  // textMuted is 3.91:1 on the Gold wash and 3.68:1 on the Ice wash).
  const labelInk = inkOnFill(tint, tokens.textMuted, tokens.text, WCAG_AA_TEXT);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.full,
        backgroundColor: tint,
        borderWidth: 2,
        borderColor: `${hue.bright}33`,
      }}
    >
      {variant === 'streak' ? (
        <FlameIcon size={14} bright={hue.bright} lip={hue.lip} />
      ) : (
        <FreezeShieldIcon size={14} bright={hue.bright} lip={hue.lip} />
      )}
      <Text style={{ ...typography.label, color: rewardAccents[variant].text }}>{value}</Text>
      <Text style={{ ...typography.caption, color: labelInk }}>{label}</Text>
    </View>
  );
}

/**
 * Level + streak hero (Refero: Brilliant level badge with a circular progress
 * ring, Duolingo streak card).
 *
 * P20 (`docs/ui-ux/16-playful-momentum.md` §7 "LevelHero / XpBar / XpRing
 * polish per tokens"): the Gold ring carries a Gold-lip depth band under its
 * arc, the XP bar is the chunky §6 bar with a lighter top highlight and a
 * Gold-lip edge, and the streak/freeze chips become reward-hue pills with the
 * P9 Flame and Ice-shield hero icons instead of plain surfaces.
 *
 * Contract kept: the level number + title, the exact XP line
 * (`n/m XP · k to level N`), the `Level N, <title>. …` accessible label, and
 * the `Level progress: n of m XP` progress-bar label.
 */
export function LevelHero({ level, streak, freezes, size = 'compact' }: LevelHeroProps) {
  const { tokens } = useAppTheme();
  const ring = levelRingVisual({
    surfaceSunken: tokens.surfaceSunken,
    surfaceActive: tokens.surfaceActive,
  });
  const ringSize = size === 'full' ? 108 : 84;
  const strokeWidth = size === 'full' ? 10 : 8;

  return (
    <View
      style={{
        flexDirection: size === 'full' ? 'column' : 'row',
        alignItems: 'center',
        gap: spacing.lg,
      }}
    >
      <XpRing
        size={ringSize}
        strokeWidth={strokeWidth}
        progress={level.ratio}
        color={ring.arcColor}
        trackColor={ring.trackColor}
      >
        <View className="items-center">
          <AppText variant={size === 'full' ? 'metric' : 'titleLg'} style={{ color: tokens.text }}>
            {level.level}
          </AppText>
          <Text style={{ ...typography.label, color: tokens.textMuted, letterSpacing: 0.8 }}>
            LEVEL
          </Text>
        </View>
      </XpRing>

      <View
        style={{
          flex: size === 'full' ? undefined : 1,
          gap: spacing.sm,
          alignItems: size === 'full' ? 'center' : 'flex-start',
        }}
      >
        <AppText variant={size === 'full' ? 'titleMd' : 'bodyLg'} style={{ color: tokens.text }}>
          {level.title}
        </AppText>
        <Text
          accessible
          accessibilityLabel={`Level ${level.level}, ${level.title}. ${level.xpIntoLevel} of ${level.xpForNextLevel} XP towards level ${level.level + 1}. ${level.xpToNextLevel} XP to go.`}
          style={{ ...typography.caption, color: tokens.textMuted }}
        >
          {level.xpIntoLevel}/{level.xpForNextLevel} XP · {level.xpToNextLevel} to level{' '}
          {level.level + 1}
        </Text>
        <View style={{ alignSelf: 'stretch', width: size === 'full' ? 240 : undefined }}>
          <XpBar
            progress={level.ratio}
            color={ring.arcColor}
            trackColor={ring.trackColor}
            accessibilityLabel={`Level progress: ${level.xpIntoLevel} of ${level.xpForNextLevel} XP`}
          />
        </View>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.sm,
            justifyContent: size === 'full' ? 'center' : 'flex-start',
          }}
        >
          <RewardPill label="reward streak" value={`${streak.current}`} variant="streak" />
          <RewardPill
            label={freezes.banked === 1 ? 'streak freeze' : 'streak freezes'}
            value={`${freezes.banked}`}
            variant="frozen"
          />
        </View>
        {streak.atRisk ? (
          <View className="flex-row items-center" style={{ gap: spacing.xs }}>
            <MaterialIcons name="info-outline" size={14} color={tokens.textMuted} />
            <Text style={{ ...typography.caption, color: tokens.textMuted }}>
              Today is still open — keep the streak alive.
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
