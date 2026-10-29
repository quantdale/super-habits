import { createTheme } from '@/core/theme/createTheme';

/**
 * Dark — the default dark appearance. Playful Momentum §5.3: blue-charcoal
 * canvas (not indigo-plum) and bright-fill buttons with an ink label.
 */
export const dark = createTheme({
  id: 'dark',
  name: 'Dark',
  appearance: 'dark',
  description: 'Blue-charcoal canvas, bright Sprout fills with ink labels.',
  primary: '#4DC93A',
  primaryBright: '#4DC93A',
  secondary: '#232938',
  accent: '#2FA8F7',
  button: '#4DC93A',
  buttonText: '#10131A',
  buttonHover: '#5AD447',
  buttonActive: '#3DB52C',
  buttonLip: '#1A7F2B',
  background: '#131722',
  surface: '#1A1F2B',
  surfaceElevated: '#232938',
  surfaceSunken: '#0F121A',
  surfaceHover: '#202635',
  surfaceActive: '#2A3142',
  border: '#2E3546',
  borderStrong: '#0B0E14',
  tabRail: '#1A1F2B',
  tabRailBorder: '#2E3546',
  text: '#F4F6FB',
  textMuted: '#AAB2C3',
  textSubtle: '#8A93A6',
  iconMuted: '#6D7690',
  overlayScrim: 'rgba(0, 0, 0, 0.65)',
  shadowColor: '#0B0E14',
  brandGradient: ['#4DC93A', '#4DC93A'],
  glow: 'transparent',
  webThemeColor: '#131722',
  statusBarStyle: 'light',
});
