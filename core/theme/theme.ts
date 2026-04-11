import { SECTION_COLORS, SECTION_TEXT_COLORS, type SectionKey } from "@/constants/sectionColors";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceRaised: string;
  surfaceMuted: string;
  card: string;
  cardSecondary: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  icon: string;
  iconMuted: string;
  inputBackground: string;
  inputBorder: string;
  inputText: string;
  inputPlaceholder: string;
  overlay: string;
  tabRailBackground: string;
  tabRailBorder: string;
  tabActiveBackground: string;
  settingsButtonBackground: string;
  settingsButtonBorder: string;
  progressTrack: string;
  warningBackground: string;
  warningBorder: string;
  warningText: string;
  dangerBackground: string;
  dangerBorder: string;
  dangerText: string;
  successBackground: string;
  successBorder: string;
  successText: string;
  badgeBackground: string;
  badgeText: string;
  statusBarStyle: "light" | "dark";
  shadow: string;
};

export type SectionThemeColors = {
  accent: string;
  text: string;
  surface: string;
  surfaceStrong: string;
  border: string;
};

const DARK_SECTION_TEXT_COLORS: Record<SectionKey, string> = {
  todos: "#93c5fd",
  habits: "#6ee7b7",
  focus: "#c4b5fd",
  workout: "#fdba74",
  calories: "#fcd34d",
};

function withAlpha(hex: string, alphaHex: string): string {
  return `${hex}${alphaHex}`;
}

export function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function sanitizeThemePreference(value: string | null | undefined): ThemePreference {
  return isThemePreference(value) ? value : "system";
}

export function resolveThemePreference(
  preference: ThemePreference,
  systemTheme: ResolvedTheme,
): ResolvedTheme {
  return preference === "system" ? systemTheme : preference;
}

export const THEME_COLORS: Record<ResolvedTheme, ThemeColors> = {
  light: {
    background: "#f8f7ff",
    surface: "#f8f7ff",
    surfaceRaised: "#ffffff",
    surfaceMuted: "#f1f5f9",
    card: "#ffffff",
    cardSecondary: "#f8fafc",
    border: "#e2e8f0",
    borderStrong: "#cbd5e1",
    text: "#0f172a",
    textMuted: "#475569",
    textSubtle: "#94a3b8",
    icon: "#475569",
    iconMuted: "#94a3b8",
    inputBackground: "#ffffff",
    inputBorder: "#cbd5e1",
    inputText: "#0f172a",
    inputPlaceholder: "#94a3b8",
    overlay: "rgba(15, 23, 42, 0.5)",
    tabRailBackground: "#eeecf8",
    tabRailBorder: "#d4d0ee",
    tabActiveBackground: "#f8f7ff",
    settingsButtonBackground: "#f6f4ff",
    settingsButtonBorder: "#d8d4f2",
    progressTrack: "#e2e8f0",
    warningBackground: "#fffbeb",
    warningBorder: "#fcd34d",
    warningText: "#b45309",
    dangerBackground: "#fef2f2",
    dangerBorder: "#fecaca",
    dangerText: "#dc2626",
    successBackground: "#f0fdf4",
    successBorder: "#bbf7d0",
    successText: "#15803d",
    badgeBackground: "#f1f5f9",
    badgeText: "#64748b",
    statusBarStyle: "dark",
    shadow: "#000000",
  },
  dark: {
    background: "#0b1220",
    surface: "#0f172a",
    surfaceRaised: "#111827",
    surfaceMuted: "#1e293b",
    card: "#111827",
    cardSecondary: "#172033",
    border: "#334155",
    borderStrong: "#475569",
    text: "#f8fafc",
    textMuted: "#cbd5e1",
    textSubtle: "#94a3b8",
    icon: "#cbd5e1",
    iconMuted: "#94a3b8",
    inputBackground: "#0f172a",
    inputBorder: "#334155",
    inputText: "#f8fafc",
    inputPlaceholder: "#64748b",
    overlay: "rgba(2, 6, 23, 0.72)",
    tabRailBackground: "#111827",
    tabRailBorder: "#334155",
    tabActiveBackground: "#0b1220",
    settingsButtonBackground: "#172033",
    settingsButtonBorder: "#334155",
    progressTrack: "#334155",
    warningBackground: "#3a2a10",
    warningBorder: "#92400e",
    warningText: "#fbbf24",
    dangerBackground: "#3a1116",
    dangerBorder: "#7f1d1d",
    dangerText: "#fda4af",
    successBackground: "#0f2f24",
    successBorder: "#166534",
    successText: "#86efac",
    badgeBackground: "#1e293b",
    badgeText: "#cbd5e1",
    statusBarStyle: "light",
    shadow: "#000000",
  },
};

export function getSectionThemeColors(
  section: SectionKey,
  theme: ResolvedTheme,
): SectionThemeColors {
  const accent = SECTION_COLORS[section];
  const text =
    theme === "light" ? SECTION_TEXT_COLORS[section] : DARK_SECTION_TEXT_COLORS[section];

  return {
    accent,
    text,
    surface: theme === "light" ? withAlpha(accent, "14") : withAlpha(accent, "22"),
    surfaceStrong: theme === "light" ? withAlpha(accent, "22") : withAlpha(accent, "33"),
    border: theme === "light" ? withAlpha(accent, "40") : withAlpha(accent, "66"),
  };
}

export function getOverviewColor(theme: ResolvedTheme): string {
  return theme === "light" ? "#475569" : "#cbd5e1";
}
