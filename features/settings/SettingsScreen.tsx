import { MaterialIcons } from "@expo/vector-icons";
import { Link, type Href } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { type ThemeMode, useAppTheme } from "@/core/providers/ThemeProvider";
import { Card } from "@/core/ui/Card";
import { PillChip } from "@/core/ui/PillChip";
import { Screen } from "@/core/ui/Screen";
import { SectionTitle } from "@/core/ui/SectionTitle";

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
    title: "Sync & backup",
    subtitle: "What the current remote path does today.",
    icon: "cloud-queue",
    items: [
      {
        label: "Backup mode",
        description:
          "Optional anonymous Supabase backup runs when env vars are configured. SQLite remains the source of truth.",
        statusLabel: "Current",
      },
      {
        label: "Current limits",
        description:
          "Pull/restore, conflict handling, and in-app sync controls are not implemented yet.",
        statusLabel: "Limited",
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
      className="flex-row items-center gap-3 rounded-2xl border px-4 py-3"
      style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
    >
      <View className="min-w-0 flex-1">
        <Text className="text-base font-semibold" style={{ color: tokens.text }}>{label}</Text>
        <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>{description}</Text>
      </View>
      {statusLabel ? (
        <View
          className="rounded-full px-3 py-1"
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

export function SettingsScreen() {
  const { mode, resolvedTheme, setMode, tokens } = useAppTheme();
  const appearanceCopy = getAppearanceSummary(mode, resolvedTheme);
  const settingsAccent = resolvedTheme === "dark" ? "#64748b" : SETTINGS_ACCENT;

  return (
    <Screen scroll>
      <View className="mb-4 flex-row items-center justify-between">
        <SectionTitle
          title="Settings"
          subtitle="Appearance is live. The rest of this screen documents the current shipped behavior instead of placeholder previews."
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

          <SettingsInfoRow
            label="Theme coverage"
            description="Theme mode, status bar styling, tab rail colors, and shared UI tokens update immediately. Some feature-specific colors still stay section-driven by design."
            statusLabel="Live"
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
              <SettingsInfoRow
                key={item.label}
                label={item.label}
                description={item.description}
                statusLabel={item.statusLabel}
              />
            ))}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
