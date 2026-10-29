import { Text } from '@/core/ui/Text';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { IconButton } from '@/core/ui/IconButton';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { SECTION_COLORS, SECTION_ON_BRIGHT_INK } from '@/constants/sectionColors';
import { PlanningSummaryRow } from '@/features/planning-hub/PlanningSummaryRow';
import {
  listProjects,
  listProjectRollups,
  reorderProjects,
} from '@/features/projects/projects.data';
import {
  computeProjectProgress,
  filterProjectRows,
  manualProjectMoveOrder,
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
  const [showFilters, setShowFilters] = useState(false);

  const loadSeq = useRef(0);
  const loadProjects = useCallback(async () => {
    const seq = ++loadSeq.current;
    // Bounded: one project list + three grouped aggregate queries (no N+1).
    const [list, rollups] = await Promise.all([listProjects(), listProjectRollups()]);
    if (seq !== loadSeq.current) return;
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
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const manualOrderActive = sortKey === 'manual' && statusFilter === 'all';
  const moveProject = useCallback(
    async (index: number, direction: -1 | 1) => {
      // `rows` is the FULL manual order (unfiltered, status-grouped) so the
      // persisted order stays absolute and complete; the group-aware swap
      // refuses moves across the completed/archived boundary, which renders
      // last no matter what sort_order says.
      const next = manualProjectMoveOrder(rows, index, direction);
      if (!next) return;
      await reorderProjects(next);
      void loadProjects();
    },
    [rows, loadProjects],
  );

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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Projects filters and sort"
            accessibilityState={{ expanded: showFilters }}
            aria-expanded={showFilters}
            className="min-h-11 self-start justify-center rounded-xl border px-3"
            style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
            onPress={() => setShowFilters((open) => !open)}
          >
            <Text className="text-sm" style={{ color: tokens.text }}>
              Filters & sort{statusFilter !== 'all' || sortKey !== 'manual' ? ' · Active' : ''}{' '}
              {showFilters ? '−' : '+'}
            </Text>
          </Pressable>
          {showFilters ? (
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
                        ? {
                            backgroundColor: SECTION_COLORS.todos,
                            borderColor: SECTION_COLORS.todos,
                          }
                        : { borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }
                    }
                    onPress={() => setStatusFilter(f.key)}
                  >
                    <Text
                      className="text-xs"
                      style={{
                        color: statusFilter === f.key ? SECTION_ON_BRIGHT_INK : tokens.textMuted,
                      }}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View className="flex-row flex-wrap items-center gap-x-2 gap-y-2">
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
                        ? {
                            backgroundColor: SECTION_COLORS.todos,
                            borderColor: SECTION_COLORS.todos,
                          }
                        : { borderColor: tokens.border }
                    }
                    onPress={() => setSortKey(o.key)}
                  >
                    <Text
                      className="text-xs"
                      style={{
                        color: sortKey === o.key ? SECTION_ON_BRIGHT_INK : tokens.textMuted,
                      }}
                    >
                      {o.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {!isLoading && rows.length === 0 ? (
        <EmptyStateCard
          accentColor={SECTION_COLORS.todos}
          title="No projects yet"
          description="Group related tasks, habits, and goals under a project to see progress in one place."
        />
      ) : !isLoading && visible.length === 0 ? (
        <EmptyStateCard
          accentColor={SECTION_COLORS.todos}
          title="No matching projects"
          description="Try a different status filter."
        />
      ) : (
        visible.map((row, index) => {
          const { project, progressPercent, linkedCounts } = row;
          const count = linkedCounts.todos + linkedCounts.habits + linkedCounts.goals;
          return (
            <PlanningSummaryRow
              key={project.id}
              title={project.name}
              status={PROJECT_STATUS_LABELS[project.status]}
              context={
                count > 0
                  ? `${linkedCounts.todos} tasks · ${linkedCounts.habits} habits · ${linkedCounts.goals} goals`
                  : 'No linked work yet'
              }
              targetDate={project.target_date}
              progressPercent={progressPercent}
              accentColor={project.color || SECTION_COLORS.todos}
              accessibilityLabel={`${project.name}, ${PROJECT_STATUS_LABELS[project.status]}, ${progressPercent} percent progress`}
              onPress={() => onOpenProject(project.id)}
              actions={
                manualOrderActive ? (
                  <View className="flex-row gap-1">
                    <IconButton
                      icon="arrow-upward"
                      size={18}
                      onPress={() => void moveProject(index, -1)}
                      accessibilityLabel={`Move ${project.name} up`}
                    />
                    <IconButton
                      icon="arrow-downward"
                      size={18}
                      onPress={() => void moveProject(index, 1)}
                      accessibilityLabel={`Move ${project.name} down`}
                    />
                  </View>
                ) : undefined
              }
            />
          );
        })
      )}
    </View>
  );
}
