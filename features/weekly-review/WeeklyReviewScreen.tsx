import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Pressable, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Text } from '@/core/ui/Text';
import { Screen } from '@/core/ui/Screen';
import { Card } from '@/core/ui/Card';
import { Button } from '@/core/ui/Button';
import { SectionLabel } from '@/core/ui/SectionLabel';
import { PlanningDisclosure } from '@/features/planning-hub/PlanningDisclosure';
import { radius, spacing } from '@/core/theme/designTokens';
import { useAppTheme } from '@/core/providers/themeContext';
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
import { ValidationError } from '@/core/ui/ValidationError';
import { describePlanningWriteError } from '@/features/planning-hub/planningWriteError';
import {
  planningPrimaryFace,
  planningRowVisual,
  planningStatusVisual,
  planningStepNodeFill,
  planningTintFace,
  planningToneText,
} from '@/features/planning-hub/planningHub.visual';
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

const STEP_ORDER: Exclude<Step, 'done'>[] = ['review', 'decide', 'plan', 'reflect', 'confirm'];

const STEP_LABELS: Record<Exclude<Step, 'done'>, string> = {
  review: 'Review',
  decide: 'Decide',
  plan: 'Plan',
  reflect: 'Reflect',
  confirm: 'Confirm',
};

/** Short step names for the progress strip (the long labels stay in the caption). */
const STEP_SHORT: Record<Exclude<Step, 'done'>, string> = {
  review: 'Review',
  decide: 'Decide',
  plan: 'Plan',
  reflect: 'Reflect',
  confirm: 'Confirm',
};

/**
 * v2 step strip (P21 part A): five Gold nodes — the Weekly Review's reflective
 * "you vs your past weeks" surface takes the reward Gold as a *shape* only
 * (§5.1: Gold never becomes a label or a button face). Reached nodes fill Gold
 * bright with §5.1 ink checks; upcoming nodes stay on the sunken track. The
 * caption keeps the exact "Step N of 5 · Label" string the specs assert.
 */
function StepStrip({
  step,
  index,
  label,
}: {
  step: Exclude<Step, 'done'>;
  index: number;
  label: string;
}) {
  const { tokens, resolvedTheme } = useAppTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="caption" tone="muted">
        Step {index + 1} of {STEP_ORDER.length} · {label}
      </Text>
      <View
        style={{ flexDirection: 'row', gap: spacing.xs }}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {STEP_ORDER.map((name, i) => {
          const reached = i <= index;
          const current = name === step;
          return (
            <View
              key={name}
              style={{
                flex: 1,
                minWidth: 0,
                gap: spacing.xs,
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: '100%',
                  height: 8,
                  borderRadius: radius.full,
                  backgroundColor: planningStepNodeFill({
                    tone: 'gold',
                    appearance: resolvedTheme,
                    surfaceSunken: tokens.surfaceSunken,
                    reached,
                  }),
                }}
              />
              <Text
                variant="caption"
                style={{ color: current ? tokens.text : tokens.textMuted }}
                numberOfLines={1}
              >
                {STEP_SHORT[name]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Sunken input well matching `TextField`'s geometry (52pt, radius 12). */
function useInputStyle() {
  const { tokens } = useAppTheme();
  return {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: tokens.border,
    backgroundColor: tokens.surfaceSunken,
    color: tokens.text,
    fontSize: 17,
  } as const;
}

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

  const currentStepIndex = step === 'done' ? STEP_ORDER.length : STEP_ORDER.indexOf(step);
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
      const result = await applyNextWeekPlanSuggestions(nextWeekSuggestions, {
        candidateCount: carryForwardTodoIds.length,
      });
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
      // A rejected next-week write must keep its failure visible (and announced)
      // instead of rendering an engine message in the success block. The copy
      // goes through the shared planning helper, and the action stays retriable:
      // `applyStatus` stays 'error' (never 'applied'), so the button below
      // remains available for the retry.
      setApplyStatus('error');
      setApplyMessage(
        describePlanningWriteError(
          e,
          'Could not add the priorities to next week. Please try again.',
        ),
      );
    }
  }, [nextWeekSuggestions, carryForwardTodoIds.length]);

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

  const historyToggle = (
    <PlanningDisclosure
      label={showHistory ? 'Hide past reviews' : 'Past reviews'}
      accessibilityLabel={showHistory ? 'Hide past reviews' : 'Show past reviews'}
      expanded={showHistory}
      icon="history"
      onPress={() => setShowHistory((current) => !current)}
    />
  );

  if (loading) {
    return (
      <Screen scroll>
        <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl }}>
          <Text variant="bodyMd" tone="muted">
            Loading weekly summary…
          </Text>
        </View>
      </Screen>
    );
  }

  if (error || !summary) {
    return (
      <Screen scroll>
        <View
          style={{
            borderRadius: radius.md,
            borderWidth: 2,
            borderColor: danger.border,
            backgroundColor: danger.face,
            padding: spacing.lg,
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          <MaterialIcons name="error-outline" size={20} color={danger.icon} />
          <Text variant="bodyMd" style={{ color: danger.ink, textAlign: 'center' }}>
            {error ?? 'Failed to load summary'}
          </Text>
        </View>
        <Button label="Close" variant="ghost" onPress={onClose} />
      </Screen>
    );
  }

  if (step === 'done') {
    return (
      <Screen scroll>
        {historyToggle}
        {showHistory ? (
          <View style={{ marginBottom: spacing.lg }}>
            <ReviewHistoryView />
          </View>
        ) : null}
        <Card
          accentColor={failedCommitmentCount > 0 ? warning.border : success.border}
          innerClassName="p-0"
        >
          <View
            style={{
              borderRadius: radius.lg,
              backgroundColor: failedCommitmentCount > 0 ? warning.face : success.face,
              padding: spacing.lg,
              alignItems: 'center',
            }}
          >
            <MaterialIcons
              name={failedCommitmentCount > 0 ? 'error-outline' : 'check-circle'}
              size={32}
              color={failedCommitmentCount > 0 ? warning.icon : success.icon}
            />
            {/* The review row IS saved in both cases; when a commitment was
                rejected the heading and copy say so instead of celebrating. */}
            <Text
              variant="titleLg"
              style={{
                color: failedCommitmentCount > 0 ? warning.ink : success.ink,
                marginTop: spacing.sm,
                marginBottom: spacing.sm,
                textAlign: 'center',
              }}
            >
              {failedCommitmentCount > 0 ? 'Review saved — some items need retry' : 'Review saved'}
            </Text>
            <Text
              variant="bodyMd"
              style={{
                textAlign: 'center',
                color: failedCommitmentCount > 0 ? warning.mutedInk : success.mutedInk,
              }}
            >
              Your weekly review for {week.startDateKey} – {week.endDateKey} is saved.
            </Text>
            {failedCommitmentCount > 0 ? (
              <View
                style={{
                  marginTop: spacing.lg,
                  marginBottom: spacing.lg,
                  width: '100%',
                  alignItems: 'center',
                  gap: spacing.xs,
                }}
              >
                <Text variant="bodyMd" style={{ color: danger.ink, textAlign: 'center' }}>
                  {failedCommitmentCount === 1
                    ? 'One new commitment was not created:'
                    : `${failedCommitmentCount} new commitments were not created:`}
                </Text>
                {failedCommitments.map((outcome) => (
                  <Text
                    key={outcome.commitmentId}
                    variant="bodyMd"
                    style={{ color: danger.ink, textAlign: 'center' }}
                  >
                    • {outcome.title || '(untitled)'}
                  </Text>
                ))}
                <Text variant="caption" style={{ textAlign: 'center', color: danger.mutedInk }}>
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
              <View
                style={{
                  marginTop: spacing.lg,
                  marginBottom: spacing.lg,
                  width: '100%',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}
              >
                <Text
                  variant="bodyMd"
                  style={{
                    textAlign: 'center',
                    color: failedCommitmentCount > 0 ? warning.mutedInk : success.mutedInk,
                  }}
                >
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
                  color={planningPrimaryFace('sky')}
                />
              </View>
            ) : null}
            {applyMessage && applyStatus === 'error' ? (
              <View style={{ marginTop: spacing.md, width: '100%' }}>
                {/* The done step's own error surface: announced to assistive
                    technology (role=alert), themed by the shared danger tokens
                    instead of inheriting the success block's muted ink. */}
                <ValidationError message={applyMessage} />
              </View>
            ) : null}
            {applyMessage && applyStatus !== 'error' ? (
              <Text
                variant="bodyMd"
                style={{
                  marginTop: spacing.md,
                  textAlign: 'center',
                  color: failedCommitmentCount > 0 ? warning.mutedInk : success.mutedInk,
                }}
              >
                {applyMessage}
              </Text>
            ) : null}
            <View style={{ marginTop: spacing.lg }}>
              <Button label="Done" variant="ghost" onPress={onClose} />
            </View>
          </View>
        </Card>
      </Screen>
    );
  }

  const stepLabel = STEP_LABELS[step];
  const stepIndex = STEP_ORDER.indexOf(step);

  return (
    <Screen scroll>
      <View style={{ gap: spacing.md }}>
        {historyToggle}
        {showHistory ? (
          <View style={{ marginBottom: spacing.lg }}>
            <ReviewHistoryView />
          </View>
        ) : null}

        {/* Labelled step progress — the baseline's seven unlabelled dots did not
            tell the user which step they were on or how many remained. */}
        <StepStrip step={step} index={stepIndex} label={stepLabel} />

        {/* Existing review warning */}
        {existingReview && step === 'review' ? (
          <View
            style={{
              borderRadius: radius.sm,
              borderWidth: 2,
              borderColor: warning.border,
              backgroundColor: warning.face,
              padding: spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <MaterialIcons name="info-outline" size={18} color={warning.icon} />
            <Text variant="bodyMd" style={{ color: warning.ink, flex: 1 }}>
              A review for this week already exists. Saving will update it.
            </Text>
          </View>
        ) : null}

        {/* Step content */}
        <View style={{ marginBottom: spacing.lg }}>
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
          {step === 'reflect' && (
            <ReflectionStep reflection={reflection} onChange={setReflection} />
          )}
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

        {/* Navigation — one loud action per step (§6 "one primary"). */}
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          {canGoBack ? <Button label="Back" variant="ghost" onPress={goBack} /> : <View />}
          {step === 'confirm' ? (
            <Button
              label={executing ? 'Saving…' : 'Confirm & Save'}
              onPress={handleConfirmPress}
              disabled={executing}
              color={planningPrimaryFace('sky')}
            />
          ) : canGoForward ? (
            <Button label="Next" onPress={goForward} color={planningPrimaryFace('sky')} />
          ) : (
            <View />
          )}
        </View>
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
  const { tokens, resolvedTheme } = useAppTheme();
  const w = summary.week;
  const observations = [...summary.wins, ...summary.attention];
  const heading = planningToneText({
    tone: 'gold',
    appearance: resolvedTheme,
    surface: tokens.surface,
    text: tokens.text,
  });
  const goldWash = planningTintFace('gold', resolvedTheme);

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="titleLg" style={{ color: heading }}>
          {w.startDateKey} – {w.endDateKey}
        </Text>
        <Text variant="caption" tone="muted">
          {weekHasAnyScheduledOrRecordedActivity(summary)
            ? `Week ${w.weekKey}`
            : 'Nothing scheduled this week.'}
        </Text>
      </View>

      {observations.length > 0 ? (
        <Card innerClassName="p-4">
          <View style={{ gap: spacing.sm }}>
            {observations.map((item, i) => (
              <View
                key={`${item.kind}-${i}`}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: radius.full,
                    marginTop: 6,
                    backgroundColor: goldWash,
                  }}
                />
                <Text variant="bodyMd" style={{ color: tokens.text, flex: 1 }}>
                  {item.message}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      ) : (
        <Card innerClassName="p-4">
          <Text variant="bodyMd" tone="muted">
            No notable wins or attention items this week.
          </Text>
        </Card>
      )}

      <PlanningDisclosure
        label={showAllNumbers ? 'Hide all numbers −' : 'All numbers +'}
        accessibilityLabel={showAllNumbers ? 'Hide all numbers' : 'Show all numbers'}
        expanded={showAllNumbers}
        icon="insights"
        onPress={onToggleAllNumbers}
      />

      {showAllNumbers ? (
        <View style={{ gap: spacing.lg }}>
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

/**
 * Decide step: one card per unfinished todo with three exclusive decisions.
 * v2 turns each decision into an OptionRow-weight choice (56pt, tint face +
 * hue lip + trailing check) instead of a pill clamped by `minHeight`, so the
 * selected state survives a theme whose `primary` is a bright hue (white on a
 * bright primary measured 2.2:1 in cyberpunk/solarized).
 */
function TodoDecisionsStep({
  summary,
  decisions,
  onChange,
}: {
  summary: WeeklyReviewSummaryV1;
  decisions: WeeklyTodoDecision[];
  onChange: (d: WeeklyTodoDecision[]) => void;
}) {
  const { tokens, resolvedTheme } = useAppTheme();
  const incompleteTodos = summary.todos.carryForwardCandidates;

  if (incompleteTodos.length === 0) {
    return (
      <View style={{ gap: spacing.md }}>
        <Text variant="titleLg" style={{ color: tokens.text }}>
          Decide
        </Text>
        <Card>
          <Text
            variant="bodyMd"
            tone="muted"
            style={{ textAlign: 'center', paddingVertical: spacing.lg }}
          >
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

  const ACTION_LABELS = {
    leave: 'Leave',
    carry_forward: 'Carry forward',
    reschedule: 'Reschedule',
  } as const;

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="titleLg" style={{ color: tokens.text }}>
          Decide
        </Text>
        <Text variant="caption" tone="muted">
          What happens to this week&apos;s unfinished todos?
        </Text>
      </View>
      {incompleteTodos.map((todo) => {
        const decision = decisions.find((d) => d.todoId === todo.id);
        const currentAction = decision?.action ?? 'leave';
        const selectedRow = planningRowVisual({
          tone: 'sky',
          selected: true,
          appearance: resolvedTheme,
          surface: tokens.surface,
          border: tokens.border,
          borderStrong: tokens.borderStrong,
          text: tokens.text,
          textMuted: tokens.textMuted,
        });
        const idleRow = planningRowVisual({
          tone: 'sky',
          selected: false,
          appearance: resolvedTheme,
          surface: tokens.surface,
          border: tokens.border,
          borderStrong: tokens.borderStrong,
          text: tokens.text,
          textMuted: tokens.textMuted,
        });

        return (
          <Card key={todo.id} innerClassName="p-3">
            <Text
              variant="bodyMd"
              style={{ color: tokens.text, fontWeight: '700', marginBottom: spacing.sm }}
            >
              {todo.title}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {(['leave', 'carry_forward', 'reschedule'] as const).map((action) => {
                const selected = currentAction === action;
                const row = selected ? selectedRow : idleRow;
                return (
                  <Pressable
                    key={action}
                    accessibilityRole="button"
                    accessibilityLabel={`${ACTION_LABELS[action]} ${todo.title}`}
                    accessibilityState={{ selected }}
                    onPress={() => updateDecision(todo.id, action)}
                    style={{
                      minHeight: 44,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.xs,
                      paddingHorizontal: spacing.lg,
                      borderRadius: radius.full,
                      borderWidth: 2,
                      borderColor: row.border,
                      backgroundColor: row.face,
                    }}
                  >
                    {selected ? <MaterialIcons name="check" size={16} color={row.ink} /> : null}
                    <Text variant="label" style={{ color: row.ink }}>
                      {ACTION_LABELS[action]}
                    </Text>
                  </Pressable>
                );
              })}
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
  const inputStyle = useInputStyle();
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
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="titleLg" style={{ color: tokens.text }}>
          Plan
        </Text>
        <Text variant="caption" tone="muted">
          Protect 1–{MAX_PRIORITIES} priorities next week, and add any commitments.
        </Text>
      </View>

      <View>
        <SectionLabel>Next week priorities</SectionLabel>
        {priorities.map((p, i) => (
          <View
            key={p.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              marginBottom: spacing.sm,
            }}
          >
            <Text variant="label" style={{ color: tokens.textMuted, width: 20 }}>
              {i + 1}.
            </Text>
            <TextInput
              value={p.text}
              onChangeText={(text) => updatePriority(p.id, text)}
              placeholder={`Priority ${i + 1}`}
              accessibilityLabel={`Priority ${i + 1}`}
              style={[inputStyle, { flex: 1, minWidth: 0 }]}
              placeholderTextColor={tokens.textSubtle}
              maxLength={200}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove priority ${i + 1}`}
              onPress={() => removePriority(p.id)}
              style={{
                width: 44,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MaterialIcons name="close" size={20} color={tokens.dangerText} />
            </Pressable>
          </View>
        ))}

        {priorities.length < MAX_PRIORITIES ? (
          <Button label="Add priority" variant="secondary" icon="add" onPress={addPriority} />
        ) : null}
      </View>

      <View>
        <SectionLabel>New commitments</SectionLabel>
        <Text variant="caption" tone="muted" style={{ marginBottom: spacing.sm }}>
          Optional new todos for next week.
        </Text>

        {commitments.map((c) => {
          const expanded = expandedCommitment === c.id;
          return (
            <Card key={c.id} className="mb-2" innerClassName="p-3">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <TextInput
                  value={c.title}
                  onChangeText={(text) => updateCommitment(c.id, { title: text })}
                  placeholder="Todo title"
                  accessibilityLabel="Commitment title"
                  style={[inputStyle, { flex: 1, minWidth: 0 }]}
                  placeholderTextColor={tokens.textSubtle}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove commitment ${c.title || 'untitled'}`}
                  onPress={() => removeCommitment(c.id)}
                  style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                >
                  <MaterialIcons name="close" size={20} color={tokens.dangerText} />
                </Pressable>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  marginTop: spacing.sm,
                }}
              >
                <Text variant="caption" tone="muted" style={{ flex: 1 }}>
                  Due {c.dueDate ?? nextWeekStartDateKey}
                </Text>
                {/* 44pt touch contract (W14-01); the visible label stays small. */}
                <PlanningDisclosure
                  label={expanded ? 'Options −' : 'Options +'}
                  accessibilityLabel={
                    expanded ? 'Hide commitment options' : 'Show commitment options'
                  }
                  expanded={expanded}
                  onPress={() => setExpandedCommitment(expanded ? null : c.id)}
                />
              </View>
              {expanded ? (
                <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Text variant="caption" tone="muted" style={{ width: 44 }}>
                      Due
                    </Text>
                    <TextInput
                      value={c.dueDate ?? ''}
                      onChangeText={(text) => updateCommitment(c.id, { dueDate: text })}
                      placeholder="YYYY-MM-DD"
                      accessibilityLabel="Commitment due date"
                      style={[inputStyle, { flex: 1, minWidth: 0, minHeight: 44 }]}
                      placeholderTextColor={tokens.textSubtle}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Text variant="caption" tone="muted" style={{ width: 44 }}>
                      Notes
                    </Text>
                    <TextInput
                      value={c.notes ?? ''}
                      onChangeText={(text) => updateCommitment(c.id, { notes: text })}
                      placeholder="Optional notes"
                      accessibilityLabel="Commitment notes"
                      multiline
                      style={[inputStyle, { flex: 1, minWidth: 0, minHeight: 60 }]}
                      placeholderTextColor={tokens.textSubtle}
                      maxLength={MAX_COMMITMENT_NOTES_LENGTH}
                    />
                  </View>
                </View>
              ) : null}
            </Card>
          );
        })}

        <Button label="Add commitment" variant="secondary" icon="add" onPress={addCommitment} />
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
  const inputStyle = useInputStyle();

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="titleLg" style={{ color: tokens.text }}>
          Reflect
        </Text>
        <Text variant="caption" tone="muted">
          Optional notes about your week.
        </Text>
      </View>
      <TextInput
        value={reflection}
        onChangeText={onChange}
        placeholder="How did this week go?"
        accessibilityLabel="Weekly reflection"
        multiline
        numberOfLines={6}
        textAlignVertical="top"
        style={[inputStyle, { minHeight: 120 }]}
        placeholderTextColor={tokens.textSubtle}
        maxLength={MAX_REFLECTION_LENGTH}
      />
      <Text variant="caption" tone="muted" style={{ textAlign: 'right' }}>
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
  const danger = planningStatusVisual({
    face: tokens.dangerBackground,
    surface: tokens.surface,
    text: tokens.text,
    textMuted: tokens.textMuted,
    ink: tokens.dangerText,
    border: tokens.dangerBorder,
    solid: tokens.dangerSolid,
  });

  const reschedules = todoDecisions.filter((d) => d.action === 'reschedule');
  const carryForwards = todoDecisions.filter((d) => d.action === 'carry_forward');

  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="titleLg" style={{ color: tokens.text }}>
        Review changes
      </Text>

      {validationErrors.length > 0 && (
        <View
          style={{
            borderRadius: radius.sm,
            borderWidth: 2,
            borderColor: danger.border,
            backgroundColor: danger.face,
            padding: spacing.md,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: spacing.sm,
          }}
        >
          <MaterialIcons name="error-outline" size={18} color={danger.icon} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            {validationErrors.map((e, i) => (
              <Text key={i} variant="bodyMd" style={{ color: danger.ink }}>
                {e}
              </Text>
            ))}
          </View>
        </View>
      )}

      {saveError ? (
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
            {saveError}
          </Text>
        </View>
      ) : null}

      <Card innerClassName="p-0">
        <StatRow label="Priorities" value={priorities.length} />
        <StatRow label="Carried forward" value={carryForwards.length} />
        <StatRow label="Rescheduled" value={reschedules.length} />
        <StatRow label="New commitments" value={newCommitments.length} />
        <StatRow label="Reflection" value={reflection ? 'included' : 'none'} />
      </Card>

      {priorities.length > 0 ? (
        <View>
          <SectionLabel>Priorities</SectionLabel>
          <Card innerClassName="p-3">
            <View style={{ gap: spacing.xs }}>
              {priorities.map((p, i) => (
                <Text key={p.id} variant="bodyMd" style={{ color: tokens.text }}>
                  {i + 1}. {p.text || '(empty)'}
                </Text>
              ))}
            </View>
          </Card>
        </View>
      ) : null}

      {newCommitments.length > 0 ? (
        <View>
          <SectionLabel>New commitments</SectionLabel>
          <Card innerClassName="p-3">
            <View style={{ gap: spacing.xs }}>
              {newCommitments.map((c) => (
                <Text key={c.id} variant="bodyMd" style={{ color: tokens.text }}>
                  + {c.title || '(empty)'} {c.dueDate ? `due ${c.dueDate}` : ''}
                </Text>
              ))}
            </View>
          </Card>
        </View>
      ) : null}

      <Text variant="caption" tone="muted">
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
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        minHeight: 44,
      }}
    >
      <Text variant="bodyMd" tone="muted">
        {label}
      </Text>
      <Text variant="bodyMd" style={{ color: tokens.text, fontWeight: '700' }}>
        {value}
      </Text>
    </View>
  );
}
