import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { SECTION_COLORS } from '@/constants/sectionColors';
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
  const { tokens } = useAppTheme();
  const [view, setView] = useState<PlanningHubView>(initialView);
  const [detail, setDetail] = useState<Detail>(null);
  // Bumped after a guided-flow save so the briefing and the full editor
  // remount with the fresh plan instead of showing stale state.
  const [todayVersion, setTodayVersion] = useState(0);

  const selectTab = useCallback((tab: PlanningHubView) => {
    setDetail(null);
    setView(tab);
  }, []);

  return (
    <View className="flex-1 gap-3">
      <View className="flex-row flex-wrap gap-2">
        {TABS.map((tab) => {
          const active = view === tab.key && detail === null;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: active }}
              className="rounded-full border px-4 py-2"
              style={
                active
                  ? { backgroundColor: SECTION_COLORS.todos, borderColor: SECTION_COLORS.todos }
                  : { borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }
              }
              onPress={() => selectTab(tab.key)}
            >
              <Text style={{ color: active ? tokens.textOnAccent : tokens.textMuted }}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

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
            <TodayBriefingView key={`briefing-${todayVersion}`} />
            <DailyPlanView key={`plan-${todayVersion}`} />
          </View>
        ) : view === 'projects' ? (
          <ProjectListView onOpenProject={(id) => setDetail({ kind: 'project', id })} />
        ) : view === 'goals' ? (
          <GoalListView onOpenGoal={(id) => setDetail({ kind: 'goal', id })} />
        ) : view === 'progress' ? (
          <ProgressInsightsView />
        ) : (
          <ActivityTimelineView />
        )}
      </View>
    </View>
  );
}
