import { createTheme } from '@/core/theme/createTheme';

/** The app's existing default. Migrated verbatim + new interaction roles. */
export const light = createTheme({
  id: 'light',
  name: 'Light',
  appearance: 'light',
  description: 'The airy lavender-white workspace. General use, default.',
  primary: '#7C3AED',
  secondary: '#ede9fe',
  accent: '#6D28D9',
  button: '#7C3AED',
  buttonText: '#ffffff',
  buttonHover: '#6D28D9',
  buttonActive: '#5B21B6',
  background: '#f8f7ff',
  surface: '#ffffff',
  surfaceElevated: '#f8f7ff',
  border: '#e2e8f0',
  tabRail: '#eeecf8',
  tabRailBorder: '#d4d0ee',
  text: '#0f172a',
  // Nudged from #64748b (4.47:1, an AA miss on surfaceElevated) to #5d6c83 (5.01:1).
  textMuted: '#5d6c83',
});
