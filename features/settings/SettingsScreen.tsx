import { MaterialIcons } from "@expo/vector-icons";
import { Link, type Href } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { LinkedActionsEditorSection } from "@/core/linked-actions/LinkedActionsEditorSection";
import { createLinkedActionEditorRowFromRule } from "@/core/linked-actions/linkedActionsEditor.model";
import type { LinkedActionEditorSourceOption } from "@/core/linked-actions/linkedActionsEditor.types";
import { createLinkedActionsNotice } from "@/core/linked-actions/linkedActionsNotice";
import { createLinkedActionTargetExistingSelection } from "@/core/linked-actions/linkedActionsTargetPicker.types";
import type { LinkedActionRuleDefinition } from "@/core/linked-actions/linkedActions.types";
import { useInAppNotices } from "@/core/providers/InAppNoticeProvider";
import { type ThemeMode, useAppTheme } from "@/core/providers/ThemeProvider";
import { Button } from "@/core/ui/Button";
import { Card } from "@/core/ui/Card";
import { PillChip } from "@/core/ui/PillChip";
import { Screen } from "@/core/ui/Screen";
import { SectionTitle } from "@/core/ui/SectionTitle";

const OVERVIEW_HREF = "/(tabs)/overview" as Href;
const SETTINGS_ACCENT = "#475569";

type PlaceholderItem = {
  label: string;
  description: string;
};

type PlaceholderSection = {
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  items: PlaceholderItem[];
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

const SECTIONS: PlaceholderSection[] = [
  {
    title: "Account",
    subtitle: "Profile and backup options will be added here later.",
    icon: "person-outline",
    items: [
      { label: "Profile", description: "Placeholder for account details and identity settings." },
      { label: "Backup & sync", description: "Placeholder for future cloud and device sync controls." },
    ],
  },
  {
    title: "About",
    subtitle: "App details and support links will appear in this section.",
    icon: "info-outline",
    items: [
      { label: "Version", description: "Placeholder for build details and release information." },
      { label: "Privacy", description: "Placeholder for privacy notes and acknowledgements." },
    ],
  },
];

const DEMO_SOURCE_OPTIONS: LinkedActionEditorSourceOption[] = [
  {
    key: "todos-demo",
    feature: "todos",
    entityType: "todo",
    entityId: "demo-todo-source",
    label: "Finish inbox zero",
    description: "Demo source task for the Version 1 linked-actions editor scaffold.",
  },
  {
    key: "habits-demo",
    feature: "habits",
    entityType: "habit",
    entityId: "demo-habit-source",
    label: "Nightly mobility",
    description: "Demo source habit for reviewing explicit trigger and effect choices.",
  },
  {
    key: "calories-demo",
    feature: "calories",
    entityType: "calorie_log",
    entityId: "demo-calorie-source",
    label: "Post-workout shake",
    description: "Demo source calorie entry showing cross-feature rule scaffolding.",
  },
  {
    key: "workout-demo",
    feature: "workout",
    entityType: "workout_routine",
    entityId: "demo-workout-source",
    label: "Hydrate after workout",
    description: "Demo source routine used to preview the Linked Actions editor for Version 1.",
  },
  {
    key: "pomodoro-demo",
    feature: "pomodoro",
    entityType: "pomodoro_timer",
    entityId: "demo-pomodoro-source",
    label: "Deep work timer",
    description: "Demo source timer for manual focus-session linked rules.",
  },
];

const DEMO_RULES_BY_SOURCE: Record<
  LinkedActionEditorSourceOption["key"],
  Array<{
    rule: LinkedActionRuleDefinition;
    targetSelection: ReturnType<typeof createLinkedActionTargetExistingSelection>;
  }>
> = {
  "todos-demo": [
    {
      rule: {
        id: "demo_rule_todo_to_habit",
        status: "active",
        directionPolicy: "one_way",
        bidirectionalGroupId: null,
        source: {
          feature: "todos",
          entityType: "todo",
          entityId: "demo-todo-source",
          triggerType: "todo.completed",
        },
        target: {
          feature: "habits",
          entityType: "habit",
          entityId: "demo-hydration-habit",
          effect: {
            kind: "progress",
            type: "habit.increment",
            amount: 1,
            dateStrategy: "source_date",
          },
        },
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
        deletedAt: null,
      },
      targetSelection: createLinkedActionTargetExistingSelection(
        { feature: "habits", entityType: "habit" },
        {
          id: "demo-hydration-habit",
          title: "Hydration check-in",
          subtitle: "Anytime · target 1/day",
        },
      ),
    },
  ],
  "habits-demo": [
    {
      rule: {
        id: "demo_rule_habit_to_todo",
        status: "active",
        directionPolicy: "one_way",
        bidirectionalGroupId: null,
        source: {
          feature: "habits",
          entityType: "habit",
          entityId: "demo-habit-source",
          triggerType: "habit.completed_for_day",
        },
        target: {
          feature: "todos",
          entityType: "todo",
          entityId: "demo-pack-gym-bag",
          effect: {
            kind: "binary",
            type: "todo.complete",
          },
        },
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
        deletedAt: null,
      },
      targetSelection: createLinkedActionTargetExistingSelection(
        { feature: "todos", entityType: "todo" },
        {
          id: "demo-pack-gym-bag",
          title: "Pack gym bag",
          subtitle: "Due tomorrow",
        },
      ),
    },
  ],
  "calories-demo": [
    {
      rule: {
        id: "demo_rule_calories_to_todo",
        status: "active",
        directionPolicy: "one_way",
        bidirectionalGroupId: null,
        source: {
          feature: "calories",
          entityType: "calorie_log",
          entityId: "demo-calorie-source",
          triggerType: "calorie.entry_logged",
        },
        target: {
          feature: "todos",
          entityType: "todo",
          entityId: "demo-log-meal-photo",
          effect: {
            kind: "binary",
            type: "todo.complete",
          },
        },
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
        deletedAt: null,
      },
      targetSelection: createLinkedActionTargetExistingSelection(
        { feature: "todos", entityType: "todo" },
        {
          id: "demo-log-meal-photo",
          title: "Log meal photo",
          subtitle: "Low priority",
        },
      ),
    },
  ],
  "workout-demo": [
    {
      rule: {
        id: "demo_rule_workout_to_habit",
        status: "active",
        directionPolicy: "one_way",
        bidirectionalGroupId: null,
        source: {
          feature: "workout",
          entityType: "workout_routine",
          entityId: "demo-workout-source",
          triggerType: "workout.completed",
        },
        target: {
          feature: "habits",
          entityType: "habit",
          entityId: "demo-recovery-habit",
          effect: {
            kind: "progress",
            type: "habit.ensure_daily_target",
            minimumCount: "target_per_day",
            dateStrategy: "source_date",
          },
        },
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
        deletedAt: null,
      },
      targetSelection: createLinkedActionTargetExistingSelection(
        { feature: "habits", entityType: "habit" },
        {
          id: "demo-recovery-habit",
          title: "Evening stretch",
          subtitle: "Evening · target 1/day",
        },
      ),
    },
  ],
  "pomodoro-demo": [
    {
      rule: {
        id: "demo_rule_pomodoro_to_todo",
        status: "active",
        directionPolicy: "one_way",
        bidirectionalGroupId: null,
        source: {
          feature: "pomodoro",
          entityType: "pomodoro_timer",
          entityId: "demo-pomodoro-source",
          triggerType: "pomodoro.focus_completed",
        },
        target: {
          feature: "todos",
          entityType: "todo",
          entityId: "demo-review-notes",
          effect: {
            kind: "binary",
            type: "todo.complete",
          },
        },
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
        deletedAt: null,
      },
      targetSelection: createLinkedActionTargetExistingSelection(
        { feature: "todos", entityType: "todo" },
        {
          id: "demo-review-notes",
          title: "Review session notes",
          subtitle: "Repeats daily",
        },
      ),
    },
  ],
};

function SettingsPlaceholderRow({ label, description }: PlaceholderItem) {
  const { tokens } = useAppTheme();

  return (
    <View
      className="flex-row items-center gap-3 rounded-2xl border px-4 py-3"
      style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
    >
      <View className="min-w-0 flex-1">
        <Text className="text-base font-semibold" style={{ color: tokens.text }}>{label}</Text>
        <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>{description}</Text>
      </View>
      <View className="items-end">
        <Text
          className="mb-1 text-xs font-semibold uppercase tracking-[1px]"
          style={{ color: tokens.iconMuted }}
        >
          Soon
        </Text>
        <MaterialIcons name="chevron-right" size={20} color={tokens.iconMuted} />
      </View>
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

export function SettingsScreen() {
  const { showNotice } = useInAppNotices();
  const { mode, resolvedTheme, setMode, tokens } = useAppTheme();
  const [selectedLinkedActionSourceKey, setSelectedLinkedActionSourceKey] = useState(
    DEMO_SOURCE_OPTIONS[3].key,
  );
  const appearanceCopy = getAppearanceSummary(mode, resolvedTheme);
  const settingsAccent = resolvedTheme === "dark" ? "#64748b" : SETTINGS_ACCENT;
  const linkedActionInitialRows = useMemo(
    () =>
      DEMO_RULES_BY_SOURCE[selectedLinkedActionSourceKey].map((input) =>
        createLinkedActionEditorRowFromRule(input),
      ),
    [selectedLinkedActionSourceKey],
  );

  const handleShowLinkedActionsDemo = () => {
    showNotice(
      createLinkedActionsNotice({
        message: "Linked Actions updated Evening stretch.",
        reason: "Hydrate after workout is linked to mark your recovery habit for today.",
        source: {
          feature: "workout",
          entityType: "routine",
          entityId: "demo-workout-routine",
          label: "Hydrate after workout",
        },
        target: {
          feature: "habits",
          entityType: "habit",
          entityId: "demo-recovery-habit",
          label: "Evening stretch",
        },
        destination: {
          kind: "linked-actions-target",
          href: "/(tabs)/habits",
          feature: "habits",
          entityType: "habit",
          entityId: "demo-recovery-habit",
          label: "Evening stretch",
        },
      }),
    );
  };

  return (
    <Screen scroll>
      <View className="mb-4 flex-row items-center justify-between">
        <SectionTitle
          title="Settings"
          subtitle="Appearance is live. Other preference areas stay in place for future settings work."
        />
        <Link href={OVERVIEW_HREF} asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to overview"
            className="ml-4 flex-row items-center gap-1 rounded-xl border px-3 py-2"
            style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
          >
            <MaterialIcons name="arrow-back" size={18} color={settingsAccent} />
            <Text className="text-sm font-semibold" style={{ color: tokens.text }}>Back</Text>
          </Pressable>
        </Link>
      </View>

      <Card
        variant="header"
        accentColor={settingsAccent}
        headerTitle="Appearance"
        headerSubtitle={appearanceCopy.subtitle}
        headerRight={<MaterialIcons name="palette" size={22} color="#ffffff" />}
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

          <SettingsPlaceholderRow
            label="App accent"
            description="Additional display preferences can be layered onto the shared theme system later."
          />
        </View>
      </Card>

      <Card
        variant="header"
        accentColor={settingsAccent}
        headerTitle="Linked Actions"
        headerSubtitle="Temporary internal preview for the Version 1 editor scaffold."
        headerRight={<MaterialIcons name="bolt" size={22} color="#ffffff" />}
      >
        <View className="gap-3">
          <Text className="text-sm" style={{ color: tokens.textMuted }}>
            This preview keeps Linked Actions explicit and manual: one source item, one or more
            rule rows, and an explicit target selection flow with no AI behavior.
          </Text>
          <LinkedActionsEditorSection
            sourceOptions={DEMO_SOURCE_OPTIONS}
            selectedSourceKey={selectedLinkedActionSourceKey}
            onSourceKeyChange={setSelectedLinkedActionSourceKey}
            initialRows={linkedActionInitialRows}
          />
          <Button
            label="Show linked notice preview"
            onPress={handleShowLinkedActionsDemo}
            variant="ghost"
          />
        </View>
      </Card>

      {SECTIONS.map((section) => (
        <Card
          key={section.title}
          variant="header"
          accentColor={settingsAccent}
          headerTitle={section.title}
          headerSubtitle={section.subtitle}
          headerRight={<MaterialIcons name={section.icon} size={22} color="#ffffff" />}
        >
          <View className="gap-3">
            {section.items.map((item) => (
              <SettingsPlaceholderRow
                key={item.label}
                label={item.label}
                description={item.description}
              />
            ))}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
