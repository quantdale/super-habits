import { createTheme } from '@/core/theme/createTheme';

/**
 * Midnight Blue — Playful Momentum §5.4 "brand-hue swap": the deep-navy
 * cockpit canvas is unchanged, and the brand role is Blue, never Sprout.
 * `primary` (colored text), `primaryBright` (shapes/nodes) and the
 * `button`…`buttonLip` band carry Blue's own solid / bright / lip triple.
 */
export const midnightBlue = createTheme({
  id: 'midnight-blue',
  name: 'Midnight Blue',
  appearance: 'dark',
  description: 'A deep navy cockpit for productivity and coding.',
  // Solid tier: lifted from #3B82F6 (4.45:1 on the navy card face) so both
  // the 4.5 text floor and the non-text floor hold on every dark surface.
  primary: '#4A90F7',
  // Shapes/nodes tier: ink #10131A reads 7.31:1; the theme keeps a white
  // label on its button face, so bright never carries one.
  primaryBright: '#60A5FA',
  secondary: '#1e3a5f',
  accent: '#7DD3FC',
  button: '#2563EB',
  buttonText: '#ffffff',
  buttonHover: '#1D4ED8',
  buttonActive: '#1E40AF',
  // Press depth: below the face and readable under the white label.
  buttonLip: '#1B3A9E',
  background: '#0a1526',
  surface: '#112036',
  surfaceElevated: '#0d1a2d',
  border: '#23395a',
  tabRail: '#0d1b2f',
  tabRailBorder: '#1e3350',
  text: '#e8f0fb',
  textMuted: '#9fb3d1',
  // Quieter than textMuted, still ≥4.5 on surface / elevated / sunken.
  textSubtle: '#8396B2',
  // The derived tint reads 3.82:1 under the brand label, so the inactive
  // chip face is pinned (4.61:1).
  chipBackground: '#162945',
  brandGradient: ['#2563EB', '#2563EB'],
});
