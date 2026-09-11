import { MaterialIcons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { REWARD_COLORS } from '@/constants/sectionColors';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius, spacing, typography } from '@/core/theme/designTokens';
import { XpBar } from './XpBar';
import { XpRing } from './XpRing';
import type { LevelProgress, StreakFreezeState, StreakSummary } from './gamification.types';

export type LevelHeroProps = {
  level: LevelProgress;
  streak: StreakSummary;
  freezes: StreakFreezeState;
  /** `compact` is the dashboard-card scale; `full` is the achievements header. */
  size?: 'compact' | 'full';
};

function StreakChip({ label, value, color }: { label: string; value: string; color: string }) {
  const { tokens } = useAppTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.full,
        backgroundColor: tokens.surfaceElevated,
      }}
    >
      <Text style={{ ...typography.label, color }}>{value}</Text>
      <Text style={{ ...typography.caption, color: tokens.textMuted }}>{label}</Text>
    </View>
  );
}

/**
 * Level + streak hero (Refero: Brilliant level badge with a circular progress
 * ring, Duolingo streak card). The ring shows progress through the *current*
 * level, which is the only number that ever motivates a next action.
 */
export function LevelHero({ level, streak, freezes, size = 'compact' }: LevelHeroProps) {
  const { tokens } = useAppTheme();
  const ringSize = size === 'full' ? 108 : 84;
  const strokeWidth = size === 'full' ? 10 : 8;

  return (
    <View
      style={{
        flexDirection: size === 'full' ? 'column' : 'row',
        alignItems: size === 'full' ? 'center' : 'center',
        gap: spacing.lg,
      }}
    >
      <XpRing
        size={ringSize}
        strokeWidth={strokeWidth}
        progress={level.ratio}
        color={REWARD_COLORS.accent}
        trackColor={tokens.surfaceActive}
      >
        <View className="items-center">
          <Text style={{ ...typography.titleLg, color: tokens.text }}>{level.level}</Text>
          <Text style={{ ...typography.caption, color: tokens.textMuted }}>LEVEL</Text>
        </View>
      </XpRing>

      <View
        style={{
          flex: size === 'full' ? undefined : 1,
          gap: spacing.sm,
          alignItems: size === 'full' ? 'center' : 'flex-start',
        }}
      >
        <Text
          style={{
            ...(size === 'full' ? typography.titleMd : typography.bodyLg),
            color: tokens.text,
          }}
        >
          {level.title}
        </Text>
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
            color={REWARD_COLORS.accent}
            trackColor={tokens.surfaceActive}
            accessibilityLabel={`Level progress: ${level.xpIntoLevel} of ${level.xpForNextLevel} XP`}
          />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <StreakChip label="day streak" value={`${streak.current}`} color={REWARD_COLORS.streak} />
          <StreakChip
            label={freezes.banked === 1 ? 'streak freeze' : 'streak freezes'}
            value={`${freezes.banked}`}
            color={REWARD_COLORS.frozen}
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
