import { Text } from '@/core/ui/Text';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Pressable, TextInput } from 'react-native';
import { Screen } from '@/core/ui/Screen';
import { Card } from '@/core/ui/Card';
import { Button } from '@/core/ui/Button';
import { SectionLabel } from '@/core/ui/SectionLabel';
import { useAppTheme } from '@/core/providers/themeContext';
import { spacing } from '@/core/theme/designTokens';
import { buildWeeklyReviewSummary } from './weeklyReview.summary';
import {
  validateReviewDraft,
  getReviewWeek,
  buildNextWeekPlanSuggestions,
  MAX_PRIORITIES,
  MAX_REFLECTION_LENGTH,
  MAX_COMMITMENT_NOTES_LENGTH,
} from './weeklyReview.domain';
import { executeWeeklyReview, type ExecutionResult } from './weeklyReview.executor';
import { applyNextWeekPlanSuggestions } from './weeklyReview.applyNextWeek';
import { getWeeklyReviewByWeekKey } from './weeklyReview.data';
import { ReviewHistoryView } from './ReviewHistoryView';
import { weekHasAnyScheduledOrRecordedActivity } from './weeklyReviewScreenGuards';
import type {
  WeeklyReviewSummaryV1,
  WeeklyReviewDraft,
  WeeklyTodoDecision,
  WeeklyPriorityDraft,
  NewTodoCommitmentDraft,
} from './weeklyReview.types';

/**
 * W12 reflection model (design D12.2): `Review → Decide → Plan → Reflect →
 * Confirm`. The previous seven-step wizard spent four of its steps on read-only
 * statistics before the user reached any decision; this model leads with the
 * week's factual story and then asks for the decisions that actually persist.
 * Every domain count from Summary+Insights is preserved behind one `All
 * numbers` disclosure, and no step loses draft state.
 */
type Step = 'review' | 'decide' | 'plan' | 'reflect' | 'confirm' | 'done';

const STEP_ORDER: Step[] = ['review', 'decide', 'plan', 'reflect', 'confirm'];

const STEP_LABELS: Record<Exclude<Step, 'done'>, string> = {
  review: 'Review',
  decide: 'Decide',
  plan: 'Plan',
  reflect: 'Reflect',
  confirm: 'Confirm',
};

export function WeeklyReviewScreen({ onClose }: { onClose: () => void }) {
  const { tokens } = useAppTheme();
  const [step, setStep] = useState<Step>('review');
  const [summary, setSummary] = useState<WeeklyReviewSummaryV1 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [existingReview, setExistingReview] = useState(false);

  // Draft state
  const [todoDecisions, setTodoDecisions] = useState<WeeklyTodoDecision[]>([]);
  const [priorities, setPriorities] = useState<WeeklyPriorityDraft[]>([]);
  const [newCommitments, setNewCommitments] = useState<NewTodoCommitmentDraft[]>([]);
  const [reflection, setReflection] = useState('');
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showAllNumbers, setShowAllNumbers] = useState(false);
  const [applyStatus, setApplyStatus] = useState<'idle' | 'applying' | 'applied' | 'error'>('idle');
  const [applyMessage, setApplyMessage] = useState<string | null>(null);

  const week = useMemo(() => getReviewWeek(), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const sum = await buildWeeklyReviewSummary();
        if (cancelled) return;
        setSummary(sum);
        const existing = await getWeeklyReviewByWeekKey(week.weekKey);
        if (cancelled) return;
        setExistingReview(!!existing);

        // Initialize todo decisions for incomplete todos in the week
        const decisions: WeeklyTodoDecision[] = sum.todos.carryForwardCandidates.map((t) => ({
          todoId: t.id,
          action: 'carry_forward' as const,
        }));
        setTodoDecisions(decisions);

        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load review');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [week.weekKey]);

  const currentStepIndex = STEP_ORDER.indexOf(step);
  const canGoBack = currentStepIndex > 0 && step !== 'done';
  const canGoForward = currentStepIndex < STEP_ORDER.length - 1 && step !== 'done';

  const goBack = useCallback(() => {
    if (canGoBack) setStep(STEP_ORDER[currentStepIndex - 1]);
  }, [canGoBack, currentStepIndex]);

  const goForward = useCallback(() => {
    if (canGoForward) setStep(STEP_ORDER[currentStepIndex + 1]);
  }, [canGoForward, currentStepIndex]);

  const handleConfirm = useCallback(async () => {
    if (!summary || executing) return;
    const draft: WeeklyReviewDraft = {
      weekKey: week.weekKey,
      todoDecisions,
      priorities,
      newCommitments,
      reflection,
    };
    const errors = validateReviewDraft(draft);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);
    setSaveError(null);
    setExecuting(true);
    try {
      const result = await executeWeeklyReview({ summary, draft });
      setExecutionResult(result);
      setStep('done');
    } catch (e) {
      // A rejected review write must never reach the completion state.
      setSaveError(
        e instanceof Error
          ? `The review was not saved: ${e.message}`
          : 'The review was not saved. Try again.',
      );
    } finally {
      setExecuting(false);
    }
  }, [summary, week.weekKey, todoDecisions, priorities, newCommitments, reflection, executing]);

  const handleConfirmPress = useCallback(() => {
    void handleConfirm();
  }, [handleConfirm]);

  // Codex P2 (PR #76): a partially-failed run must not read as a clean success.
  // The executor deliberately resolves after saving the review row even when a
  // commitment is rejected, so the surface has to name what did not persist.
  const failedCommitments = useMemo(
    () => executionResult?.commitmentOutcomes.filter((o) => o.status === 'failed') ?? [],
    [executionResult],
  );
  const failedCommitmentCount = failedCommitments.length;

  const carryForwardTodoIds = useMemo(
    () =>
      todoDecisions
        .filter(
          (d): d is Extract<WeeklyTodoDecision, { action: 'carry_forward' }> =>
            d.action === 'carry_forward',
        )
        .map((d) => d.todoId),
    [todoDecisions],
  );

  const nextWeekSuggestions = useMemo(
    () =>
      buildNextWeekPlanSuggestions({
        candidateTodoIds: carryForwardTodoIds,
        nextWeekStartDateKey: week.nextWeekStartDateKey,
      }),
    [carryForwardTodoIds, week.nextWeekStartDateKey],
  );

  const handleApplyNextWeek = useCallback(async () => {
    setApplyStatus('applying');
    try {
      const result = await applyNextWeekPlanSuggestions(nextWeekSuggestions);
      setApplyStatus('applied');
      const parts: string[] = [];
      if (result.addedCount === 0) {
        parts.push('Nothing to add — next week already covers these priorities.');
      } else {
        parts.push(
          `Added ${result.addedCount} priorit${result.addedCount === 1 ? 'y' : 'ies'} across ${result.appliedDateKeys.length} day${result.appliedDateKeys.length === 1 ? '' : 's'} of next week.`,
        );
      }
      if (result.failed.length > 0) {
        parts.push(`${result.failed.length} could not be applied.`);
      }
      if (result.truncatedCandidateCount > 0) {
        parts.push(
          `${result.truncatedCandidateCount} candidate${result.truncatedCandidateCount === 1 ? '' : 's'} didn't fit the weekly schedule (max 3 per day, 7 days) — plan them manually.`,
        );
      }
      setApplyMessage(parts.join(' '));
    } catch (e) {
      setApplyStatus('error');
      setApplyMessage(e instanceof Error ? e.message : 'Failed to apply suggestions');
    }
  }, [nextWeekSuggestions]);

  const historyToggle = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={showHistory ? 'Hide past reviews' : 'Show past reviews'}
      accessibilityState={{ expanded: showHistory }}
      aria-expanded={showHistory}
      className="mb-3 self-start justify-center rounded-xl border px-3"
      style={{
        borderColor: tokens.border,
        backgroundColor: tokens.surface,
        minHeight: 44,
      }}
      onPress={() => setShowHistory((current) => !current)}
    >
      <Text className="text-sm" style={{ color: tokens.text }}>
        {showHistory ? 'Hide past reviews' : 'Past reviews'}
      </Text>
    </Pressable>
  );

  if (loading) {
    return (
      <Screen scroll>
        <View className="items-center py-12">
          <Text className="text-base" style={{ color: tokens.textMuted }}>
            Loading weekly summary…
          </Text>
        </View>
      </Screen>
    );
  }

  if (error || !summary) {
    return (
      <Screen scroll>
        <Card>
          <Text className="text-base text-center py-6" style={{ color: tokens.dangerText }}>
            {error ?? 'Failed to load summary'}
          </Text>
        </Card>
        <Button label="Close" variant="ghost" onPress={onClose} />
      </Screen>
    );
  }

  if (step === 'done') {
    return (
      <Screen scroll>
        {historyToggle}
        {showHistory ? (
          <View className="mb-4">
            <ReviewHistoryView />
          </View>
        ) : null}
        <Card
          accentColor={
            failedCommitmentCount > 0
              ? (tokens.warningText ?? '#d97706')
              : (tokens.successText ?? '#16a34a')
          }
        >
          <View className="py-8 items-center">
            {/* The review row IS saved in both cases; when a commitment was
                rejected the heading and copy say so instead of celebrating. */}
            <Text variant="titleLg" className="mb-2" style={{ color: tokens.text }}>
              {failedCommitmentCount > 0 ? 'Review saved — some items need retry' : 'Review saved'}
            </Text>
            <Text className="text-base text-center mb-6" style={{ color: tokens.textMuted }}>
              Your weekly review for {week.startDateKey} – {week.endDateKey} is saved.
            </Text>
            {failedCommitmentCount > 0 ? (
              <View className="mb-4 w-full items-center gap-1">
                <Text className="text-center text-sm" style={{ color: tokens.dangerText }}>
                  {failedCommitmentCount === 1
                    ? 'One new commitment was not created:'
                    : `${failedCommitmentCount} new commitments were not created:`}
                </Text>
                {failedCommitments.map((outcome) => (
                  <Text
                    key={outcome.commitmentId}
                    className="text-center text-sm"
                    style={{ color: tokens.dangerText }}
                  >
                    • {outcome.title || '(untitled)'}
                  </Text>
                ))}
                <Text className="text-center text-xs" style={{ color: tokens.textMuted }}>
                  Retrying creates only the missing items; ones already created are not duplicated.
                </Text>
              </View>
            ) : null}
            {failedCommitmentCount > 0 ? (
              <Button
                label={executing ? 'Retrying…' : 'Retry failed commitments'}
                variant="secondary"
                disabled={executing}
                onPress={handleConfirmPress}
              />
            ) : null}
            {nextWeekSuggestions.length > 0 && applyStatus !== 'applied' ? (
              <View className="mb-6 mt-4 w-full items-center gap-2">
                <Text className="text-center text-sm" style={{ color: tokens.textMuted }}>
                  {carryForwardTodoIds.length} carry-forward candidate
                  {carryForwardTodoIds.length === 1 ? '' : 's'} can seed next week&apos;s daily
                  plans (up to 3 per day over the first 7 days).
                </Text>
                <Button
                  label={
                    applyStatus === 'applying'
                      ? 'Applying…'
                      : 'Add carry-forwards to next week’s plans'
                  }
                  onPress={() => void handleApplyNextWeek()}
                  disabled={applyStatus === 'applying'}
                />
              </View>
            ) : null}
            {applyMessage ? (
              <Text
                className="mb-6 mt-3 text-center text-sm"
                style={{ color: applyStatus === 'error' ? tokens.dangerText : tokens.textMuted }}
              >
                {applyMessage}
              </Text>
            ) : null}
            <Button label="Done" variant="ghost" onPress={onClose} />
          </View>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      {historyToggle}
      {showHistory ? (
        <View className="mb-4">
          <ReviewHistoryView />
        </View>
      ) : null}

      {/* Labelled step progress — the baseline's seven unlabelled dots did not
          tell the user which step they were on or how many remained. */}
      <Text className="text-xs mb-3" style={{ color: tokens.textMuted }}>
        Step {currentStepIndex + 1} of {STEP_ORDER.length} · {STEP_LABELS[step]}
      </Text>

      {/* Existing review warning */}
      {existingReview && step === 'review' && (
        <Card className="mb-3">
          <Text className="text-sm" style={{ color: tokens.warningText ?? '#d97706' }}>
            A review for this week already exists. Saving will update it.
          </Text>
        </Card>
      )}

      {/* Step content */}
      <View className="mb-4">
        {step === 'review' && (
          <ReviewStep
            summary={summary}
            showAllNumbers={showAllNumbers}
            onToggleAllNumbers={() => setShowAllNumbers((open) => !open)}
          />
        )}
        {step === 'decide' && (
          <TodoDecisionsStep
            summary={summary}
            decisions={todoDecisions}
            onChange={setTodoDecisions}
          />
        )}
        {step === 'plan' && (
          <PlanStep
            priorities={priorities}
            onPrioritiesChange={setPriorities}
            commitments={newCommitments}
            onCommitmentsChange={setNewCommitments}
            nextWeekStartDateKey={week.nextWeekStartDateKey}
          />
        )}
        {step === 'reflect' && <ReflectionStep reflection={reflection} onChange={setReflection} />}
        {step === 'confirm' && (
          <ConfirmStep
            todoDecisions={todoDecisions}
            priorities={priorities}
            newCommitments={newCommitments}
            reflection={reflection}
            validationErrors={validationErrors}
            saveError={saveError}
          />
        )}
      </View>

      {/* Navigation */}
      <View className="flex-row justify-between mt-2">
        {canGoBack ? <Button label="Back" variant="ghost" onPress={goBack} /> : <View />}
        {step === 'confirm' ? (
          <Button
            label={executing ? 'Saving…' : 'Confirm & Save'}
            onPress={handleConfirmPress}
            disabled={executing}
          />
        ) : canGoForward ? (
          <Button label="Next" onPress={goForward} />
        ) : (
          <View />
        )}
      </View>
    </Screen>
  );
}

// ── Step Components ──────────────────────────────────────────────────────────

/**
 * Review step (design D12.2/D12.3): the week context and its factual story
 * lead; every domain count stays reachable behind one `All numbers`
 * disclosure so the statistics support the story instead of replacing it.
 */
function ReviewStep({
  summary,
  showAllNumbers,
  onToggleAllNumbers,
}: {
  summary: WeeklyReviewSummaryV1;
  showAllNumbers: boolean;
  onToggleAllNumbers: () => void;
}) {
  const { tokens } = useAppTheme();
  const w = summary.week;
  const observations = [...summary.wins, ...summary.attention];

  return (
    <View>
      <Text variant="titleLg" style={{ color: tokens.text }}>
        {w.startDateKey} – {w.endDateKey}
      </Text>
      <Text className="text-sm mt-1 mb-3" style={{ color: tokens.textMuted }}>
        {weekHasAnyScheduledOrRecordedActivity(summary)
          ? `Week ${w.weekKey}`
          : 'Nothing scheduled this week.'}
      </Text>

      {observations.length > 0 ? (
        <Card innerClassName="p-4">
          <View className="gap-1.5">
            {observations.map((item, i) => (
              <Text key={`${item.kind}-${i}`} className="text-sm" style={{ color: tokens.text }}>
                {item.message}
              </Text>
            ))}
          </View>
        </Card>
      ) : (
        <Card innerClassName="p-4">
          <Text className="text-sm" style={{ color: tokens.textMuted }}>
            No notable wins or attention items this week.
          </Text>
        </Card>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={showAllNumbers ? 'Hide all numbers' : 'Show all numbers'}
        accessibilityState={{ expanded: showAllNumbers }}
        aria-expanded={showAllNumbers}
        className="min-h-11 mt-3 self-start justify-center rounded-xl border px-3"
        style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
        onPress={onToggleAllNumbers}
      >
        <Text className="text-sm" style={{ color: tokens.text }}>
          {showAllNumbers ? 'Hide all numbers −' : 'All numbers +'}
        </Text>
      </Pressable>

      {showAllNumbers ? (
        <View className="mt-3 gap-3">
          <View>
            <SectionLabel>Todos</SectionLabel>
            <Card innerClassName="p-0">
              <StatRow label="Completed" value={summary.todos.completedCount} />
              <StatRow label="Incomplete" value={summary.todos.incompleteCount} />
              <StatRow label="Overdue" value={summary.todos.overdueCount} />
              <StatRow label="Due next week" value={summary.todos.dueNextWeekCount} />
            </Card>
          </View>
          <View>
            <SectionLabel>Habits</SectionLabel>
            <Card innerClassName="p-0">
              <StatRow
                label="Consistency"
                value={
                  summary.habits.consistencyPercent !== null
                    ? `${summary.habits.consistencyPercent}%`
                    : 'Not tracked'
                }
              />
              <StatRow
                label="Completed"
                value={`${summary.habits.completedOccurrences}/${summary.habits.scheduledOccurrences}`}
              />
            </Card>
          </View>
          <View>
            <SectionLabel>Focus</SectionLabel>
            <Card innerClassName="p-0">
              <StatRow label="Sessions" value={summary.focus.sessions} />
              <StatRow label="Minutes" value={`${summary.focus.minutes} min`} />
              {summary.focus.priorWeekMinutes !== null && (
                <StatRow label="Prior week" value={`${summary.focus.priorWeekMinutes} min`} />
              )}
            </Card>
          </View>
          <View>
            <SectionLabel>Workouts</SectionLabel>
            <Card innerClassName="p-0">
              <StatRow label="Sessions" value={summary.workouts.sessions} />
              {summary.workouts.scheduledSessions !== undefined &&
              summary.workouts.scheduledSessions > 0 ? (
                <StatRow
                  label="Scheduled"
                  value={`${summary.workouts.sessions}/${summary.workouts.scheduledSessions}`}
                />
              ) : null}
              {summary.workouts.completedSets !== undefined ? (
                <StatRow label="Completed sets" value={summary.workouts.completedSets} />
              ) : null}
              {summary.workouts.measurableVolume !== undefined &&
              summary.workouts.measurableVolume > 0 ? (
                <StatRow
                  label="Measurable volume"
                  value={Math.round(summary.workouts.measurableVolume)}
                />
              ) : null}
              {summary.workouts.priorWeekSessions !== null && (
                <StatRow label="Prior week" value={summary.workouts.priorWeekSessions} />
              )}
            </Card>
          </View>
          <View>
            <SectionLabel>Calories</SectionLabel>
            <Card innerClassName="p-0">
              <StatRow label="Logged days" value={summary.calories.loggedDays} />
              {summary.calories.averageCaloriesOnLoggedDays !== null && (
                <StatRow
                  label="Avg/day"
                  value={`${summary.calories.averageCaloriesOnLoggedDays} kcal`}
                />
              )}
              {summary.calories.configuredGoal !== null && (
                <StatRow label="Goal" value={`${summary.calories.configuredGoal} kcal`} />
              )}
            </Card>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function TodoDecisionsStep({
  summary,
  decisions,
  onChange,
}: {
  summary: WeeklyReviewSummaryV1;
  decisions: WeeklyTodoDecision[];
  onChange: (d: WeeklyTodoDecision[]) => void;
}) {
  const { tokens } = useAppTheme();
  const incompleteTodos = summary.todos.carryForwardCandidates;

  if (incompleteTodos.length === 0) {
    return (
      <View>
        <Text variant="titleLg" className="mb-3" style={{ color: tokens.text }}>
          Decide
        </Text>
        <Card>
          <Text className="text-sm text-center py-4" style={{ color: tokens.textMuted }}>
            No incomplete todos to decide on this week.
          </Text>
        </Card>
      </View>
    );
  }

  const updateDecision = (todoId: string, action: WeeklyTodoDecision['action']) => {
    if (action === 'leave') {
      onChange(decisions.filter((d) => d.todoId !== todoId));
    } else {
      const newDecision: WeeklyTodoDecision =
        action === 'reschedule'
          ? { todoId, action: 'reschedule', dueDate: summary.week.nextWeekStartDateKey }
          : { todoId, action: 'carry_forward' };
      onChange([...decisions.filter((d) => d.todoId !== todoId), newDecision]);
    }
  };

  return (
    <View>
      <Text variant="titleLg" style={{ color: tokens.text }}>
        Decide
      </Text>
      <Text className="text-sm mt-1 mb-3" style={{ color: tokens.textMuted }}>
        What happens to this week&apos;s unfinished todos?
      </Text>
      {incompleteTodos.map((todo) => {
        const decision = decisions.find((d) => d.todoId === todo.id);
        const currentAction = decision?.action ?? 'leave';

        return (
          <Card key={todo.id} className="mb-2" innerClassName="p-3">
            <Text className="text-sm font-medium mb-2" style={{ color: tokens.text }}>
              {todo.title}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {(['leave', 'carry_forward', 'reschedule'] as const).map((action) => (
                <Pressable
                  key={action}
                  accessibilityRole="button"
                  accessibilityLabel={`${action === 'leave' ? 'Leave' : action === 'carry_forward' ? 'Carry forward' : 'Reschedule'} ${todo.title}`}
                  accessibilityState={{ selected: currentAction === action }}
                  onPress={() => updateDecision(todo.id, action)}
                  className="justify-center rounded-full px-3"
                  style={{
                    minHeight: 44,
                    backgroundColor: currentAction === action ? tokens.primary : tokens.surface,
                    borderWidth: 1,
                    borderColor: currentAction === action ? tokens.primary : tokens.border,
                  }}
                >
                  <Text
                    className="text-xs"
                    style={{
                      color: currentAction === action ? '#fff' : tokens.text,
                    }}
                  >
                    {action === 'leave'
                      ? 'Leave'
                      : action === 'carry_forward'
                        ? 'Carry forward'
                        : 'Reschedule'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>
        );
      })}
    </View>
  );
}

/**
 * Plan step (design D12.2): next-week priorities and new commitments in one
 * step. Priorities lead with exactly one add affordance bounded by the existing
 * minimum/maximum; commitments follow with exactly one add affordance and
 * notes behind a per-row disclosure. No draft value is lost on step change.
 */
function PlanStep({
  priorities,
  onPrioritiesChange,
  commitments,
  onCommitmentsChange,
  nextWeekStartDateKey,
}: {
  priorities: WeeklyPriorityDraft[];
  onPrioritiesChange: (p: WeeklyPriorityDraft[]) => void;
  commitments: NewTodoCommitmentDraft[];
  onCommitmentsChange: (c: NewTodoCommitmentDraft[]) => void;
  nextWeekStartDateKey: string;
}) {
  const { tokens } = useAppTheme();
  const [expandedCommitment, setExpandedCommitment] = useState<string | null>(null);

  const addPriority = () => {
    if (priorities.length >= MAX_PRIORITIES) return;
    onPrioritiesChange([...priorities, { id: `p${Date.now()}${priorities.length}`, text: '' }]);
  };

  const updatePriority = (id: string, text: string) => {
    onPrioritiesChange(priorities.map((p) => (p.id === id ? { ...p, text } : p)));
  };

  const removePriority = (id: string) => {
    onPrioritiesChange(priorities.filter((p) => p.id !== id));
  };

  const addCommitment = () => {
    onCommitmentsChange([
      ...commitments,
      {
        id: `c${Date.now()}${commitments.length}`,
        title: '',
        priority: 'normal' as const,
        dueDate: nextWeekStartDateKey,
      },
    ]);
  };

  const updateCommitment = (id: string, updates: Partial<NewTodoCommitmentDraft>) => {
    onCommitmentsChange(commitments.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const removeCommitment = (id: string) => {
    onCommitmentsChange(commitments.filter((c) => c.id !== id));
  };

  return (
    <View>
      <Text variant="titleLg" style={{ color: tokens.text }}>
        Plan
      </Text>
      <Text className="text-sm mt-1 mb-3" style={{ color: tokens.textMuted }}>
        Protect 1–{MAX_PRIORITIES} priorities next week, and add any commitments.
      </Text>

      <SectionLabel>Next week priorities</SectionLabel>
      {priorities.map((p, i) => (
        <View key={p.id} className="flex-row items-center mb-2">
          <Text className="text-sm mr-2 w-5" style={{ color: tokens.textMuted }}>
            {i + 1}.
          </Text>
          <TextInput
            value={p.text}
            onChangeText={(text) => updatePriority(p.id, text)}
            placeholder={`Priority ${i + 1}`}
            accessibilityLabel={`Priority ${i + 1}`}
            className="flex-1 px-3 py-2 rounded-lg text-sm"
            style={{
              minHeight: 44,
              backgroundColor: tokens.surface,
              color: tokens.text,
              borderWidth: 1,
              borderColor: tokens.border,
            }}
            maxLength={200}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove priority ${i + 1}`}
            onPress={() => removePriority(p.id)}
            className="ml-2 h-11 w-11 items-center justify-center"
          >
            <Text style={{ color: tokens.dangerText }}>✕</Text>
          </Pressable>
        </View>
      ))}

      {priorities.length < MAX_PRIORITIES ? (
        <Button label="Add priority" variant="ghost" onPress={addPriority} />
      ) : null}

      <View className="mt-4">
        <SectionLabel>New commitments</SectionLabel>
        <Text className="text-xs mb-2" style={{ color: tokens.textMuted }}>
          Optional new todos for next week.
        </Text>

        {commitments.map((c) => {
          const expanded = expandedCommitment === c.id;
          return (
            <Card key={c.id} className="mb-2" innerClassName="p-3">
              <View className="flex-row items-center">
                <TextInput
                  value={c.title}
                  onChangeText={(text) => updateCommitment(c.id, { title: text })}
                  placeholder="Todo title"
                  accessibilityLabel="Commitment title"
                  className="flex-1 px-3 py-2 rounded-lg text-sm"
                  style={{
                    minHeight: 44,
                    backgroundColor: tokens.surface,
                    color: tokens.text,
                    borderWidth: 1,
                    borderColor: tokens.border,
                  }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove commitment ${c.title || 'untitled'}`}
                  onPress={() => removeCommitment(c.id)}
                  className="ml-2 h-11 w-11 items-center justify-center"
                >
                  <Text style={{ color: tokens.dangerText }}>✕</Text>
                </Pressable>
              </View>
              <View className="flex-row items-center mt-1">
                <Text className="text-xs mr-2" style={{ color: tokens.textMuted }}>
                  Due {c.dueDate ?? nextWeekStartDateKey}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    expanded ? 'Hide commitment options' : 'Show commitment options'
                  }
                  accessibilityState={{ expanded }}
                  aria-expanded={expanded}
                  className="justify-center rounded-lg border px-2"
                  style={{
                    // 44pt touch contract (W14-01); the visible label stays small.
                    minHeight: 44,
                    borderColor: tokens.border,
                    backgroundColor: tokens.surface,
                  }}
                  onPress={() => setExpandedCommitment(expanded ? null : c.id)}
                >
                  <Text className="text-xs" style={{ color: tokens.text }}>
                    {expanded ? 'Options −' : 'Options +'}
                  </Text>
                </Pressable>
              </View>
              {expanded ? (
                <View className="mt-2 gap-2">
                  <View className="flex-row items-center">
                    <Text className="text-xs mr-2 w-12" style={{ color: tokens.textMuted }}>
                      Due
                    </Text>
                    <TextInput
                      value={c.dueDate ?? ''}
                      onChangeText={(text) => updateCommitment(c.id, { dueDate: text })}
                      placeholder="YYYY-MM-DD"
                      accessibilityLabel="Commitment due date"
                      className="flex-1 px-3 py-1 rounded text-xs"
                      style={{
                        minHeight: 44,
                        backgroundColor: tokens.surface,
                        color: tokens.text,
                        borderWidth: 1,
                        borderColor: tokens.border,
                      }}
                    />
                  </View>
                  <View className="flex-row items-center">
                    <Text className="text-xs mr-2 w-12" style={{ color: tokens.textMuted }}>
                      Notes
                    </Text>
                    <TextInput
                      value={c.notes ?? ''}
                      onChangeText={(text) => updateCommitment(c.id, { notes: text })}
                      placeholder="Optional notes"
                      accessibilityLabel="Commitment notes"
                      multiline
                      className="flex-1 px-3 py-1 rounded text-xs"
                      style={{
                        minHeight: 60,
                        backgroundColor: tokens.surface,
                        color: tokens.text,
                        borderWidth: 1,
                        borderColor: tokens.border,
                      }}
                      maxLength={MAX_COMMITMENT_NOTES_LENGTH}
                    />
                  </View>
                </View>
              ) : null}
            </Card>
          );
        })}

        <Button label="Add commitment" variant="ghost" onPress={addCommitment} />
      </View>
    </View>
  );
}

function ReflectionStep({
  reflection,
  onChange,
}: {
  reflection: string;
  onChange: (r: string) => void;
}) {
  const { tokens } = useAppTheme();

  return (
    <View>
      <Text variant="titleLg" style={{ color: tokens.text }}>
        Reflect
      </Text>
      <Text className="text-sm mt-1 mb-3" style={{ color: tokens.textMuted }}>
        Optional notes about your week.
      </Text>
      <TextInput
        value={reflection}
        onChangeText={onChange}
        placeholder="How did this week go?"
        accessibilityLabel="Weekly reflection"
        multiline
        numberOfLines={6}
        textAlignVertical="top"
        className="px-3 py-2 rounded-lg text-sm"
        style={{
          backgroundColor: tokens.surface,
          color: tokens.text,
          borderWidth: 1,
          borderColor: tokens.border,
          minHeight: 120,
        }}
        maxLength={MAX_REFLECTION_LENGTH}
      />
      <Text className="text-xs mt-1 text-right" style={{ color: tokens.textMuted }}>
        {reflection.length}/{MAX_REFLECTION_LENGTH}
      </Text>
    </View>
  );
}

function ConfirmStep({
  todoDecisions,
  priorities,
  newCommitments,
  reflection,
  validationErrors,
  saveError,
}: {
  todoDecisions: WeeklyTodoDecision[];
  priorities: WeeklyPriorityDraft[];
  newCommitments: NewTodoCommitmentDraft[];
  reflection: string;
  validationErrors: string[];
  saveError: string | null;
}) {
  const { tokens } = useAppTheme();

  const reschedules = todoDecisions.filter((d) => d.action === 'reschedule');
  const carryForwards = todoDecisions.filter((d) => d.action === 'carry_forward');

  return (
    <View>
      <Text variant="titleLg" className="mb-3" style={{ color: tokens.text }}>
        Review changes
      </Text>

      {validationErrors.length > 0 && (
        <Card className="mb-3" innerClassName="p-3">
          {validationErrors.map((e, i) => (
            <Text key={i} className="text-sm" style={{ color: tokens.dangerText }}>
              {e}
            </Text>
          ))}
        </Card>
      )}

      {saveError ? (
        <Card className="mb-3" innerClassName="p-3">
          <Text className="text-sm" style={{ color: tokens.dangerText }}>
            {saveError}
          </Text>
        </Card>
      ) : null}

      <Card className="mb-3" innerClassName="p-0">
        <StatRow label="Priorities" value={priorities.length} />
        <StatRow label="Carried forward" value={carryForwards.length} />
        <StatRow label="Rescheduled" value={reschedules.length} />
        <StatRow label="New commitments" value={newCommitments.length} />
        <StatRow label="Reflection" value={reflection ? 'included' : 'none'} />
      </Card>

      {priorities.length > 0 ? (
        <View className="mb-3">
          <SectionLabel>Priorities</SectionLabel>
          <Card innerClassName="p-3">
            {priorities.map((p, i) => (
              <Text key={p.id} className="text-sm" style={{ color: tokens.text }}>
                {i + 1}. {p.text || '(empty)'}
              </Text>
            ))}
          </Card>
        </View>
      ) : null}

      {newCommitments.length > 0 ? (
        <View className="mb-3">
          <SectionLabel>New commitments</SectionLabel>
          <Card innerClassName="p-3">
            {newCommitments.map((c) => (
              <Text key={c.id} className="text-sm" style={{ color: tokens.text }}>
                + {c.title || '(empty)'} {c.dueDate ? `due ${c.dueDate}` : ''}
              </Text>
            ))}
          </Card>
        </View>
      ) : null}

      <Text className="text-xs" style={{ color: tokens.textMuted }}>
        Saving writes this week&apos;s review and applies the decisions above. Applying
        carry-forwards to next week&apos;s daily plans is a separate action afterwards.
      </Text>
    </View>
  );
}

// ── Shared Components ────────────────────────────────────────────────────────

function StatRow({ label, value }: { label: string; value: number | string }) {
  const { tokens } = useAppTheme();
  return (
    <View
      className="flex-row justify-between items-center px-4"
      style={{ minHeight: 44, paddingVertical: spacing.xs }}
    >
      <Text className="text-sm" style={{ color: tokens.textMuted }}>
        {label}
      </Text>
      <Text className="text-sm font-medium tabular-nums" style={{ color: tokens.text }}>
        {value}
      </Text>
    </View>
  );
}
