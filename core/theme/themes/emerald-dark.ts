import { createTheme } from '@/core/theme/createTheme';

/**
 * Emerald Dark — Playful Momentum §5.4 "brand-hue swap": the OLED-friendly
 * jewel-case canvas is unchanged, and the brand role is Emerald, never Sprout.
 * `primary` (colored text), `primaryBright` (shapes/nodes) and the
 * `button`…`buttonLip` band carry Emerald's own solid / bright / lip triple.
 */
export const emeraldDark = createTheme({
  id: 'emerald-dark',
  name: 'Emerald Dark',
  appearance: 'dark',
  description: 'Jewel-case minimalism. Coding and focused deep work; OLED-friendly.',
  // Solid tier: 7.04:1 as colored text on the jewel-case card face.
  primary: '#10B981',
  // Shapes/nodes tier: ink #10131A reads 9.67:1 on it.
  primaryBright: '#34D399',
  secondary: '#173029',
  accent: '#6EE7B7',
  // Ink-label face (§5.3 dark pattern): 6.51 / 8.58 / 5.30.
  button: '#10B981',
  buttonText: '#04241a',
  buttonHover: '#34D399',
  buttonActive: '#0DA678',
  // Press depth: below the face and readable under the ink label (4.77:1).
  buttonLip: '#0E9D6E',
  background: '#0a0f0d',
  surface: '#111917',
  surfaceElevated: '#0d1412',
  border: '#1f2e29',
  tabRail: '#0d1310',
  tabRailBorder: '#1c2a24',
  text: '#e7f0ec',
  textMuted: '#96aba1',
  // Quieter than textMuted, still ≥4.5 on surface / elevated / sunken.
  textSubtle: '#7E9188',
  brandGradient: ['#10B981', '#10B981'],
});
