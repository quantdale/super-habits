import { MaterialIcons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { spacing, typography } from '@/core/theme/designTokens';

import { ChestIcon } from '@/core/ui/illustrations/icons';
import { XpBar } from './XpBar';
import { questRowVisual } from './gamificationSurfaces.visual';
import type { DailyQuestState } from './gamification.types';

export type QuestRowProps = {
  quest: DailyQuestState;
  /**
   * Accepted for API stability with the existing call sites. The v2 card's
   * progress bar is always Gold (§7 "QuestRow = depth.card with a Gold
   * progress bar + chest"), so the value is unused.
   */
  accent?: string;
};

/**
 * One daily quest (Refero: Duolingo daily-quest card with an XP bar).
 *
 * P20 (`docs/ui-ux/16-playful-momentum.md` §7): "QuestRow = depth.card with a
 * Gold progress bar + chest". The row is a pressed-card slab (2px ring + 4px
 * bottom lip, §5.7 `depth.card`), leads with a state tile, carries the Gold
 * bar with a lighter top highlight, and ends with the reward chest — a Gold
 * object whose glyph ink is resolved against its own tile (Gold on the Gold
 * wash is 1.55:1, so light paints the bronze warp tone at 5.07:1).
 *
 * Everything asserted stays: the accessible label
 * ("<title>: <progress>. Reward <xp> XP."), the title, the `n/target`
 * fraction and the complete-state `+XP` swap.
 */
export function QuestRow({ quest }: QuestRowProps) {
  const { tokens, rewardAccents, resolvedTheme } = useAppTheme();
  const ratio = quest.target > 0 ? Math.min(1, quest.progress / quest.target) : 0;
  const progressLabel = quest.complete
    ? `Complete, ${quest.target} of ${quest.target} ${quest.unit}`
    : `${Math.min(quest.progress, quest.target)} of ${quest.target} ${quest.unit}`;
  const visual = questRowVisual({
    complete: quest.complete,
    appearance: resolvedTheme,
    tokens: {
      surface: tokens.surface,
      surfaceSunken: tokens.surfaceSunken,
      text: tokens.text,
      textMuted: tokens.textMuted,
      border: tokens.border,
      borderStrong: tokens.borderStrong,
    },
  });

  return (
    <View
      accessible
      accessibilityLabel={`${quest.title}: ${progressLabel}. Reward ${quest.xpReward} XP.`}
      style={{
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: 16,
        backgroundColor: tokens.surface,
        borderWidth: 2,
        borderColor: visual.cardBorder,
        borderBottomWidth: 4,
        borderBottomColor: visual.cardLip,
      }}
    >
      <View className="flex-row items-center" style={{ gap: spacing.sm }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 9999,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: visual.iconTile,
          }}
        >
          <MaterialIcons
            name={quest.complete ? 'check' : (quest.icon as keyof typeof MaterialIcons.glyphMap)}
            size={18}
            color={visual.iconInk}
          />
        </View>
        <View className="min-w-0 flex-1">
          <Text style={{ ...typography.bodyMd, color: tokens.text }} numberOfLines={1}>
            {quest.title}
          </Text>
        </View>
        <Text
          style={{
            ...typography.label,
            color: quest.complete ? rewardAccents.badge.text : tokens.textMuted,
          }}
        >
          {quest.complete ? `+${quest.xpReward} XP` : `${quest.progress}/${quest.target}`}
        </Text>
        {/* Reward chest: Gold in both states, glyph resolved on its own tile. */}
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: visual.chestTile,
          }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <ChestIcon size={18} bright={visual.chestInk} lip={visual.chestInk} />
        </View>
      </View>
      <XpBar
        progress={ratio}
        color={visual.barColor}
        trackColor={tokens.surfaceSunken}
        height={8}
        accessibilityLabel={progressLabel}
      />
    </View>
  );
}
