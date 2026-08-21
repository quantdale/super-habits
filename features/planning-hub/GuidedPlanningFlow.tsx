import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Button } from '@/core/ui/Button';
import { TextField } from '@/core/ui/TextField';
import { NumberStepperField } from '@/core/ui/NumberStepperField';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { toDateKey } from '@/lib/time';
import {
  carryForwardFromPreviousDay,
  getDailyPlan,
  upsertDailyPlan,
} from '@/features/daily-plan/dailyPlan.data';
import { parseTopTodoIds, parseTopTodoTitles } from '@/features/daily-plan/dailyPlan.domain';
import { MAX_TOP_PRIORITIES } from '@/features/daily-plan/dailyPlan.types';
import { listTodos } from '@/features/todos/todos.data';
import type { Todo } from '@/core/db/types';
import {
  isGuidedPlanningDismissed,
  setGuidedPlanningDismissed,
} from '@/features/planning-hub/guidedPlanning.storage';

type GuidedPlanningFlowProps = {
  /** Bump to refresh sibling surfaces after a guided save. */
  onPlanSaved?: () => void;
};

const STEPS = ['Carry-over', 'Commitments', 'Priorities', 'Focus', 'Confirm'] as const;

function shiftDateKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/**
 * Skippable five-step guided planning sequence for the Planning Hub Today
 * tab (carry-over → commitments → priorities → focus → confirm). Purely a
 * friendlier front door over the existing daily-plan data functions; the
 * full DailyPlanView below remains the complete editor.
 */
export function GuidedPlanningFlow({ onPlanSaved }: GuidedPlanningFlowProps) {
  const { tokens } = useAppTheme();
  const todayKey = toDateKey();
  const yesterdayKey = shiftDateKey(todayKey, -1);

  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);

  // Step 1 — carry-over review.
  const [yesterdayUnfinished, setYesterdayUnfinished] = useState<string[]>([]);
  const [carryingForward, setCarryingForward] = useState(false);

  // Step 2 — fixed commitments (read-only).
  const [overdueTodos, setOverdueTodos] = useState<Todo[]>([]);
  const [dueTodayTodos, setDueTodayTodos] = useState<Todo[]>([]);

  // Step 3 — priority selection (writes only at confirm).
  const [pendingTodos, setPendingTodos] = useState<
    { id: string; title: string; dueDate: string | null }[]
  >([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Step 4/5 — focus + intention, then save.
  const [focusMinutes, setFocusMinutes] = useState('25');
  const [intention, setIntention] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const dismissedFlag = await isGuidedPlanningDismissed();
        if (!active) return;
        setDismissed(dismissedFlag);
        if (dismissedFlag) {
          setLoading(false);
          return;
        }
        const [yesterdayPlan, todos] = await Promise.all([
          getDailyPlan(yesterdayKey).catch(() => null),
          listTodos(),
        ]);
        if (!active) return;
        if (yesterdayPlan) {
          const ids = parseTopTodoIds(yesterdayPlan.top_todo_ids);
          const titles = parseTopTodoTitles(yesterdayPlan.top_todo_titles);
          const completedIds = new Set(todos.filter((t) => t.completed === 1).map((t) => t.id));
          setYesterdayUnfinished(
            ids
              .filter((id) => !completedIds.has(id))
              .map(
                (id, i) => titles[i] ?? todos.find((t) => t.id === id)?.title ?? 'A past priority',
              ),
          );
        }
        const open = todos.filter((t) => t.completed === 0);
        setOverdueTodos(
          open.filter((t) => t.due_date !== null && t.due_date < todayKey).slice(0, 5),
        );
        setDueTodayTodos(open.filter((t) => t.due_date === todayKey).slice(0, 5));
        setPendingTodos(
          open
            .map((t) => ({ id: t.id, title: t.title, dueDate: t.due_date }))
            .sort((a, b) => {
              if (a.dueDate === b.dueDate) return 0;
              if (a.dueDate === null) return 1;
              if (b.dueDate === null) return -1;
              return a.dueDate < b.dueDate ? -1 : 1;
            }),
        );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [todayKey, yesterdayKey]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    void setGuidedPlanningDismissed(true);
  }, []);

  const togglePriority = useCallback((todoId: string) => {
    setSelectedIds((current) => {
      if (current.includes(todoId)) {
        return current.filter((id) => id !== todoId);
      }
      if (current.length >= MAX_TOP_PRIORITIES) {
        return current;
      }
      return [...current, todoId];
    });
  }, []);

  const handleCarryForward = useCallback(async () => {
    setCarryingForward(true);
    setError(null);
    try {
      await carryForwardFromPreviousDay(todayKey);
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not carry forward.');
    } finally {
      setCarryingForward(false);
    }
  }, [todayKey]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await upsertDailyPlan(todayKey, {
        intention,
        notes: '',
        reflection: '',
        energyScore: null,
        focusTargetMinutes: Math.min(Number(focusMinutes.replace(/\D/g, '')) || 0, 24 * 60),
        topTodoIds: selectedIds,
        status: 'committed',
      });
      setSaved(true);
      onPlanSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the plan.');
    } finally {
      setSaving(false);
    }
  }, [todayKey, intention, focusMinutes, selectedIds, onPlanSaved]);

  if (dismissed || loading) {
    return null;
  }

  if (saved) {
    return (
      <View
        className="rounded-2xl border p-4"
        style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
      >
        <Text className="text-base font-semibold" style={{ color: SECTION_COLORS.todos }}>
          {"Today's plan is set."}
        </Text>
        <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
          Adjust anything below whenever the day changes.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hide guided planning"
          className="self-start rounded-full border px-3 py-2"
          style={{
            marginTop: 12,
            borderColor: tokens.border,
            backgroundColor: tokens.surfaceElevated,
          }}
          onPress={dismiss}
        >
          <Text className="text-sm" style={{ color: tokens.text }}>
            Use simple view next time
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      className="rounded-2xl border p-4"
      style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
    >
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-base font-semibold" style={{ color: tokens.text }}>
          Plan your day · {STEPS[step]}
        </Text>
        <Text className="text-xs" style={{ color: tokens.textMuted }}>
          Step {step + 1} of {STEPS.length}
        </Text>
      </View>

      {error ? (
        <Text className="mb-2 text-sm" style={{ color: tokens.dangerText }}>
          {error}
        </Text>
      ) : null}

      {step === 0 ? (
        <View>
          {yesterdayUnfinished.length === 0 ? (
            <Text className="text-sm" style={{ color: tokens.textMuted }}>
              Nothing left over from yesterday. Fresh start.
            </Text>
          ) : (
            <>
              <Text className="mb-2 text-sm" style={{ color: tokens.textMuted }}>
                Still open from yesterday:
              </Text>
              {yesterdayUnfinished.slice(0, 3).map((title) => (
                <Text
                  key={title}
                  className="text-sm"
                  style={{ color: tokens.text }}
                  numberOfLines={1}
                >
                  • {title}
                </Text>
              ))}
            </>
          )}
          <View className="mt-3 flex-row gap-2">
            {yesterdayUnfinished.length > 0 ? (
              <View className="flex-1">
                <Button
                  label={carryingForward ? 'Carrying…' : 'Carry forward'}
                  onPress={() => void handleCarryForward()}
                  disabled={carryingForward}
                  color={SECTION_COLORS.todos}
                />
              </View>
            ) : null}
            <View className="flex-1">
              <Button label="Start fresh" onPress={() => setStep(1)} variant="ghost" />
            </View>
          </View>
        </View>
      ) : null}

      {step === 1 ? (
        <View>
          {overdueTodos.length === 0 && dueTodayTodos.length === 0 ? (
            <Text className="text-sm" style={{ color: tokens.textMuted }}>
              No deadlines today. Your time is yours.
            </Text>
          ) : (
            <>
              {overdueTodos.length > 0 ? (
                <Text className="mb-1 text-sm font-medium" style={{ color: tokens.warningText }}>
                  Overdue ({overdueTodos.length})
                </Text>
              ) : null}
              {overdueTodos.map((t) => (
                <Text
                  key={t.id}
                  className="text-sm"
                  style={{ color: tokens.text }}
                  numberOfLines={1}
                >
                  • {t.title}
                </Text>
              ))}
              {dueTodayTodos.length > 0 ? (
                <Text className="mb-1 mt-2 text-sm font-medium" style={{ color: tokens.text }}>
                  Due today ({dueTodayTodos.length})
                </Text>
              ) : null}
              {dueTodayTodos.map((t) => (
                <Text
                  key={t.id}
                  className="text-sm"
                  style={{ color: tokens.text }}
                  numberOfLines={1}
                >
                  • {t.title}
                </Text>
              ))}
            </>
          )}
          <View className="mt-3">
            <Button label="Next" onPress={() => setStep(2)} variant="ghost" />
          </View>
        </View>
      ) : null}

      {step === 2 ? (
        <View>
          <Text className="mb-2 text-sm" style={{ color: tokens.textMuted }}>
            What matters most? Pick up to {MAX_TOP_PRIORITIES}. ({selectedIds.length}/
            {MAX_TOP_PRIORITIES})
          </Text>
          {pendingTodos.slice(0, 10).map((t) => {
            const selected = selectedIds.includes(t.id);
            return (
              <Pressable
                key={t.id}
                accessibilityRole="button"
                accessibilityLabel={`Prioritize ${t.title}`}
                accessibilityState={{ selected }}
                className="mb-2 min-h-[44px] flex-row items-center gap-2 rounded-xl border p-2"
                style={{
                  borderColor: selected ? SECTION_COLORS.todos : tokens.border,
                  backgroundColor: selected ? tokens.surfaceActive : tokens.surfaceElevated,
                }}
                onPress={() => togglePriority(t.id)}
              >
                <Text
                  style={{
                    fontSize: 16,
                    color: selected ? SECTION_COLORS.todos : tokens.textMuted,
                  }}
                >
                  {selected ? '✓' : '•'}
                </Text>
                <Text
                  className="flex-1 text-sm"
                  style={{ color: selected ? tokens.text : tokens.textMuted }}
                  numberOfLines={1}
                >
                  {t.title}
                </Text>
              </Pressable>
            );
          })}
          <View className="mt-1 flex-row gap-2">
            <View className="flex-1">
              <Button label="Back" onPress={() => setStep(1)} variant="ghost" />
            </View>
            <View className="flex-1">
              <Button label="Next" onPress={() => setStep(3)} variant="ghost" />
            </View>
          </View>
        </View>
      ) : null}

      {step === 3 ? (
        <View>
          <TextField
            label="Intention"
            value={intention}
            onChangeText={setIntention}
            placeholder="What is the one thing that matters most today?"
          />
          <NumberStepperField
            label="Focus target (minutes)"
            value={focusMinutes}
            onChange={setFocusMinutes}
            min={0}
            max={480}
            placeholder="0"
          />
          <View className="mt-1 flex-row gap-2">
            <View className="flex-1">
              <Button label="Back" onPress={() => setStep(2)} variant="ghost" />
            </View>
            <View className="flex-1">
              <Button label="Next" onPress={() => setStep(4)} variant="ghost" />
            </View>
          </View>
        </View>
      ) : null}

      {step === 4 ? (
        <View>
          <Text className="text-sm" style={{ color: tokens.text }}>
            {selectedIds.length} priorit{selectedIds.length === 1 ? 'y' : 'ies'} ·{' '}
            {Number(focusMinutes.replace(/\D/g, '')) || 0} focus minutes planned
          </Text>
          <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
            A realistic plan beats a perfect one.
          </Text>
          <View className="mt-3 flex-row gap-2">
            <View className="flex-1">
              <Button label="Back" onPress={() => setStep(3)} variant="ghost" />
            </View>
            <View className="flex-1">
              <Button
                label={saving ? 'Saving…' : 'Save plan'}
                onPress={() => void handleSave()}
                disabled={saving}
                color={SECTION_COLORS.todos}
              />
            </View>
          </View>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Use simple view"
        className="self-start pt-3"
        onPress={dismiss}
      >
        <Text className="text-xs underline" style={{ color: tokens.textMuted }}>
          Use simple view
        </Text>
      </Pressable>
    </View>
  );
}
