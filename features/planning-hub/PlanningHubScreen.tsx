import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Text } from '@/core/ui/Text';
import { useAppNavigation } from '@/core/providers/navigationContext';
import { useDayRolloverGeneration } from '@/core/providers/dayRolloverContext';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { spacing } from '@/core/theme/designTokens';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { SegmentedControl } from '@/core/ui/SegmentedControl';
import type { PlanningHubView } from '@/core/providers/navigationContext';
import { ProjectListView } from '@/features/projects/ProjectListView';
import { ProjectDetailView } from '@/features/projects/ProjectDetailView';
import { GoalListView } from '@/features/goals/GoalListView';
import { GoalDetailView } from '@/features/goals/GoalDetailView';
import { DailyPlanView } from '@/features/daily-plan/DailyPlanView';
import { TodayBriefingView } from '@/features/planning-hub/TodayBriefingView';
import { GuidedPlanningFlow } from '@/features/planning-hub/GuidedPlanningFlow';
import { ActivityTimelineView } from '@/features/activity/ActivityTimelineView';
import { ProgressInsightsView } from '@/features/progress/ProgressInsightsView';
import { MomentumDetailView } from '@/features/momentum/MomentumDetailView';

type PlanningHubScreenProps = {
  initialView: PlanningHubView;
};

type Detail = { kind: 'project' | 'goal'; id: string | null } | null;

const TABS: { key: PlanningHubView; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'projects', label: 'Projects' },
  { key: 'goals', label: 'Goals' },
  { key: 'progress', label: 'Progress' },
  { key: 'timeline', label: 'Timeline' },
];

export function PlanningHubScreen({ initialView }: PlanningHubScreenProps) {
  const { openWeeklyReview } = useAppNavigation();
  const { tokens } = useAppTheme();
  const [showBriefing, setShowBriefing] = useState(false);
  const [view, setView] = useState<PlanningHubView>(initialView);
  const [detail, setDetail] = useState<Detail>(null);
  // Bumped after a guided-flow save so the briefing and the full editor
  // remount with the fresh plan instead of showing stale state.
  const [todayVersion, setTodayVersion] = useState(0);
  // A hub left open across local midnight must remount the Today views so
  // they load the new day instead of rendering yesterday's briefing/plan.
  const dayGeneration = useDayRolloverGeneration();

  const selectTab = useCallback((tab: PlanningHubView) => {
    setDetail(null);
    setView(tab);
  }, []);

  return (
    <View className="flex-1" style={{ gap: spacing.md }}>
      <SegmentedControl
        options={TABS.map((tab) => ({ value: tab.key, label: tab.label }))}
        value={view}
        onChange={selectTab}
        accentColor={SECTION_COLORS.todos}
        accessibilityLabel="Planning hub views"
      />

      <View className="flex-1">
        {detail?.kind === 'project' ? (
          <ProjectDetailView projectId={detail.id} onBack={() => setDetail(null)} />
        ) : detail?.kind === 'goal' ? (
          <GoalDetailView
            goalId={detail.id}
            onBack={() => setDetail(null)}
            onOpenProject={(projectId) => setDetail({ kind: 'project', id: projectId })}
          />
        ) : view === 'today' ? (
          <View className="gap-3">
            <GuidedPlanningFlow onPlanSaved={() => setTodayVersion((v) => v + 1)} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Planning briefing"
              accessibilityState={{ expanded: showBriefing }}
              aria-expanded={showBriefing}
              className="min-h-11 self-start justify-center rounded-xl border px-3"
              style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
              onPress={() => setShowBriefing((open) => !open)}
            >
              <Text className="text-sm" style={{ color: tokens.text }}>
                Today&apos;s briefing {showBriefing ? '−' : '+'}
              </Text>
            </Pressable>
            {showBriefing ? (
              <TodayBriefingView key={`briefing-${todayVersion}-${dayGeneration}`} />
            ) : null}
            <DailyPlanView key={`plan-${todayVersion}-${dayGeneration}`} />
          </View>
        ) : view === 'projects' ? (
          <ProjectListView onOpenProject={(id) => setDetail({ kind: 'project', id })} />
        ) : view === 'goals' ? (
          <GoalListView onOpenGoal={(id) => setDetail({ kind: 'goal', id })} />
        ) : view === 'progress' ? (
          <View className="gap-3">
            {/* W12 (design D12.4): Progress is the surface the user selected, so
                its narrative leads. The Weekly Review entry and the decorative
                Momentum Garden follow as supporting items instead of consuming
                the first fold. */}
            <ProgressInsightsView />
            <Card innerClassName="p-3">
              <View className="gap-2">
                <Text variant="titleMd" style={{ color: tokens.text }}>
                  Weekly Review
                </Text>
                <Text variant="caption" tone="muted">
                  Carry this week&apos;s priorities and todos into the next one.
                </Text>
                <Button
                  label="Open weekly review"
                  accessibilityLabel="Open weekly review"
                  onPress={openWeeklyReview}
                />
              </View>
            </Card>
            <MomentumDetailView />
          </View>
        ) : (
          <ActivityTimelineView />
        )}
      </View>
    </View>
  );
}
