import { MaterialIcons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius, spacing, typography } from '@/core/theme/designTokens';
import { XpBar } from './XpBar';
import type { DailyQuestState } from './gamification.types';

export type QuestRowProps = {
  quest: DailyQuestState;
  accent: string;
};

/**
 * One daily quest (Refero: Duolingo daily-quest card with an XP bar).
 * Progress is always shown as a fraction; completion swaps the fraction for a
 * check so a finished quest reads instantly.
 */
export function QuestRow({ quest, accent }: QuestRowProps) {
  const { tokens } = useAppTheme();
  const ratio = quest.target > 0 ? Math.min(1, quest.progress / quest.target) : 0;
  const progressLabel = quest.complete
    ? `Complete, ${quest.target} of ${quest.target} ${quest.unit}`
    : `${Math.min(quest.progress, quest.target)} of ${quest.target} ${quest.unit}`;

  return (
    <View
      accessible
      accessibilityLabel={`${quest.title}: ${progressLabel}. Reward ${quest.xpReward} XP.`}
      style={{ gap: spacing.xs }}
    >
      <View className="flex-row items-center" style={{ gap: spacing.sm }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: quest.complete ? `${accent}22` : tokens.surfaceElevated,
          }}
        >
          <MaterialIcons
            name={quest.complete ? 'check' : (quest.icon as keyof typeof MaterialIcons.glyphMap)}
            size={18}
            color={quest.complete ? accent : tokens.iconMuted}
          />
        </View>
        <View className="flex-1">
          <Text style={{ ...typography.bodyMd, color: tokens.text }} numberOfLines={1}>
            {quest.title}
          </Text>
        </View>
        <Text
          style={{
            ...typography.caption,
            color: quest.complete ? accent : tokens.textMuted,
          }}
        >
          {quest.complete ? `+${quest.xpReward} XP` : `${quest.progress}/${quest.target}`}
        </Text>
      </View>
      <XpBar
        progress={ratio}
        color={accent}
        trackColor={tokens.surfaceActive}
        height={6}
        accessibilityLabel={progressLabel}
      />
    </View>
  );
}
