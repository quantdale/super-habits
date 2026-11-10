import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { REWARD_COLORS, REWARD_HUES } from '@/constants/sectionColors';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius, spacing, typography } from '@/core/theme/designTokens';
import { Card } from '@/core/ui/Card';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { ProgressBar } from '@/core/ui/ProgressBar';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { SkeletonBlock } from '@/core/ui/SkeletonBlock';
import { StatBlock } from '@/core/ui/StatBlock';
import { BadgeFamilyTile, BadgeGrid } from './BadgeGrid';
import { earnedMilestones } from './gamification.domain';
import { LevelHero } from './LevelHero';
import { QuestRow } from './QuestRow';
import { WeekStrip } from './WeekStrip';
import { useGamification } from './gamificationContext';
import { BADGE_TIER_LABELS, type BadgeState } from './gamification.types';

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
 * The single nearest locked tier — the one real next milestone. Ordered by
 * progress ratio descending, then by the smallest threshold so a fresh account
 * sees the cheapest achievable goal rather than an alphabetical accident.
 */
function nextTarget(badges: readonly BadgeState[]): BadgeState | null {
  const locked = badges
    .filter((badge) => !badge.unlocked)
    .sort((a, b) => b.ratio - a.ratio || a.threshold - b.threshold || a.id.localeCompare(b.id));
  return locked[0] ?? null;
}

function tierLabel(badge: BadgeState): string {
  return BADGE_TIER_LABELS[badge.tier - 1] ?? badge.label;
}

/**
 * Full reward surface behind the Today dashboard card (Refero: Duolingo
 * Quests/Badges tabs, Brilliant progress screen, Planny awards grid).
 *
 * W13 (design D13.4, defect SUR-13): an **earned milestone leads**, one
 * believable next target follows, and earned tiers render inline while locked
 * tiers move behind one disclosure. The ledger, thresholds and award
 * idempotency are untouched — this reads the same shared snapshot only.
 *
 * P20 (`docs/ui-ux/16-playful-momentum.md` §7 "Gamification surfaces"): the
 * milestone and next-target cards lead with the badge-family tile on its Gold
 * wash, the next-target bar is the chunky Gold §6 bar, the week strip is
 * Flame/Ice nodes, and quest rows are lipped Gold-bar cards. Every heading,
 * string, control name and the `All badges` disclosure (with its reported
 * expanded state) are unchanged.
 */
export function AchievementsScreen() {
  const { tokens, rewardAccents } = useAppTheme();
  const { snapshot, isLoading } = useGamification();
  const [showAllBadges, setShowAllBadges] = useState(false);

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

  const earned = snapshot.badges.filter((badge) => badge.unlocked);
  const earnedBadgeCount = earned.length;
  const milestones = earnedMilestones(snapshot.badges);
  const next = nextTarget(snapshot.badges);
  const topMilestone = milestones[0] ?? null;

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

      {/* W13: the earned milestone is the screen's primary content. */}
      <ScreenSection>
        <SectionHeading title="Latest milestone" />
        {topMilestone ? (
          <Card
            innerClassName="p-3"
            className="mb-0"
            style={{
              borderColor: REWARD_HUES.badge.bright,
              borderBottomColor: REWARD_COLORS.badge,
            }}
          >
            <View className="flex-row items-center" style={{ gap: spacing.md }}>
              <BadgeFamilyTile
                icon={topMilestone.icon as keyof typeof MaterialIcons.glyphMap}
                size={52}
              />
              <View className="min-w-0 flex-1">
                <Text style={{ ...typography.titleMd, color: tokens.text }}>
                  {topMilestone.label}
                </Text>
                <Text style={{ ...typography.caption, color: tokens.textMuted, marginTop: 2 }}>
                  {tierLabel(topMilestone)} tier earned · {topMilestone.description}
                </Text>
              </View>
              <Text style={{ ...typography.label, color: rewardAccents.badge.text }}>Earned</Text>
            </View>
            {earnedBadgeCount > 1 ? (
              <Text
                style={{ ...typography.caption, color: tokens.textMuted, marginTop: spacing.sm }}
              >
                {earnedBadgeCount} badges earned in total.
              </Text>
            ) : null}
          </Card>
        ) : (
          <Card innerClassName="p-3" className="mb-0">
            <View className="flex-row items-center" style={{ gap: spacing.md }}>
              <BadgeFamilyTile icon="emoji-events" size={44} subdued />
              <Text style={{ ...typography.bodyMd, color: tokens.text, flex: 1 }}>
                No badges earned yet — the first one is one completed day away.
              </Text>
            </View>
          </Card>
        )}
      </ScreenSection>

      {/* One believable next target, derived from real ledger progress only. */}
      {next ? (
        <ScreenSection>
          <SectionHeading title="Next target" />
          <Card innerClassName="p-3" className="mb-0">
            <View className="flex-row items-center" style={{ gap: spacing.md }}>
              <BadgeFamilyTile
                icon={next.icon as keyof typeof MaterialIcons.glyphMap}
                size={44}
                subdued
              />
              <View className="min-w-0 flex-1">
                <Text style={{ ...typography.bodyMd, color: tokens.text }}>{next.label}</Text>
                <Text style={{ ...typography.caption, color: tokens.textMuted, marginTop: 2 }}>
                  {next.description}
                </Text>
              </View>
              <Text
                style={{
                  ...typography.label,
                  color: tokens.text,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {Math.min(next.progress, next.threshold)}/{next.threshold}
              </Text>
            </View>
            <View style={{ marginTop: spacing.sm }}>
              {/* §7: the badge/quest progress object is the Gold §6 bar. */}
              <ProgressBar
                progress={next.ratio}
                accentColor={REWARD_COLORS.badge}
                height={10}
                accessibilityLabel={`${next.label} progress`}
              />
            </View>
          </Card>
        </ScreenSection>
      ) : null}

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
            accentColor={REWARD_COLORS.badge}
            value={`${earnedBadgeCount}/${snapshot.badges.length}`}
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
        <Card innerClassName="p-3" className="mb-0">
          <WeekStrip
            week={snapshot.week}
            todayKey={snapshot.todayKey}
            accent={REWARD_COLORS.accent}
          />
        </Card>
      </ScreenSection>

      <ScreenSection>
        <SectionHeading title="Today's quests" hint="Three new quests rotate in every day." />
        <View style={{ gap: spacing.md }}>
          {snapshot.quests.map((quest) => (
            <QuestRow key={quest.id} quest={quest} accent={REWARD_COLORS.quest} />
          ))}
        </View>
      </ScreenSection>

      {earned.length > 0 ? (
        <ScreenSection>
          <SectionHeading title="Earned badges" />
          <Card innerClassName="p-3" className="mb-0">
            <BadgeGrid badges={earned} />
          </Card>
        </ScreenSection>
      ) : null}

      {/* Locked tiers are a collection, not the milestone. One disclosure keeps
          them reachable without giving every unearned badge equal prominence
          (SUR-13). The disclosure reports its expanded state. */}
      <ScreenSection>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showAllBadges ? 'Hide all badges' : 'Show all badges'}
          accessibilityState={{ expanded: showAllBadges }}
          aria-expanded={showAllBadges}
          className="min-h-11 self-start justify-center rounded-xl px-3"
          style={{
            borderWidth: 2,
            borderColor: tokens.border,
            borderBottomWidth: 4,
            borderBottomColor: tokens.borderStrong,
            backgroundColor: tokens.surface,
          }}
          onPress={() => setShowAllBadges((open) => !open)}
        >
          <Text style={{ ...typography.bodyMd, color: tokens.text }}>
            All badges {showAllBadges ? '−' : '+'}
          </Text>
        </Pressable>
        {showAllBadges ? (
          <Card innerClassName="p-3" className="mt-3 mb-0">
            <BadgeGrid badges={snapshot.badges} maxRows={snapshot.badges.length} />
          </Card>
        ) : null}
      </ScreenSection>

      <ScreenSection className="mb-0">
        <SectionHeading title="Streak protection" />
        <Card innerClassName="p-3" className="mb-0">
          <View
            className="flex-row items-center"
            style={{ gap: spacing.sm, marginBottom: spacing.sm }}
          >
            {/* Ice-shield hero icon: a freeze is a gift, never a loss. */}
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.sm,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: tokens.surfaceSunken,
              }}
            >
              <MaterialIcons name="ac-unit" size={18} color={REWARD_HUES.frozen.lip} />
            </View>
            <Text style={{ ...typography.bodyMd, color: tokens.text, flex: 1 }}>
              {snapshot.freezes.banked} of {snapshot.freezes.earned} earned streak freezes available
            </Text>
          </View>
          <Text style={{ ...typography.caption, color: tokens.textMuted }}>
            Reward streak: {snapshot.streak.current} day
            {snapshot.streak.current === 1 ? '' : 's'} · best: {snapshot.streak.longest} day
            {snapshot.streak.longest === 1 ? '' : 's'}.
          </Text>
          <Text style={{ ...typography.caption, color: tokens.textMuted, marginTop: spacing.xs }}>
            A freeze is earned at 7, 30, 100, and 365 day reward streaks and spends itself
            automatically on the first missed day, so one off day never wipes a long run. Today is
            always grace: the streak only breaks once a full day has passed with no activity. The
            Habits tab shows a separate per-habit streak, which counts that habit&apos;s scheduled
            occurrences only.
          </Text>
        </Card>
      </ScreenSection>
    </View>
  );
}
