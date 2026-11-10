import { createTheme } from '@/core/theme/createTheme';

/**
 * Crimson Red — Playful Momentum §5.4 "brand-hue swap": the dark-theatre
 * canvas is unchanged, and the brand role is Crimson, never Sprout.
 * `primary` (colored text), `primaryBright` (shapes/nodes) and the
 * `button`…`buttonLip` band carry Crimson's own solid / bright / lip triple.
 */
export const crimsonRed = createTheme({
  id: 'crimson-red',
  name: 'Crimson Red',
  appearance: 'dark',
  description: 'A dark theater. Gaming and workout-heavy sessions.',
  // Solid tier: 6.43:1 as colored text on the theatre card face.
  primary: '#F87171',
  primaryBright: '#F87171',
  secondary: '#3d1d24',
  accent: '#FBBF24',
  // White-label face, AA on every state (4.83 / 6.47 / 8.31).
  button: '#DC2626',
  buttonText: '#ffffff',
  buttonHover: '#B91C1C',
  buttonActive: '#991B1B',
  // Press depth: below the face and readable under the white label.
  buttonLip: '#991B1B',
  background: '#190c10',
  surface: '#241318',
  surfaceElevated: '#1f1014',
  border: '#47242b',
  tabRail: '#1d0e12',
  tabRailBorder: '#3a1d24',
  text: '#fbedee',
  textMuted: '#d3a6ac',
  // This canvas is darker than the default dark, so textSubtle is pinned
  // independently of textMuted (≥4.5 on surface / elevated / sunken).
  textSubtle: '#A98388',
  brandGradient: ['#DC2626', '#DC2626'],
  // With a red primary, destructive actions can't rely on hue alone to stand
  // apart from the rest of the chrome — shift the danger set to a distinct
  // rose instead of overlapping the theme's own red.
  dangerBackground: '#451a1e',
  dangerBorder: '#7f2b31',
  dangerText: '#FDA4AF',
  dangerSolid: '#E11D48',
});
