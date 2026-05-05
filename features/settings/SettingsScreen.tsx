import { useCallback, useMemo, useState } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { Link, type Href, useFocusEffect } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useAppBootstrapState } from "@/core/providers/AppProviders";
import { type ThemeMode, useAppTheme } from "@/core/providers/ThemeProvider";
import { getRestorePreview, restoreFromRemoteBackup } from "@/core/sync/restore.coordinator";
import type {
  RemoteBackupEntityStatus,
  RestorePreview,
  SyncBackedEntity,
} from "@/core/sync/restore.types";
import { Button } from "@/core/ui/Button";
import { Card } from "@/core/ui/Card";
import { NumberStepperField } from "@/core/ui/NumberStepperField";
import { PageHeader } from "@/core/ui/PageHeader";
import { PillChip } from "@/core/ui/PillChip";
import { Screen } from "@/core/ui/Screen";
import { ScreenSection } from "@/core/ui/ScreenSection";
import { ValidationError } from "@/core/ui/ValidationError";
import {
  POMODORO_SECTION_KEY,
  SECTION_COLORS,
} from "@/constants/sectionColors";
import {
  DEFAULT_GOAL,
  getCalorieGoal,
  setCalorieGoal,
} from "@/features/calories/calories.data";
import type { CalorieGoal } from "@/features/calories/types";
import {
  getAiCommandParseConfig,
  isAiCommandInternalRolloutAvailable,
} from "@/features/command/commandConfig";
import {
  getAiCommandInternalRolloutPreference,
  setAiCommandInternalRolloutPreference,
} from "@/features/command/commandInternalRollout";
import { COMMAND_EXPERIMENT_ENABLED } from "@/features/command/types";
import { maybeLoadRestorePreviewForSettings } from "@/features/settings/settingsRestorePreview";
import {
  getPomodoroSettings,
  savePomodoroSettings,
} from "@/features/pomodoro/pomodoro.data";
import { DEFAULT_SETTINGS, type PomodoroSettings } from "@/features/pomodoro/pomodoro.domain";
import { validateCalorieGoal, validatePomodoroSettings } from "@/lib/validation";

const OVERVIEW_HREF = "/(tabs)/overview" as Href;
const COMMAND_HREF = "/command" as Href;
const SETTINGS_ACCENT = "#475569";
const BACKUP_ACCENT = "#0f766e";
const INTERNAL_ACCENT = "#7c2d12";

type SettingsStatusTone = "neutral" | "accent" | "warning" | "danger";

type SettingsRowProps = {
  label: string;
  description: string;
  statusLabel?: string;
  statusTone?: SettingsStatusTone;
  accentColor?: string;
  first?: boolean;
  last?: boolean;
};

type SettingsSectionHeadingProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  accentColor: string;
};

type PomodoroFormState = {
  focusMinutes: string;
  shortBreakMinutes: string;
  longBreakMinutes: string;
  sessionsBeforeLongBreak: string;
};

type CalorieGoalFormState = {
  calories: string;
  protein: string;
  carbs: string;
  fats: string;
};

const THEME_OPTIONS: Array<{
  mode: ThemeMode;
  label: string;
  description: string;
}> = [
  {
    mode: "system",
    label: "System",
    description: "Follow your device setting automatically.",
  },
  {
    mode: "light",
    label: "Light",
    description: "Always use the light theme.",
  },
  {
    mode: "dark",
    label: "Dark",
    description: "Always use the dark theme.",
  },
];

const RESTORE_ENTITY_ORDER: SyncBackedEntity[] = [
  "todos",
  "habits",
  "calorie_entries",
  "workout_routines",
];

const RESTORE_ENTITY_LABELS: Record<SyncBackedEntity, string> = {
  todos: "Todos backup",
  habits: "Habits backup",
  calorie_entries: "Calories backup",
  workout_routines: "Workout backup",
};

function SettingsStatusPill({
  label,
  tone = "neutral",
  accentColor = SETTINGS_ACCENT,
}: {
  label: string;
  tone?: SettingsStatusTone;
  accentColor?: string;
}) {
  const { tokens } = useAppTheme();

  const backgroundColor =
    tone === "accent"
      ? `${accentColor}18`
      : tone === "warning"
        ? tokens.warningBackground
        : tone === "danger"
          ? tokens.dangerBackground
          : tokens.surfaceElevated;

  const textColor =
    tone === "accent"
      ? accentColor
      : tone === "warning"
        ? tokens.warningText
        : tone === "danger"
          ? tokens.dangerText
          : tokens.iconMuted;

  return (
    <View className="rounded-full px-3 py-1.5" style={{ backgroundColor }}>
      <Text
        className="text-[11px] font-semibold uppercase tracking-[1px]"
        style={{ color: textColor }}
      >
        {label}
      </Text>
    </View>
  );
}

function SettingsRow({
  label,
  description,
  statusLabel,
  statusTone = "neutral",
  accentColor = SETTINGS_ACCENT,
  first = false,
  last = false,
}: SettingsRowProps) {
  const { tokens } = useAppTheme();

  return (
    <View
      className={[!first ? "pt-3" : "", !last ? "border-b pb-3" : ""].filter(Boolean).join(" ")}
      style={!last ? { borderColor: tokens.border } : undefined}
    >
      <View className="flex-row items-start gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
            {label}
          </Text>
          <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
            {description}
          </Text>
        </View>
        {statusLabel ? (
          <SettingsStatusPill
            label={statusLabel}
            tone={statusTone}
            accentColor={accentColor}
          />
        ) : null}
      </View>
    </View>
  );
}

function SettingsSectionHeading({
  eyebrow,
  title,
  subtitle,
  icon,
  accentColor,
}: SettingsSectionHeadingProps) {
  const { tokens } = useAppTheme();

  return (
    <View className="mb-3 flex-row items-start gap-3">
      <View
        className="h-12 w-12 items-center justify-center rounded-2xl"
        style={{ backgroundColor: `${accentColor}18` }}
      >
        <MaterialIcons name={icon} size={24} color={accentColor} />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className="text-[11px] font-semibold uppercase tracking-[1.2px]"
          style={{ color: accentColor }}
        >
          {eyebrow}
        </Text>
        <Text className="mt-1 text-xl font-semibold" style={{ color: tokens.text }}>
          {title}
        </Text>
        <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

function getAppearanceSummary(mode: ThemeMode, resolvedTheme: "light" | "dark") {
  if (mode === "system") {
    return {
      summary: `Following your device setting. ${resolvedTheme[0].toUpperCase() + resolvedTheme.slice(1)} mode is active right now.`,
      detail:
        "System mode updates automatically when your device appearance changes.",
    };
  }

  return {
    summary: `Using ${mode} mode across the app.`,
    detail: `SuperHabits will stay in ${mode} mode until you change it here.`,
  };
}

function formatBackupTime(value: string | null) {
  if (!value) return "No restorable backup timestamp is available yet.";
  return new Date(value).toLocaleString();
}

function describeBackupEntity(status: RemoteBackupEntityStatus) {
  if (status.phaseOneStatus === "excluded_in_phase_one") {
    const countLabel =
      status.remoteRowCount === null
        ? "Remote status unavailable."
        : `${status.remoteRowCount} remote rows.`;
    return `${countLabel} ${status.reason}`;
  }

  if (status.remoteState === "available") {
    return `${status.remoteRowCount ?? 0} rows backed up.${status.latestUpdatedAt ? ` Latest change: ${formatBackupTime(status.latestUpdatedAt)}` : ""}`;
  }

  if (status.remoteState === "empty") {
    return "No remote rows are backed up for this entity yet.";
  }

  if (status.remoteState === "unavailable") {
    return "Remote backup is not configured in this build.";
  }

  return status.errorMessage
    ? `Backup status failed to load: ${status.errorMessage}`
    : "Backup status failed to load.";
}

function buildPomodoroForm(settings: PomodoroSettings): PomodoroFormState {
  return {
    focusMinutes: String(settings.focusMinutes),
    shortBreakMinutes: String(settings.shortBreakMinutes),
    longBreakMinutes: String(settings.longBreakMinutes),
    sessionsBeforeLongBreak: String(settings.sessionsBeforeLongBreak),
  };
}

function buildCalorieGoalForm(goal: CalorieGoal): CalorieGoalFormState {
  return {
    calories: String(goal.calories),
    protein: String(goal.protein),
    carbs: String(goal.carbs),
    fats: String(goal.fats),
  };
}

function formatPomodoroSummary(settings: PomodoroSettings) {
  return `${settings.focusMinutes}m focus, ${settings.shortBreakMinutes}m short break, ${settings.longBreakMinutes}m long break, long break every ${settings.sessionsBeforeLongBreak} focus sessions.`;
}

function formatCalorieGoalSummary(goal: CalorieGoal) {
  return `${goal.calories} kcal, ${goal.protein}g protein, ${goal.carbs}g carbs, ${goal.fats}g fats.`;
}

export function SettingsScreen() {
  const { mode, resolvedTheme, setMode, tokens } = useAppTheme();
  const { authBootstrapReady } = useAppBootstrapState();
  const commandConfig = useMemo(() => getAiCommandParseConfig(), []);
  const commandInternalRolloutAvailable = useMemo(
    () => isAiCommandInternalRolloutAvailable(commandConfig),
    [commandConfig],
  );
  const appearanceCopy = getAppearanceSummary(mode, resolvedTheme);
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

  const loadRestorePreview = useCallback(async () => {
    setRestoreLoading(true);
    try {
      const preview = await getRestorePreview();
      setRestorePreview(preview);
      setRestoreError(null);
    } catch (err) {
      console.error("[SettingsScreen] getRestorePreview failed", err);
      setRestoreError("Unable to load backup status right now.");
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
      setCommandRolloutError("Unable to load the internal parser toggle right now.");
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
      console.error("[SettingsScreen] getPomodoroSettings failed", err);
      setPomodoroError("Unable to load timer defaults right now.");
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
      console.error("[SettingsScreen] getCalorieGoal failed", err);
      setCalorieGoalError("Unable to load nutrition defaults right now.");
    } finally {
      setCalorieGoalLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
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
      authBootstrapReady,
      loadCalorieDefaults,
      loadCommandRolloutPreference,
      loadPomodoroDefaults,
      loadRestorePreview,
    ]),
  );

  const handleRestore = async () => {
    setRestoreRunning(true);
    setRestoreError(null);
    try {
      const result = await restoreFromRemoteBackup();
      if (result.status === "blocked") {
        setRestoreError(result.preview.eligibility.message);
      }
      await loadRestorePreview();
    } catch (err) {
      console.error("[SettingsScreen] restoreFromRemoteBackup failed", err);
      setRestoreError("Restore failed. Your current local data was left unchanged.");
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
      setCommandRolloutError("Unable to update the internal parser toggle right now.");
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
      console.error("[SettingsScreen] savePomodoroSettings failed", err);
      setPomodoroError("Unable to save timer defaults right now.");
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
      console.error("[SettingsScreen] setCalorieGoal failed", err);
      setCalorieGoalError("Unable to save nutrition defaults right now.");
    } finally {
      setCalorieGoalSaving(false);
    }
  };

  const restoreButtonDisabled =
    restoreLoading ||
    restoreRunning ||
    !restorePreview ||
    restorePreview.eligibility.kind !== "empty_device";
  const restoreButtonLabel = restoreRunning ? "Restoring..." : "Restore backup";

  const latestBackupStatusLabel = restoreLoading
    ? "Loading"
    : restorePreview?.remoteAvailable
      ? "Available"
      : restorePreview?.eligibility.kind === "blocked" &&
          restorePreview.eligibility.reason === "remote_disabled"
        ? "Local only"
        : "Not ready";

  const latestBackupStatusTone: SettingsStatusTone =
    latestBackupStatusLabel === "Available"
      ? "accent"
      : latestBackupStatusLabel === "Loading"
        ? "neutral"
        : latestBackupStatusLabel === "Local only"
          ? "warning"
          : "neutral";

  const restoreEligibilityLabel = restoreLoading
    ? "Loading"
    : restorePreview?.eligibility.kind === "empty_device"
      ? "Allowed"
      : "Blocked";

  const effectiveParserLabel = commandRolloutLoading
    ? "Loading"
    : commandInternalRolloutAvailable && commandRolloutEnabledOnDevice
      ? "Model"
      : "Mock";

  const effectiveParserDescription = commandInternalRolloutAvailable
    ? commandRolloutEnabledOnDevice
      ? "Model-backed parsing is enabled on this device. You can turn it off in Developer / Internal to fall back to the mock parser immediately."
      : "The command shell still defaults to the local mock parser. Internal testers can opt in from Developer / Internal."
    : "This build keeps the command shell on the local mock parser only.";

  return (
    <Screen scroll>
      <ScreenSection>
        <PageHeader
          title="Settings"
          subtitle="Everyday settings come first. Internal tools stay separate at the bottom."
          actions={
            <Link href={OVERVIEW_HREF} asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to overview"
                className="ml-4 flex-row items-center gap-1.5 rounded-2xl border px-3.5 py-2.5"
                style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
              >
                <MaterialIcons name="arrow-back" size={18} color={SETTINGS_ACCENT} />
                <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
                  Back
                </Text>
              </Pressable>
            </Link>
          }
        />
      </ScreenSection>

      <ScreenSection>
        <SettingsSectionHeading
          eyebrow="Appearance"
          title="Theme and display"
          subtitle="Visual preferences that apply across the app."
          icon="palette"
          accentColor={SETTINGS_ACCENT}
        />
        <Card accentColor={SETTINGS_ACCENT} className="mb-0">
          <View className="gap-4">
            <View>
              <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
                Theme mode
              </Text>
              <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
                Choose how SuperHabits should look on this device.
              </Text>
            </View>

            <View className="flex-row flex-wrap">
              {THEME_OPTIONS.map((option) => (
                <PillChip
                  key={option.mode}
                  label={option.label}
                  active={mode === option.mode}
                  color={SETTINGS_ACCENT}
                  onPress={() => setMode(option.mode)}
                />
              ))}
            </View>

            <SettingsRow
              first
              label="Current selection"
              description={`${THEME_OPTIONS.find((option) => option.mode === mode)?.description} ${appearanceCopy.detail}`}
              statusLabel={mode}
              statusTone="accent"
              accentColor={SETTINGS_ACCENT}
            />
            <SettingsRow
              label="Current behavior"
              description={appearanceCopy.summary}
              statusLabel={resolvedTheme}
              last
            />
          </View>
        </Card>
      </ScreenSection>

      <ScreenSection>
        <SettingsSectionHeading
          eyebrow="Backup / Sync / Restore"
          title="Backup status and restore"
          subtitle="Remote backup status and phase-one restore. This is backup sync, not full two-way sync."
          icon="cloud-sync"
          accentColor={BACKUP_ACCENT}
        />
        <View className="gap-3">
          <Card accentColor={BACKUP_ACCENT} className="mb-0">
            <SettingsRow
              first
              label="Latest restorable backup"
              description={
                restoreLoading
                  ? "Checking remote backup status..."
                  : formatBackupTime(restorePreview?.latestRestorableBackupAt ?? null)
              }
              statusLabel={latestBackupStatusLabel}
              statusTone={latestBackupStatusTone}
              accentColor={BACKUP_ACCENT}
            />
            <SettingsRow
              label="Restore rule"
              description={
                restoreLoading
                  ? "Checking whether this device is still eligible for phase-one restore."
                  : restorePreview?.eligibility.message ?? "Backup status is not available yet."
              }
              statusLabel={restoreEligibilityLabel}
              statusTone={
                restoreEligibilityLabel === "Allowed"
                  ? "accent"
                  : restoreEligibilityLabel === "Blocked"
                    ? "warning"
                    : "neutral"
              }
              accentColor={BACKUP_ACCENT}
            />
            <SettingsRow
              label="Current backup model"
              description="Backups push synced rows to the remote account. Restore is cautious and empty-device only in this phase, so this page should not be read as full sync or merge support."
              statusLabel="Backup"
              last
            />

            <ValidationError message={restoreError} />
            <Button
              label={restoreButtonLabel}
              onPress={handleRestore}
              disabled={restoreButtonDisabled}
              color={BACKUP_ACCENT}
            />
          </Card>

          <Card accentColor={BACKUP_ACCENT} className="mb-0">
            <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
              Phase-one coverage
            </Text>
            <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
              The backup feed covers more than the current restore scope. The rows below show what is backed up and what this phase can actually restore.
            </Text>

            <View className="mt-4">
              {RESTORE_ENTITY_ORDER.map((entity, index) => (
                <SettingsRow
                  key={entity}
                  first={index === 0}
                  last={index === RESTORE_ENTITY_ORDER.length - 1}
                  label={RESTORE_ENTITY_LABELS[entity]}
                  description={
                    restoreLoading || !restorePreview
                      ? "Checking backup coverage..."
                      : describeBackupEntity(restorePreview.entityStatuses[entity])
                  }
                  statusLabel={
                    restoreLoading || !restorePreview
                      ? "Loading"
                      : restorePreview.entityStatuses[entity].phaseOneStatus ===
                          "excluded_in_phase_one"
                        ? "Excluded"
                        : restorePreview.entityStatuses[entity].remoteState === "available"
                          ? "Backed up"
                          : restorePreview.entityStatuses[entity].remoteState === "empty"
                            ? "Empty"
                            : "Unavailable"
                  }
                  statusTone={
                    restoreLoading || !restorePreview
                      ? "neutral"
                      : restorePreview.entityStatuses[entity].phaseOneStatus ===
                          "excluded_in_phase_one"
                        ? "warning"
                        : restorePreview.entityStatuses[entity].remoteState === "available"
                          ? "accent"
                          : "neutral"
                  }
                  accentColor={BACKUP_ACCENT}
                />
              ))}
            </View>

            {restorePreview ? (
              <View
                className="mt-4 rounded-2xl border px-4 py-3"
                style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
              >
                <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
                  Current restore disclosures
                </Text>
                {restorePreview.disclosures.map((item) => (
                  <Text
                    key={item}
                    className="mt-2 text-sm leading-6"
                    style={{ color: tokens.textMuted }}
                  >
                    {item}
                  </Text>
                ))}
              </View>
            ) : null}

            {restorePreview?.warnings.length ? (
              <View
                className="mt-3 rounded-2xl border px-4 py-3"
                style={{
                  borderColor: tokens.warningBorder,
                  backgroundColor: tokens.warningBackground,
                }}
              >
                <Text className="text-sm font-semibold" style={{ color: tokens.warningText }}>
                  Warnings
                </Text>
                {restorePreview.warnings.map((warning) => (
                  <Text
                    key={warning}
                    className="mt-2 text-sm leading-6"
                    style={{ color: tokens.warningText }}
                  >
                    {warning}
                  </Text>
                ))}
              </View>
            ) : null}
          </Card>
        </View>
      </ScreenSection>

      <ScreenSection>
        <SettingsSectionHeading
          eyebrow="AI / Command"
          title="Command center"
          subtitle="Status and entry point for the experimental command shell."
          icon="terminal"
          accentColor={SETTINGS_ACCENT}
        />
        <Card accentColor={SETTINGS_ACCENT} className="mb-0">
          <SettingsRow
            first
            label="Current scope"
            description="Command center drafts one todo or one habit from plain language, then waits for your review and confirmation before anything is saved."
            statusLabel="Experimental"
            statusTone="accent"
            accentColor={SETTINGS_ACCENT}
          />
          <SettingsRow
            label="Effective parser"
            description={effectiveParserDescription}
            statusLabel={effectiveParserLabel}
            statusTone={effectiveParserLabel === "Model" ? "accent" : "neutral"}
            accentColor={SETTINGS_ACCENT}
          />
          <SettingsRow
            label="What it is not"
            description="This route is a command-focused shell for structured drafts. It is not a general-purpose assistant chat."
            statusLabel="Current"
            last
          />

          {COMMAND_EXPERIMENT_ENABLED ? (
            <Link href={COMMAND_HREF} asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open command center"
                className="mt-4 rounded-2xl px-4 py-3"
                style={{
                  backgroundColor: SETTINGS_ACCENT,
                  shadowColor: tokens.shadowColor,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.08,
                  shadowRadius: 12,
                  elevation: 1,
                }}
              >
                <Text className="text-center text-sm font-semibold" style={{ color: tokens.textOnAccent }}>
                  Open command center
                </Text>
              </Pressable>
            </Link>
          ) : null}
        </Card>
      </ScreenSection>

      <ScreenSection>
        <SettingsSectionHeading
          eyebrow="Notifications / Timer defaults"
          title="Focus defaults"
          subtitle="Save your timer defaults here. Notification behavior still lives with the Focus flow."
          icon="timer"
          accentColor={SECTION_COLORS[POMODORO_SECTION_KEY]}
        />
        <Card accentColor={SECTION_COLORS[POMODORO_SECTION_KEY]} className="mb-0">
          <SettingsRow
            first
            label="Saved timer sequence"
            description={
              pomodoroLoading
                ? "Loading saved timer defaults..."
                : formatPomodoroSummary(pomodoroSettings)
            }
            statusLabel={pomodoroLoading ? "Loading" : "Saved"}
            statusTone={pomodoroLoading ? "neutral" : "accent"}
            accentColor={SECTION_COLORS[POMODORO_SECTION_KEY]}
          />
          <SettingsRow
            label="Notification behavior"
            description="On iOS and Android, the Focus timer can request notification permission and schedule end-of-timer alerts. Web does not schedule native timer notifications."
            statusLabel="Focus"
            last
          />

          <View className="mt-4">
            <NumberStepperField
              label="Focus minutes"
              value={pomodoroForm.focusMinutes}
              onChange={(value) => {
                setPomodoroError(null);
                setPomodoroForm((current) => ({ ...current, focusMinutes: value }));
              }}
              min={1}
              max={120}
            />
            <NumberStepperField
              label="Short break minutes"
              value={pomodoroForm.shortBreakMinutes}
              onChange={(value) => {
                setPomodoroError(null);
                setPomodoroForm((current) => ({ ...current, shortBreakMinutes: value }));
              }}
              min={1}
              max={60}
            />
            <NumberStepperField
              label="Long break minutes"
              value={pomodoroForm.longBreakMinutes}
              onChange={(value) => {
                setPomodoroError(null);
                setPomodoroForm((current) => ({ ...current, longBreakMinutes: value }));
              }}
              min={1}
              max={120}
            />
            <NumberStepperField
              label="Focus sessions before long break"
              value={pomodoroForm.sessionsBeforeLongBreak}
              onChange={(value) => {
                setPomodoroError(null);
                setPomodoroForm((current) => ({
                  ...current,
                  sessionsBeforeLongBreak: value,
                }));
              }}
              min={2}
              max={10}
            />
          </View>

          <ValidationError message={pomodoroError} />

          <View className="mt-2 flex-row gap-2">
            <View className="flex-1">
              <Button
                label={pomodoroSaving ? "Saving..." : "Save timer defaults"}
                onPress={handleSavePomodoroDefaults}
                disabled={pomodoroLoading || pomodoroSaving}
                color={SECTION_COLORS[POMODORO_SECTION_KEY]}
              />
            </View>
            <View className="flex-1">
              <Button
                label="Revert"
                variant="ghost"
                onPress={() => {
                  setPomodoroError(null);
                  setPomodoroForm(buildPomodoroForm(pomodoroSettings));
                }}
                disabled={pomodoroLoading || pomodoroSaving}
              />
            </View>
          </View>
        </Card>
      </ScreenSection>

      <ScreenSection>
        <SettingsSectionHeading
          eyebrow="Nutrition defaults"
          title="Daily calorie and macro goals"
          subtitle="Saved defaults for the Calories feature."
          icon="local-dining"
          accentColor={SECTION_COLORS.calories}
        />
        <Card accentColor={SECTION_COLORS.calories} className="mb-0">
          <SettingsRow
            first
            label="Saved goal"
            description={
              calorieGoalLoading
                ? "Loading saved calorie and macro goals..."
                : formatCalorieGoalSummary(calorieGoal)
            }
            statusLabel={calorieGoalLoading ? "Loading" : "Saved"}
            statusTone={calorieGoalLoading ? "neutral" : "accent"}
            accentColor={SECTION_COLORS.calories}
          />
          <SettingsRow
            label="Where it shows up"
            description="The Calories screen uses this goal for daily progress and charts. Saved meals stay separate from the default goal."
            statusLabel="Calories"
            last
          />

          <View className="mt-4">
            <NumberStepperField
              label="Calories (kcal)"
              value={calorieGoalForm.calories}
              onChange={(value) => {
                setCalorieGoalError(null);
                setCalorieGoalForm((current) => ({ ...current, calories: value }));
              }}
              min={500}
              max={6000}
            />
            <NumberStepperField
              label="Protein (g)"
              value={calorieGoalForm.protein}
              onChange={(value) => {
                setCalorieGoalError(null);
                setCalorieGoalForm((current) => ({ ...current, protein: value }));
              }}
              min={0}
              max={999}
            />
            <NumberStepperField
              label="Carbs (g)"
              value={calorieGoalForm.carbs}
              onChange={(value) => {
                setCalorieGoalError(null);
                setCalorieGoalForm((current) => ({ ...current, carbs: value }));
              }}
              min={0}
              max={999}
            />
            <NumberStepperField
              label="Fats (g)"
              value={calorieGoalForm.fats}
              onChange={(value) => {
                setCalorieGoalError(null);
                setCalorieGoalForm((current) => ({ ...current, fats: value }));
              }}
              min={0}
              max={999}
            />
          </View>

          <ValidationError message={calorieGoalError} />

          <View className="mt-2 flex-row gap-2">
            <View className="flex-1">
              <Button
                label={calorieGoalSaving ? "Saving..." : "Save nutrition defaults"}
                onPress={handleSaveCalorieGoal}
                disabled={calorieGoalLoading || calorieGoalSaving}
                color={SECTION_COLORS.calories}
              />
            </View>
            <View className="flex-1">
              <Button
                label="Revert"
                variant="ghost"
                onPress={() => {
                  setCalorieGoalError(null);
                  setCalorieGoalForm(buildCalorieGoalForm(calorieGoal));
                }}
                disabled={calorieGoalLoading || calorieGoalSaving}
              />
            </View>
          </View>
        </Card>
      </ScreenSection>

      <ScreenSection className="mb-0">
        <SettingsSectionHeading
          eyebrow="Developer / Internal"
          title="Rollout and diagnostics"
          subtitle="Internal controls stay here so they do not compete with normal settings."
          icon="build"
          accentColor={INTERNAL_ACCENT}
        />
        <Card accentColor={INTERNAL_ACCENT} className="mb-0">
          <View
            className="rounded-2xl border px-4 py-3"
            style={{
              borderColor: tokens.dangerBorder,
              backgroundColor: tokens.dangerBackground,
            }}
          >
            <Text
              className="text-[11px] font-semibold uppercase tracking-[1.1px]"
              style={{ color: tokens.dangerText }}
            >
              Internal only
            </Text>
            <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
              These controls and notes are for rollout testing and product diagnostics, not everyday setup.
            </Text>
          </View>

          <View className="mt-4">
            <SettingsRow
              first
              label="Internal parser rollout"
              description={
                commandInternalRolloutAvailable
                  ? "This build can test the model-backed parser with a device-local preference."
                  : "This build does not expose the internal model parser rollout controls."
              }
              statusLabel={commandInternalRolloutAvailable ? "Available" : "Unavailable"}
              statusTone={commandInternalRolloutAvailable ? "accent" : "warning"}
              accentColor={INTERNAL_ACCENT}
            />
            <SettingsRow
              label="Device preference"
              description={
                commandRolloutLoading
                  ? "Loading the saved internal parser preference for this device..."
                  : commandRolloutEnabledOnDevice
                    ? "Model-backed parsing is enabled on this device. Turn it off here to return to the mock parser immediately."
                    : "Model-backed parsing is disabled on this device. The command shell stays on the mock parser until you opt in here."
              }
              statusLabel={
                commandRolloutLoading
                  ? "Loading"
                  : commandRolloutEnabledOnDevice
                    ? "Enabled"
                    : "Disabled"
              }
              statusTone={
                commandRolloutLoading
                  ? "neutral"
                  : commandRolloutEnabledOnDevice
                    ? "accent"
                    : "neutral"
              }
              accentColor={INTERNAL_ACCENT}
            />
            <SettingsRow
              label="Linked Actions editor"
              description="Create or edit a habit to manage linked rules. Applied rules still surface through the in-app notice banner."
              statusLabel="Habits"
              last
            />
          </View>

          <ValidationError message={commandRolloutError} />

          {commandInternalRolloutAvailable ? (
            <View className="mt-2 gap-2">
              <Button
                label={commandRolloutLoading ? "Saving..." : "Enable model parser"}
                onPress={() => handleCommandRolloutToggle(true)}
                disabled={commandRolloutLoading || commandRolloutEnabledOnDevice}
                color={INTERNAL_ACCENT}
              />
              <Button
                label={commandRolloutLoading ? "Saving..." : "Use mock parser only"}
                onPress={() => handleCommandRolloutToggle(false)}
                variant="ghost"
                disabled={commandRolloutLoading || !commandRolloutEnabledOnDevice}
              />
            </View>
          ) : null}
        </Card>
      </ScreenSection>
    </Screen>
  );
}
