import { createTheme } from '@/core/theme/createTheme';

export const solarized = createTheme({
  id: 'solarized',
  name: 'Solarized',
  appearance: 'light',
  description: 'Aged paper under warm lamplight. Coding and reading-heavy productivity.',
  primary: '#268BD2',
  secondary: '#eee8d5',
  // Deepened from the canonical #6c71c4 (4.27:1) to keep AA on surface.
  accent: '#5a60ba',
  // Darkened from the canonical #268BD2 — white labels on it are 3.7:1, below AA.
  button: '#1a6e9e',
  buttonText: '#ffffff',
  buttonHover: '#15597f',
  buttonActive: '#104963',
  background: '#fdf6e3',
  surface: '#fffcf2',
  surfaceElevated: '#eee8d5',
  border: '#ddd1ae',
  tabRail: '#f6eed7',
  tabRailBorder: '#dccfa8',
  text: '#073642',
  textMuted: '#51666d',
});
