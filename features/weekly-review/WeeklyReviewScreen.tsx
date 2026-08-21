import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { Screen } from '@/core/ui/Screen';
import { Card } from '@/core/ui/Card';
import { Button } from '@/core/ui/Button';
import { PageHeader } from '@/core/ui/PageHeader';
import { useAppTheme } from '@/core/providers/themeContext';
import { buildWeeklyReviewSummary } from './weeklyReview.summary';
import {
  validateReviewDraft,
  getReviewWeek,
  buildNextWeekPlanSuggestions,
  MAX_PRIORITIES,
  MAX_REFLECTION_LENGTH,
} from './weeklyReview.domain';
import { executeWeeklyReview, type ExecutionResult } from './weeklyReview.executor';
import { applyNextWeekPlanSuggestions } from './weeklyReview.applyNextWeek';
import { getWeeklyReviewByWeekKey } from './weeklyReview.data';
import { ReviewHistoryView } from './ReviewHistoryView';
import type {
  WeeklyReviewSummaryV1,
  WeeklyReviewDraft,
  WeeklyTodoDecision,
  WeeklyPriorityDraft,
  NewTodoCommitmentDraft,
} from './weeklyReview.types';

type Step =
  'summary' | 'insights' | 'todos' | 'priorities' | 'new_todos' | 'reflection' | 'preview' | 'done';

const STEP_ORDER: Step[] = [
  'summary',
  'insights',
  'todos',
  'priorities',
  'new_todos',
  'reflection',
  'preview',
];

export function WeeklyReviewScreen({ onClose }: { onClose: () => void }) {
  const { tokens } = useAppTheme();
  const [step, setStep] = useState<Step>('summary');
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
  const [showHistory, setShowHistory] = useState(false);
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
    if (!summary) return;
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
    setExecuting(true);
    try {
      const result = await executeWeeklyReview({ summary, draft });
      setExecutionResult(result);
      setStep('done');
    } catch (e) {
      setValidationErrors([e instanceof Error ? e.message : 'Execution failed']);
    } finally {
      setExecuting(false);
    }
  }, [summary, week.weekKey, todoDecisions, priorities, newCommitments, reflection]);

  const handleConfirmPress = useCallback(() => {
    void handleConfirm();
  }, [handleConfirm]);

  const failedCommitmentCount = useMemo(
    () => executionResult?.commitmentOutcomes.filter((o) => o.status === 'failed').length ?? 0,
    [executionResult],
  );

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
      className="mb-3 self-start rounded-full border px-3 py-1.5"
      style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
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
        <PageHeader title="Weekly Review" />
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
        <PageHeader title="Weekly Review" />
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
        <PageHeader title="Weekly Review" />
        {historyToggle}
        {showHistory ? (
          <View className="mb-4">
            <ReviewHistoryView />
          </View>
        ) : null}
        <Card accentColor={tokens.successText ?? '#16a34a'}>
          <View className="py-8 items-center">
            <Text className="text-2xl font-bold mb-2" style={{ color: tokens.text }}>
              Review Complete ✓
            </Text>
            <Text className="text-base text-center mb-6" style={{ color: tokens.textMuted }}>
              Your weekly review for {week.startDateKey} – {week.endDateKey} has been saved.
            </Text>
            {failedCommitmentCount > 0 ? (
              <Text className="mb-4 text-center text-sm" style={{ color: tokens.dangerText }}>
                {failedCommitmentCount} new commitment
                {failedCommitmentCount === 1 ? '' : 's'} could not be created. Re-confirming the
                review will retry only those.
              </Text>
            ) : null}
            {nextWeekSuggestions.length > 0 && applyStatus !== 'applied' ? (
              <View className="mb-6 w-full items-center gap-2">
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
                className="mb-6 text-center text-sm"
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
      <PageHeader title="Weekly Review" />
      {historyToggle}
      {showHistory ? (
        <View className="mb-4">
          <ReviewHistoryView />
        </View>
      ) : null}

      {/* Step indicator */}
      <View className="flex-row justify-center mb-4">
        {STEP_ORDER.map((s, i) => (
          <View
            key={s}
            className="w-2 h-2 rounded-full mx-1"
            style={{
              backgroundColor: i === currentStepIndex ? tokens.primary : tokens.border,
            }}
          />
        ))}
      </View>

      {/* Existing review warning */}
      {existingReview && step === 'summary' && (
        <Card className="mb-3">
          <Text className="text-sm" style={{ color: tokens.warningText ?? '#d97706' }}>
            A review for this week already exists. Saving will update it.
          </Text>
        </Card>
      )}

      {/* Step content */}
      <View className="mb-4">
        {step === 'summary' && <SummaryStep summary={summary} />}
        {step === 'insights' && <InsightsStep summary={summary} />}
        {step === 'todos' && (
          <TodoDecisionsStep
            summary={summary}
            decisions={todoDecisions}
            onChange={setTodoDecisions}
          />
        )}
        {step === 'priorities' && (
          <PrioritiesStep priorities={priorities} onChange={setPriorities} />
        )}
        {step === 'new_todos' && (
          <NewCommitmentsStep commitments={newCommitments} onChange={setNewCommitments} />
        )}
        {step === 'reflection' && (
          <ReflectionStep reflection={reflection} onChange={setReflection} />
        )}
        {step === 'preview' && (
          <PreviewStep
            summary={summary}
            todoDecisions={todoDecisions}
            priorities={priorities}
            newCommitments={newCommitments}
            reflection={reflection}
            validationErrors={validationErrors}
          />
        )}
      </View>

      {/* Navigation */}
      <View className="flex-row justify-between mt-2">
        {canGoBack ? <Button label="Back" variant="ghost" onPress={goBack} /> : <View />}
        {step === 'preview' ? (
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

function SummaryStep({ summary }: { summary: WeeklyReviewSummaryV1 }) {
  const { tokens } = useAppTheme();
  const w = summary.week;

  return (
    <View>
      <Text className="text-lg font-bold mb-3" style={{ color: tokens.text }}>
        Week of {w.startDateKey} – {w.endDateKey}
      </Text>

      <Card headerTitle="Todos" className="mb-3">
        <StatRow label="Completed" value={summary.todos.completedCount} />
        <StatRow label="Incomplete" value={summary.todos.incompleteCount} />
        <StatRow label="Overdue" value={summary.todos.overdueCount} />
        <StatRow label="Due next week" value={summary.todos.dueNextWeekCount} />
      </Card>

      <Card headerTitle="Habits" className="mb-3">
        <StatRow
          label="Consistency"
          value={
            summary.habits.consistencyPercent !== null
              ? `${summary.habits.consistencyPercent}%`
              : 'N/A'
          }
        />
        <StatRow
          label="Completed"
          value={`${summary.habits.completedOccurrences}/${summary.habits.scheduledOccurrences}`}
        />
      </Card>

      <Card headerTitle="Focus" className="mb-3">
        <StatRow label="Sessions" value={summary.focus.sessions} />
        <StatRow label="Minutes" value={summary.focus.minutes} />
        {summary.focus.priorWeekMinutes !== null && (
          <StatRow label="Prior week" value={`${summary.focus.priorWeekMinutes} min`} />
        )}
      </Card>

      <Card headerTitle="Workouts" className="mb-3">
        <StatRow label="Sessions" value={summary.workouts.sessions} />
        {summary.workouts.priorWeekSessions !== null && (
          <StatRow label="Prior week" value={summary.workouts.priorWeekSessions} />
        )}
      </Card>

      <Card headerTitle="Calories" className="mb-3">
        <StatRow label="Logged days" value={summary.calories.loggedDays} />
        {summary.calories.averageCaloriesOnLoggedDays !== null && (
          <StatRow label="Avg/day" value={`${summary.calories.averageCaloriesOnLoggedDays} kcal`} />
        )}
        {summary.calories.configuredGoal !== null && (
          <StatRow label="Goal" value={`${summary.calories.configuredGoal} kcal`} />
        )}
      </Card>
    </View>
  );
}

function InsightsStep({ summary }: { summary: WeeklyReviewSummaryV1 }) {
  const { tokens } = useAppTheme();

  return (
    <View>
      <Text className="text-lg font-bold mb-3" style={{ color: tokens.text }}>
        Wins & Attention
      </Text>

      {summary.wins.length > 0 && (
        <Card headerTitle="Wins" className="mb-3">
          {summary.wins.map((w, i) => (
            <Text key={i} className="text-sm mb-1" style={{ color: tokens.text }}>
              ✓ {w.message}
            </Text>
          ))}
        </Card>
      )}

      {summary.attention.length > 0 && (
        <Card headerTitle="Attention" className="mb-3">
          {summary.attention.map((a, i) => (
            <Text
              key={i}
              className="text-sm mb-1"
              style={{ color: tokens.warningText ?? '#d97706' }}
            >
              ⚠ {a.message}
            </Text>
          ))}
        </Card>
      )}

      {summary.wins.length === 0 && summary.attention.length === 0 && (
        <Card>
          <Text className="text-sm text-center py-4" style={{ color: tokens.textMuted }}>
            No notable wins or attention items this week.
          </Text>
        </Card>
      )}
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
        <Text className="text-lg font-bold mb-3" style={{ color: tokens.text }}>
          Todo Decisions
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
      <Text className="text-lg font-bold mb-3" style={{ color: tokens.text }}>
        Todo Decisions
      </Text>
      {incompleteTodos.map((todo) => {
        const decision = decisions.find((d) => d.todoId === todo.id);
        const currentAction = decision?.action ?? 'leave';

        return (
          <Card key={todo.id} className="mb-2">
            <Text className="text-sm font-medium mb-2" style={{ color: tokens.text }}>
              {todo.title}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {(['leave', 'carry_forward', 'reschedule'] as const).map((action) => (
                <Pressable
                  key={action}
                  onPress={() => updateDecision(todo.id, action)}
                  className="px-3 py-1 rounded-full"
                  style={{
                    backgroundColor: currentAction === action ? tokens.primary : tokens.surface,
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
                        ? 'Carry'
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

function PrioritiesStep({
  priorities,
  onChange,
}: {
  priorities: WeeklyPriorityDraft[];
  onChange: (p: WeeklyPriorityDraft[]) => void;
}) {
  const { tokens } = useAppTheme();

  const addPriority = () => {
    if (priorities.length >= MAX_PRIORITIES) return;
    onChange([...priorities, { id: `p${Date.now()}`, text: '' }]);
  };

  const updatePriority = (id: string, text: string) => {
    onChange(priorities.map((p) => (p.id === id ? { ...p, text } : p)));
  };

  const removePriority = (id: string) => {
    onChange(priorities.filter((p) => p.id !== id));
  };

  return (
    <View>
      <Text className="text-lg font-bold mb-1" style={{ color: tokens.text }}>
        Next Week Priorities
      </Text>
      <Text className="text-sm mb-3" style={{ color: tokens.textMuted }}>
        Choose 1–{MAX_PRIORITIES} priorities to protect next week.
      </Text>

      {priorities.map((p, i) => (
        <View key={p.id} className="flex-row items-center mb-2">
          <Text className="text-sm mr-2 w-5" style={{ color: tokens.textMuted }}>
            {i + 1}.
          </Text>
          <TextInput
            value={p.text}
            onChangeText={(text) => updatePriority(p.id, text)}
            placeholder={`Priority ${i + 1}`}
            className="flex-1 px-3 py-2 rounded-lg text-sm"
            style={{
              backgroundColor: tokens.surface,
              color: tokens.text,
              borderWidth: 1,
              borderColor: tokens.border,
            }}
            maxLength={200}
          />
          <Pressable onPress={() => removePriority(p.id)} className="ml-2 p-1">
            <Text style={{ color: tokens.dangerText }}>✕</Text>
          </Pressable>
        </View>
      ))}

      {priorities.length < MAX_PRIORITIES && (
        <Button label="+ Add Priority" variant="ghost" onPress={addPriority} />
      )}
    </View>
  );
}

function NewCommitmentsStep({
  commitments,
  onChange,
}: {
  commitments: NewTodoCommitmentDraft[];
  onChange: (c: NewTodoCommitmentDraft[]) => void;
}) {
  const { tokens } = useAppTheme();

  const addCommitment = () => {
    onChange([
      ...commitments,
      {
        id: `c${Date.now()}`,
        title: '',
        priority: 'normal' as const,
        dueDate: getReviewWeek().nextWeekStartDateKey,
      },
    ]);
  };

  const updateCommitment = (id: string, updates: Partial<NewTodoCommitmentDraft>) => {
    onChange(commitments.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const removeCommitment = (id: string) => {
    onChange(commitments.filter((c) => c.id !== id));
  };

  return (
    <View>
      <Text className="text-lg font-bold mb-1" style={{ color: tokens.text }}>
        New Commitments
      </Text>
      <Text className="text-sm mb-3" style={{ color: tokens.textMuted }}>
        Create new Todos for next week (optional).
      </Text>

      {commitments.map((c) => (
        <Card key={c.id} className="mb-2">
          <View className="flex-row items-center mb-2">
            <TextInput
              value={c.title}
              onChangeText={(text) => updateCommitment(c.id, { title: text })}
              placeholder="Todo title"
              className="flex-1 px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: tokens.surface,
                color: tokens.text,
                borderWidth: 1,
                borderColor: tokens.border,
              }}
            />
            <Pressable onPress={() => removeCommitment(c.id)} className="ml-2 p-1">
              <Text style={{ color: tokens.dangerText }}>✕</Text>
            </Pressable>
          </View>
          <View className="flex-row items-center">
            <Text className="text-xs mr-2" style={{ color: tokens.textMuted }}>
              Due:
            </Text>
            <TextInput
              value={c.dueDate ?? ''}
              onChangeText={(text) => updateCommitment(c.id, { dueDate: text })}
              placeholder="YYYY-MM-DD"
              className="flex-1 px-3 py-1 rounded text-xs"
              style={{
                backgroundColor: tokens.surface,
                color: tokens.text,
                borderWidth: 1,
                borderColor: tokens.border,
              }}
            />
          </View>
        </Card>
      ))}

      <Button label="+ Add Commitment" variant="ghost" onPress={addCommitment} />
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
      <Text className="text-lg font-bold mb-1" style={{ color: tokens.text }}>
        Reflection
      </Text>
      <Text className="text-sm mb-3" style={{ color: tokens.textMuted }}>
        Optional notes about your week.
      </Text>
      <TextInput
        value={reflection}
        onChangeText={onChange}
        placeholder="How did this week go?"
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

function PreviewStep({
  summary,
  todoDecisions,
  priorities,
  newCommitments,
  reflection,
  validationErrors,
}: {
  summary: WeeklyReviewSummaryV1;
  todoDecisions: WeeklyTodoDecision[];
  priorities: WeeklyPriorityDraft[];
  newCommitments: NewTodoCommitmentDraft[];
  reflection: string;
  validationErrors: string[];
}) {
  const { tokens } = useAppTheme();

  const reschedules = todoDecisions.filter((d) => d.action === 'reschedule');
  const carryForwards = todoDecisions.filter((d) => d.action === 'carry_forward');

  return (
    <View>
      <Text className="text-lg font-bold mb-3" style={{ color: tokens.text }}>
        Preview
      </Text>

      {validationErrors.length > 0 && (
        <Card className="mb-3">
          {validationErrors.map((e, i) => (
            <Text key={i} className="text-sm" style={{ color: tokens.dangerText }}>
              {e}
            </Text>
          ))}
        </Card>
      )}

      <Card headerTitle="Priorities" className="mb-3">
        {priorities.length === 0 ? (
          <Text className="text-sm" style={{ color: tokens.textMuted }}>
            None
          </Text>
        ) : (
          priorities.map((p, i) => (
            <Text key={p.id} className="text-sm" style={{ color: tokens.text }}>
              {i + 1}. {p.text || '(empty)'}
            </Text>
          ))
        )}
      </Card>

      {carryForwards.length > 0 && (
        <Card headerTitle="Carry Forward" className="mb-3">
          <Text className="text-sm" style={{ color: tokens.textMuted }}>
            {carryForwards.length} todo(s) will be carried to next week
          </Text>
        </Card>
      )}

      {reschedules.length > 0 && (
        <Card headerTitle="Rescheduled" className="mb-3">
          <Text className="text-sm" style={{ color: tokens.textMuted }}>
            {reschedules.length} todo(s) will be rescheduled
          </Text>
        </Card>
      )}

      {newCommitments.length > 0 && (
        <Card headerTitle="New Commitments" className="mb-3">
          {newCommitments.map((c) => (
            <Text key={c.id} className="text-sm" style={{ color: tokens.text }}>
              + {c.title || '(empty)'} {c.dueDate ? `due ${c.dueDate}` : ''}
            </Text>
          ))}
        </Card>
      )}

      {reflection && (
        <Card headerTitle="Reflection" className="mb-3">
          <Text className="text-sm" style={{ color: tokens.text }}>
            {reflection}
          </Text>
        </Card>
      )}
    </View>
  );
}

// ── Shared Components ────────────────────────────────────────────────────────

function StatRow({ label, value }: { label: string; value: number | string }) {
  const { tokens } = useAppTheme();
  return (
    <View className="flex-row justify-between py-1">
      <Text className="text-sm" style={{ color: tokens.textMuted }}>
        {label}
      </Text>
      <Text className="text-sm font-medium" style={{ color: tokens.text }}>
        {value}
      </Text>
    </View>
  );
}
