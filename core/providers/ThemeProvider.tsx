import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getSectionAccents, type SectionAccent, type SectionKey } from '@/constants/sectionColors';
import {
  DEFAULT_DARK_THEME_ID,
  DEFAULT_LIGHT_THEME_ID,
  THEME_REGISTRY,
  getTheme,
  isThemeId,
  type ThemeDefinition,
  type ThemeId,
  type ThemeTokens,
} from '@/core/theme';

export type { ThemeTokens };
export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
type SystemTheme = 'light' | 'dark' | 'unspecified' | null;

const THEME_MODE_STORAGE_KEY = 'superhabits.theme.mode';
const THEME_SLOTS_STORAGE_KEY = 'superhabits.theme.slots.v2';

type ThemeSlots = {
  lightThemeId: ThemeId;
  darkThemeId: ThemeId;
};

const DEFAULT_SLOTS: ThemeSlots = {
  lightThemeId: DEFAULT_LIGHT_THEME_ID,
  darkThemeId: DEFAULT_DARK_THEME_ID,
};

function parseStoredSlots(raw: string | null): ThemeSlots {
  if (!raw) return DEFAULT_SLOTS;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<keyof ThemeSlots, unknown>>;
    return {
      lightThemeId: isThemeId(parsed.lightThemeId) ? parsed.lightThemeId : DEFAULT_LIGHT_THEME_ID,
      darkThemeId: isThemeId(parsed.darkThemeId) ? parsed.darkThemeId : DEFAULT_DARK_THEME_ID,
    };
  } catch {
    return DEFAULT_SLOTS;
  }
}

function resolveTheme(mode: ThemeMode, system: SystemTheme): ResolvedTheme {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  return system === 'dark' ? 'dark' : 'light';
}

function kebabToCamelCssVar(key: string): string {
  return `--sh-${key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`;
}

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  themeId: ThemeId;
  theme: ThemeDefinition;
  tokens: ThemeTokens;
  sectionAccents: Record<SectionKey, SectionAccent>;
  setMode: (nextMode: ThemeMode) => void;
  setTheme: (id: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [systemTheme, setSystemTheme] = useState<SystemTheme>(Appearance.getColorScheme() ?? null);
  const [slots, setSlots] = useState<ThemeSlots>(DEFAULT_SLOTS);

  useEffect(() => {
    AsyncStorage.getItem(THEME_MODE_STORAGE_KEY)
      .then((storedValue) => {
        if (storedValue === 'light' || storedValue === 'dark' || storedValue === 'system') {
          setModeState(storedValue);
        }
      })
      .catch(() => undefined);

    AsyncStorage.getItem(THEME_SLOTS_STORAGE_KEY)
      .then((storedValue) => {
        setSlots(parseStoredSlots(storedValue));
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
  const themeId = resolvedTheme === 'dark' ? slots.darkThemeId : slots.lightThemeId;
  const theme = useMemo(() => getTheme(themeId), [themeId]);
  const tokens = theme.tokens;

  const setTheme = useCallback(
    (id: ThemeId) => {
      const nextAppearance = THEME_REGISTRY[id].appearance;
      setSlots((current) => {
        const next: ThemeSlots =
          nextAppearance === 'dark'
            ? { ...current, darkThemeId: id }
            : { ...current, lightThemeId: id };
        void AsyncStorage.setItem(THEME_SLOTS_STORAGE_KEY, JSON.stringify(next)).catch(
          () => undefined,
        );
        return next;
      });
      // A fixed mode must flip appearance so the chosen theme becomes visible
      // immediately; in `system` mode the slot fills in for whichever
      // appearance is next active, with no visible change right now.
      if (mode !== 'system') setMode(nextAppearance);
    },
    [mode, setMode],
  );

  const sectionAccents = useMemo(
    () => getSectionAccents(resolvedTheme, theme.sectionOverrides),
    [resolvedTheme, theme.sectionOverrides],
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;

    document.documentElement.setAttribute('data-theme', resolvedTheme);
    document.documentElement.setAttribute('data-theme-id', themeId);
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    metaThemeColor?.setAttribute('content', tokens.webThemeColor);

    for (const [key, value] of Object.entries(tokens)) {
      if (typeof value !== 'string') continue;
      document.documentElement.style.setProperty(kebabToCamelCssVar(key), value);
    }
  }, [resolvedTheme, themeId, tokens]);

  const value = useMemo(
    () => ({ mode, resolvedTheme, themeId, theme, tokens, sectionAccents, setMode, setTheme }),
    [mode, resolvedTheme, themeId, theme, tokens, sectionAccents, setMode, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within ThemeProvider');
  }
  return context;
}
