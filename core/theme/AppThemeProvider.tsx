import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance, type ColorSchemeName } from "react-native";
import {
  getOverviewColor,
  getSectionThemeColors,
  resolveThemePreference,
  sanitizeThemePreference,
  THEME_COLORS,
  type ResolvedTheme,
  type ThemeColors,
  type ThemePreference,
} from "./theme";
import { getThemePreference, saveThemePreference } from "@/features/settings/settings.data";
import type { SectionKey } from "@/constants/sectionColors";

type AppThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  colors: ThemeColors;
  setPreference: (preference: ThemePreference) => Promise<void>;
  getSectionColors: (section: SectionKey) => ReturnType<typeof getSectionThemeColors>;
  overviewColor: string;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

function normalizeColorScheme(colorScheme: ColorSchemeName | null | undefined): ResolvedTheme {
  return colorScheme === "dark" ? "dark" : "light";
}

export function AppThemeProvider({ children }: PropsWithChildren) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(
    normalizeColorScheme(Appearance.getColorScheme()),
  );

  useEffect(() => {
    let isMounted = true;

    getThemePreference()
      .then((storedPreference) => {
        if (isMounted) {
          setPreferenceState(sanitizeThemePreference(storedPreference));
        }
      })
      .catch((error) => {
        console.error("[theme] failed to read theme preference", error);
      });

    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemTheme(normalizeColorScheme(colorScheme));
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  const resolvedTheme = resolveThemePreference(preference, systemTheme);
  const colors = THEME_COLORS[resolvedTheme];

  useEffect(() => {
    if (typeof document === "undefined") return;

    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.dataset.theme = resolvedTheme;
    document.body.style.backgroundColor = colors.background;
  }, [colors.background, resolvedTheme]);

  const value = useMemo<AppThemeContextValue>(
    () => ({
      preference,
      resolvedTheme,
      colors,
      setPreference: async (nextPreference) => {
        const sanitized = sanitizeThemePreference(nextPreference);
        await saveThemePreference(sanitized);
        setPreferenceState(sanitized);
      },
      getSectionColors: (section) => getSectionThemeColors(section, resolvedTheme),
      overviewColor: getOverviewColor(resolvedTheme),
    }),
    [colors, preference, resolvedTheme],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }
  return context;
}
