import { createTheme } from '@/core/theme/createTheme';

/**
 * Forest Green — Playful Momentum §5.4 "brand-hue swap": the after-dusk pine
 * canvas is unchanged, and the brand role is Forest green, never Sprout.
 * `primary` (colored text/links), `primaryBright` (shapes/nodes) and the
 * `button`…`buttonLip` band carry Forest's own solid / bright / lip triple.
 */
export const forestGreen = createTheme({
  id: 'forest-green',
  name: 'Forest Green',
  appearance: 'dark',
  description: 'A pine forest after dusk. Habit-focused daily use and evening journaling.',
  // Solid tier: 9.56:1 as colored text on the pine card face.
  primary: '#4ADE80',
  // Shapes/nodes tier (bright + ink label in dark, per §5.3).
  primaryBright: '#4ADE80',
  secondary: '#1d3528',
  accent: '#A3E635',
  // Ink-labelled dark button (§5.3): bright fill, `#052e1f` label.
  button: '#34D399',
  buttonText: '#052e1f',
  buttonHover: '#5FE3AC',
  buttonActive: '#2BBE88',
  // Press depth: below the face, still readable under the ink label (4.98:1)
  // and distinctly deeper than the face's own hover/active ramp.
  buttonLip: '#2AA97A',
  background: '#0c1712',
  surface: '#13211a',
  surfaceElevated: '#101d16',
  border: '#24382c',
  tabRail: '#101c15',
  tabRailBorder: '#20342a',
  text: '#e4eee6',
  textMuted: '#9db4a4',
  // Quieter than textMuted, still ≥4.5 on surface / elevated / sunken.
  textSubtle: '#819788',
  brandGradient: ['#34D399', '#34D399'],
});
