import { createTheme } from '@/core/theme/createTheme';

/**
 * Sunset Orange — Playful Momentum §5.4 "brand-hue swap": golden-hour canvas
 * kept, brand now Sunset instead of Sprout. The solid / bright / lip triple
 * lives in `primary`, `primaryBright` and the `button`…`buttonLip` band.
 */
export const sunsetOrange = createTheme({
  id: 'sunset-orange',
  name: 'Sunset Orange',
  appearance: 'light',
  description: 'Golden hour. Motivational, energetic daily planning.',
  // Solid tier: 5.18:1 as colored text on the white card face.
  primary: '#C2410C',
  // Shapes/nodes tier: 3.56:1 on the card face, ink #10131A reads 5.22:1.
  primaryBright: '#EA580C',
  secondary: '#fed7aa',
  accent: '#7E22CE',
  button: '#C2410C',
  buttonText: '#ffffff',
  buttonHover: '#9A3412',
  buttonActive: '#7C2D12',
  buttonLip: '#7C2D12',
  background: '#fff9f2',
  surface: '#ffffff',
  surfaceElevated: '#fff3e6',
  border: '#f3dfc9',
  tabRail: '#fdf0e2',
  tabRailBorder: '#eed7bc',
  text: '#3b1d0f',
  textMuted: '#7c4a21',
  // Quieter than textMuted, still ≥4.5 on surface / elevated / sunken.
  textSubtle: '#8E6340',
  // The derived ink tint would read 4.48:1 under the brand label, so the
  // inactive chip face is pinned one step lighter (4.62:1).
  chipBackground: '#FAF0EC',
  brandGradient: ['#C2410C', '#C2410C'],
});
