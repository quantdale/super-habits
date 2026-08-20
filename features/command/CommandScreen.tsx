import { useEffect, useMemo, useRef, useState } from 'react';

import { Pressable, Text, View } from 'react-native';
import { PageHeader } from '@/core/ui/PageHeader';
import { Screen } from '@/core/ui/Screen';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { useAppTheme } from '@/core/providers/themeContext';
import { type AppSection } from '@/core/providers/navigationContext';
import { toDateKey } from '@/lib/time';
import { executeDraftAction } from './command.executor';
import { commandParser } from './commandParser';
import { getAiCommandParseConfig, isAiCommandInternalRolloutAvailable } from './commandConfig';
import { getAiCommandInternalRolloutPreference } from './commandInternalRollout';
import {
  getLastUsedCommandMode,
  setLastUsedCommandMode,
  type CommandMode,
} from './commandModePreference';
import {
  type CommandCenterLaunchContext,
  getCommandCenterContextCopy,
} from './commandCenterConfig';
import { getParserContext, getTomorrowDateKey } from './commandScreenUtils';
import type {
  CommandExecutionResult,
  CommandParseObservation,
  DraftAiAction,
  DraftMissingField,
  ParseCommandResult,
} from './types';
import { AI_ASK_EXPERIMENT_ENABLED, COMMAND_EXPERIMENT_ENABLED } from './types';
import { AskConversationView } from './AskConversationView';
import { AutoModeView } from './AutoModeView';
import { CommandInputCard } from './CommandInputCard';
import { CommandParseResultCard } from './CommandParseResultCard';
import { CommandSection } from './CommandSection';
import { DraftPreview } from './DraftPreview';
import { InternalMetadataCard, LaunchContextCard } from './CommandPreview';
import { ModeToggle } from './ModeToggle';
import type { PomodoroCommandStartResult } from '@/features/pomodoro/pomodoroCommandBridgeContext';
import { prepareCommandReview, type CommandReview } from './command.review';

type CommandScreenProps = {
  launchContext?: CommandCenterLaunchContext | null;
  onRequestClose?: () => void;
  onNavigateToDestination?: (section: AppSection) => void;
  onStartFocusSession?: (durationMinutes: number) => Promise<PomodoroCommandStartResult>;
};

function cloneDraft(draft: DraftAiAction): DraftAiAction {
  return { ...draft, fields: { ...draft.fields } } as DraftAiAction;
}

function getInlineRequiredMissingFields(draft: DraftAiAction): DraftMissingField[] {
  switch (draft.kind) {
    case 'create_todo':
      return draft.fields.title?.trim()
        ? []
        : [{ field: 'title', message: 'Add the task title before saving.' }];
    case 'create_habit':
      return draft.fields.name?.trim()
        ? []
        : [{ field: 'name', message: 'Add the habit name before saving.' }];
    case 'complete_todo':
      return draft.fields.todoTitle?.trim()
        ? []
        : [{ field: 'todoTitle', message: 'Add the Todo title before completing.' }];
    case 'log_habit':
      return draft.fields.habitName?.trim()
        ? []
        : [{ field: 'habitName', message: 'Add the Habit name before logging.' }];
    case 'log_calorie_entry':
      return [
        ...(draft.fields.foodName?.trim()
          ? []
          : [{ field: 'foodName', message: 'Add the food name before logging.' }]),
        ...(draft.fields.calories == null
          ? [{ field: 'calories', message: 'Add calories before logging.' }]
          : []),
      ];
    case 'log_workout_routine':
      return draft.fields.routineName?.trim()
        ? []
        : [{ field: 'routineName', message: 'Add the routine name before logging.' }];
    case 'start_focus_session':
      return draft.fields.durationMinutes != null
        ? []
        : [{ field: 'durationMinutes', message: 'Add the focus duration before starting.' }];
    case 'create_project':
      return draft.fields.name?.trim()
        ? []
        : [{ field: 'name', message: 'Add the project name before saving.' }];
    case 'update_goal_progress':
      return [
        ...(draft.fields.goalTitle?.trim()
          ? []
          : [{ field: 'goalTitle', message: 'Add the goal title before saving.' }]),
        ...(draft.fields.percent == null
          ? [{ field: 'percent', message: 'Add the progress percent before saving.' }]
          : []),
      ];
    case 'add_todo_to_daily_plan':
      return draft.fields.todoTitle?.trim()
        ? []
        : [{ field: 'todoTitle', message: 'Add the Todo title before saving.' }];
  }
}

function isFieldStillMissing(draft: DraftAiAction, field: string): boolean {
  switch (draft.kind) {
    case 'create_todo':
      return field === 'title' && !draft.fields.title?.trim();
    case 'create_habit':
      return field === 'name' && !draft.fields.name?.trim();
    case 'complete_todo':
      return field === 'todoTitle' && !draft.fields.todoTitle?.trim();
    case 'log_habit':
      return field === 'habitName' && !draft.fields.habitName?.trim();
    case 'log_calorie_entry':
      return (
        (field === 'foodName' && !draft.fields.foodName?.trim()) ||
        (field === 'calories' && draft.fields.calories == null)
      );
    case 'log_workout_routine':
      return field === 'routineName' && !draft.fields.routineName?.trim();
    case 'start_focus_session':
      return field === 'durationMinutes' && draft.fields.durationMinutes == null;
    case 'create_project':
      return field === 'name' && !draft.fields.name?.trim();
    case 'update_goal_progress':
      return (
        (field === 'goalTitle' && !draft.fields.goalTitle?.trim()) ||
        (field === 'percent' && draft.fields.percent == null)
      );
    case 'add_todo_to_daily_plan':
      return field === 'todoTitle' && !draft.fields.todoTitle?.trim();
  }
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? Number(trimmed) : null;
}

function updateV2DraftField(draft: DraftAiAction, field: string, value: string): DraftAiAction {
  switch (draft.kind) {
    case 'complete_todo':
      return field === 'todoTitle'
        ? { ...draft, fields: { ...draft.fields, todoTitle: value } }
        : draft;
    case 'log_habit':
      return field === 'habitName'
        ? { ...draft, fields: { ...draft.fields, habitName: value } }
        : draft;
    case 'log_calorie_entry':
      if (field === 'foodName') {
        return { ...draft, fields: { ...draft.fields, foodName: value } };
      }
      if (field === 'consumedOn') {
        return {
          ...draft,
          fields: { ...draft.fields, consumedOn: value.trim().length > 0 ? value.trim() : null },
        };
      }
      if (['calories', 'protein', 'carbs', 'fats', 'fiber'].includes(field)) {
        return {
          ...draft,
          fields: { ...draft.fields, [field]: parseOptionalNumber(value) },
        };
      }
      return field === 'mealType'
        ? {
            ...draft,
            fields: {
              ...draft.fields,
              mealType: value as typeof draft.fields.mealType,
            },
          }
        : draft;
    case 'log_workout_routine':
      return field === 'routineName'
        ? { ...draft, fields: { ...draft.fields, routineName: value } }
        : draft;
    case 'start_focus_session':
      return field === 'durationMinutes'
        ? { ...draft, fields: { ...draft.fields, durationMinutes: parseOptionalNumber(value) } }
        : draft;
    case 'create_project':
      if (field === 'name') {
        return { ...draft, fields: { ...draft.fields, name: value } };
      }
      if (field === 'targetDate') {
        return {
          ...draft,
          fields: { ...draft.fields, targetDate: value.trim().length > 0 ? value.trim() : null },
        };
      }
      return draft;
    case 'update_goal_progress':
      if (field === 'goalTitle') {
        return { ...draft, fields: { ...draft.fields, goalTitle: value } };
      }
      return field === 'percent'
        ? { ...draft, fields: { ...draft.fields, percent: parseOptionalNumber(value) } }
        : draft;
    case 'add_todo_to_daily_plan':
      return field === 'todoTitle'
        ? { ...draft, fields: { ...draft.fields, todoTitle: value } }
        : draft;
    case 'create_todo':
    case 'create_habit':
      return draft;
  }
}

export function CommandScreen({
  launchContext = null,
  onRequestClose,
  onNavigateToDestination,
  onStartFocusSession,
}: CommandScreenProps) {
  const { tokens } = useAppTheme();
  const parseConfig = useMemo(() => getAiCommandParseConfig(), []);
  const internalRolloutAvailable = useMemo(
    () => isAiCommandInternalRolloutAvailable(parseConfig),
    [parseConfig],
  );
  const contextCopy = getCommandCenterContextCopy(launchContext);
  const commandPlaceholder = contextCopy?.inputPlaceholder ?? 'Add a todo to call mom tomorrow';
  const supportedExamples = contextCopy
    ? [contextCopy.inputPlaceholder, 'Create a habit to drink water every morning']
    : ['Add a todo to call mom tomorrow', 'Create a habit to drink water every morning'];
  const [rawText, setRawText] = useState('');
  const [parseResult, setParseResult] = useState<ParseCommandResult | null>(null);
  const [editableDraft, setEditableDraft] = useState<DraftAiAction | null>(null);
  const [commandReview, setCommandReview] = useState<CommandReview | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const reviewRequestId = useRef(0);
  const [parseObservation, setParseObservation] = useState<CommandParseObservation | null>(null);
  const [internalRolloutEnabledOnDevice, setInternalRolloutEnabledOnDevice] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [successResult, setSuccessResult] = useState<Extract<
    CommandExecutionResult,
    { outcome: 'success' }
  > | null>(null);
  const [mode, setMode] = useState<CommandMode>('create');

  useEffect(() => {
    if (!AI_ASK_EXPERIMENT_ENABLED) return;

    let cancelled = false;
    void getLastUsedCommandMode().then((storedMode) => {
      if (!cancelled) {
        setMode(storedMode);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleModeChange = (nextMode: CommandMode) => {
    setMode(nextMode);
    void setLastUsedCommandMode(nextMode).catch(() => {
      // The runtime cache is already updated before the await; a persistence
      // failure should not surface as an unhandled rejection.
    });
  };

  useEffect(() => {
    // Defaults to false via useState; nothing to reset when unavailable.
    if (!internalRolloutAvailable) return;

    let cancelled = false;
    void getAiCommandInternalRolloutPreference().then((enabled) => {
      if (!cancelled) {
        setInternalRolloutEnabledOnDevice(enabled);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [internalRolloutAvailable]);

  const parsedDraft = useMemo(
    () => commandReview?.draft ?? (parseResult?.outcome === 'draft' ? parseResult.draft : null),
    [commandReview, parseResult],
  );
  const visibleMissingFields = useMemo(() => {
    if (!editableDraft || !parsedDraft) return [];

    const unresolvedParseMissing = [
      ...parsedDraft.missingFields,
      ...(commandReview?.missingFields ?? []),
    ]
      .filter(
        (missing, index, fields) =>
          fields.findIndex((candidate) => candidate.field === missing.field) === index,
      )
      .filter(
        (missing) =>
          missing.field === 'reference' ||
          missing.field === 'schedule' ||
          missing.field === 'fields' ||
          isFieldStillMissing(editableDraft, missing.field),
      );
    const inlineRequiredMissing = getInlineRequiredMissingFields(editableDraft).filter(
      (missing) => !unresolvedParseMissing.some((existing) => existing.field === missing.field),
    );

    return [...unresolvedParseMissing, ...inlineRequiredMissing];
  }, [commandReview, editableDraft, parsedDraft]);
  const canConfirm = useMemo(
    () =>
      editableDraft
        ? getInlineRequiredMissingFields(editableDraft).length === 0 &&
          commandReview?.status === 'ready'
        : false,
    [commandReview, editableDraft],
  );

  const handleReset = () => {
    reviewRequestId.current += 1;
    setRawText('');
    setParseResult(null);
    setEditableDraft(null);
    setCommandReview(null);
    setSelectedEntityId(null);
    setParseObservation(null);
    setExecutionError(null);
    setIsExecuting(false);
    setIsParsing(false);
    setSuccessResult(null);
  };

  const handleParseCommand = async () => {
    setExecutionError(null);
    setSuccessResult(null);
    setIsParsing(true);

    const parserContext = getParserContext();
    const now = new Date();
    const requestId = ++reviewRequestId.current;
    try {
      const execution = await commandParser.parseWithObservation({
        rawText,
        now,
        locale: parserContext.locale,
        timeZone: parserContext.timeZone,
        todayDateKey: toDateKey(now),
        tomorrowDateKey: getTomorrowDateKey(now),
      });
      if (requestId !== reviewRequestId.current) return;
      setParseResult(execution.result);
      setParseObservation(execution.observation);
      if (execution.result.outcome === 'draft') {
        const review = await prepareCommandReview(cloneDraft(execution.result.draft), { now });
        if (requestId !== reviewRequestId.current) return;
        setCommandReview(review);
        setEditableDraft(review.draft);
        setSelectedEntityId(null);
      } else {
        setCommandReview(null);
        setEditableDraft(null);
        setSelectedEntityId(null);
      }

      if (internalRolloutAvailable && internalRolloutEnabledOnDevice) {
        // Intentional diagnostic log, scoped to opted-in internal testers.
        // eslint-disable-next-line no-console
        console.debug('[command][internal-rollout]', execution.observation);
      }
    } catch {
      if (requestId !== reviewRequestId.current) return;
      setParseResult({
        outcome: 'unavailable',
        rawText,
        message: 'The command could not be prepared. Nothing was saved.',
        reasonCode: 'request_failed',
      });
      setParseObservation(null);
      setCommandReview(null);
      setEditableDraft(null);
      setSelectedEntityId(null);
      setExecutionError(null);
    } finally {
      if (requestId === reviewRequestId.current) {
        setIsParsing(false);
      }
    }
  };

  const handleConfirm = async () => {
    if (!editableDraft || !canConfirm) return;

    setIsExecuting(true);
    setExecutionError(null);

    try {
      const review = await prepareCommandReview(editableDraft, { selectedEntityId });
      setCommandReview(review);
      setEditableDraft(review.draft);
      if (review.status !== 'ready') {
        setExecutionError('Resolve the command details before confirming.');
        return;
      }

      const result = await executeDraftAction(review.draft, {
        executionToken: review.executionToken,
        resolvedEntityId: review.resolvedEntityId,
        startFocusSession: onStartFocusSession,
      });
      if (result.outcome === 'success') {
        setSuccessResult(result);
      } else {
        setSuccessResult(null);
        setExecutionError(result.message);
      }
    } catch {
      setSuccessResult(null);
      setExecutionError('The command could not be completed. Nothing else was changed.');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleRawTextChange = (nextText: string) => {
    reviewRequestId.current += 1;
    setRawText(nextText);
    setParseResult(null);
    setEditableDraft(null);
    setCommandReview(null);
    setSelectedEntityId(null);
    setParseObservation(null);
    setExecutionError(null);
    setIsParsing(false);
    setSuccessResult(null);
  };

  const refreshDraftReview = (nextDraft: DraftAiAction, nextSelectedEntityId: string | null) => {
    const requestId = ++reviewRequestId.current;
    setEditableDraft(nextDraft);
    setCommandReview(null);
    setSelectedEntityId(nextSelectedEntityId);
    setExecutionError(null);
    setSuccessResult(null);
    void prepareCommandReview(nextDraft, { selectedEntityId: nextSelectedEntityId })
      .then((review) => {
        if (requestId !== reviewRequestId.current) return;
        setCommandReview(review);
        setEditableDraft(review.draft);
      })
      .catch(() => {
        if (requestId !== reviewRequestId.current) return;
        setExecutionError('The command details could not be refreshed.');
      });
  };

  const handleV2FieldEdit = (field: string, value: string) => {
    if (
      !editableDraft ||
      editableDraft.kind === 'create_todo' ||
      editableDraft.kind === 'create_habit'
    ) {
      return;
    }
    refreshDraftReview(updateV2DraftField(editableDraft, field, value), null);
  };

  const handleAmbiguousReferenceSelection = (entityId: string, reference: string) => {
    if (!editableDraft) return;
    const field =
      editableDraft.kind === 'complete_todo' || editableDraft.kind === 'add_todo_to_daily_plan'
        ? 'todoTitle'
        : editableDraft.kind === 'log_habit'
          ? 'habitName'
          : editableDraft.kind === 'log_workout_routine'
            ? 'routineName'
            : editableDraft.kind === 'update_goal_progress'
              ? 'goalTitle'
              : null;
    if (!field) return;
    refreshDraftReview(updateV2DraftField(editableDraft, field, reference), entityId);
  };

  const updateEditableDraftAndReview = (update: (draft: DraftAiAction) => DraftAiAction) => {
    if (!editableDraft) return;
    const nextDraft = update(editableDraft);
    if (nextDraft === editableDraft) return;
    refreshDraftReview(nextDraft, null);
  };

  const hasCommandText = rawText.trim().length > 0;

  if (!COMMAND_EXPERIMENT_ENABLED) {
    return (
      <Screen scroll>
        <ScreenSection>
          <PageHeader
            title="Command center"
            subtitle="This experimental screen is currently disabled."
            actions={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close command center"
                className="rounded-xl border px-3.5 py-2.5"
                style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
                onPress={onRequestClose}
              >
                <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
                  Back
                </Text>
              </Pressable>
            }
          />
        </ScreenSection>
      </Screen>
    );
  }

  const commandContent = (
    <>
      {launchContext ? (
        <CommandSection className="mb-4">
          <LaunchContextCard launchContext={launchContext} />
        </CommandSection>
      ) : null}

      <CommandSection>
        <CommandInputCard
          value={rawText}
          onChangeText={handleRawTextChange}
          placeholder={commandPlaceholder}
          examples={supportedExamples}
          isParsing={isParsing}
          parseDisabled={!hasCommandText || isParsing}
          onParse={handleParseCommand}
        />
      </CommandSection>

      {parseResult?.outcome === 'unsupported' || parseResult?.outcome === 'unavailable' ? (
        <CommandParseResultCard
          outcome={parseResult.outcome}
          message={parseResult.outcome === 'unsupported' ? parseResult.reason : parseResult.message}
          onRetry={handleParseCommand}
          retryDisabled={!hasCommandText || isParsing}
        />
      ) : null}

      {parsedDraft && editableDraft ? (
        <CommandSection className="mb-0">
          <DraftPreview
            parsedDraft={parsedDraft}
            editableDraft={editableDraft}
            review={commandReview}
            visibleMissingFields={visibleMissingFields}
            canConfirm={canConfirm}
            busy={isExecuting}
            executionError={executionError}
            successResult={successResult}
            onEditTodoTitle={(value) => {
              updateEditableDraftAndReview((current) =>
                current.kind === 'create_todo'
                  ? { ...current, fields: { ...current.fields, title: value } }
                  : current,
              );
            }}
            onEditTodoNotes={(value) => {
              updateEditableDraftAndReview((current) =>
                current.kind === 'create_todo'
                  ? { ...current, fields: { ...current.fields, notes: value } }
                  : current,
              );
            }}
            onEditTodoDueDate={(value) => {
              const trimmed = value.trim();
              updateEditableDraftAndReview((current) =>
                current.kind === 'create_todo'
                  ? {
                      ...current,
                      fields: {
                        ...current.fields,
                        dueDate: trimmed.length > 0 ? trimmed : null,
                      },
                    }
                  : current,
              );
            }}
            onSetTodoDueDateToday={() => {
              updateEditableDraftAndReview((current) =>
                current.kind === 'create_todo'
                  ? { ...current, fields: { ...current.fields, dueDate: toDateKey(new Date()) } }
                  : current,
              );
            }}
            onSetTodoDueDateTomorrow={() => {
              updateEditableDraftAndReview((current) =>
                current.kind === 'create_todo'
                  ? { ...current, fields: { ...current.fields, dueDate: getTomorrowDateKey() } }
                  : current,
              );
            }}
            onClearTodoDueDate={() => {
              updateEditableDraftAndReview((current) =>
                current.kind === 'create_todo'
                  ? { ...current, fields: { ...current.fields, dueDate: null } }
                  : current,
              );
            }}
            onEditTodoPriority={(value) => {
              updateEditableDraftAndReview((current) =>
                current.kind === 'create_todo'
                  ? { ...current, fields: { ...current.fields, priority: value } }
                  : current,
              );
            }}
            onEditHabitName={(value) => {
              updateEditableDraftAndReview((current) =>
                current.kind === 'create_habit'
                  ? { ...current, fields: { ...current.fields, name: value } }
                  : current,
              );
            }}
            onEditHabitTargetPerDay={(value) => {
              const nextValue = value.trim();
              const parsedValue = nextValue.length > 0 ? Number(nextValue) : Number.NaN;
              updateEditableDraftAndReview((current) =>
                current.kind === 'create_habit'
                  ? { ...current, fields: { ...current.fields, targetPerDay: parsedValue } }
                  : current,
              );
            }}
            onEditHabitCategory={(value) => {
              updateEditableDraftAndReview((current) =>
                current.kind === 'create_habit'
                  ? { ...current, fields: { ...current.fields, category: value } }
                  : current,
              );
            }}
            onEditV2Field={handleV2FieldEdit}
            onSelectAmbiguousReference={handleAmbiguousReferenceSelection}
            onConfirm={handleConfirm}
            onReset={handleReset}
            onNavigateToDestination={(section) => {
              onNavigateToDestination?.(section);
              onRequestClose?.();
            }}
          />
        </CommandSection>
      ) : null}

      {internalRolloutAvailable && internalRolloutEnabledOnDevice && parseObservation ? (
        <CommandSection className="mb-0">
          <InternalMetadataCard observation={parseObservation} />
        </CommandSection>
      ) : null}
    </>
  );

  if (!AI_ASK_EXPERIMENT_ENABLED) {
    return <View className="gap-4 pb-1 pt-1">{commandContent}</View>;
  }

  return (
    <View className="gap-4 pb-1 pt-1">
      <ModeToggle mode={mode} onChange={handleModeChange} />
      {mode === 'create' ? commandContent : null}
      {mode === 'ask' ? <AskConversationView placeholder={commandPlaceholder} /> : null}
      {mode === 'auto' ? (
        <AutoModeView placeholder={commandPlaceholder} onSwitchToMode={handleModeChange} />
      ) : null}
    </View>
  );
}
