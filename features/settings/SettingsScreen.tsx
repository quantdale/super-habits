import { Pressable, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { FeaturePanel } from "@/core/ui/FeaturePanel";
import { Screen } from "@/core/ui/Screen";
import { SectionTitle } from "@/core/ui/SectionTitle";
<<<<<<< HEAD

const SETTINGS_ACCENT = "#cbd5e1";
const SETTINGS_TEXT = "#475569";
const SETTINGS_ICON_TINT = "#64748b";

const PLACEHOLDER_SECTIONS = [
  {
    title: "Account",
    subtitle: "Identity, profile, and sign-in controls will live here.",
    icon: "person-outline" as const,
    items: ["Profile details", "Backup and sync status", "Session and device access"],
  },
  {
    title: "Appearance",
    subtitle: "Theme, density, and visual display preferences.",
    icon: "palette" as const,
    items: ["Theme selection", "Reduced motion", "Interface density"],
  },
  {
    title: "Preferences",
    subtitle: "App-wide defaults for daily workflow behavior.",
    icon: "tune" as const,
    items: ["Start screen", "Notification defaults", "Date and reminder behavior"],
  },
  {
    title: "About",
    subtitle: "Product information and release metadata.",
    icon: "info-outline" as const,
    items: ["Version details", "What is new", "Support resources"],
  },
  {
    title: "Misc",
    subtitle: "Space for utility actions that do not belong to a feature.",
    icon: "widgets" as const,
    items: ["Import and export tools", "Diagnostics", "Experimental flags"],
=======
import { useAppTheme, type ThemePreference } from "@/core/theme";

const THEME_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}> = [
  {
    value: "light",
    label: "Light",
    description: "Bright surfaces and light navigation chrome.",
    icon: "light-mode",
  },
  {
    value: "dark",
    label: "Dark",
    description: "Dimmed surfaces with high-contrast content.",
    icon: "dark-mode",
  },
  {
    value: "system",
    label: "System",
    description: "Follow your device or browser appearance setting.",
    icon: "settings-suggest",
>>>>>>> a74517a (dark mode, documentatiton, blank fix)
  },
];

export function SettingsScreen() {
  const router = useRouter();
<<<<<<< HEAD
=======
  const { colors, preference, resolvedTheme, setPreference, overviewColor } = useAppTheme();
>>>>>>> a74517a (dark mode, documentatiton, blank fix)

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/overview");
  };

  return (
    <Screen scroll>
      <SectionTitle
        title="Settings"
<<<<<<< HEAD
        subtitle="Global controls and app-level preferences."
=======
        subtitle="App-wide controls and preferences."
>>>>>>> a74517a (dark mode, documentatiton, blank fix)
        right={(
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={handleBack}
            className="flex-row items-center gap-1 rounded-xl px-3 py-2 active:opacity-80"
<<<<<<< HEAD
            style={{ backgroundColor: "#eef2ff" }}
          >
            <MaterialIcons name="arrow-back" size={18} color={SETTINGS_TEXT} />
            <Text className="text-sm font-semibold" style={{ color: SETTINGS_TEXT }}>
=======
            style={{ backgroundColor: colors.surfaceMuted }}
          >
            <MaterialIcons name="arrow-back" size={18} color={colors.textMuted} />
            <Text className="text-sm font-semibold" style={{ color: colors.textMuted }}>
>>>>>>> a74517a (dark mode, documentatiton, blank fix)
              Back
            </Text>
          </Pressable>
        )}
      />

<<<<<<< HEAD
      <View className="mb-4 rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-black/5">
        <Text className="text-sm font-semibold uppercase tracking-[1.6px] text-slate-400">
          Utility
        </Text>
        <Text className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          One place for app-wide controls
        </Text>
        <Text className="mt-2 text-sm leading-6 text-slate-500">
          This screen is a scaffold for shared preferences and utility actions. It stays outside the
          module tabs so the main navigation remains focused on day-to-day content.
        </Text>
      </View>

      <View className="gap-3">
        {PLACEHOLDER_SECTIONS.map((section) => (
          <FeaturePanel
            key={section.title}
            title={section.title}
            subtitle={section.subtitle}
            icon={section.icon}
            accentColor={SETTINGS_ACCENT}
            textColor={SETTINGS_ICON_TINT}
            className="mb-0"
          >
            <View className="gap-2">
              {section.items.map((item) => (
                <View
                  key={item}
                  className="flex-row items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <Text className="min-w-0 flex-1 text-sm font-medium text-slate-700">{item}</Text>
                  <MaterialIcons name="chevron-right" size={18} color={SETTINGS_ICON_TINT} />
                </View>
              ))}
            </View>
          </FeaturePanel>
        ))}
      </View>
=======
      <View
        className="mb-4 rounded-3xl border px-5 py-4 shadow-sm shadow-black/5"
        style={{ borderColor: colors.border, backgroundColor: colors.card }}
      >
        <Text
          className="text-sm font-semibold uppercase tracking-[1.6px]"
          style={{ color: colors.textSubtle }}
        >
          Appearance
        </Text>
        <Text
          className="mt-2 text-2xl font-bold tracking-tight"
          style={{ color: colors.text }}
        >
          Theme preference
        </Text>
        <Text className="mt-2 text-sm leading-6" style={{ color: colors.textMuted }}>
          Choose how SuperHabits should render across the full app. Changes apply immediately and
          persist on this device.
        </Text>
        <View className="mt-4 flex-row items-center gap-2">
          <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: colors.surfaceMuted }}>
            <Text className="text-xs font-semibold" style={{ color: overviewColor }}>
              Active: {resolvedTheme === "dark" ? "Dark" : "Light"}
            </Text>
          </View>
          {preference === "system" ? (
            <Text className="text-xs" style={{ color: colors.textSubtle }}>
              Following system appearance
            </Text>
          ) : null}
        </View>
      </View>

      <FeaturePanel
        title="Theme"
        subtitle="Use a single app-wide theme instead of per-screen overrides."
        icon="palette"
        accentColor={colors.settingsButtonBorder}
        textColor={overviewColor}
        className="mb-0"
      >
        <View className="gap-3">
          {THEME_OPTIONS.map((option) => {
            const selected = preference === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Use ${option.label.toLowerCase()} theme`}
                onPress={() => {
                  void setPreference(option.value);
                }}
                className="flex-row items-center justify-between rounded-2xl border px-4 py-3"
                style={{
                  borderColor: selected ? overviewColor : colors.border,
                  backgroundColor: selected ? colors.surfaceMuted : colors.cardSecondary,
                }}
              >
                <View className="min-w-0 flex-1 flex-row items-center gap-3">
                  <View
                    className="h-10 w-10 items-center justify-center rounded-xl"
                    style={{ backgroundColor: selected ? colors.settingsButtonBackground : colors.surfaceMuted }}
                  >
                    <MaterialIcons
                      name={option.icon}
                      size={20}
                      color={selected ? overviewColor : colors.iconMuted}
                    />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-sm font-semibold" style={{ color: colors.text }}>
                      {option.label}
                    </Text>
                    <Text className="mt-0.5 text-xs" style={{ color: colors.textMuted }}>
                      {option.description}
                    </Text>
                  </View>
                </View>
                <MaterialIcons
                  name={selected ? "radio-button-checked" : "radio-button-unchecked"}
                  size={20}
                  color={selected ? overviewColor : colors.iconMuted}
                />
              </Pressable>
            );
          })}
        </View>
      </FeaturePanel>
>>>>>>> a74517a (dark mode, documentatiton, blank fix)

      <View className="h-2" />
    </Screen>
  );
}
