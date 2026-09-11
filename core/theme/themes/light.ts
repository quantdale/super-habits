import { createTheme } from '@/core/theme/createTheme';

/**
 * Pop Light — the default. A soft lavender canvas, crisp white cards, and a
 * vivid violet brand. Chosen so the app reads as a friendly consumer product
 * rather than a grey productivity tool.
 */
export const light = createTheme({
  id: 'light',
  name: 'Light',
  appearance: 'light',
  description: 'Lavender canvas, white cards, vivid violet brand. Default.',
  primary: '#6C4CF5',
  secondary: '#EDE7FF',
  accent: '#C026D3',
  button: '#6C4CF5',
  buttonText: '#FFFFFF',
  buttonHover: '#5B3AE0',
  buttonActive: '#4A2BC4',
  background: '#F5F3FF',
  surface: '#FFFFFF',
  surfaceElevated: '#FBFAFF',
  border: '#E7E3F7',
  tabRail: '#FFFFFF',
  tabRailBorder: '#ECE8F8',
  text: '#16123A',
  textMuted: '#655F8A',
  iconMuted: '#8C86B0',
  overlayScrim: 'rgba(20, 14, 60, 0.45)',
  shadowColor: '#2A1E6B',
});
