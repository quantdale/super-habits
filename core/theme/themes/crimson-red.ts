import { createTheme } from '@/core/theme/createTheme';

export const crimsonRed = createTheme({
  id: 'crimson-red',
  name: 'Crimson Red',
  appearance: 'dark',
  description: 'A dark theater. Gaming and workout-heavy sessions.',
  primary: '#F87171',
  secondary: '#3d1d24',
  accent: '#FBBF24',
  button: '#DC2626',
  buttonText: '#ffffff',
  buttonHover: '#B91C1C',
  buttonActive: '#991B1B',
  background: '#190c10',
  surface: '#241318',
  surfaceElevated: '#1f1014',
  border: '#47242b',
  tabRail: '#1d0e12',
  tabRailBorder: '#3a1d24',
  text: '#fbedee',
  textMuted: '#d3a6ac',
  // With a red primary, destructive actions can't rely on hue alone to stand
  // apart from the rest of the chrome — shift the danger set to a distinct
  // rose instead of overlapping the theme's own red.
  dangerBackground: '#451a1e',
  dangerBorder: '#7f2b31',
  dangerText: '#FDA4AF',
  dangerSolid: '#E11D48',
});
