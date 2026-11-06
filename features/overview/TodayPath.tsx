import { MaterialIcons } from '@expo/vector-icons';
import { View } from 'react-native';

import { REWARD_HUES } from '@/constants/sectionColors';
import { useAppTheme } from '@/core/providers/themeContext';
import { Text } from '@/core/ui/Text';
import { GardenIcon, TodayIcon } from '@/core/ui/illustrations/icons';
import { radius, spacing } from '@/core/theme/designTokens';
import type { DailyQuestState } from '@/features/gamification/gamification.types';

import type { PlanProgressSummary } from './overview.domain';

type TodayPathProps = {
  /** The 3 seeded daily quests — the exact QuestRow data, same order. */
  quests: DailyQuestState[];
  plan: PlanProgressSummary;
  /** The Momentum Garden exists on the other end of the path (presentation). */
  hasGarden: boolean;
};

type PathStepState = 'done' | 'current' | 'upcoming' | 'reward';

type PathStep = {
  key: string;
  label: string;
  caption: string;
  state: PathStepState;
  spoken: string;
  /** MaterialIcons glyph (quest data), or a hero icon when `heroIcon` is set. */
  icon: string;
  heroIcon?: 'plan' | 'garden';
};

/**
 * "Today's path" (Playful Momentum §7): a presentation of the existing daily
 * quest / plan / garden state as chunky 64px path nodes zig-zagging down into
 * the Momentum Garden. Pure presentation — no new data, no new state, no
 * behavior changes. The quest order is exactly the QuestRow order from the
 * gamification snapshot.
 *
 * Node states (§6 PathNode): done = reward bright + check, current = bright +
 * white ring, upcoming = sunken + muted glyph, reward = Gold chest/garden.
 * Nodes are static markers (the quests themselves stay interactive on the
 * Level & Streaks card), so they carry no press target of their own.
 */
export function TodayPath({ quests, plan, hasGarden }: TodayPathProps) {
  const { tokens } = useAppTheme();
  const gold = REWARD_HUES.accent;

  const planDone =
    plan.hasPlan && plan.totalPriorities > 0 && plan.completedPriorities >= plan.totalPriorities;

  const steps: PathStep[] = [
    ...quests.map((quest, index) => {
      const progress = Math.min(quest.progress, quest.target);
      return {
        key: `quest-${quest.id}`,
        label: quest.title,
        caption: quest.complete
          ? `Complete · +${quest.xpReward} XP`
          : `Quest ${index + 1} · ${progress}/${quest.target} ${quest.unit}`,
        state: quest.complete ? ('done' as const) : ('upcoming' as const),
        spoken: quest.complete
          ? `${quest.title}: quest complete`
          : `${quest.title}: quest in progress, ${progress} of ${quest.target} ${quest.unit}`,
        icon: quest.icon,
      };
    }),
    {
      key: 'plan',
      label: "Today's plan",
      caption: plan.hasPlan
        ? planDone
          ? 'All priorities done'
          : `${plan.completedPriorities}/${plan.totalPriorities} priorities`
        : 'No plan yet',
      state: planDone ? 'done' : 'upcoming',
      spoken: plan.hasPlan
        ? `Today's plan: ${plan.completedPriorities} of ${plan.totalPriorities} priorities done`
        : "Today's plan: not planned yet",
      icon: 'event-note',
      heroIcon: 'plan' as const,
    },
    {
      key: 'garden',
      label: 'Garden',
      caption: hasGarden ? 'Roots growing today' : 'Ready when you are',
      state: 'reward',
      spoken: hasGarden
        ? 'Momentum Garden: roots growing today'
        : 'Momentum Garden: ready when you are',
      icon: 'park',
      heroIcon: 'garden' as const,
    },
  ];

  // One "current" step only: the first step that is not finished. Everything
  // after it reads as "upcoming" so the path has a single point of focus.
  const firstOpenIndex = steps.findIndex(
    (step) => step.state !== 'done' && step.state !== 'reward',
  );
  const styled = steps.map((step, index) =>
    step.state === 'upcoming' && index === firstOpenIndex
      ? { ...step, state: 'current' as const }
      : step,
  );

  return (
    <View style={{ gap: spacing.md }}>
      <Text
        variant="caption"
        tone="muted"
        style={{ letterSpacing: 0.8, textTransform: 'uppercase' }}
      >
        Today&apos;s path
      </Text>
      <View style={{ gap: spacing.sm }}>
        {styled.map((step, index) => {
          const isDone = step.state === 'done';
          const isCurrent = step.state === 'current';
          const isReward = step.state === 'reward';
          const isUpcoming = step.state === 'upcoming';

          const face = isUpcoming ? tokens.surfaceSunken : gold.bright;
          const lipColor = isUpcoming ? tokens.border : gold.lip;
          const glyph = isUpcoming ? tokens.iconMuted : '#10131A';
          const flipped = index % 2 === 1;

          return (
            <View
              key={step.key}
              accessible
              accessibilityLabel={step.spoken}
              style={{
                flexDirection: flipped ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingHorizontal: spacing.sm,
              }}
            >
              {/* Node face + 6px lip (§6 PathNode: 64 + 6). */}
              <View
                style={{
                  width: 64,
                  height: 70,
                  borderRadius: radius.full,
                  backgroundColor: lipColor,
                }}
              >
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: radius.full,
                    backgroundColor: face,
                    borderWidth: isCurrent ? 3 : 2,
                    borderColor: isCurrent ? '#FFFFFF' : isUpcoming ? tokens.border : gold.lip,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isDone ? (
                    <MaterialIcons name="check" size={30} color={glyph} />
                  ) : step.heroIcon === 'garden' ? (
                    <GardenIcon
                      size={30}
                      bright={isUpcoming ? tokens.iconMuted : '#10131A'}
                      lip={isUpcoming ? tokens.border : gold.lip}
                    />
                  ) : step.heroIcon === 'plan' ? (
                    <TodayIcon
                      size={30}
                      bright={isUpcoming ? tokens.iconMuted : '#10131A'}
                      lip={isUpcoming ? tokens.border : gold.lip}
                    />
                  ) : (
                    <MaterialIcons
                      name={
                        (isReward
                          ? 'emoji-events'
                          : step.icon) as keyof typeof MaterialIcons.glyphMap
                      }
                      size={28}
                      color={glyph}
                    />
                  )}
                </View>
              </View>
              <View
                style={{
                  flex: 1,
                  alignItems: flipped ? 'flex-end' : 'flex-start',
                }}
              >
                <Text
                  variant="bodyMd"
                  numberOfLines={1}
                  style={{
                    fontWeight: '700',
                    color: isUpcoming ? tokens.textMuted : tokens.text,
                    textAlign: flipped ? 'right' : 'left',
                  }}
                >
                  {step.label}
                </Text>
                <Text
                  variant="caption"
                  tone="muted"
                  numberOfLines={1}
                  style={{ textAlign: flipped ? 'right' : 'left' }}
                >
                  {step.caption}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
