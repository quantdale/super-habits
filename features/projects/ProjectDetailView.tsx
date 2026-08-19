import { useCallback, useEffect, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Button } from '@/core/ui/Button';
import { IconButton } from '@/core/ui/IconButton';
import { TextField } from '@/core/ui/TextField';
import { SECTION_COLORS } from '@/constants/sectionColors';
import {
  addProject,
  getProject,
  listGoalsForProject,
  listHabitsForProject,
  listTodosForProject,
  softDeleteProject,
  updateProject,
} from '@/features/projects/projects.data';
import {
  PROJECT_COLORS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_VALUES,
  type ProjectInput,
} from '@/features/projects/projects.types';
import { listHabits, setHabitProjectGoal } from '@/features/habits/habits.data';
import { listTodos, setTodoProjectGoal } from '@/features/todos/todos.data';
import {
  PROJECT_DESCRIPTION_MAX,
  PROJECT_NAME_MAX,
  validateProjectInput,
} from '@/features/projects/projects.domain';

import { updateGoal } from '@/features/goals/goals.data';
import type { Project, ProjectStatus } from '@/core/db/types';

type ProjectDetailViewProps = {
  projectId: string | null;
  onBack: () => void;
};

export function ProjectDetailView({ projectId, onBack }: ProjectDetailViewProps) {
  const { tokens } = useAppTheme();
  const isCreate = projectId === null;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<string>(PROJECT_COLORS[0]);
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [targetDate, setTargetDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [linkedTodos, setLinkedTodos] = useState<{ id: string; title: string }[]>([]);
  const [linkedHabits, setLinkedHabits] = useState<{ id: string; name: string }[]>([]);
  const [linkedGoals, setLinkedGoals] = useState<{ id: string; title: string }[]>([]);
  const [candidateTodos, setCandidateTodos] = useState<{ id: string; title: string }[]>([]);
  const [candidateHabits, setCandidateHabits] = useState<{ id: string; name: string }[]>([]);
  const [candidateGoals, setCandidateGoals] = useState<{ id: string; title: string }[]>([]);

  const reloadLinks = useCallback(async () => {
    if (isCreate || !projectId) return;
    const [todos, habits, goals] = await Promise.all([
      listTodosForProject(projectId),
      listHabitsForProject(projectId),
      listGoalsForProject(projectId),
    ]);
    setLinkedTodos(todos.map((t) => ({ id: t.id, title: t.title })));
    setLinkedHabits(habits.map((h) => ({ id: h.id, name: h.name })));
    setLinkedGoals(goals.map((g) => ({ id: g.id, title: g.title })));

    const [allTodos, allHabits, allGoals] = await Promise.all([
      listTodos(),
      listHabits(),
      import('@/features/goals/goals.data').then((m) => m.listGoals()),
    ]);
    const linkedTodoIds = new Set(todos.map((t) => t.id));
    const linkedHabitIds = new Set(habits.map((h) => h.id));
    const linkedGoalIds = new Set(goals.map((g) => g.id));
    setCandidateTodos(
      allTodos
        .filter((t) => !t.completed && !t.project_id && !linkedTodoIds.has(t.id))
        .slice(0, 20)
        .map((t) => ({ id: t.id, title: t.title })),
    );
    setCandidateHabits(
      allHabits
        .filter((h) => !h.project_id && !linkedHabitIds.has(h.id))
        .slice(0, 20)
        .map((h) => ({ id: h.id, name: h.name })),
    );
    setCandidateGoals(
      allGoals
        .filter((g) => !g.project_id && !linkedGoalIds.has(g.id))
        .slice(0, 20)
        .map((g) => ({ id: g.id, title: g.title })),
    );
  }, [isCreate, projectId]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (isCreate || !projectId) return;
      const project = await getProject(projectId);
      if (!active || !project) return;
      setName(project.name);
      setDescription(project.description ?? '');
      setColor(project.color);
      setStatus(project.status);
      setTargetDate(project.target_date ?? '');
      await reloadLinks();
    })();
    return () => {
      active = false;
    };
  }, [projectId, isCreate, reloadLinks]);

  const handleSave = useCallback(async () => {
    setError(null);
    const input: ProjectInput = {
      name,
      description,
      color,
      status,
      targetDate: targetDate || null,
    };
    const validation = validateProjectInput(input);
    if (!validation.ok) {
      setError(
        validation.name ?? validation.description ?? validation.targetDate ?? 'Check the fields.',
      );
      return;
    }
    setSaving(true);
    try {
      if (isCreate) {
        await addProject(input);
      } else if (projectId) {
        await updateProject(projectId, input);
      }
      onBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save project.');
    } finally {
      setSaving(false);
    }
  }, [name, description, color, status, targetDate, isCreate, projectId, onBack]);

  const handleDelete = useCallback(async () => {
    if (isCreate || !projectId) return;
    await softDeleteProject(projectId);
    onBack();
  }, [isCreate, projectId, onBack]);

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <IconButton icon="arrow-back" onPress={onBack} accessibilityLabel="Back to projects" />
        <Text className="text-lg font-bold" style={{ color: tokens.text }}>
          {isCreate ? 'New Project' : 'Project'}
        </Text>
        <View className="w-11" />
      </View>

      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Project name"
        accessibilityLabel={`Project name, up to ${PROJECT_NAME_MAX} chars`}
      />
      <TextField
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Optional"
        accessibilityLabel={`Project description, up to ${PROJECT_DESCRIPTION_MAX} chars`}
      />
      <TextField
        label="Target date (YYYY-MM-DD)"
        value={targetDate}
        onChangeText={setTargetDate}
        placeholder="Optional"
      />

      <Text className="mb-1.5 text-sm font-medium" style={{ color: tokens.textMuted }}>
        Color
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {PROJECT_COLORS.map((c) => (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityLabel={`Color ${c}`}
            className="h-9 w-9 rounded-full"
            style={{
              backgroundColor: c,
              borderWidth: color === c ? 3 : 0,
              borderColor: tokens.text,
            }}
            onPress={() => setColor(c)}
          />
        ))}
      </View>

      <Text className="mb-1.5 mt-2 text-sm font-medium" style={{ color: tokens.textMuted }}>
        Status
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {PROJECT_STATUS_VALUES.map((s) => (
          <Pressable
            key={s}
            accessibilityRole="button"
            accessibilityLabel={PROJECT_STATUS_LABELS[s]}
            className="rounded-full border px-4 py-2"
            style={
              status === s
                ? { backgroundColor: SECTION_COLORS.todos, borderColor: SECTION_COLORS.todos }
                : { borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }
            }
            onPress={() => setStatus(s)}
          >
            <Text style={{ color: status === s ? tokens.textOnAccent : tokens.textMuted }}>
              {PROJECT_STATUS_LABELS[s]}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? (
        <Text className="text-sm" style={{ color: tokens.dangerSolid }}>
          {error}
        </Text>
      ) : null}

      <Button
        label={isCreate ? 'Create Project' : 'Save Project'}
        onPress={handleSave}
        disabled={saving}
        color={SECTION_COLORS.todos}
      />

      {!isCreate && projectId ? (
        <AssociationSection
          title="Linked Tasks"
          linked={linkedTodos}
          candidates={candidateTodos}
          labelOf={(i) => i.title ?? ''}
          onLink={(id) => setTodoProjectGoal(id, { projectId })}
          onUnlink={(id) => setTodoProjectGoal(id, { projectId: null })}
          onChanged={reloadLinks}
        />
      ) : null}

      {!isCreate && projectId ? (
        <AssociationSection
          title="Linked Habits"
          linked={linkedHabits}
          candidates={candidateHabits}
          labelOf={(i) => i.name ?? ''}
          onLink={(id) => setHabitProjectGoal(id, { projectId })}
          onUnlink={(id) => setHabitProjectGoal(id, { projectId: null })}
          onChanged={reloadLinks}
        />
      ) : null}

      {!isCreate && projectId ? (
        <AssociationSection
          title="Linked Goals"
          linked={linkedGoals}
          candidates={candidateGoals}
          labelOf={(i) => i.title ?? ''}
          onLink={(id) => updateGoal(id, { projectId })}
          onUnlink={(id) => updateGoal(id, { projectId: null })}
          onChanged={reloadLinks}
        />
      ) : null}

      {!isCreate && projectId ? (
        <Button label="Delete Project" variant="danger" onPress={handleDelete} disabled={saving} />
      ) : null}
    </View>
  );
}

type Item = { id: string; title?: string; name?: string };

function AssociationSection({
  title,
  linked,
  candidates,
  labelOf,
  onLink,
  onUnlink,
  onChanged,
}: {
  title: string;
  linked: Item[];
  candidates: Item[];
  labelOf: (item: Item) => string;
  onLink: (id: string) => void | Promise<void>;
  onUnlink: (id: string) => void | Promise<void>;
  onChanged: () => void | Promise<void>;
}) {
  const { tokens } = useAppTheme();
  if (linked.length === 0 && candidates.length === 0) return null;
  return (
    <View className="mt-2">
      <Text className="mb-2 text-sm font-semibold" style={{ color: tokens.text }}>
        {title}
      </Text>
      {linked.map((item) => (
        <View
          key={item.id}
          className="mb-2 flex-row items-center justify-between rounded-xl border p-2"
          style={{ borderColor: tokens.border }}
        >
          <Text className="flex-1 text-sm" style={{ color: tokens.text }} numberOfLines={1}>
            {labelOf(item)}
          </Text>
          <IconButton
            icon="link-off"
            onPress={async () => {
              await onUnlink(item.id);
              await onChanged();
            }}
            accessibilityLabel={`Unlink ${labelOf(item)}`}
          />
        </View>
      ))}
      {candidates.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          className="mb-2 flex-row items-center gap-2 rounded-xl border p-2"
          style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
          onPress={async () => {
            await onLink(item.id);
            await onChanged();
          }}
        >
          <Text style={{ fontSize: 18 }}>•</Text>
          <Text className="flex-1 text-sm" style={{ color: tokens.textMuted }} numberOfLines={1}>
            {labelOf(item)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
