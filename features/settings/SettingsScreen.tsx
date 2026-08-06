import { useCallback, useEffect, useMemo, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text } from 'react-native';
import { useAppBootstrapState } from '@/core/providers/AppProviders';
import { useAppTheme } from '@/core/providers/ThemeProvider';
import { getRestorePreview, restoreFromRemoteBackup } from '@/core/sync/restore.coordinator';
import type { RestorePreview } from '@/core/sync/restore.types';
import { syncEngine } from '@/core/sync/sync.engine';
import { PageHeader } from '@/core/ui/PageHeader';
import { Screen } from '@/core/ui/Screen';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { DEFAULT_GOAL, getCalorieGoal, setCalorieGoal } from '@/features/calories/calories.data';
import type { CalorieGoal } from '@/features/calories/types';
import {
  getAiCommandParseConfig,
  isAiCommandInternalRolloutAvailable,
} from '@/features/command/commandConfig';
import {
  getAiCommandInternalRolloutPreference,
  setAiCommandInternalRolloutPreference,
} from '@/features/command/commandInternalRollout';
import { useCommandCenter } from '@/features/command/CommandCenterProvider';
import { getPomodoroSettings, savePomodoroSettings } from '@/features/pomodoro/pomodoro.data';
import { DEFAULT_SETTINGS, type PomodoroSettings } from '@/features/pomodoro/pomodoro.domain';
import { validateCalorieGoal, validatePomodoroSettings } from '@/lib/validation';
import { maybeLoadRestorePreviewForSettings } from '@/features/settings/settingsRestorePreview';
import { SettingsAppearanceSection } from '@/features/settings/SettingsAppearanceSection';
import { SettingsBackupSection } from '@/features/settings/SettingsBackupSection';
import { SettingsCaloriesSection } from '@/features/settings/SettingsCaloriesSection';
import { SettingsCommandSection } from '@/features/settings/SettingsCommandSection';
import { SettingsDeveloperSection } from '@/features/settings/SettingsDeveloperSection';
import { SettingsPomodoroSection } from '@/features/settings/SettingsPomodoroSection';
import {
  buildCalorieGoalForm,
  buildPomodoroForm,
  describeOutboxStatus,
  type CalorieGoalFormState,
  type OutboxSummary,
  type PomodoroFormState,
} from '@/features/settings/settingsShared';

type SettingsScreenProps = {
  visible: boolean;
  onRequestClose: () => void;
};

export function SettingsScreen({ visible, onRequestClose }: SettingsScreenProps) {
  const { mode, resolvedTheme, themeId, setMode, setTheme, tokens } = useAppTheme();
  const { authBootstrapReady } = useAppBootstrapState();
  const { openCommandCenter } = useCommandCenter();
  const commandConfig = useMemo(() => getAiCommandParseConfig(), []);
  const commandInternalRolloutAvailable = useMemo(
    () => isAiCommandInternalRolloutAvailable(commandConfig),
    [commandConfig],
  );
  const [outboxSummary, setOutboxSummary] = useState<OutboxSummary>(() =>
    describeOutboxStatus(syncEngine.getPendingCount(), syncEngine.getStatus()),
  );
  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(true);
  const [restoreRunning, setRestoreRunning] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [commandRolloutEnabledOnDevice, setCommandRolloutEnabledOnDevice] = useState(false);
  const [commandRolloutLoading, setCommandRolloutLoading] = useState(
    commandInternalRolloutAvailable,
  );
  const [commandRolloutError, setCommandRolloutError] = useState<string | null>(null);
  const [pomodoroSettings, setPomodoroSettingsState] = useState<PomodoroSettings>(DEFAULT_SETTINGS);
  const [pomodoroForm, setPomodoroForm] = useState<PomodoroFormState>(
    buildPomodoroForm(DEFAULT_SETTINGS),
  );
  const [pomodoroLoading, setPomodoroLoading] = useState(true);
  const [pomodoroSaving, setPomodoroSaving] = useState(false);
  const [pomodoroError, setPomodoroError] = useState<string | null>(null);
  const [calorieGoal, setCalorieGoalState] = useState<CalorieGoal>(DEFAULT_GOAL);
  const [calorieGoalForm, setCalorieGoalForm] = useState<CalorieGoalFormState>(
    buildCalorieGoalForm(DEFAULT_GOAL),
  );
  const [calorieGoalLoading, setCalorieGoalLoading] = useState(true);
  const [calorieGoalSaving, setCalorieGoalSaving] = useState(false);
  const [calorieGoalError, setCalorieGoalError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      setOutboxSummary(describeOutboxStatus(syncEngine.getPendingCount(), syncEngine.getStatus()));
    };
    refresh();
    const intervalId = setInterval(refresh, 5_000);
    return () => clearInterval(intervalId);
  }, []);

  const loadRestorePreview = useCallback(async () => {
    setRestoreLoading(true);
    try {
      const preview = await getRestorePreview();
      setRestorePreview(preview);
      setRestoreError(null);
    } catch (err) {
      console.error('[SettingsScreen] getRestorePreview failed', err);
      setRestoreError('Unable to load backup status right now.');
    } finally {
      setRestoreLoading(false);
    }
  }, []);

  const loadCommandRolloutPreference = useCallback(async () => {
    if (!commandInternalRolloutAvailable) {
      setCommandRolloutEnabledOnDevice(false);
      setCommandRolloutLoading(false);
      setCommandRolloutError(null);
      return;
    }

    setCommandRolloutLoading(true);
    try {
      const enabled = await getAiCommandInternalRolloutPreference();
      setCommandRolloutEnabledOnDevice(enabled);
      setCommandRolloutError(null);
    } catch {
      setCommandRolloutEnabledOnDevice(false);
      setCommandRolloutError('Unable to load the internal parser toggle right now.');
    } finally {
      setCommandRolloutLoading(false);
    }
  }, [commandInternalRolloutAvailable]);

  const loadPomodoroDefaults = useCallback(async () => {
    setPomodoroLoading(true);
    try {
      const nextSettings = await getPomodoroSettings();
      setPomodoroSettingsState(nextSettings);
      setPomodoroForm(buildPomodoroForm(nextSettings));
      setPomodoroError(null);
    } catch (err) {
      console.error('[SettingsScreen] getPomodoroSettings failed', err);
      setPomodoroError('Unable to load timer defaults right now.');
    } finally {
      setPomodoroLoading(false);
    }
  }, []);

  const loadCalorieDefaults = useCallback(async () => {
    setCalorieGoalLoading(true);
    try {
      const nextGoal = await getCalorieGoal();
      setCalorieGoalState(nextGoal);
      setCalorieGoalForm(buildCalorieGoalForm(nextGoal));
      setCalorieGoalError(null);
    } catch (err) {
      console.error('[SettingsScreen] getCalorieGoal failed', err);
      setCalorieGoalError('Unable to load nutrition defaults right now.');
    } finally {
      setCalorieGoalLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    void maybeLoadRestorePreviewForSettings({
      authBootstrapReady,
      loadRestorePreview,
      onAuthBootstrapping: () => {
        setRestoreLoading(true);
        setRestoreError(null);
      },
    });
    void loadCommandRolloutPreference();
    void loadPomodoroDefaults();
    void loadCalorieDefaults();
  }, [
    visible,
    authBootstrapReady,
    loadCalorieDefaults,
    loadCommandRolloutPreference,
    loadPomodoroDefaults,
    loadRestorePreview,
  ]);

  const handleRestore = async () => {
    setRestoreRunning(true);
    setRestoreError(null);
    try {
      const result = await restoreFromRemoteBackup();
      if (result.status === 'blocked') {
        setRestoreError(result.preview.eligibility.message);
      }
      await loadRestorePreview();
    } catch (err) {
      console.error('[SettingsScreen] restoreFromRemoteBackup failed', err);
      setRestoreError('Restore failed. Your current local data was left unchanged.');
    } finally {
      setRestoreRunning(false);
    }
  };

  const handleCommandRolloutToggle = async (enabled: boolean) => {
    setCommandRolloutLoading(true);
    setCommandRolloutError(null);

    try {
      await setAiCommandInternalRolloutPreference(enabled);
      setCommandRolloutEnabledOnDevice(enabled);
    } catch {
      setCommandRolloutError('Unable to update the internal parser toggle right now.');
    } finally {
      setCommandRolloutLoading(false);
    }
  };

  const handleSavePomodoroDefaults = async () => {
    const nextError = validatePomodoroSettings(
      pomodoroForm.focusMinutes,
      pomodoroForm.shortBreakMinutes,
      pomodoroForm.longBreakMinutes,
      pomodoroForm.sessionsBeforeLongBreak,
    );
    if (nextError) {
      setPomodoroError(nextError);
      return;
    }

    const nextSettings: PomodoroSettings = {
      focusMinutes: Number(pomodoroForm.focusMinutes.trim()),
      shortBreakMinutes: Number(pomodoroForm.shortBreakMinutes.trim()),
      longBreakMinutes: Number(pomodoroForm.longBreakMinutes.trim()),
      sessionsBeforeLongBreak: Number(pomodoroForm.sessionsBeforeLongBreak.trim()),
    };

    setPomodoroSaving(true);
    try {
      await savePomodoroSettings(nextSettings);
      setPomodoroSettingsState(nextSettings);
      setPomodoroForm(buildPomodoroForm(nextSettings));
      setPomodoroError(null);
    } catch (err) {
      console.error('[SettingsScreen] savePomodoroSettings failed', err);
      setPomodoroError('Unable to save timer defaults right now.');
    } finally {
      setPomodoroSaving(false);
    }
  };

  const handleSaveCalorieGoal = async () => {
    const nextError = validateCalorieGoal(
      calorieGoalForm.calories,
      calorieGoalForm.protein,
      calorieGoalForm.carbs,
      calorieGoalForm.fats,
    );
    if (nextError) {
      setCalorieGoalError(nextError);
      return;
    }

    const nextGoal: CalorieGoal = {
      calories: Number(calorieGoalForm.calories.trim()),
      protein: Number(calorieGoalForm.protein.trim()),
      carbs: Number(calorieGoalForm.carbs.trim()),
      fats: Number(calorieGoalForm.fats.trim()),
    };

    setCalorieGoalSaving(true);
    try {
      await setCalorieGoal(nextGoal);
      setCalorieGoalState(nextGoal);
      setCalorieGoalForm(buildCalorieGoalForm(nextGoal));
      setCalorieGoalError(null);
    } catch (err) {
      console.error('[SettingsScreen] setCalorieGoal failed', err);
      setCalorieGoalError('Unable to save nutrition defaults right now.');
    } finally {
      setCalorieGoalSaving(false);
    }
  };

  const handlePomodoroFieldChange = (field: keyof PomodoroFormState, value: string) => {
    setPomodoroError(null);
    setPomodoroForm((current) => ({ ...current, [field]: value }));
  };

  const handlePomodoroRevert = () => {
    setPomodoroError(null);
    setPomodoroForm(buildPomodoroForm(pomodoroSettings));
  };

  const handleCalorieFieldChange = (field: keyof CalorieGoalFormState, value: string) => {
    setCalorieGoalError(null);
    setCalorieGoalForm((current) => ({ ...current, [field]: value }));
  };

  const handleCalorieRevert = () => {
    setCalorieGoalError(null);
    setCalorieGoalForm(buildCalorieGoalForm(calorieGoal));
  };

  return (
    <Screen scroll>
      <ScreenSection>
        <PageHeader
          title="Settings"
          subtitle="Everyday settings come first. Internal tools stay separate at the bottom."
          actions={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close settings"
              className="ml-4 flex-row items-center gap-1.5 rounded-2xl border px-3.5 py-2.5"
              style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
              onPress={onRequestClose}
            >
              <MaterialIcons name="arrow-back" size={18} color={tokens.textMuted} />
              <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
                Back
              </Text>
            </Pressable>
          }
        />
      </ScreenSection>

      <SettingsAppearanceSection
        mode={mode}
        resolvedTheme={resolvedTheme}
        themeId={themeId}
        onSelectMode={setMode}
        onSelectTheme={setTheme}
      />

      <SettingsBackupSection
        outboxSummary={outboxSummary}
        restorePreview={restorePreview}
        restoreLoading={restoreLoading}
        restoreRunning={restoreRunning}
        restoreError={restoreError}
        onRestore={handleRestore}
      />

      <SettingsCommandSection
        commandInternalRolloutAvailable={commandInternalRolloutAvailable}
        commandRolloutEnabledOnDevice={commandRolloutEnabledOnDevice}
        commandRolloutLoading={commandRolloutLoading}
        onOpenCommandCenter={() => openCommandCenter('overview')}
      />

      <SettingsPomodoroSection
        pomodoroSettings={pomodoroSettings}
        pomodoroForm={pomodoroForm}
        pomodoroLoading={pomodoroLoading}
        pomodoroSaving={pomodoroSaving}
        pomodoroError={pomodoroError}
        onFieldChange={handlePomodoroFieldChange}
        onSave={handleSavePomodoroDefaults}
        onRevert={handlePomodoroRevert}
      />

      <SettingsCaloriesSection
        calorieGoal={calorieGoal}
        calorieGoalForm={calorieGoalForm}
        calorieGoalLoading={calorieGoalLoading}
        calorieGoalSaving={calorieGoalSaving}
        calorieGoalError={calorieGoalError}
        onFieldChange={handleCalorieFieldChange}
        onSave={handleSaveCalorieGoal}
        onRevert={handleCalorieRevert}
      />

      <SettingsDeveloperSection
        commandInternalRolloutAvailable={commandInternalRolloutAvailable}
        commandRolloutEnabledOnDevice={commandRolloutEnabledOnDevice}
        commandRolloutLoading={commandRolloutLoading}
        commandRolloutError={commandRolloutError}
        onToggleParserRollout={handleCommandRolloutToggle}
      />
    </Screen>
  );
}
