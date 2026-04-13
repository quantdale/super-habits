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
  const { mode, resolvedTheme, setMode, tokens } = useAppTheme();
  const appearanceCopy = getAppearanceSummary(mode, resolvedTheme);
  const settingsAccent = resolvedTheme === "dark" ? "#64748b" : SETTINGS_ACCENT;

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
