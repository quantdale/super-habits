import { REWARD_COLORS } from '@/constants/sectionColors';
import { MaterialIcons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius, spacing, typography } from '@/core/theme/designTokens';
import { useGamification } from '@/features/gamification/gamificationContext';
import { LevelHero } from '@/features/gamification/LevelHero';
import { QuestRow } from '@/features/gamification/QuestRow';
import { WeekStrip } from '@/features/gamification/WeekStrip';
import { CardEmptyMessage, DashboardCard } from './DashboardCard';
import { OVERVIEW_CARD_META } from '../overviewCards';

/**
 * Today's reward surface: level + streak hero, the weekly activity strip, and
 * the three rotating daily quests (Refero: Duolingo daily-quest card, Brilliant
 * streak card). Tapping the card opens the full achievements overlay.
 */
export function GamificationCard() {
  const { tokens } = useAppTheme();
  const { snapshot, isLoading } = useGamification();

  const hasProgress =
    snapshot !== null &&
    (snapshot.totalXp > 0 || snapshot.quests.length > 0 || snapshot.streak.current > 0);

  return (
    <DashboardCard
      meta={OVERVIEW_CARD_META.progress}
      loading={isLoading && !snapshot}
      empty={
        hasProgress ? undefined : (
          <CardEmptyMessage
            title="No rewards yet"
            description="Check off a habit, finish a focus session, or log a workout to start earning XP."
          />
        )
      }
    >
      {snapshot ? (
        <View style={{ gap: spacing.lg }}>
          <LevelHero level={snapshot.level} streak={snapshot.streak} freezes={snapshot.freezes} />

          {snapshot.dayComplete ? (
            <View
              accessible
              accessibilityLabel="Every habit is done today. Complete day."
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                borderRadius: radius.full,
                backgroundColor: `${REWARD_COLORS.day}1F`,
              }}
            >
              <MaterialIcons name="task-alt" size={18} color={REWARD_COLORS.day} />
              <Text style={{ ...typography.label, color: tokens.text }}>
                Complete day — every habit is done
              </Text>
            </View>
          ) : null}

          <WeekStrip
            week={snapshot.week}
            todayKey={snapshot.todayKey}
            accent={REWARD_COLORS.accent}
          />

          <View style={{ gap: spacing.md }}>
            <Text style={{ ...typography.label, color: tokens.textMuted }}>
              TODAY&apos;S QUESTS
            </Text>
            {snapshot.quests.map((quest) => (
              <QuestRow key={quest.id} quest={quest} accent={REWARD_COLORS.quest} />
            ))}
          </View>
        </View>
      ) : null}
    </DashboardCard>
  );
}
