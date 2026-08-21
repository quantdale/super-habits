import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Button } from '@/core/ui/Button';
import { PillChip } from '@/core/ui/PillChip';
import { TextField } from '@/core/ui/TextField';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { useAppNavigation } from '@/core/providers/navigationContext';
import { addTodo } from '@/features/todos/todos.data';
import { addHabit } from '@/features/habits/habits.data';
import { addCalorieEntry } from '@/features/calories/calories.data';
import { addProject, listProjects } from '@/features/projects/projects.data';
import { addGoal, listGoals } from '@/features/goals/goals.data';
import { PROJECT_COLORS } from '@/features/projects/projects.types';
import type { TodoPriority } from '@/core/db/types';

type CaptureMode = 'todo' | 'habit' | 'calorie' | 'project' | 'goal' | 'focus';

const MODES: { key: CaptureMode; label: string }[] = [
  { key: 'todo', label: 'Task' },
  { key: 'habit', label: 'Habit' },
  { key: 'calorie', label: 'Calorie' },
  { key: 'project', label: 'Project' },
  { key: 'goal', label: 'Goal' },
  { key: 'focus', label: 'Focus' },
];

const PRIORITIES: TodoPriority[] = ['urgent', 'normal', 'low'];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export function QuickCaptureOverlay() {
  const { tokens } = useAppTheme();
  const { closeQuickCapture, setActiveSection } = useAppNavigation();
  const [mode, setMode] = useState<CaptureMode>('todo');
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [goals, setGoals] = useState<{ id: string; title: string }[]>([]);

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TodoPriority>('normal');
  const [mealType, setMealType] = useState<(typeof MEAL_TYPES)[number]>('breakfast');
  const [calories, setCalories] = useState('');
  const [projectLink, setProjectLink] = useState<string | null>(null);
  const [goalLink, setGoalLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const refreshOptions = useCallback(async () => {
    const [ps, gs] = await Promise.all([listProjects(), listGoals()]);
    setProjects(ps.map((p) => ({ id: p.id, name: p.name })));
    setGoals(gs.map((g) => ({ id: g.id, title: g.title })));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional async data-load
    void refreshOptions();
  }, [refreshOptions]);

  const resetForm = useCallback(() => {
    setTitle('');
    setCalories('');
    setPriority('normal');
    setProjectLink(null);
    setGoalLink(null);
    setError(null);
    setSaved(false);
  }, []);

  const switchMode = useCallback(
    (next: CaptureMode) => {
      setMode(next);
      resetForm();
    },
    [resetForm],
  );

  const handleSubmit = useCallback(async () => {
    setError(null);
    try {
      if (mode === 'todo') {
        if (!title.trim()) {
          setError('Task title is required.');
          return;
        }
        await addTodo({ title: title.trim(), priority, projectId: projectLink });
      } else if (mode === 'habit') {
        if (!title.trim()) {
          setError('Habit name is required.');
          return;
        }
        await addHabit(
          title.trim(),
          1,
          'anytime',
          undefined,
          undefined,
          undefined,
          null,
          projectLink,
        );
      } else if (mode === 'calorie') {
        const cal = Number(calories);
        if (!title.trim() || !Number.isFinite(cal) || cal <= 0) {
          setError('Food name and a positive calorie amount are required.');
          return;
        }
        await addCalorieEntry({ foodName: title.trim(), calories: cal, mealType });
      } else if (mode === 'project') {
        if (!title.trim()) {
          setError('Project name is required.');
          return;
        }
        await addProject({ name: title.trim(), color: PROJECT_COLORS[0] });
      } else if (mode === 'goal') {
        if (!title.trim()) {
          setError('Goal title is required.');
          return;
        }
        await addGoal({ title: title.trim(), horizon: 'month', projectId: goalLink });
      } else if (mode === 'focus') {
        setActiveSection('pomodoro');
        closeQuickCapture();
        return;
      }
      setSaved(true);
      resetForm();
      await refreshOptions();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not capture.');
    }
  }, [
    mode,
    title,
    priority,
    projectLink,
    calories,
    mealType,
    goalLink,
    setActiveSection,
    closeQuickCapture,
    resetForm,
    refreshOptions,
  ]);

  return (
    <View className="gap-3">
      <Text className="text-lg font-bold" style={{ color: tokens.text }}>
        Quick Capture
      </Text>
      <View className="flex-row flex-wrap">
        {MODES.map((m) => (
          <PillChip
            key={m.key}
            label={m.label}
            active={mode === m.key}
            color={SECTION_COLORS.todos}
            onPress={() => switchMode(m.key)}
          />
        ))}
      </View>

      {mode === 'focus' ? (
        <View className="items-center gap-3 py-4">
          <Text style={{ fontSize: 18 }}>•</Text>
          <Text className="text-base" style={{ color: tokens.text }}>
            Jump straight into a focus session.
          </Text>
          <Button label="Start Focus" onPress={handleSubmit} color={SECTION_COLORS.focus} />
        </View>
      ) : (
        <>
          <TextField
            label={mode === 'calorie' ? 'Food name' : mode === 'habit' ? 'Habit name' : 'Title'}
            value={title}
            onChangeText={setTitle}
            placeholder={mode === 'calorie' ? 'e.g. Chicken breast' : 'Name'}
          />

          {mode === 'todo' ? (
            <View className="flex-row flex-wrap gap-2">
              {PRIORITIES.map((p) => (
                <PillChip
                  key={p}
                  label={p}
                  active={priority === p}
                  color={SECTION_COLORS.todos}
                  onPress={() => setPriority(p)}
                />
              ))}
            </View>
          ) : null}

          {mode === 'calorie' ? (
            <>
              <TextField
                label="Calories"
                value={calories}
                onChangeText={setCalories}
                keyboardType="numeric"
                placeholder="0"
              />
              <View className="flex-row flex-wrap gap-2">
                {MEAL_TYPES.map((mt) => (
                  <PillChip
                    key={mt}
                    label={mt}
                    active={mealType === mt}
                    color={SECTION_COLORS.calories}
                    onPress={() => setMealType(mt)}
                  />
                ))}
              </View>
            </>
          ) : null}

          {mode === 'todo' || mode === 'habit' ? (
            <LinkPicker
              label="Project"
              options={projects}
              selectedId={projectLink}
              onSelect={setProjectLink}
            />
          ) : null}
          {mode === 'goal' ? (
            <LinkPicker
              label="Project"
              options={goals.map((g) => ({ id: g.id, name: g.title }))}
              selectedId={goalLink}
              onSelect={setGoalLink}
            />
          ) : null}

          {error ? (
            <Text className="text-sm" style={{ color: tokens.dangerSolid }}>
              {error}
            </Text>
          ) : null}
          {saved ? (
            <Text className="text-sm" style={{ color: SECTION_COLORS.habits }}>
              Captured.
            </Text>
          ) : null}

          <Button label="Capture" onPress={handleSubmit} color={SECTION_COLORS.todos} />
          <Button label="Done" variant="ghost" onPress={closeQuickCapture} />
        </>
      )}
    </View>
  );
}

function LinkPicker({
  label,
  options,
  selectedId,
  onSelect,
}: {
  label: string;
  options: { id: string; name: string }[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { tokens } = useAppTheme();
  if (options.length === 0) return null;
  return (
    <View className="mt-1">
      <Text className="mb-1.5 text-sm font-medium" style={{ color: tokens.textMuted }}>
        {label}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        <Pressable
          accessibilityRole="button"
          className="rounded-full border px-4 py-2"
          style={
            selectedId === null
              ? { backgroundColor: SECTION_COLORS.todos, borderColor: SECTION_COLORS.todos }
              : { borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }
          }
          onPress={() => onSelect(null)}
        >
          <Text style={{ color: selectedId === null ? tokens.textOnAccent : tokens.textMuted }}>
            None
          </Text>
        </Pressable>
        {options.map((o) => (
          <Pressable
            key={o.id}
            accessibilityRole="button"
            className="rounded-full border px-4 py-2"
            style={
              selectedId === o.id
                ? { backgroundColor: SECTION_COLORS.todos, borderColor: SECTION_COLORS.todos }
                : { borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }
            }
            onPress={() => onSelect(o.id)}
          >
            <Text
              style={{ color: selectedId === o.id ? tokens.textOnAccent : tokens.textMuted }}
              numberOfLines={1}
            >
              {o.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
