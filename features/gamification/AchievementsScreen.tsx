import { MaterialIcons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { REWARD_COLORS } from '@/constants/sectionColors';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius, spacing, typography } from '@/core/theme/designTokens';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { SkeletonBlock } from '@/core/ui/SkeletonBlock';
import { StatBlock } from '@/core/ui/StatBlock';
import { BadgeGrid } from './BadgeGrid';
import { LevelHero } from './LevelHero';
import { QuestRow } from './QuestRow';
import { WeekStrip } from './WeekStrip';
import { useGamification } from './gamificationContext';

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  const { tokens } = useAppTheme();
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={{ ...typography.titleMd, color: tokens.text }}>{title}</Text>
      {hint ? (
        <Text style={{ ...typography.caption, color: tokens.textMuted, marginTop: spacing.xs }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Full reward surface behind the Today dashboard card (Refero: Duolingo
 * Quests/Badges tabs, Brilliant progress screen, Planny awards grid).
 *
 * It reads the shared gamification snapshot only — no queries of its own — so
 * it can never disagree with the card the user just tapped.
 */
export function AchievementsScreen() {
  const { tokens } = useAppTheme();
  const { snapshot, isLoading } = useGamification();

  if (isLoading && !snapshot) {
    return (
      <View style={{ gap: spacing.lg }}>
        <SkeletonBlock height={108} radius={radius.xl} />
        <SkeletonBlock height={72} radius={radius.lg} />
        <SkeletonBlock height={160} radius={radius.lg} />
      </View>
    );
  }

  if (!snapshot) {
    return (
      <EmptyStateCard
        accentColor={REWARD_COLORS.accent}
        title="Progress is unavailable"
        description="The reward ledger could not be read on this device yet. Pull to refresh or reopen this screen."
        icon={<MaterialIcons name="insights" size={32} color={REWARD_COLORS.accent} />}
      />
    );
  }

  const earnedBadges = snapshot.badges.filter((badge) => badge.unlocked).length;

  return (
    <View>
      <ScreenSection>
        <LevelHero
          level={snapshot.level}
          streak={snapshot.streak}
          freezes={snapshot.freezes}
          size="full"
        />
      </ScreenSection>

      <ScreenSection>
        <View className="flex-row" style={{ gap: spacing.md }}>
          <StatBlock
            accentColor={REWARD_COLORS.accent}
            value={snapshot.totalXp}
            label="Total XP"
            detail={`${snapshot.xpToday} today`}
            className="flex-1"
          />
          <StatBlock
            accentColor={REWARD_COLORS.streak}
            value={snapshot.streak.longest}
            label="Best streak"
            detail={`${snapshot.streak.current} current`}
            className="flex-1"
          />
          <StatBlock
            accentColor={REWARD_COLORS.badge}
            value={`${earnedBadges}/${snapshot.badges.length}`}
            label="Badges"
            className="flex-1"
          />
        </View>
      </ScreenSection>

      <ScreenSection>
        <SectionHeading
          title="This week"
          hint={
            snapshot.dayComplete
              ? 'Every habit is done today — that is a complete day.'
              : 'A day counts once any habit, task, focus session, workout, or meal is logged.'
          }
        />
        <WeekStrip
          week={snapshot.week}
          todayKey={snapshot.todayKey}
          accent={REWARD_COLORS.accent}
        />
      </ScreenSection>

      <ScreenSection>
        <SectionHeading title="Today's quests" hint="Three new quests rotate in every day." />
        <View
          style={{
            gap: spacing.md,
            padding: spacing.lg,
            borderRadius: radius.lg,
            backgroundColor: tokens.surface,
            borderWidth: 1,
            borderColor: tokens.border,
          }}
        >
          {snapshot.quests.map((quest) => (
            <QuestRow key={quest.id} quest={quest} accent={REWARD_COLORS.quest} />
          ))}
        </View>
      </ScreenSection>

      <ScreenSection>
        <SectionHeading
          title="Badges"
          hint="Earned tiers are shown first; the next goal follows."
        />
        <BadgeGrid badges={snapshot.badges} />
      </ScreenSection>

      <ScreenSection className="mb-0">
        <SectionHeading title="Streak protection" />
        <View
          style={{
            gap: spacing.sm,
            padding: spacing.lg,
            borderRadius: radius.lg,
            backgroundColor: tokens.surface,
            borderWidth: 1,
            borderColor: tokens.border,
          }}
        >
          <Text style={{ ...typography.bodyMd, color: tokens.text }}>
            {snapshot.freezes.banked} of {snapshot.freezes.earned} earned streak freezes available
          </Text>
          <Text style={{ ...typography.caption, color: tokens.textMuted }}>
            A freeze is earned at 7, 30, 100, and 365 day streaks and spends itself automatically on
            the first missed day, so one off day never wipes a long run. Today is always grace: the
            streak only breaks once a full day has passed with no activity.
          </Text>
        </View>
      </ScreenSection>
    </View>
  );
}
