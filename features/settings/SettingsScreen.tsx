import { Pressable, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { FeaturePanel } from "@/core/ui/FeaturePanel";
import { Screen } from "@/core/ui/Screen";
import { SectionTitle } from "@/core/ui/SectionTitle";

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
  },
];

export function SettingsScreen() {
  const router = useRouter();

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
        subtitle="Global controls and app-level preferences."
        right={(
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={handleBack}
            className="flex-row items-center gap-1 rounded-xl px-3 py-2 active:opacity-80"
            style={{ backgroundColor: "#eef2ff" }}
          >
            <MaterialIcons name="arrow-back" size={18} color={SETTINGS_TEXT} />
            <Text className="text-sm font-semibold" style={{ color: SETTINGS_TEXT }}>
              Back
            </Text>
          </Pressable>
        )}
      />

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

      <View className="h-2" />
    </Screen>
  );
}
