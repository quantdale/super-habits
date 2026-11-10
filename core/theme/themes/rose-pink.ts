import { createTheme } from '@/core/theme/createTheme';

/**
 * Rose Pink — Playful Momentum §5.4 "brand-hue swap": blush stationery canvas
 * kept, brand now Rose instead of Sprout. The solid / bright / lip triple lives
 * in `primary`, `primaryBright` and the `button`…`buttonLip` band.
 */
export const rosePink = createTheme({
  id: 'rose-pink',
  name: 'Rose Pink',
  appearance: 'light',
  description: 'Soft blush stationery. Journaling and gentle, personal-feeling tools.',
  // Solid tier: 6.04:1 as colored text on the white card face.
  primary: '#BE185D',
  // Shapes/nodes tier: 4.08:1 on the card face, ink #10131A reads 4.55:1.
  primaryBright: '#DF3D85',
  secondary: '#fce7f3',
  accent: '#9D174D',
  button: '#BE185D',
  buttonText: '#ffffff',
  buttonHover: '#9D174D',
  buttonActive: '#831843',
  buttonLip: '#831843',
  background: '#fdf5f8',
  surface: '#ffffff',
  surfaceElevated: '#fbeaf1',
  border: '#f3d7e2',
  tabRail: '#faeaf1',
  tabRailBorder: '#eed0dd',
  text: '#3f1226',
  textMuted: '#8b5f70',
  brandGradient: ['#BE185D', '#BE185D'],
});
