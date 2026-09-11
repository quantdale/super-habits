import { createTheme } from '@/core/theme/createTheme';

/**
 * Pop Dark — the default dark appearance. Deep indigo-black canvas, plum
 * surfaces, and a bright violet brand so saturated accents stay legible
 * without glare.
 */
export const dark = createTheme({
  id: 'dark',
  name: 'Dark',
  appearance: 'dark',
  description: 'Deep indigo canvas, plum surfaces, bright violet brand.',
  primary: '#A78BFA',
  secondary: '#241F45',
  accent: '#F472B6',
  button: '#6D4BE8',
  buttonText: '#FFFFFF',
  buttonHover: '#5E3CD6',
  buttonActive: '#4F2FC0',
  background: '#0C0A1D',
  surface: '#171436',
  surfaceElevated: '#1F1B42',
  border: '#2A2550',
  tabRail: '#171436',
  tabRailBorder: '#2A2550',
  text: '#F3F1FF',
  textMuted: '#A9A4C9',
  iconMuted: '#8F89B8',
  overlayScrim: 'rgba(6, 4, 20, 0.72)',
  shadowColor: '#04021A',
});
