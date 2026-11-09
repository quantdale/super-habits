import { Text } from '@/core/ui/Text';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/core/providers/themeContext';
import { Button } from '@/core/ui/Button';
import { TextField } from '@/core/ui/TextField';
import { NumberStepperField } from '@/core/ui/NumberStepperField';
import { Card } from '@/core/ui/Card';
import { Pressable3D } from '@/core/ui/Pressable3D';
import { radius, spacing } from '@/core/theme/designTokens';
import { addLocalDays, toDateKey } from '@/lib/time';
import {
  carryForwardFromPreviousDay,
  getDailyPlan,
  upsertDailyPlan,
} from '@/features/daily-plan/dailyPlan.data';
import { parseTopTodoIds, parseTopTodoTitles } from '@/features/daily-plan/dailyPlan.domain';
import { MAX_TOP_PRIORITIES } from '@/features/daily-plan/dailyPlan.types';
import { listTodos } from '@/features/todos/todos.data';
import type { Todo } from '@/core/db/types';
import { describePlanningWriteError } from '@/features/planning-hub/planningWriteError';
import {
  isGuidedPlanningDismissed,
  setGuidedPlanningDismissed,
} from '@/features/planning-hub/guidedPlanning.storage';
import {
  applyCarriedForwardSelection,
  buildGuidedPlanDraft,
  buildGuidedSaveUpdates,
  resolveUnfinishedPriorities,
  type UnfinishedPriority,
} from '@/features/planning-hub/guidedPlanning.model';
import {
  planningPrimaryFace,
  planningRowVisual,
  planningStatusVisual,
  planningStepNodeFill,
  planningStepNodeInk,
  planningToneText,
} from '@/features/planning-hub/planningHub.visual';

type GuidedPlanningFlowProps = {
  /** Bump to refresh sibling surfaces after a guided save. */
  onPlanSaved?: () => void;
};

const STEPS = ['Carry-over', 'Commitments', 'Priorities', 'Focus', 'Confirm'] as const;

/**
 * Step progress (§6/§7 "one question per screen"): the numbered caption stays
 * (E2E and screen readers depend on "Step 3 of 5"), and a row of five Sky
 * step nodes adds the at-a-glance position. Reached nodes fill with the Sky
 * bright and carry an ink check; upcoming nodes stay on the sunken track — a
 * quiet progress affordance, not a celebration (§5.8).
 */
function StepNodes({ step, label }: { step: number; label: string }) {
  const { tokens, resolvedTheme } = useAppTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <View
        style={{ flexDirection: 'row', gap: spacing.xs }}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {STEPS.map((name, index) => {
          const reached = index <= step;
          const current = index === step;
          return (
            <View
              key={name}
              style={{
                width: current ? 28 : 10,
                height: 10,
                borderRadius: radius.full,
                backgroundColor: planningStepNodeFill({
                  tone: 'sky',
                  appearance: resolvedTheme,
                  surfaceSunken: tokens.surfaceSunken,
                  reached,
                }),
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {current ? (
                <MaterialIcons
                  name="check"
                  size={12}
                  color={planningStepNodeInk({ reached: true, textMuted: tokens.textMuted })}
                />
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * One selectable priority row — the §6 OptionRow rhythm (56pt, 2px border,
 * 3px lip, tint face + trailing check badge when selected). Naming, role and
 * the `selected` state are unchanged from the previous bare Pressable, so the
 * E2E `Prioritize …` contract and the screen reader announcement hold.
 */
function PriorityRow({
  title,
  selected,
  onPress,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { tokens, resolvedTheme } = useAppTheme();
  const row = planningRowVisual({
    tone: 'sky',
    selected,
    appearance: resolvedTheme,
    surface: tokens.surface,
    border: tokens.border,
    borderStrong: tokens.borderStrong,
    text: tokens.text,
    textMuted: tokens.textMuted,
  });
  return (
    <Pressable3D
      lip={3}
      faceColor={row.face}
      lipColor={row.lip}
      radius={radius.md}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Prioritize ${title}`}
      accessibilityState={{ selected }}
      faceStyle={{ borderWidth: 2, borderColor: row.border }}
      contentStyle={{
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
      }}
    >
      <Text
        variant="label"
        style={{ color: row.mark }}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {selected ? '✓' : '•'}
      </Text>
      <Text
        variant="bodyMd"
        style={{ color: row.ink, fontWeight: '700', flex: 1 }}
        numberOfLines={1}
      >
        {title}
      </Text>
      {selected ? (
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: row.badgeFill,
          }}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          <MaterialIcons name="check" size={16} color={row.badgeInk} />
        </View>
      ) : null}
    </Pressable3D>
  );
}

/**
 * Skippable five-step guided planning sequence for the Planning Hub Today
 * tab (carry-over → commitments → priorities → focus → confirm). Purely a
 * friendlier front door over the existing daily-plan data functions; the
 * full DailyPlanView below remains the complete editor.
 */
export function GuidedPlanningFlow({ onPlanSaved }: GuidedPlanningFlowProps) {
  const { tokens, resolvedTheme } = useAppTheme();
  const todayKey = toDateKey();
  const yesterdayKey = addLocalDays(todayKey, -1);

  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);

  // Step 1 — carry-over review.
  const [yesterdayUnfinished, setYesterdayUnfinished] = useState<UnfinishedPriority[]>([]);
  const [carryingForward, setCarryingForward] = useState(false);

  // Step 2 — fixed commitments (read-only).
  const [overdueTodos, setOverdueTodos] = useState<Todo[]>([]);
  const [dueTodayTodos, setDueTodayTodos] = useState<Todo[]>([]);

  // Step 3 — priority selection (writes only at confirm). Seeded from today's
  // existing plan so re-running the flow never silently drops prior choices.
  const [pendingTodos, setPendingTodos] = useState<
    { id: string; title: string; dueDate: string | null }[]
  >([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Today's plan ids as of flow open — the baseline the carry-forward delta
  // is measured against so deliberate deselections are never resurrected.
  const planIdsAtOpenRef = useRef<string[]>([]);
  // Ids the user explicitly removed from the selection this session: a repeat
  // carry press must never re-add them (the idempotent plan rewrite keeps them
  // in the re-read plan, and the flow-open baseline re-reports them as new).
  const deselectedIdsRef = useRef<Set<string>>(new Set());

  // Step 4/5 — focus + intention, then save. notes/reflection/energyScore
  // have no guided-flow inputs but ride along from today's existing plan so
  // the save preserves them instead of resetting to empty defaults.
  const [focusMinutes, setFocusMinutes] = useState('25');
  const [intention, setIntention] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftReflection, setDraftReflection] = useState('');
  const [draftEnergyScore, setDraftEnergyScore] = useState<number | null>(null);
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
        const [yesterdayPlan, todayPlan, todos] = await Promise.all([
          getDailyPlan(yesterdayKey).catch(() => null),
          getDailyPlan(todayKey).catch(() => null),
          listTodos(),
        ]);
        if (!active) return;
        // Prefill the draft from today's existing plan (same semantics as the
        // full editor): untouched fields pass through to the save verbatim.
        const draft = buildGuidedPlanDraft(todayPlan);
        setSelectedIds(draft.selectedIds);
        planIdsAtOpenRef.current = draft.selectedIds;
        setIntention(draft.intention);
        setFocusMinutes(draft.focusMinutesText);
        setDraftNotes(draft.notes);
        setDraftReflection(draft.reflection);
        setDraftEnergyScore(draft.energyScore);
        if (yesterdayPlan) {
          setYesterdayUnfinished(
            resolveUnfinishedPriorities({
              ids: parseTopTodoIds(yesterdayPlan.top_todo_ids),
              titles: parseTopTodoTitles(yesterdayPlan.top_todo_titles),
              todos,
            }),
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
        deselectedIdsRef.current.add(todoId);
        return current.filter((id) => id !== todoId);
      }
      deselectedIdsRef.current.delete(todoId);
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
      // Re-read what the canonical carry-forward actually wrote so the
      // selection shown on later steps matches the persisted plan; only
      // newly carried ids join the selection (deselected stays deselected).
      const afterPlan = await getDailyPlan(todayKey).catch(() => null);
      setSelectedIds((current) =>
        applyCarriedForwardSelection({
          selection: current,
          planIdsBeforeCarry: planIdsAtOpenRef.current,
          planIdsAfterCarry: parseTopTodoIds(afterPlan?.top_todo_ids ?? '[]'),
          deselectedIds: [...deselectedIdsRef.current],
        }),
      );
      setStep(1);
    } catch (e) {
      setError(describePlanningWriteError(e, 'Could not carry forward. Please try again.'));
    } finally {
      setCarryingForward(false);
    }
  }, [todayKey]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await upsertDailyPlan(
        todayKey,
        buildGuidedSaveUpdates({
          draftNotes,
          draftReflection,
          draftEnergyScore,
          intention,
          focusMinutesText: focusMinutes,
          selectedIds,
        }),
      );
      setSaved(true);
      onPlanSaved?.();
    } catch (e) {
      setError(describePlanningWriteError(e, 'Could not save the plan. Please try again.'));
    } finally {
      setSaving(false);
    }
  }, [
    todayKey,
    draftNotes,
    draftReflection,
    draftEnergyScore,
    intention,
    focusMinutes,
    selectedIds,
    onPlanSaved,
  ]);

  if (dismissed || loading) {
    return null;
  }

  // Step 3 rows: the first ten open todos, plus any selected id that falls
  // outside that window (e.g. carried-forward items) so everything that will
  // be saved is visible and can be deselected deliberately.
  const priorityRows: { id: string; title: string }[] = [...pendingTodos.slice(0, 10)];
  for (const id of selectedIds) {
    if (!priorityRows.some((t) => t.id === id)) {
      priorityRows.push({
        id,
        title: pendingTodos.find((t) => t.id === id)?.title ?? 'Unavailable priority',
      });
    }
  }

  const success = planningStatusVisual({
    face: tokens.successBackground,
    surface: tokens.surface,
    text: tokens.text,
    textMuted: tokens.textMuted,
    ink: tokens.successText,
    border: tokens.successBorder,
    solid: tokens.successSolid,
  });
  const warning = planningStatusVisual({
    face: tokens.warningBackground,
    surface: tokens.surface,
    text: tokens.text,
    textMuted: tokens.textMuted,
    ink: tokens.warningText,
    border: tokens.warningBorder,
    solid: tokens.warningSolid,
  });
  const danger = planningStatusVisual({
    face: tokens.dangerBackground,
    surface: tokens.surface,
    text: tokens.text,
    textMuted: tokens.textMuted,
    ink: tokens.dangerText,
    border: tokens.dangerBorder,
    solid: tokens.dangerSolid,
  });
  // The guided flow's one loud action per step uses the Sky `solid` face (5.19:1
  // under a white label in every theme); quieter moves use `ghost`.
  const primaryFace = planningPrimaryFace('sky');
  const accentText = planningToneText({
    tone: 'sky',
    appearance: resolvedTheme,
    surface: tokens.surface,
    text: tokens.text,
  });

  if (saved) {
    return (
      <View
        style={{
          borderRadius: radius.lg,
          borderWidth: 2,
          borderColor: success.border,
          backgroundColor: success.face,
          padding: spacing.lg,
          gap: spacing.sm,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <MaterialIcons name="check-circle" size={20} color={success.icon} />
          <Text variant="titleMd" style={{ color: success.ink }}>
            {"Today's plan is set."}
          </Text>
        </View>
        <Text variant="caption" style={{ color: success.mutedInk }}>
          Adjust anything below whenever the day changes.
        </Text>
        <Button
          label="Use simple view next time"
          accessibilityLabel="Hide guided planning"
          variant="secondary"
          onPress={dismiss}
        />
      </View>
    );
  }

  return (
    <Card innerClassName="p-4">
      <View style={{ gap: spacing.md }}>
        <View style={{ gap: spacing.xs }}>
          <Text variant="titleMd" style={{ color: tokens.text }}>
            Plan your day · {STEPS[step]}
          </Text>
          <StepNodes step={step} label={`Step ${step + 1} of ${STEPS.length}`} />
        </View>

        {error ? (
          <View
            style={{
              borderRadius: radius.sm,
              borderWidth: 2,
              borderColor: danger.border,
              backgroundColor: danger.face,
              padding: spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <MaterialIcons name="error-outline" size={18} color={danger.icon} />
            <Text variant="bodyMd" style={{ color: danger.ink, flex: 1 }}>
              {error}
            </Text>
          </View>
        ) : null}

        {step === 0 ? (
          <View style={{ gap: spacing.sm }}>
            {yesterdayUnfinished.length === 0 ? (
              <Text variant="bodyMd" tone="muted">
                Nothing left over from yesterday. Fresh start.
              </Text>
            ) : (
              <>
                <Text variant="bodyMd" tone="muted">
                  Still open from yesterday:
                </Text>
                {yesterdayUnfinished.slice(0, 3).map((item) => (
                  <Text
                    key={item.id}
                    variant="bodyMd"
                    style={{ color: tokens.text }}
                    numberOfLines={1}
                  >
                    • {item.title}
                  </Text>
                ))}
                <Text variant="caption" tone="muted">
                  {
                    "They start selected as today's priorities — you can drop any of them in the next steps."
                  }
                </Text>
              </>
            )}
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              {yesterdayUnfinished.length > 0 ? (
                <View style={{ flex: 1 }}>
                  <Button
                    label={carryingForward ? 'Carrying…' : 'Carry forward'}
                    onPress={() => void handleCarryForward()}
                    disabled={carryingForward}
                    color={primaryFace}
                    fullWidth
                  />
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                <Button label="Start fresh" onPress={() => setStep(1)} variant="ghost" fullWidth />
              </View>
            </View>
          </View>
        ) : null}

        {step === 1 ? (
          <View style={{ gap: spacing.sm }}>
            {overdueTodos.length === 0 && dueTodayTodos.length === 0 ? (
              <Text variant="bodyMd" tone="muted">
                No deadlines today. Your time is yours.
              </Text>
            ) : (
              <>
                {overdueTodos.length > 0 ? (
                  <View style={{ gap: spacing.xs }}>
                    <Text variant="label" style={{ color: warning.ink }}>
                      Overdue ({overdueTodos.length})
                    </Text>
                    {overdueTodos.map((t) => (
                      <Text
                        key={t.id}
                        variant="bodyMd"
                        style={{ color: tokens.text }}
                        numberOfLines={1}
                      >
                        • {t.title}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {dueTodayTodos.length > 0 ? (
                  <View style={{ gap: spacing.xs }}>
                    <Text variant="label" style={{ color: tokens.text }}>
                      Due today ({dueTodayTodos.length})
                    </Text>
                    {dueTodayTodos.map((t) => (
                      <Text
                        key={t.id}
                        variant="bodyMd"
                        style={{ color: tokens.text }}
                        numberOfLines={1}
                      >
                        • {t.title}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </>
            )}
            <View style={{ marginTop: spacing.sm }}>
              <Button label="Next" onPress={() => setStep(2)} variant="ghost" />
            </View>
          </View>
        ) : null}

        {step === 2 ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="bodyMd" tone="muted">
              What matters most? Pick up to {MAX_TOP_PRIORITIES}. ({selectedIds.length}/
              {MAX_TOP_PRIORITIES})
            </Text>
            <View style={{ gap: spacing.sm }}>
              {priorityRows.map((t) => (
                <PriorityRow
                  key={t.id}
                  title={t.title}
                  selected={selectedIds.includes(t.id)}
                  onPress={() => togglePriority(t.id)}
                />
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
              <View style={{ flex: 1 }}>
                <Button label="Back" onPress={() => setStep(1)} variant="ghost" fullWidth />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Next"
                  onPress={() => setStep(3)}
                  variant="secondary"
                  color={accentText}
                  fullWidth
                />
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
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
              <View style={{ flex: 1 }}>
                <Button label="Back" onPress={() => setStep(2)} variant="ghost" fullWidth />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Next"
                  onPress={() => setStep(4)}
                  variant="secondary"
                  color={accentText}
                  fullWidth
                />
              </View>
            </View>
          </View>
        ) : null}

        {step === 4 ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="bodyMd" style={{ color: tokens.text }}>
              {selectedIds.length} priorit{selectedIds.length === 1 ? 'y' : 'ies'} ·{' '}
              {Number(focusMinutes.replace(/\D/g, '')) || 0} focus minutes planned
            </Text>
            <Text variant="caption" tone="muted">
              A realistic plan beats a perfect one.
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button label="Back" onPress={() => setStep(3)} variant="ghost" fullWidth />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label={saving ? 'Saving…' : 'Save plan'}
                  onPress={() => void handleSave()}
                  disabled={saving}
                  color={primaryFace}
                  fullWidth
                />
              </View>
            </View>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use simple view"
          onPress={dismiss}
          style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}
        >
          <Text
            variant="caption"
            style={{ color: tokens.textMuted, textDecorationLine: 'underline' }}
          >
            Use simple view
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}
