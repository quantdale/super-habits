import { createContext, useContext } from 'react';
import type { SectionAccent, SectionKey } from '@/constants/sectionColors';
import type { ThemeDefinition, ThemeId, ThemeTokens } from '@/core/theme';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export type ThemeContextValue = {
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

export function useAppTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within ThemeProvider');
  }
  return context;
}

export { ThemeContext };
