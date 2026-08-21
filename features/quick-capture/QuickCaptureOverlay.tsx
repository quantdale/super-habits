import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Button } from '@/core/ui/Button';
import { PillChip } from '@/core/ui/PillChip';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { useAppNavigation } from '@/core/providers/navigationContext';
import { addTodo, removeTodo } from '@/features/todos/todos.data';
import { addHabit, deleteHabit } from '@/features/habits/habits.data';
import {
  addCalorieEntry,
  deleteCalorieEntry,
  listCalorieEntries,
} from '@/features/calories/calories.data';
import { addProject, listProjects, softDeleteProject } from '@/features/projects/projects.data';
import { addGoal, listGoals, softDeleteGoal } from '@/features/goals/goals.data';
import { PROJECT_COLORS } from '@/features/projects/projects.types';
import { parseQuickCapture } from '@/features/quick-capture/quickCapture.domain';
import {
  pushRecentCapture,
  removeRecentCapture,
  undoRecentCapture,
  type RecentCapture,
} from '@/features/quick-capture/recentCaptures';
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
  const [priorityTouched, setPriorityTouched] = useState(false);
  const [mealType, setMealType] = useState<(typeof MEAL_TYPES)[number]>('breakfast');
  const [calories, setCalories] = useState('');
  const [projectLink, setProjectLink] = useState<string | null>(null);
  const [goalLink, setGoalLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [recent, setRecent] = useState<RecentCapture[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const refreshOptions = useCallback(async () => {
    const [ps, gs] = await Promise.all([listProjects(), listGoals()]);
    setProjects(ps.map((p) => ({ id: p.id, name: p.name })));
    setGoals(gs.map((g) => ({ id: g.id, title: g.title })));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional async data-load
    void refreshOptions();
  }, [refreshOptions]);

  // Live natural-language parse preview for todo mode (parser stays pure;
  // the loaded lists are passed in here).
  const parsed = useMemo(() => {
    if (mode !== 'todo') return null;
    return parseQuickCapture(title, {
      projects,
      goals: goals.map((g) => ({ id: g.id, name: g.title })),
    });
  }, [mode, title, projects, goals]);

  const resetForm = useCallback(() => {
    setTitle('');
    setCalories('');
    setPriority('normal');
    setPriorityTouched(false);
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

  const pushRecent = useCallback((entry: RecentCapture) => {
    setRecent((prev) => pushRecentCapture(prev, entry));
  }, []);

  const handleUndo = useCallback(
    async (key: string) => {
      try {
        const { removed } = await undoRecentCapture(recent, key);
        if (removed) {
          setRecent((prev) => removeRecentCapture(prev, key));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Undo failed.');
      }
    },
    [recent],
  );

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'todo') {
        if (!parsed || !parsed.title) {
          setError('Task title is required.');
          return;
        }
        const id = await addTodo({
          title: parsed.title,
          priority: priorityTouched ? priority : parsed.priority,
          dueDate: parsed.dueDateKey,
          projectId: parsed.projectId ?? projectLink,
          goalId: parsed.goalId,
        });
        pushRecent({
          key: `todo:${id}`,
          label: `Task · ${parsed.title}`,
          undo: () => removeTodo(id),
        });
      } else if (mode === 'habit') {
        if (!title.trim()) {
          setError('Habit name is required.');
          return;
        }
        const id = await addHabit(
          title.trim(),
          1,
          'anytime',
          undefined,
          undefined,
          undefined,
          null,
          projectLink,
        );
        pushRecent({
          key: `habit:${id}`,
          label: `Habit · ${title.trim()}`,
          undo: () => deleteHabit(id),
        });
      } else if (mode === 'calorie') {
        const cal = Number(calories);
        if (!title.trim() || !Number.isFinite(cal) || cal <= 0) {
          setError('Food name and a positive calorie amount are required.');
          return;
        }
        const capturedFood = title.trim();
        await addCalorieEntry({ foodName: capturedFood, calories: cal, mealType });
        pushRecent({
          key: `calorie:${Date.now()}`,
          label: `${capturedFood} · ${cal} kcal`,
          undo: async () => {
            // addCalorieEntry does not return the row id; resolve the
            // just-added entry from today's newest-first list before deleting.
            const entries = await listCalorieEntries();
            const match = entries.find(
              (entry) =>
                entry.food_name === capturedFood &&
                entry.calories === cal &&
                entry.meal_type === mealType,
            );
            if (!match) return;
            await deleteCalorieEntry(match.id);
          },
        });
      } else if (mode === 'project') {
        if (!title.trim()) {
          setError('Project name is required.');
          return;
        }
        const id = await addProject({ name: title.trim(), color: PROJECT_COLORS[0] });
        pushRecent({
          key: `project:${id}`,
          label: `Project · ${title.trim()}`,
          undo: () => softDeleteProject(id),
        });
      } else if (mode === 'goal') {
        if (!title.trim()) {
          setError('Goal title is required.');
          return;
        }
        const id = await addGoal({ title: title.trim(), horizon: 'month', projectId: goalLink });
        pushRecent({
          key: `goal:${id}`,
          label: `Goal · ${title.trim()}`,
          undo: () => softDeleteGoal(id),
        });
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
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    mode,
    parsed,
    priorityTouched,
    priority,
    projectLink,
    goalLink,
    title,
    calories,
    mealType,
    setActiveSection,
    closeQuickCapture,
    resetForm,
    refreshOptions,
    pushRecent,
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
          <CaptureInput
            label={mode === 'calorie' ? 'Food name' : mode === 'habit' ? 'Habit name' : 'Title'}
            value={title}
            onChangeText={setTitle}
            placeholder={
              mode === 'todo'
                ? 'e.g. Pay rent tomorrow !urgent #home'
                : mode === 'calorie'
                  ? 'e.g. Chicken breast'
                  : 'Name'
            }
            onSubmitEditing={handleSubmit}
          />

          {parsed &&
          (parsed.dueDateKey ||
            parsed.priority !== 'normal' ||
            parsed.projectId ||
            parsed.goalId) ? (
            <View className="flex-row flex-wrap gap-2">
              {parsed.dueDateKey ? (
                <View
                  className="rounded-full border px-3 py-1"
                  style={{ borderColor: tokens.border }}
                >
                  <Text className="text-xs" style={{ color: tokens.textMuted }}>
                    Due {parsed.dueDateKey}
                  </Text>
                </View>
              ) : null}
              {parsed.priority !== 'normal' && !priorityTouched ? (
                <View
                  className="rounded-full border px-3 py-1"
                  style={{ borderColor: tokens.border }}
                >
                  <Text className="text-xs" style={{ color: tokens.textMuted }}>
                    {parsed.priority}
                  </Text>
                </View>
              ) : null}
              {parsed.matchedProjectName ? (
                <View
                  className="rounded-full border px-3 py-1"
                  style={{ borderColor: tokens.border }}
                >
                  <Text className="text-xs" style={{ color: tokens.textMuted }} numberOfLines={1}>
                    #{parsed.matchedProjectName}
                  </Text>
                </View>
              ) : null}
              {parsed.matchedGoalName ? (
                <View
                  className="rounded-full border px-3 py-1"
                  style={{ borderColor: tokens.border }}
                >
                  <Text className="text-xs" style={{ color: tokens.textMuted }} numberOfLines={1}>
                    @{parsed.matchedGoalName}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {mode === 'todo' ? (
            <View className="flex-row flex-wrap gap-2">
              {PRIORITIES.map((p) => (
                <PillChip
                  key={p}
                  label={p}
                  active={priorityTouched ? priority === p : p === (parsed?.priority ?? 'normal')}
                  color={SECTION_COLORS.todos}
                  onPress={() => {
                    setPriority(p);
                    setPriorityTouched(true);
                  }}
                />
              ))}
            </View>
          ) : null}

          {mode === 'calorie' ? (
            <>
              <CaptureInput
                label="Calories"
                value={calories}
                onChangeText={setCalories}
                keyboardType="numeric"
                placeholder="0"
                onSubmitEditing={handleSubmit}
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

          <Button
            label={submitting ? 'Capturing…' : 'Capture'}
            onPress={handleSubmit}
            color={SECTION_COLORS.todos}
          />

          {recent.length > 0 ? (
            <View className="gap-2">
              <Text className="text-sm font-medium" style={{ color: tokens.textMuted }}>
                Recent captures
              </Text>
              {recent.map((r) => (
                <View
                  key={r.key}
                  className="flex-row items-center justify-between gap-3 rounded-xl border px-3 py-2"
                  style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
                >
                  <Text className="flex-1 text-xs" style={{ color: tokens.text }} numberOfLines={1}>
                    {r.label}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Undo ${r.label}`}
                    onPress={() => void handleUndo(r.key)}
                    hitSlop={8}
                  >
                    <Text className="text-xs font-semibold" style={{ color: tokens.dangerSolid }}>
                      Undo
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <Button label="Done" variant="ghost" onPress={closeQuickCapture} />
        </>
      )}
    </View>
  );
}

/** Local text field with Enter-to-submit (core/ui TextField has no submit hook). */
function CaptureInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  onSubmitEditing,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  onSubmitEditing: () => void;
}) {
  const { tokens } = useAppTheme();
  return (
    <View className="mb-3">
      <Text className="mb-1.5 text-sm font-medium" style={{ color: tokens.textMuted }}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        className="rounded-2xl border px-4 py-3 text-base"
        style={{
          minHeight: 48,
          borderColor: tokens.border,
          backgroundColor: tokens.surfaceElevated,
          color: tokens.text,
        }}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.textMuted}
        keyboardType={keyboardType}
        returnKeyType="done"
        submitBehavior="submit"
        blurOnSubmit={false}
        onSubmitEditing={onSubmitEditing}
      />
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
