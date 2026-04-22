import { useCallback, useMemo, useState } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { Link, type Href, useFocusEffect } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useAppBootstrapState } from "@/core/providers/AppProviders";
import { getRestorePreview, restoreFromRemoteBackup } from "@/core/sync/restore.coordinator";
import type {
  RemoteBackupEntityStatus,
  RestorePreview,
  SyncBackedEntity,
} from "@/core/sync/restore.types";
import { type ThemeMode, useAppTheme } from "@/core/providers/ThemeProvider";
import { Button } from "@/core/ui/Button";
import { Card } from "@/core/ui/Card";
import { FeatureStatCard } from "@/core/ui/FeatureStatCard";
import { PageHeader } from "@/core/ui/PageHeader";
import { PillChip } from "@/core/ui/PillChip";
import { Screen } from "@/core/ui/Screen";
import { ScreenSection } from "@/core/ui/ScreenSection";
import { maybeLoadRestorePreviewForSettings } from "@/features/settings/settingsRestorePreview";
import {
  getAiCommandParseConfig,
  isAiCommandInternalRolloutAvailable,
} from "@/features/command/commandConfig";
import {
  getAiCommandInternalRolloutPreference,
  setAiCommandInternalRolloutPreference,
} from "@/features/command/commandInternalRollout";

const OVERVIEW_HREF = "/(tabs)/overview" as Href;
const SETTINGS_ACCENT = "#475569";

type SettingsInfoItem = {
  label: string;
  description: string;
  statusLabel?: string;
};

type SettingsInfoSection = {
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  items: SettingsInfoItem[];
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

const SECTIONS: SettingsInfoSection[] = [
  {
    title: "Linked Actions",
    subtitle: "Current shipped scope for linked triggers, targets, and notices.",
    icon: "bolt",
    items: [
      {
        label: "Where it lives",
        description:
          "Create or edit a habit to manage linked rules. Settings no longer hosts a separate Linked Actions preview.",
        statusLabel: "Current",
      },
      {
        label: "Supported path",
        description:
          "Rules currently run when a habit reaches its daily target and can affect Todos, Habits, or Workout.",
        statusLabel: "Live",
      },
      {
        label: "Notice delivery",
        description:
          "Applied rules surface through the in-app notice banner at the top of the app.",
        statusLabel: "Live",
      },
    ],
  },
  {
    title: "About",
    subtitle: "Current maintenance facts instead of generic placeholders.",
    icon: "info-outline",
    items: [
      {
        label: "Schema & package",
        description: "Package version 1.0.0 with runtime schema version 11.",
        statusLabel: "Current",
      },
      {
        label: "Validation gate",
        description:
          "Maintenance changes are expected to clear typecheck, Vitest, build:web, and Playwright E2E.",
        statusLabel: "Required",
      },
    ],
  },
];

function SettingsInfoRow({ label, description, statusLabel }: SettingsInfoItem) {
  const { tokens } = useAppTheme();

  return (
    <View
      className="flex-row items-center gap-3 rounded-2xl border px-4 py-3.5"
      style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
    >
      <View className="min-w-0 flex-1">
        <Text className="text-base font-semibold" style={{ color: tokens.text }}>{label}</Text>
        <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>{description}</Text>
      </View>
      {statusLabel ? (
        <View
          className="rounded-full px-3 py-1.5"
          style={{ backgroundColor: tokens.surface }}
        >
          <Text
            className="text-[11px] font-semibold uppercase tracking-[1px]"
            style={{ color: tokens.iconMuted }}
          >
            {statusLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function getAppearanceSummary(mode: ThemeMode, resolvedTheme: "light" | "dark") {
  if (mode === "system") {
    return {
      subtitle: `Following your device setting. Currently ${resolvedTheme} mode is active.`,
      detail: "System mode updates automatically when your device appearance changes.",
    };
  }

  return {
    subtitle: `Using ${mode} mode across the app.`,
    detail: `SuperHabits will stay in ${mode} mode until you change it here.`,
  };
}

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

function formatBackupTime(value: string | null) {
  if (!value) return "No restorable backup timestamp is available yet.";
  return new Date(value).toLocaleString();
}

function describeBackupEntity(status: RemoteBackupEntityStatus) {
  if (status.phaseOneStatus === "excluded_in_phase_one") {
    const countLabel =
      status.remoteRowCount === null ? "Remote status unavailable." : `${status.remoteRowCount} remote rows.`;
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

export function SettingsScreen() {
  const { mode, resolvedTheme, setMode, tokens } = useAppTheme();
  const { authBootstrapReady } = useAppBootstrapState();
  const commandConfig = useMemo(() => getAiCommandParseConfig(), []);
  const commandInternalRolloutAvailable = useMemo(
    () => isAiCommandInternalRolloutAvailable(commandConfig),
    [commandConfig],
  );
  const appearanceCopy = getAppearanceSummary(mode, resolvedTheme);
  const settingsAccent = resolvedTheme === "dark" ? "#64748b" : SETTINGS_ACCENT;
  const settingsTextColor = resolvedTheme === "dark" ? "#cbd5e1" : "#334155";
  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(true);
  const [restoreRunning, setRestoreRunning] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [commandRolloutEnabledOnDevice, setCommandRolloutEnabledOnDevice] = useState(false);
  const [commandRolloutLoading, setCommandRolloutLoading] = useState(
    commandInternalRolloutAvailable,
  );
  const [commandRolloutError, setCommandRolloutError] = useState<string | null>(null);

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
    }, [authBootstrapReady, loadCommandRolloutPreference, loadRestorePreview]),
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

  const restoreButtonDisabled =
    restoreLoading ||
    restoreRunning ||
    !restorePreview ||
    restorePreview.eligibility.kind !== "empty_device";
  const restoreButtonLabel = restoreRunning ? "Restoring..." : "Restore backup";

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

  return (
    <Screen scroll>
      <ScreenSection>
        <PageHeader
          title="Settings"
          subtitle="Appearance is live. The rest of this screen documents the current shipped behavior instead of placeholder previews."
          actions={
            <Link href={OVERVIEW_HREF} asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to overview"
                className="ml-4 flex-row items-center gap-1.5 rounded-2xl border px-3.5 py-2.5"
                style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
              >
                <MaterialIcons name="arrow-back" size={18} color={settingsAccent} />
                <Text className="text-sm font-semibold" style={{ color: tokens.text }}>Back</Text>
              </Pressable>
            </Link>
          }
        />
      </ScreenSection>

      <ScreenSection>
        <View className="flex-row flex-wrap gap-3">
          <View className="min-w-[160px] flex-1">
            <FeatureStatCard
              accentColor={settingsAccent}
              textColor={settingsTextColor}
              icon="palette"
              title="Theme mode"
              value={mode[0].toUpperCase() + mode.slice(1)}
              subtitle="Current selection"
              note={`Resolved as ${resolvedTheme} right now`}
            />
          </View>
          <View className="min-w-[160px] flex-1">
            <FeatureStatCard
              accentColor={settingsAccent}
              textColor={settingsTextColor}
              icon="rule"
              title="Documented areas"
              value={SECTIONS.length + 1}
              subtitle="Status sections below"
              note="Backup, linked actions, and maintenance facts"
            />
          </View>
        </View>
      </ScreenSection>

      <ScreenSection>
        <Card
          variant="header"
          accentColor={settingsAccent}
          headerTitle="Appearance"
          headerSubtitle={appearanceCopy.subtitle}
          headerRight={<MaterialIcons name="palette" size={22} color="#ffffff" />}
          className="mb-0"
        >
        <View className="gap-3">
          <View>
            <Text className="text-base font-semibold" style={{ color: tokens.text }}>
              Theme
            </Text>
            <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
              Choose how SuperHabits should look on this device.
            </Text>
          </View>

          <View className="flex-row flex-wrap">
            {THEME_OPTIONS.map((option) => (
              <PillChip
                key={option.mode}
                label={option.label}
                active={mode === option.mode}
                color={settingsAccent}
                onPress={() => setMode(option.mode)}
              />
            ))}
          </View>

          <View
            className="rounded-2xl border px-4 py-3"
            style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
          >
            <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
              Current selection
            </Text>
            <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
              {THEME_OPTIONS.find((option) => option.mode === mode)?.description}
            </Text>
            <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
              {appearanceCopy.detail}
            </Text>
          </View>

          <SettingsInfoRow
            label="Theme coverage"
            description="Theme mode, status bar styling, tab rail colors, and shared UI tokens update immediately. Some feature-specific colors still stay section-driven by design."
            statusLabel="Live"
          />
        </View>
        </Card>
      </ScreenSection>

      <ScreenSection>
        <Card
          variant="header"
          accentColor={settingsAccent}
          headerTitle="Backup restore"
          headerSubtitle="A conservative restore path for empty devices only. SQLite stays the source of truth."
          headerRight={<MaterialIcons name="cloud-download" size={22} color="#ffffff" />}
          className="mb-0"
        >
          <View className="gap-3">
            <SettingsInfoRow
              label="Latest restorable backup"
              description={
                restoreLoading
                  ? "Checking remote backup status..."
                  : formatBackupTime(restorePreview?.latestRestorableBackupAt ?? null)
              }
              statusLabel={
                restoreLoading
                  ? "Loading"
                  : restorePreview?.remoteAvailable
                    ? "Available"
                    : "Unavailable"
              }
            />

            <SettingsInfoRow
              label="Restore eligibility"
              description={
                restoreLoading
                  ? "Checking whether this device is still eligible for first-phase restore."
                  : restorePreview?.eligibility.message ??
                    "Backup status is not available yet."
              }
              statusLabel={
                restoreLoading
                  ? "Loading"
                  : restorePreview?.eligibility.kind === "empty_device"
                    ? "Allowed"
                    : "Blocked"
              }
            />

            {RESTORE_ENTITY_ORDER.map((entity) => (
              <SettingsInfoRow
                key={entity}
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
              />
            ))}

            {restorePreview?.disclosures.map((item) => (
              <Text key={item} className="text-sm" style={{ color: tokens.textMuted }}>
                {item}
              </Text>
            ))}

            {restorePreview?.warnings.map((warning) => (
              <Text key={warning} className="text-sm" style={{ color: "#92400e" }}>
                {warning}
              </Text>
            ))}

            {restoreError ? (
              <Text className="text-sm" style={{ color: "#b91c1c" }}>
                {restoreError}
              </Text>
            ) : null}

            <Button
              label={restoreButtonLabel}
              onPress={handleRestore}
              disabled={restoreButtonDisabled}
              color={settingsAccent}
            />
          </View>
        </Card>
      </ScreenSection>

      {commandInternalRolloutAvailable ? (
        <ScreenSection>
          <Card
            variant="header"
            accentColor={settingsAccent}
            headerTitle="Command parser rollout"
            headerSubtitle="Internal-only toggle for the model-backed parser. Public builds stay on mock mode."
            headerRight={<MaterialIcons name="science" size={22} color="#ffffff" />}
            className="mb-0"
          >
            <View className="gap-3">
              <SettingsInfoRow
                label="Effective default"
                description="This build still defaults to the local mock parser until you enable the internal model parser on this device."
                statusLabel="Mock"
              />

              <SettingsInfoRow
                label="Device-local toggle"
                description={
                  commandRolloutLoading
                    ? "Loading the internal parser preference for this device..."
                    : commandRolloutEnabledOnDevice
                      ? "Model-backed parsing is enabled on this device. Turn it off here at any time to roll back to mock immediately."
                      : "Model-backed parsing is disabled on this device. The command shell will stay on mock mode until you opt in here."
                }
                statusLabel={commandRolloutEnabledOnDevice ? "Enabled" : "Disabled"}
              />

              <View
                className="rounded-2xl border px-4 py-3"
                style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
              >
                <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
                  Internal tester notes
                </Text>
                <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
                  This toggle is device-local and disposable.
                </Text>
                <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
                  Clearing app storage may reset it.
                </Text>
                <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
                  If the remote parser misbehaves, disable it here to return to mock mode immediately.
                </Text>
              </View>

              {commandRolloutError ? (
                <Text className="text-sm" style={{ color: "#b91c1c" }}>
                  {commandRolloutError}
                </Text>
              ) : null}

              <View className="gap-2">
                <Button
                  label={commandRolloutLoading ? "Saving..." : "Enable model parser"}
                  onPress={() => handleCommandRolloutToggle(true)}
                  disabled={commandRolloutLoading || commandRolloutEnabledOnDevice}
                  color={settingsAccent}
                />
                <Button
                  label={commandRolloutLoading ? "Saving..." : "Use mock parser only"}
                  onPress={() => handleCommandRolloutToggle(false)}
                  variant="ghost"
                  disabled={commandRolloutLoading || !commandRolloutEnabledOnDevice}
                />
              </View>
            </View>
          </Card>
        </ScreenSection>
      ) : null}

      {SECTIONS.map((section) => (
        <ScreenSection
          key={section.title}
          className={section.title === SECTIONS[SECTIONS.length - 1].title ? "mb-0" : "mb-1"}
        >
          <Card
            variant="header"
            accentColor={settingsAccent}
            headerTitle={section.title}
            headerSubtitle={section.subtitle}
            headerRight={<MaterialIcons name={section.icon} size={22} color="#ffffff" />}
            className="mb-0"
          >
            <View className="gap-3">
              {section.items.map((item) => (
                <SettingsInfoRow
                  key={item.label}
                  label={item.label}
                  description={item.description}
                  statusLabel={item.statusLabel}
                />
              ))}
            </View>
          </Card>
        </ScreenSection>
      ))}
    </Screen>
  );
}
