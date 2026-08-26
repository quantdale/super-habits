import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Button } from '@/core/ui/Button';
import { IconButton } from '@/core/ui/IconButton';
import { TextField } from '@/core/ui/TextField';
import { SECTION_COLORS } from '@/constants/sectionColors';
import {
  getDailyPlan,
  upsertDailyPlan,
  carryForwardFromPreviousDay,
  getDailyPlanAdherence,
} from '@/features/daily-plan/dailyPlan.data';
import {
  parseTopTodoIds,
  parseTopTodoTitles,
  toggleTopTodoId,
  normalizeEnergyScore,
} from '@/features/daily-plan/dailyPlan.domain';
import { MAX_TOP_PRIORITIES } from '@/features/daily-plan/dailyPlan.types';
import { DailyPlanHistoryView } from '@/features/daily-plan/DailyPlanHistoryView';
import { listPendingTodos } from '@/features/todos/todos.data';
import { listHabits } from '@/features/habits/habits.data';
import { isHabitScheduledOn } from '@/features/habits/habits.domain';
import { toDateKey } from '@/lib/time';
import { useGuardedAsyncRefresh } from '@/lib/useGuardedAsyncRefresh';
import { createEditableFieldOwner } from '@/lib/editableDraft';
import type { DailyPlan } from '@/core/db/types';

type DailyPlanViewProps = {
  dateKey?: string;
};

type EditableField =
  'intention' | 'notes' | 'reflection' | 'energyScore' | 'focusTarget' | 'topTodoIds';

type AdherenceSummary = {
  committedStreak: number;
  completedStreak: number;
};

export function DailyPlanView({ dateKey }: DailyPlanViewProps) {
  const { tokens } = useAppTheme();
  const today = dateKey ?? toDateKey();
  const { begin } = useGuardedAsyncRefresh();
  const draft = useMemo(() => createEditableFieldOwner<EditableField>(), []);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [intention, setIntention] = useState('');
  const [notes, setNotes] = useState('');
  const [reflection, setReflection] = useState('');
  const [energyScore, setEnergyScore] = useState<number | null>(null);
  const [focusTarget, setFocusTarget] = useState(0);
  const [topTodoIds, setTopTodoIds] = useState<string[]>([]);
  const [pendingTodos, setPendingTodos] = useState<{ id: string; title: string }[]>([]);
  const [scheduledHabits, setScheduledHabits] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [adherence, setAdherence] = useState<AdherenceSummary | null>(null);
  const [carryingForward, setCarryingForward] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const loadPlanData = useCallback(
    () =>
      Promise.all([
        getDailyPlan(today),
        listPendingTodos(),
        listHabits(),
        getDailyPlanAdherence().catch(() => null),
      ]),
    [today],
  );

  const applyLoadedPlan = useCallback(
    (isCurrent: () => boolean, data: Awaited<ReturnType<typeof loadPlanData>>) => {
      if (!isCurrent()) return;
      const [existing, todos, habits, adherenceSummary] = data;
      if (existing) {
        setPlan(existing);
        // Editable fields only adopt the persisted value when the user has not
        // edited them since this load began (F-01 / D3): a slow refresh can
        // never discard an in-progress user edit, while untouched fields still
        // hydrate normally.
        draft.applyIfPristine('intention', () => setIntention(existing.intention));
        draft.applyIfPristine('notes', () => setNotes(existing.notes));
        draft.applyIfPristine('reflection', () => setReflection(existing.reflection));
        draft.applyIfPristine('energyScore', () => setEnergyScore(existing.energy_score));
        draft.applyIfPristine('focusTarget', () => setFocusTarget(existing.focus_target_minutes));
        draft.applyIfPristine('topTodoIds', () =>
          setTopTodoIds(parseTopTodoIds(existing.top_todo_ids)),
        );
      } else {
        // Read-only draft: do not persist until explicit Save/Commit/Complete.
        // Keeps pristine provisional devices eligible for Recover Existing.
        setPlan(null);
        draft.applyIfPristine('intention', () => setIntention(''));
        draft.applyIfPristine('notes', () => setNotes(''));
        draft.applyIfPristine('reflection', () => setReflection(''));
        draft.applyIfPristine('energyScore', () => setEnergyScore(null));
        draft.applyIfPristine('focusTarget', () => setFocusTarget(0));
        draft.applyIfPristine('topTodoIds', () => setTopTodoIds([]));
      }
      setPendingTodos(todos.map((t) => ({ id: t.id, title: t.title })));
      setScheduledHabits(
        habits
          .filter((h) => isHabitScheduledOn(h.rule_history, today, h.target_per_day))
          .map((h) => h.name),
      );
      if (adherenceSummary) {
        setAdherence({
          committedStreak: adherenceSummary.committedStreak,
          completedStreak: adherenceSummary.completedStreak,
        });
      }
    },
    [draft, today],
  );

  const refresh = useCallback(async () => {
    const isCurrent = begin();
    const data = await loadPlanData();
    applyLoadedPlan(isCurrent, data);
  }, [begin, loadPlanData, applyLoadedPlan]);

  useEffect(() => {
    const isCurrent = begin();
    let active = true;
    void (async () => {
      const data = await loadPlanData();
      if (active) applyLoadedPlan(isCurrent, data);
    })();
    return () => {
      active = false;
    };
  }, [begin, loadPlanData, applyLoadedPlan]);

  const toggleTodo = useCallback(
    (todoId: string) => {
      draft.markDirty('topTodoIds');
      setTopTodoIds((current) => toggleTopTodoId(current, todoId));
    },
    [draft],
  );

  const [carryForwardError, setCarryForwardError] = useState<string | null>(null);

  const handleCarryForward = useCallback(async () => {
    setCarryingForward(true);
    setCarryForwardError(null);
    try {
      await carryForwardFromPreviousDay(today);
      await refresh();
    } catch (e) {
      // Surface the failure instead of leaking an unhandled rejection; the
      // plan draft stays untouched and the user can retry.
      setCarryForwardError(e instanceof Error ? e.message : 'Could not carry forward.');
    } finally {
      setCarryingForward(false);
    }
  }, [today, refresh]);

  const persist = useCallback(
    async (
      extra: {
        status?: DailyPlan['status'];
        reflection?: string;
        energyScore?: number | null;
      } = {},
    ) => {
      setSaving(true);
      try {
        const updated = await upsertDailyPlan(today, {
          intention,
          notes,
          reflection: extra.reflection ?? reflection,
          energyScore: extra.energyScore !== undefined ? extra.energyScore : energyScore,
          focusTargetMinutes: focusTarget,
          topTodoIds,
          ...(extra.status ? { status: extra.status } : {}),
        });
        setPlan(updated);
        draft.clear();
      } finally {
        setSaving(false);
      }
    },
    [today, intention, notes, reflection, energyScore, focusTarget, topTodoIds, draft],
  );

  const isCompleted = plan?.status === 'completed';
  const pendingById = new Map(pendingTodos.map((t) => [t.id, t.title]));
  // Title resolution: save-time snapshot first (survives deletion/renames),
  // then the live todo lookup; '(unavailable)' stays the last resort.
  const snapshotTitles = parseTopTodoTitles(plan?.top_todo_titles);
  const selectedItems = topTodoIds.map((id, i) => ({
    id,
    title: snapshotTitles[i] || pendingById.get(id) || '(unavailable)',
  }));
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const candidateTodos = pendingTodos
    .filter((t) => !topTodoIds.includes(t.id))
    .filter((t) => normalizedQuery.length === 0 || t.title.toLowerCase().includes(normalizedQuery));

  return (
    <View className="gap-3">
      <Text className="text-lg font-bold" style={{ color: tokens.text }}>
        Plan for {today}
      </Text>

      {adherence ? (
        <Text className="text-sm" style={{ color: tokens.textMuted }}>
          Streaks: {adherence.committedStreak} committed · {adherence.completedStreak} completed
        </Text>
      ) : null}

      {carryForwardError ? (
        <Text className="text-sm" style={{ color: tokens.dangerText }}>
          {carryForwardError}
        </Text>
      ) : null}

      {!isCompleted ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Carry forward unfinished priorities from yesterday"
          className="self-start rounded-full border px-3 py-1.5"
          style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
          onPress={() => void handleCarryForward()}
          disabled={carryingForward}
        >
          <Text className="text-sm" style={{ color: tokens.text }}>
            {carryingForward ? 'Carrying forward…' : 'Carry forward from yesterday'}
          </Text>
        </Pressable>
      ) : null}

      <TextField
        label="Intention"
        value={intention}
        onChangeText={(value) => {
          draft.markDirty('intention');
          setIntention(value);
        }}
        placeholder="What is the one thing that matters most today?"
      />

      <Text className="mb-1.5 text-sm font-medium" style={{ color: tokens.textMuted }}>
        Top priorities ({topTodoIds.length}/{MAX_TOP_PRIORITIES})
      </Text>
      {selectedItems.map((item) => (
        <View
          key={item.id}
          className="mb-2 flex-row items-center justify-between rounded-xl border p-2"
          style={{ borderColor: tokens.border }}
        >
          <Text className="flex-1 text-sm" style={{ color: tokens.text }} numberOfLines={1}>
            {item.title}
          </Text>
          <IconButton
            icon="remove-circle-outline"
            onPress={() => toggleTodo(item.id)}
            accessibilityLabel={`Remove ${item.title}`}
          />
        </View>
      ))}
      <TextField
        label="Quick-add priority"
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search todos to add…"
      />
      {candidateTodos.slice(0, 12).map((t) => (
        <Pressable
          key={t.id}
          accessibilityRole="button"
          className="mb-2 flex-row items-center gap-2 rounded-xl border p-2"
          style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
          onPress={() => toggleTodo(t.id)}
        >
          <Text style={{ fontSize: 18 }}>•</Text>
          <Text className="flex-1 text-sm" style={{ color: tokens.textMuted }} numberOfLines={1}>
            {t.title}
          </Text>
        </Pressable>
      ))}

      <View className="mt-2">
        <Text className="mb-1.5 text-sm font-medium" style={{ color: tokens.textMuted }}>
          Scheduled habits today
        </Text>
        {scheduledHabits.length === 0 ? (
          <Text className="text-sm" style={{ color: tokens.textMuted }}>
            Rest day
          </Text>
        ) : (
          scheduledHabits.map((name) => (
            <Text key={name} className="text-sm" style={{ color: tokens.text }} numberOfLines={1}>
              • {name}
            </Text>
          ))
        )}
      </View>

      <TextField
        label="Focus target (minutes)"
        value={String(focusTarget)}
        onChangeText={(value) => {
          draft.markDirty('focusTarget');
          setFocusTarget(Number(value.replace(/\D/g, '')) || 0);
        }}
        keyboardType="number-pad"
        placeholder="0"
      />

      <TextField
        label="Notes"
        value={notes}
        onChangeText={(value) => {
          draft.markDirty('notes');
          setNotes(value);
        }}
        placeholder="Optional"
      />

      <Button
        label="Save Plan"
        onPress={() =>
          persist({
            status:
              plan?.status === 'committed' || plan?.status === 'completed'
                ? plan.status
                : 'committed',
          })
        }
        disabled={saving}
        color={SECTION_COLORS.focus}
      />

      <View className="mt-2">
        <Text className="mb-1.5 text-sm font-medium" style={{ color: tokens.textMuted }}>
          End-of-day reflection
        </Text>
        <TextField
          label="Reflection"
          value={reflection}
          onChangeText={(value) => {
            draft.markDirty('reflection');
            setReflection(value);
          }}
          placeholder="How did today go?"
        />
        <Text className="mb-1.5 text-sm font-medium" style={{ color: tokens.textMuted }}>
          Energy score (1–5): {energyScore ?? '—'}
        </Text>
        <View className="flex-row gap-2">
          {[1, 2, 3, 4, 5].map((score) => (
            <Pressable
              key={score}
              accessibilityRole="button"
              accessibilityLabel={`Energy ${score}`}
              className="h-10 w-10 items-center justify-center rounded-full border"
              style={
                energyScore === score
                  ? { backgroundColor: SECTION_COLORS.focus, borderColor: SECTION_COLORS.focus }
                  : { borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }
              }
              onPress={() => {
                draft.markDirty('energyScore');
                setEnergyScore(normalizeEnergyScore(score));
              }}
            >
              <Text style={{ color: energyScore === score ? tokens.textOnAccent : tokens.text }}>
                {score}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {!isCompleted ? (
        <Button
          label="Complete Daily Plan"
          onPress={() => persist({ status: 'completed' })}
          disabled={saving}
          color={SECTION_COLORS.habits}
        />
      ) : (
        <Text className="text-sm font-semibold" style={{ color: SECTION_COLORS.habits }}>
          Plan completed.
        </Text>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={showHistory ? 'Hide plan history' : 'Show plan history'}
        accessibilityState={{ expanded: showHistory }}
        className="self-start rounded-full border px-3 py-1.5"
        style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
        onPress={() => setShowHistory((current) => !current)}
      >
        <Text className="text-sm" style={{ color: tokens.text }}>
          {showHistory ? 'Hide plan history' : 'Plan history'}
        </Text>
      </Pressable>
      {showHistory ? <DailyPlanHistoryView /> : null}
    </View>
  );
}
