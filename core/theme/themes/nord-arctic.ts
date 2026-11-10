import { createTheme } from '@/core/theme/createTheme';

/**
 * Nord Arctic — Playful Momentum §5.4 "brand-hue swap": the beloved Nord
 * canvas (`background #2e3440`, asserted by `e2e/theming.spec.ts`) is
 * unchanged, and the brand role is Nord Frost, never Sprout. `primary`
 * (colored text), `primaryBright` (shapes/nodes) and the `button`…`buttonLip`
 * band carry Frost's own solid / bright / lip triple.
 */
export const nordArctic = createTheme({
  id: 'nord-arctic',
  name: 'Nord Arctic',
  appearance: 'dark',
  description: 'The beloved developer palette. Coding and all-day productivity.',
  // Solid tier: 5.03:1 as colored text on the Nord card face.
  primary: '#88C0D0',
  primaryBright: '#88C0D0',
  secondary: '#434c5e',
  accent: '#A3BE8C',
  // Ink-label cold face (§5.3 dark pattern): 7.62 / 8.82 / 6.51.
  button: '#88C0D0',
  buttonText: '#20262e',
  buttonHover: '#9BCDDC',
  buttonActive: '#79B2C4',
  // Press depth: below the face and readable under the ink label (4.60:1).
  buttonLip: '#6994A0',
  background: '#2e3440',
  surface: '#3b4252',
  surfaceElevated: '#343b49',
  border: '#4c566a',
  tabRail: '#333947',
  tabRailBorder: '#454f63',
  text: '#eceff4',
  textMuted: '#c2c9d6',
  // Quieter than textMuted, still ≥4.5 on surface / elevated / sunken.
  textSubtle: '#B7BECB',
  // The derived tint reads 3.50:1 under the brand label, so the inactive chip
  // face is pinned (4.68:1).
  chipBackground: '#3E4757',
  brandGradient: ['#88C0D0', '#88C0D0'],
});
