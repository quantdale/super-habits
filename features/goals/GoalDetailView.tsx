import { useCallback, useEffect, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Button } from '@/core/ui/Button';
import { IconButton } from '@/core/ui/IconButton';
import { TextField } from '@/core/ui/TextField';
import { SECTION_COLORS } from '@/constants/sectionColors';
import {
  addGoal,
  getGoal,
  getGoalRollup,
  listHabitsForGoal,
  listTodosForGoal,
  softDeleteGoal,
  updateGoal,
} from '@/features/goals/goals.data';
import {
  GOAL_HORIZON_LABELS,
  GOAL_HORIZON_VALUES,
  GOAL_STATUS_LABELS,
  GOAL_STATUS_VALUES,
  type GoalInput,
} from '@/features/goals/goals.types';
import {
  GOAL_DESCRIPTION_MAX,
  GOAL_TITLE_MAX,
  computeGoalRollup,
  describeGoalHorizon,
  parseGoalProgressText,
  validateGoalInput,
} from '@/features/goals/goals.domain';
import { listTodos, setTodoProjectGoal } from '@/features/todos/todos.data';
import { listProjects } from '@/features/projects/projects.data';
import type { GoalHorizon, GoalStatus } from '@/core/db/types';

type GoalDetailViewProps = {
  goalId: string | null;
  onBack: () => void;
  /** Optional goal→project navigation hook (wired by the planning hub). */
  onOpenProject?: (projectId: string) => void;
};

export function GoalDetailView({ goalId, onBack, onOpenProject }: GoalDetailViewProps) {
  const { tokens } = useAppTheme();
  const isCreate = goalId === null;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [horizon, setHorizon] = useState<GoalHorizon>('month');
  const [status, setStatus] = useState<GoalStatus>('active');
  const [progress, setProgress] = useState(0);
  const [targetDate, setTargetDate] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [linkedTodos, setLinkedTodos] = useState<{ id: string; title: string }[]>([]);
  const [candidateTodos, setCandidateTodos] = useState<{ id: string; title: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [progressText, setProgressText] = useState('0');
  const [progressError, setProgressError] = useState<string | null>(null);
  const [rollup, setRollup] = useState<{
    todos: { total: number; done: number };
    habits: { habitCount: number; completionsInWindow: number; windowDays: number };
  } | null>(null);
  const [linkedHabits, setLinkedHabits] = useState<{ id: string; name: string }[]>([]);

  const reloadLinks = useCallback(async () => {
    if (isCreate || !goalId) return;
    const [todos, habits, nextRollup] = await Promise.all([
      listTodosForGoal(goalId),
      listHabitsForGoal(goalId),
      getGoalRollup(goalId),
    ]);
    setLinkedTodos(todos.map((t) => ({ id: t.id, title: t.title })));
    setLinkedHabits(habits);
    setRollup(nextRollup);
    const all = await listTodos();
    const linkedIds = new Set(todos.map((t) => t.id));
    setCandidateTodos(
      all
        .filter((t) => !t.completed && !t.goal_id && !linkedIds.has(t.id))
        .slice(0, 20)
        .map((t) => ({ id: t.id, title: t.title })),
    );
  }, [isCreate, goalId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const projectList = await listProjects();
      if (!active) return;
      setProjects(projectList.map((p) => ({ id: p.id, name: p.name })));
      if (isCreate || !goalId) return;
      const goal = await getGoal(goalId);
      if (!active || !goal) return;
      setTitle(goal.title);
      setDescription(goal.description ?? '');
      setHorizon(goal.horizon);
      setStatus(goal.status);
      setProgress(goal.progress_percent);
      setProgressText(String(goal.progress_percent));
      setTargetDate(goal.target_date ?? '');
      setProjectId(goal.project_id);
      await reloadLinks();
    })();
    return () => {
      active = false;
    };
  }, [goalId, isCreate, reloadLinks]);

  const handleSave = useCallback(async () => {
    setError(null);
    const input: GoalInput = {
      title,
      description,
      horizon,
      status,
      progressPercent: progress,
      targetDate: targetDate || null,
      projectId,
    };
    const validation = validateGoalInput(input);
    if (!validation.ok) {
      setError(
        validation.title ?? validation.description ?? validation.targetDate ?? 'Check the fields.',
      );
      return;
    }
    setSaving(true);
    try {
      if (isCreate) {
        await addGoal(input);
      } else if (goalId) {
        await updateGoal(goalId, input);
      }
      onBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save goal.');
    } finally {
      setSaving(false);
    }
  }, [
    title,
    description,
    horizon,
    status,
    progress,
    targetDate,
    projectId,
    isCreate,
    goalId,
    onBack,
  ]);

  const handleDelete = useCallback(async () => {
    if (isCreate || !goalId) return;
    await softDeleteGoal(goalId);
    onBack();
  }, [isCreate, goalId, onBack]);

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <IconButton icon="arrow-back" onPress={onBack} accessibilityLabel="Back to goals" />
        <Text className="text-lg font-bold" style={{ color: tokens.text }}>
          {isCreate ? 'New Goal' : 'Goal'}
        </Text>
        <View className="w-11" />
      </View>

      <TextField
        label="Title"
        value={title}
        onChangeText={setTitle}
        placeholder="Goal title"
        accessibilityLabel={`Goal title, up to ${GOAL_TITLE_MAX} chars`}
      />
      <TextField
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Optional"
        accessibilityLabel={`Goal description, up to ${GOAL_DESCRIPTION_MAX} chars`}
      />
      <TextField
        label="Target date (YYYY-MM-DD)"
        value={targetDate}
        onChangeText={setTargetDate}
        placeholder="Optional"
      />

      <Text className="mb-1.5 text-sm font-medium" style={{ color: tokens.textMuted }}>
        Horizon
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {GOAL_HORIZON_VALUES.map((h) => (
          <Pressable
            key={h}
            accessibilityRole="button"
            accessibilityLabel={GOAL_HORIZON_LABELS[h]}
            className="rounded-full border px-4 py-2"
            style={
              horizon === h
                ? { backgroundColor: SECTION_COLORS.todos, borderColor: SECTION_COLORS.todos }
                : { borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }
            }
            onPress={() => setHorizon(h)}
          >
            <Text style={{ color: horizon === h ? tokens.textOnAccent : tokens.textMuted }}>
              {GOAL_HORIZON_LABELS[h]}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
        {describeGoalHorizon(horizon).cadenceHint}
      </Text>

      <Text className="mb-1.5 mt-2 text-sm font-medium" style={{ color: tokens.textMuted }}>
        Status
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {GOAL_STATUS_VALUES.map((s) => (
          <Pressable
            key={s}
            accessibilityRole="button"
            accessibilityLabel={GOAL_STATUS_LABELS[s]}
            className="rounded-full border px-4 py-2"
            style={
              status === s
                ? { backgroundColor: SECTION_COLORS.todos, borderColor: SECTION_COLORS.todos }
                : { borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }
            }
            onPress={() => setStatus(s)}
          >
            <Text style={{ color: status === s ? tokens.textOnAccent : tokens.textMuted }}>
              {GOAL_STATUS_LABELS[s]}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="mt-2">
        <Text className="mb-1.5 text-sm font-medium" style={{ color: tokens.textMuted }}>
          Progress (0–100)
        </Text>
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <TextField
              label=""
              value={progressText}
              onChangeText={(text) => {
                setProgressText(text);
                const parsed = parseGoalProgressText(text);
                if (parsed.ok) {
                  setProgressError(null);
                  setProgress(parsed.value);
                } else {
                  setProgressError(parsed.error);
                }
              }}
              keyboardType="number-pad"
              placeholder="0"
              accessibilityLabel="Goal progress percent, 0 to 100"
            />
          </View>
          <Button
            label="-10"
            onPress={() => {
              const next = Math.max(0, progress - 10);
              setProgress(next);
              setProgressText(String(next));
              setProgressError(null);
            }}
            variant="ghost"
          />
          <Button
            label="+10"
            onPress={() => {
              const next = Math.min(100, progress + 10);
              setProgress(next);
              setProgressText(String(next));
              setProgressError(null);
            }}
            variant="ghost"
          />
        </View>
        {progressError ? (
          <Text className="mt-1 text-xs" style={{ color: tokens.dangerSolid }}>
            {progressError}
          </Text>
        ) : null}
        <View
          className="mt-2 h-3 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: tokens.surfaceElevated }}
        >
          <View
            className="h-3 rounded-full"
            style={{ width: `${progress}%`, backgroundColor: SECTION_COLORS.todos }}
          />
        </View>
      </View>

      {!isCreate && rollup ? (
        <GoalRollupPanel
          rollup={rollup}
          onApplySuggestion={async (percent) => {
            setProgress(percent);
            setProgressText(String(percent));
            if (goalId) await updateGoal(goalId, { progressPercent: percent });
          }}
        />
      ) : null}

      {projects.length > 0 ? (
        <View className="mt-2">
          <Text className="mb-1.5 text-sm font-medium" style={{ color: tokens.textMuted }}>
            Project
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <Pressable
              accessibilityRole="button"
              className="rounded-full border px-4 py-2"
              style={
                projectId === null
                  ? { backgroundColor: SECTION_COLORS.todos, borderColor: SECTION_COLORS.todos }
                  : { borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }
              }
              onPress={() => setProjectId(null)}
            >
              <Text style={{ color: projectId === null ? tokens.textOnAccent : tokens.textMuted }}>
                None
              </Text>
            </Pressable>
            {projects.map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                className="rounded-full border px-4 py-2"
                style={
                  projectId === p.id
                    ? { backgroundColor: SECTION_COLORS.todos, borderColor: SECTION_COLORS.todos }
                    : { borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }
                }
                onPress={() => setProjectId(p.id)}
              >
                <Text
                  style={{ color: projectId === p.id ? tokens.textOnAccent : tokens.textMuted }}
                  numberOfLines={1}
                >
                  {p.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {error ? (
        <Text className="text-sm" style={{ color: tokens.dangerSolid }}>
          {error}
        </Text>
      ) : null}

      {!isCreate && projectId && onOpenProject ? (
        <Button
          label="Open linked project"
          variant="ghost"
          onPress={() => onOpenProject(projectId)}
        />
      ) : null}

      <Button
        label={isCreate ? 'Create Goal' : 'Save Goal'}
        onPress={handleSave}
        disabled={saving}
        color={SECTION_COLORS.todos}
      />

      {!isCreate && goalId ? (
        <View className="mt-2">
          <Text className="mb-2 text-sm font-semibold" style={{ color: tokens.text }}>
            Linked Tasks
          </Text>
          {linkedTodos.map((t) => (
            <View
              key={t.id}
              className="mb-2 flex-row items-center justify-between rounded-xl border p-2"
              style={{ borderColor: tokens.border }}
            >
              <Text className="flex-1 text-sm" style={{ color: tokens.text }} numberOfLines={1}>
                {t.title}
              </Text>
              <IconButton
                icon="link-off"
                onPress={async () => {
                  await setTodoProjectGoal(t.id, { goalId: null });
                  await reloadLinks();
                }}
                accessibilityLabel={`Unlink ${t.title}`}
              />
            </View>
          ))}
          {candidateTodos.map((t) => (
            <Pressable
              key={t.id}
              accessibilityRole="button"
              className="mb-2 flex-row items-center gap-2 rounded-xl border p-2"
              style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
              onPress={async () => {
                await setTodoProjectGoal(t.id, { goalId });
                await reloadLinks();
              }}
            >
              <MaterialIcons name="add" size={18} color={tokens.iconMuted} />
              <Text
                className="flex-1 text-sm"
                style={{ color: tokens.textMuted }}
                numberOfLines={1}
              >
                {t.title}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {!isCreate && goalId ? (
        <Button label="Delete Goal" variant="danger" onPress={handleDelete} disabled={saving} />
      ) : null}
    </View>
  );
}

function GoalRollupPanel({
  rollup,
  onApplySuggestion,
}: {
  rollup: {
    todos: { total: number; done: number };
    habits: { habitCount: number; completionsInWindow: number; windowDays: number };
  };
  onApplySuggestion: (percent: number) => void | Promise<void>;
}) {
  const { tokens } = useAppTheme();
  const [applying, setApplying] = useState(false);
  const summary = computeGoalRollup({
    todos: rollup.todos,
    habits: rollup.habits,
  });

  if (summary.isEmpty) return null;

  return (
    <View
      className="mt-2 rounded-2xl border p-3"
      style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
      accessibilityLabel={`Linked-entity rollup suggests ${summary.suggestedPercent} percent`}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
          Linked progress
        </Text>
        <Text className="text-sm font-bold" style={{ color: tokens.text }}>
          {summary.suggestedPercent}%
        </Text>
      </View>
      <Text className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
        {rollup.todos.total > 0
          ? `${rollup.todos.done}/${rollup.todos.total} linked tasks done`
          : 'No linked tasks'}
        {rollup.habits.habitCount > 0
          ? ` · ${rollup.habits.completionsInWindow} habit check-ins in ${rollup.habits.windowDays}d across ${rollup.habits.habitCount} habit(s)`
          : ''}
      </Text>
      <View className="mt-2">
        <Button
          label={`Set progress to ${summary.suggestedPercent}%`}
          variant="ghost"
          disabled={applying}
          onPress={async () => {
            setApplying(true);
            try {
              await onApplySuggestion(summary.suggestedPercent);
            } finally {
              setApplying(false);
            }
          }}
        />
      </View>
    </View>
  );
}
