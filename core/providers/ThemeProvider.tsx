import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance } from "react-native";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";
type SystemTheme = "light" | "dark" | "unspecified" | null;

type ThemeTokens = {
  background: string;
  surface: string;
  surfaceElevated: string;
  tabRail: string;
  tabRailBorder: string;
  border: string;
  text: string;
  textMuted: string;
  iconMuted: string;
  textOnAccent: string;
  shadowColor: string;
  overlayScrim: string;
  dangerBackground: string;
  dangerBorder: string;
  dangerText: string;
  dangerSolid: string;
  warningBackground: string;
  warningBorder: string;
  warningText: string;
  successBackground: string;
  successBorder: string;
  successText: string;
  statusBarStyle: "light" | "dark";
  webThemeColor: string;
};

const THEME_MODE_STORAGE_KEY = "superhabits.theme.mode";

const LIGHT_TOKENS: ThemeTokens = {
  background: "#f8f7ff",
  surface: "#ffffff",
  surfaceElevated: "#f8f7ff",
  tabRail: "#eeecf8",
  tabRailBorder: "#d4d0ee",
  border: "#e2e8f0",
  text: "#0f172a",
  textMuted: "#64748b",
  iconMuted: "#94a3b8",
  textOnAccent: "#ffffff",
  shadowColor: "#0f172a",
  overlayScrim: "rgba(15, 23, 42, 0.5)",
  dangerBackground: "#fef2f2",
  dangerBorder: "#fecaca",
  dangerText: "#b91c1c",
  dangerSolid: "#dc2626",
  warningBackground: "#fffbeb",
  warningBorder: "#fcd34d",
  warningText: "#92400e",
  successBackground: "#ecfdf5",
  successBorder: "#bbf7d0",
  successText: "#166534",
  statusBarStyle: "dark",
  webThemeColor: "#8B5CF6",
};

const DARK_TOKENS: ThemeTokens = {
  background: "#0f1221",
  surface: "#171a2a",
  surfaceElevated: "#111427",
  tabRail: "#1a1f34",
  tabRailBorder: "#2e3552",
  border: "#334155",
  text: "#e2e8f0",
  textMuted: "#a6b0c2",
  iconMuted: "#94a3b8",
  textOnAccent: "#f8fafc",
  shadowColor: "#020617",
  overlayScrim: "rgba(2, 6, 23, 0.76)",
  dangerBackground: "#3f1d24",
  dangerBorder: "#7f1d1d",
  dangerText: "#fecaca",
  dangerSolid: "#b91c1c",
  warningBackground: "#3a2a10",
  warningBorder: "#8a5a13",
  warningText: "#fde68a",
  successBackground: "#163223",
  successBorder: "#166534",
  successText: "#bbf7d0",
  statusBarStyle: "light",
  webThemeColor: "#0f1221",
};

function resolveTheme(mode: ThemeMode, system: SystemTheme): ResolvedTheme {
  if (mode === "light") return "light";
  if (mode === "dark") return "dark";
  return system === "dark" ? "dark" : "light";
}

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  tokens: ThemeTokens;
  setMode: (nextMode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [systemTheme, setSystemTheme] = useState<SystemTheme>(Appearance.getColorScheme() ?? null);

  useEffect(() => {
    AsyncStorage.getItem(THEME_MODE_STORAGE_KEY)
      .then((storedValue) => {
        if (storedValue === "light" || storedValue === "dark" || storedValue === "system") {
          setModeState(storedValue);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemTheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);
    void AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, nextMode).catch(() => undefined);
  }, []);

  const resolvedTheme = useMemo(() => resolveTheme(mode, systemTheme), [mode, systemTheme]);
  const tokens = useMemo(
    () => (resolvedTheme === "dark" ? DARK_TOKENS : LIGHT_TOKENS),
    [resolvedTheme],
  );

  useEffect(() => {
    if (typeof document === "undefined") return;

    document.documentElement.setAttribute("data-theme", resolvedTheme);
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    metaThemeColor?.setAttribute("content", tokens.webThemeColor);
  }, [resolvedTheme, tokens.webThemeColor]);

  const value = useMemo(
    () => ({ mode, resolvedTheme, tokens, setMode }),
    [mode, resolvedTheme, setMode, tokens],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used within ThemeProvider");
  }
  return context;
}
