import { createTheme } from '@/core/theme/createTheme';

/**
 * Light — the default. Playful Momentum §5.2: a Duolingo-style white canvas,
 * cards defined by their 2px border, and the Sprout green brand
 * (`#1A7F2B` face / `#4DC93A` marks).
 */
export const light = createTheme({
  id: 'light',
  name: 'Light',
  appearance: 'light',
  description: 'White canvas, 2px card borders, Sprout green brand. Default.',
  primary: '#1A7F2B',
  primaryBright: '#4DC93A',
  secondary: '#FFFFFF',
  accent: '#1769D8',
  button: '#1A7F2B',
  buttonText: '#FFFFFF',
  buttonHover: '#17742A',
  buttonActive: '#135B1F',
  buttonLip: '#135B1F',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceSunken: '#F3F5F9',
  surfaceHover: '#F7F8FB',
  surfaceActive: '#EDF0F5',
  border: '#E3E6EE',
  borderStrong: '#D5DAE3',
  tabRail: '#FFFFFF',
  tabRailBorder: '#E3E6EE',
  text: '#1F2430',
  textMuted: '#5B6475',
  textSubtle: '#656D80',
  iconMuted: '#9AA2B1',
  chipBackground: '#FFFFFF',
  chipBorder: '#E3E6EE',
  overlayScrim: 'rgba(16, 19, 26, 0.55)',
  shadowColor: '#10131A',
  // Gradients retired outside celebration; the type is kept (flat pair).
  brandGradient: ['#4DC93A', '#4DC93A'],
  glow: 'transparent',
  webThemeColor: '#FFFFFF',
  statusBarStyle: 'dark',
});
