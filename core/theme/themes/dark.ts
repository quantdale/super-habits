import { createTheme } from '@/core/theme/createTheme';

/** The app's existing Dark. Migrated verbatim + new interaction roles. */
export const dark = createTheme({
  id: 'dark',
  name: 'Dark',
  appearance: 'dark',
  description: 'The cool indigo night mode. General use, low light.',
  primary: '#A78BFA',
  secondary: '#2b2350',
  accent: '#C4B5FD',
  button: '#7C3AED',
  buttonText: '#ffffff',
  buttonHover: '#6D28D9',
  buttonActive: '#5B21B6',
  background: '#0f1221',
  surface: '#171a2a',
  surfaceElevated: '#111427',
  border: '#334155',
  tabRail: '#1a1f34',
  tabRailBorder: '#2e3552',
  text: '#e2e8f0',
  textMuted: '#a6b0c2',
});
