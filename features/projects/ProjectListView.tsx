import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { IconButton } from '@/core/ui/IconButton';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { SECTION_COLORS } from '@/constants/sectionColors';
import {
  listProjects,
  listGoalsForProject,
  listHabitsForProject,
  listTodosForProject,
} from '@/features/projects/projects.data';
import { PROJECT_STATUS_LABELS } from '@/features/projects/projects.types';
import type { Project } from '@/core/db/types';

type ProjectListViewProps = {
  onOpenProject: (id: string | null) => void;
};

type ProjectCounts = { todos: number; habits: number; goals: number };

export function ProjectListView({ onOpenProject }: ProjectListViewProps) {
  const { tokens } = useAppTheme();
  const [projects, setProjects] = useState<Project[]>([]);
  const [counts, setCounts] = useState<Record<string, ProjectCounts>>({});
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await listProjects();
      setProjects(list);
      const next: Record<string, ProjectCounts> = {};
      await Promise.all(
        list.map(async (project) => {
          const [todos, habits, goals] = await Promise.all([
            listTodosForProject(project.id),
            listHabitsForProject(project.id),
            listGoalsForProject(project.id),
          ]);
          next[project.id] = { todos: todos.length, habits: habits.length, goals: goals.length };
        }),
      );
      setCounts(next);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

      {!isLoading && projects.length === 0 ? (
        <EmptyStateCard
          accentColor={SECTION_COLORS.todos}
          title="No projects yet"
          description="Group related tasks, habits, and goals under a project to see progress in one place."
          icon={<Text style={{ fontSize: 18 }}>•</Text>}
        />
      ) : (
        projects.map((project) => {
          const c = counts[project.id];
          return (
            <Pressable
              key={project.id}
              accessibilityRole="button"
              accessibilityLabel={project.name}
              className="flex-row items-center gap-3 rounded-2xl border p-3"
              style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
              onPress={() => onOpenProject(project.id)}
            >
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
                  {c ? ` · ${c.todos} tasks, ${c.habits} habits, ${c.goals} goals` : ''}
                </Text>
              </View>
              <Text style={{ fontSize: 18 }}>•</Text>
            </Pressable>
          );
        })
      )}
    </View>
  );
}
