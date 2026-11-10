import { createTheme } from '@/core/theme/createTheme';

/**
 * Ocean Teal — Playful Momentum §5.4 "brand-hue swap": the coastal canvas is
 * unchanged and the brand role is Teal, never Sprout. `primary`,
 * `primaryBright` and the `button`…`buttonLip` band carry Teal's own
 * solid / bright / lip triple (role definitions in `light.ts`, §5.2).
 */
export const oceanTeal = createTheme({
  id: 'ocean-teal',
  name: 'Ocean Teal',
  appearance: 'light',
  description: 'A bright coastal morning. General use and design work in daylight.',
  // Solid tier (§5.1): paints colored text and the white-label button face.
  primary: '#0F766E',
  // Shapes/nodes tier: 3.74:1 on the card face and ink #10131A reads 4.96:1.
  primaryBright: '#0D9488',
  secondary: '#ccfbf1',
  accent: '#0E7490',
  button: '#0F766E',
  buttonText: '#ffffff',
  buttonHover: '#115E59',
  buttonActive: '#134E4A',
  // Press depth: below the face and readable under the white label.
  buttonLip: '#134E4A',
  background: '#f2fafa',
  surface: '#ffffff',
  surfaceElevated: '#eaf5f5',
  border: '#cbe5e2',
  tabRail: '#e4f2f1',
  tabRailBorder: '#c4dedb',
  text: '#0f3d3b',
  textMuted: '#42706b',
  // Quieter than textMuted, still ≥4.5 on surface / elevated / sunken.
  textSubtle: '#4A7671',
  brandGradient: ['#0F766E', '#0F766E'],
});
