import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { IconButton } from '@/core/ui/IconButton';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { listGoals } from '@/features/goals/goals.data';
import { listProjects } from '@/features/projects/projects.data';
import {
  filterGoalRows,
  sortGoalRows,
  type GoalHorizonFilter,
  type GoalListRow,
  type GoalSortKey,
  type GoalStatusFilter,
} from '@/features/goals/goals.domain';
import {
  GOAL_HORIZON_LABELS,
  GOAL_HORIZON_VALUES,
  GOAL_STATUS_LABELS,
  GOAL_STATUS_VALUES,
} from '@/features/goals/goals.types';

type GoalListViewProps = {
  onOpenGoal: (id: string | null) => void;
};

const STATUS_FILTERS: { key: GoalStatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  ...GOAL_STATUS_VALUES.map((s) => ({
    key: s,
    label: GOAL_STATUS_LABELS[s],
  })),
];

const HORIZON_FILTERS: { key: GoalHorizonFilter; label: string }[] = [
  { key: 'all', label: 'Any horizon' },
  ...GOAL_HORIZON_VALUES.map((h) => ({
    key: h,
    label: GOAL_HORIZON_LABELS[h],
  })),
];

const SORT_OPTIONS: { key: GoalSortKey; label: string }[] = [
  { key: 'created', label: 'Newest' },
  { key: 'progress', label: 'Progress' },
  { key: 'target_date', label: 'Target date' },
  { key: 'title', label: 'Title' },
];

export function GoalListView({ onOpenGoal }: GoalListViewProps) {
  const { tokens } = useAppTheme();
  const [rows, setRows] = useState<GoalListRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<GoalStatusFilter>('all');
  const [horizonFilter, setHorizonFilter] = useState<GoalHorizonFilter>('all');
  const [sortKey, setSortKey] = useState<GoalSortKey>('created');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [goals, projects] = await Promise.all([listGoals(), listProjects()]);
      const projectNameById = new Map(projects.map((p) => [p.id, p.name]));
      setRows(
        goals.map((goal) => ({
          goal,
          projectName: goal.project_id ? (projectNameById.get(goal.project_id) ?? null) : null,
        })),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () =>
      sortGoalRows(filterGoalRows(rows, { status: statusFilter, horizon: horizonFilter }), sortKey),
    [rows, statusFilter, horizonFilter, sortKey],
  );

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-bold" style={{ color: tokens.text }}>
          Goals
        </Text>
        <IconButton
          icon="add"
          onPress={() => onOpenGoal(null)}
          accessibilityLabel="Create goal"
          accentColor={SECTION_COLORS.todos}
        />
      </View>

      {!isLoading && rows.length > 0 ? (
        <View className="gap-2">
          <View className="flex-row flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => (
              <Pressable
                key={f.key}
                accessibilityRole="button"
                accessibilityLabel={`Filter goals by ${f.label} status`}
                className="rounded-full border px-3 py-1.5"
                style={
                  statusFilter === f.key
                    ? { backgroundColor: SECTION_COLORS.todos, borderColor: SECTION_COLORS.todos }
                    : { borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }
                }
                onPress={() => setStatusFilter(f.key)}
              >
                <Text
                  className="text-xs"
                  style={{ color: statusFilter === f.key ? tokens.textOnAccent : tokens.textMuted }}
                >
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View className="flex-row flex-wrap gap-2">
            {HORIZON_FILTERS.map((f) => (
              <Pressable
                key={f.key}
                accessibilityRole="button"
                accessibilityLabel={`Filter goals by ${f.label} horizon`}
                className="rounded-full border px-3 py-1.5"
                style={
                  horizonFilter === f.key
                    ? { backgroundColor: SECTION_COLORS.todos, borderColor: SECTION_COLORS.todos }
                    : { borderColor: tokens.border }
                }
                onPress={() => setHorizonFilter(f.key)}
              >
                <Text
                  className="text-xs"
                  style={{
                    color: horizonFilter === f.key ? tokens.textOnAccent : tokens.textMuted,
                  }}
                >
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View className="flex-row items-center gap-2">
            <Text className="text-xs" style={{ color: tokens.textMuted }}>
              Sort
            </Text>
            {SORT_OPTIONS.map((o) => (
              <Pressable
                key={o.key}
                accessibilityRole="button"
                accessibilityLabel={`Sort goals by ${o.label}`}
                className="rounded-full border px-3 py-1.5"
                style={
                  sortKey === o.key
                    ? { backgroundColor: SECTION_COLORS.todos, borderColor: SECTION_COLORS.todos }
                    : { borderColor: tokens.border }
                }
                onPress={() => setSortKey(o.key)}
              >
                <Text
                  className="text-xs"
                  style={{ color: sortKey === o.key ? tokens.textOnAccent : tokens.textMuted }}
                >
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {!isLoading && rows.length === 0 ? (
        <EmptyStateCard
          accentColor={SECTION_COLORS.todos}
          title="No goals yet"
          description="Set measurable outcomes and track manual progress toward them."
          icon={<Text style={{ fontSize: 18 }}>•</Text>}
        />
      ) : !isLoading && visible.length === 0 ? (
        <EmptyStateCard
          accentColor={SECTION_COLORS.todos}
          title="No matching goals"
          description="Try a different status or horizon filter."
          icon={<Text style={{ fontSize: 18 }}>•</Text>}
        />
      ) : (
        visible.map(({ goal, projectName }) => (
          <Pressable
            key={goal.id}
            accessibilityRole="button"
            accessibilityLabel={`${goal.title}, ${GOAL_STATUS_LABELS[goal.status]}, ${goal.progress_percent} percent`}
            className="flex-row items-center gap-3 rounded-2xl border p-3"
            style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
            onPress={() => onOpenGoal(goal.id)}
          >
            <View
              className="h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${SECTION_COLORS.todos}22` }}
            >
              <Text style={{ fontSize: 18 }}>•</Text>
            </View>
            <View className="min-w-0 flex-1">
              <Text
                className="text-base font-semibold"
                style={{ color: tokens.text }}
                numberOfLines={1}
              >
                {goal.title}
              </Text>
              <Text className="text-sm" style={{ color: tokens.textMuted }} numberOfLines={1}>
                {GOAL_STATUS_LABELS[goal.status]} · {GOAL_HORIZON_LABELS[goal.horizon]} ·{' '}
                {goal.progress_percent}%{projectName ? ` · ${projectName}` : ''}
              </Text>
            </View>
            <Text style={{ fontSize: 18 }}>•</Text>
          </Pressable>
        ))
      )}
    </View>
  );
}
