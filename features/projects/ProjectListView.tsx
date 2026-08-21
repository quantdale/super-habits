import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { IconButton } from '@/core/ui/IconButton';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { listProjects, listProjectRollups } from '@/features/projects/projects.data';
import {
  computeProjectProgress,
  filterProjectRows,
  sortProjectRows,
  type ProjectListRow,
  type ProjectSortKey,
  type ProjectStatusFilter,
} from '@/features/projects/projects.domain';
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_VALUES } from '@/features/projects/projects.types';

type ProjectListViewProps = {
  onOpenProject: (id: string | null) => void;
};

const STATUS_FILTERS: { key: ProjectStatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  ...PROJECT_STATUS_VALUES.map((s) => ({
    key: s,
    label: PROJECT_STATUS_LABELS[s],
  })),
];

const SORT_OPTIONS: { key: ProjectSortKey; label: string }[] = [
  { key: 'manual', label: 'Manual' },
  { key: 'target_date', label: 'Target date' },
  { key: 'progress', label: 'Progress' },
  { key: 'name', label: 'Name' },
];

export function ProjectListView({ onOpenProject }: ProjectListViewProps) {
  const { tokens } = useAppTheme();
  const [rows, setRows] = useState<ProjectListRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>('all');
  const [sortKey, setSortKey] = useState<ProjectSortKey>('manual');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      // Bounded: one project list + three grouped aggregate queries (no N+1).
      const [list, rollups] = await Promise.all([listProjects(), listProjectRollups()]);
      setRows(
        list.map((project) => {
          const r = rollups[project.id];
          const progress = r
            ? computeProjectProgress({ todos: r.todos, goals: r.goals, habits: r.habits })
            : null;
          return {
            project,
            progressPercent: progress?.percent ?? 0,
            linkedCounts: {
              todos: r?.todos.total ?? 0,
              goals: r?.goals.count ?? 0,
              habits: r?.habits.habitCount ?? 0,
            },
          };
        }),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => sortProjectRows(filterProjectRows(rows, statusFilter), sortKey),
    [rows, statusFilter, sortKey],
  );

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-bold" style={{ color: tokens.text }}>
          Projects
        </Text>
        <IconButton
          icon="add"
          onPress={() => onOpenProject(null)}
          accessibilityLabel="Create project"
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
                accessibilityLabel={`Filter projects by ${f.label}`}
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
          <View className="flex-row items-center gap-2">
            <Text className="text-xs" style={{ color: tokens.textMuted }}>
              Sort
            </Text>
            {SORT_OPTIONS.map((o) => (
              <Pressable
                key={o.key}
                accessibilityRole="button"
                accessibilityLabel={`Sort by ${o.label}`}
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
          title="No projects yet"
          description="Group related tasks, habits, and goals under a project to see progress in one place."
          icon={<Text style={{ fontSize: 18 }}>•</Text>}
        />
      ) : !isLoading && visible.length === 0 ? (
        <EmptyStateCard
          accentColor={SECTION_COLORS.todos}
          title="No matching projects"
          description="Try a different status filter."
          icon={<Text style={{ fontSize: 18 }}>•</Text>}
        />
      ) : (
        visible.map((row) => {
          const { project, progressPercent, linkedCounts } = row;
          return (
            <Pressable
              key={project.id}
              accessibilityRole="button"
              accessibilityLabel={`${project.name}, ${PROJECT_STATUS_LABELS[project.status]}, ${progressPercent} percent progress`}
              className="rounded-2xl border p-3"
              style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
              onPress={() => onOpenProject(project.id)}
            >
              <View className="flex-row items-center gap-3">
                <View
                  className="h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${project.color}22` }}
                >
                  <Text style={{ fontSize: 18 }}>•</Text>
                </View>
                <View className="min-w-0 flex-1">
                  <Text
                    className="text-base font-semibold"
                    style={{ color: tokens.text }}
                    numberOfLines={1}
                  >
                    {project.name}
                  </Text>
                  <Text className="text-sm" style={{ color: tokens.textMuted }} numberOfLines={1}>
                    {PROJECT_STATUS_LABELS[project.status]}
                    {linkedCounts.todos + linkedCounts.habits + linkedCounts.goals > 0
                      ? ` · ${linkedCounts.todos} tasks, ${linkedCounts.habits} habits, ${linkedCounts.goals} goals`
                      : ' · nothing linked yet'}
                  </Text>
                </View>
                <Text className="text-sm font-bold" style={{ color: tokens.text }}>
                  {progressPercent}%
                </Text>
              </View>
              <View
                className="mt-2 h-2 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: tokens.surfaceElevated }}
              >
                <View
                  className="h-2 rounded-full"
                  style={{
                    width: `${progressPercent}%`,
                    backgroundColor: project.color || SECTION_COLORS.todos,
                  }}
                />
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );
}
