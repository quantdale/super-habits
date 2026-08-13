import { useEffect, useMemo, useState } from 'react';

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

type CommandScreenProps = {
  launchContext?: CommandCenterLaunchContext | null;
  onRequestClose?: () => void;
  onNavigateToDestination?: (section: AppSection) => void;
};

function cloneDraft(draft: DraftAiAction): DraftAiAction {
  return draft.kind === 'create_todo'
    ? { ...draft, fields: { ...draft.fields } }
    : { ...draft, fields: { ...draft.fields } };
}

function getInlineRequiredMissingFields(draft: DraftAiAction): DraftMissingField[] {
  if (draft.kind === 'create_todo') {
    return draft.fields.title?.trim()
      ? []
      : [{ field: 'title', message: 'Add the task title before saving.' }];
  }

  return draft.fields.name?.trim()
    ? []
    : [{ field: 'name', message: 'Add the habit name before saving.' }];
}

function isFieldStillMissing(draft: DraftAiAction, field: string): boolean {
  if (draft.kind === 'create_todo' && field === 'title') {
    return !draft.fields.title?.trim();
  }

  if (draft.kind === 'create_habit' && field === 'name') {
    return !draft.fields.name?.trim();
  }

  return false;
}

export function CommandScreen({
  launchContext = null,
  onRequestClose,
  onNavigateToDestination,
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
    () => (parseResult?.outcome === 'draft' ? parseResult.draft : null),
    [parseResult],
  );
  const visibleMissingFields = useMemo(() => {
    if (!editableDraft || !parsedDraft) return [];

    const unresolvedParseMissing = parsedDraft.missingFields.filter((missing) =>
      isFieldStillMissing(editableDraft, missing.field),
    );
    const inlineRequiredMissing = getInlineRequiredMissingFields(editableDraft).filter(
      (missing) => !unresolvedParseMissing.some((existing) => existing.field === missing.field),
    );

    return [...unresolvedParseMissing, ...inlineRequiredMissing];
  }, [editableDraft, parsedDraft]);
  const canConfirm = useMemo(
    () => (editableDraft ? getInlineRequiredMissingFields(editableDraft).length === 0 : false),
    [editableDraft],
  );

  const handleReset = () => {
    setRawText('');
    setParseResult(null);
    setEditableDraft(null);
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
    try {
      const execution = await commandParser.parseWithObservation({
        rawText,
        now,
        locale: parserContext.locale,
        timeZone: parserContext.timeZone,
        todayDateKey: toDateKey(now),
        tomorrowDateKey: getTomorrowDateKey(now),
      });
      setParseResult(execution.result);
      setParseObservation(execution.observation);
      setEditableDraft(
        execution.result.outcome === 'draft' ? cloneDraft(execution.result.draft) : null,
      );

      if (internalRolloutAvailable && internalRolloutEnabledOnDevice) {
        // Intentional diagnostic log, scoped to opted-in internal testers.
        // eslint-disable-next-line no-console
        console.debug('[command][internal-rollout]', execution.observation);
      }
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirm = async () => {
    if (!editableDraft || !canConfirm) return;

    setIsExecuting(true);
    setExecutionError(null);

    const result = await executeDraftAction(editableDraft);
    if (result.outcome === 'success') {
      setSuccessResult(result);
    } else {
      setSuccessResult(null);
      setExecutionError(result.message);
    }

    setIsExecuting(false);
  };

  const handleRawTextChange = (nextText: string) => {
    setRawText(nextText);
    setParseResult(null);
    setEditableDraft(null);
    setParseObservation(null);
    setExecutionError(null);
    setIsParsing(false);
    setSuccessResult(null);
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
            visibleMissingFields={visibleMissingFields}
            canConfirm={canConfirm}
            busy={isExecuting}
            executionError={executionError}
            successResult={successResult}
            onEditTodoTitle={(value) => {
              setEditableDraft((current) =>
                current?.kind === 'create_todo'
                  ? { ...current, fields: { ...current.fields, title: value } }
                  : current,
              );
              setExecutionError(null);
              setSuccessResult(null);
            }}
            onEditTodoNotes={(value) => {
              setEditableDraft((current) =>
                current?.kind === 'create_todo'
                  ? { ...current, fields: { ...current.fields, notes: value } }
                  : current,
              );
              setExecutionError(null);
              setSuccessResult(null);
            }}
            onEditTodoDueDate={(value) => {
              const trimmed = value.trim();
              setEditableDraft((current) =>
                current?.kind === 'create_todo'
                  ? {
                      ...current,
                      fields: {
                        ...current.fields,
                        dueDate: trimmed.length > 0 ? trimmed : null,
                      },
                    }
                  : current,
              );
              setExecutionError(null);
              setSuccessResult(null);
            }}
            onSetTodoDueDateToday={() => {
              setEditableDraft((current) =>
                current?.kind === 'create_todo'
                  ? { ...current, fields: { ...current.fields, dueDate: toDateKey(new Date()) } }
                  : current,
              );
              setExecutionError(null);
              setSuccessResult(null);
            }}
            onSetTodoDueDateTomorrow={() => {
              setEditableDraft((current) =>
                current?.kind === 'create_todo'
                  ? { ...current, fields: { ...current.fields, dueDate: getTomorrowDateKey() } }
                  : current,
              );
              setExecutionError(null);
              setSuccessResult(null);
            }}
            onClearTodoDueDate={() => {
              setEditableDraft((current) =>
                current?.kind === 'create_todo'
                  ? { ...current, fields: { ...current.fields, dueDate: null } }
                  : current,
              );
              setExecutionError(null);
              setSuccessResult(null);
            }}
            onEditTodoPriority={(value) => {
              setEditableDraft((current) =>
                current?.kind === 'create_todo'
                  ? { ...current, fields: { ...current.fields, priority: value } }
                  : current,
              );
              setExecutionError(null);
              setSuccessResult(null);
            }}
            onEditHabitName={(value) => {
              setEditableDraft((current) =>
                current?.kind === 'create_habit'
                  ? { ...current, fields: { ...current.fields, name: value } }
                  : current,
              );
              setExecutionError(null);
              setSuccessResult(null);
            }}
            onEditHabitTargetPerDay={(value) => {
              const nextValue = value.trim();
              const parsedValue = nextValue.length > 0 ? Number(nextValue) : Number.NaN;
              setEditableDraft((current) =>
                current?.kind === 'create_habit'
                  ? { ...current, fields: { ...current.fields, targetPerDay: parsedValue } }
                  : current,
              );
              setExecutionError(null);
              setSuccessResult(null);
            }}
            onEditHabitCategory={(value) => {
              setEditableDraft((current) =>
                current?.kind === 'create_habit'
                  ? { ...current, fields: { ...current.fields, category: value } }
                  : current,
              );
              setExecutionError(null);
              setSuccessResult(null);
            }}
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
