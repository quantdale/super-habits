import { Pressable, View } from 'react-native';
import { REWARD_HUES } from '@/constants/sectionColors';
import { useAppNavigation } from '@/core/providers/navigationContext';
import { useAppTheme } from '@/core/providers/themeContext';
import { Text } from '@/core/ui/Text';
import { FlameIcon, XpBoltIcon } from '@/core/ui/illustrations/icons';
import { radius, spacing } from '@/core/theme/designTokens';
import { useGamification } from './gamificationContext';

/**
 * P10 shell reward chips (docs/ui-ux/16-playful-momentum.md §6 "StreakChip /
 * XpChip", §7 Shell). Purely presentational: they read the existing
 * gamification snapshot (streak days, total XP) and open the existing
 * Achievements overlay — no new data, no new state.
 *
 * Placed in the Today header (phone) and the sidebar footer (desktop).
 */

export function ShellRewardChips() {
  const { snapshot } = useGamification();
  const { openAchievements } = useAppNavigation();
  const { resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';

  const streakDays = snapshot?.streak.current ?? 0;
  const totalXp = snapshot?.totalXp ?? 0;
  const streakText = isDark ? REWARD_HUES.streak.bright : REWARD_HUES.streak.text;
  const xpText = isDark ? REWARD_HUES.accent.bright : REWARD_HUES.accent.text;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Streak ${streakDays} days — open achievements`}
        onPress={openAchievements}
        hitSlop={{ top: 6, bottom: 6 }}
        style={{
          height: 32,
          borderRadius: radius.full,
          borderWidth: 2,
          borderColor: REWARD_HUES.streak.bright,
          paddingHorizontal: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <FlameIcon size={16} />
        <Text variant="label" style={{ fontSize: 13, lineHeight: 16, color: streakText }}>
          {streakDays}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`XP total ${totalXp} — open achievements`}
        onPress={openAchievements}
        hitSlop={{ top: 6, bottom: 6 }}
        style={{
          height: 32,
          borderRadius: radius.full,
          borderWidth: 2,
          borderColor: REWARD_HUES.accent.bright,
          paddingHorizontal: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <XpBoltIcon size={16} />
        <Text variant="label" style={{ fontSize: 13, lineHeight: 16, color: xpText }}>
          {totalXp}
        </Text>
      </Pressable>
    </View>
  );
}
