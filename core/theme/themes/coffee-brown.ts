import { createTheme } from '@/core/theme/createTheme';

/**
 * Coffee Brown — Playful Momentum §5.4 "brand-hue swap": the canvas family
 * (cream paper, warm ink) is unchanged, but the brand role is Coffee now,
 * never Sprout. `primary`/`primaryBright` plus the `button`…`buttonLip` band
 * describe Coffee's own solid / bright / lip triple: solid = the white-label
 * face, bright = shapes and nodes only, lip = the press depth under the face.
 */
export const coffeeBrown = createTheme({
  id: 'coffee-brown',
  name: 'Coffee Brown',
  appearance: 'light',
  description: 'A café notebook. Journaling, reading, and general use.',
  // Solid tier: 5.58:1 as colored text on the white card face.
  primary: '#8B5E3C',
  // Shapes/nodes tier (never a label face): ink #10131A reads 4.68:1 on it.
  primaryBright: '#9E785B',
  secondary: '#e9dbcc',
  accent: '#0F766E',
  button: '#6F4E37',
  buttonText: '#ffffff',
  buttonHover: '#5A3F2C',
  buttonActive: '#46311F',
  // Press depth: below the face and readable under the white label.
  buttonLip: '#46311F',
  background: '#faf6f0',
  surface: '#ffffff',
  surfaceElevated: '#f3ebe1',
  border: '#e7dacb',
  tabRail: '#f4ede3',
  tabRailBorder: '#e2d3c0',
  text: '#33261c',
  textMuted: '#75634f',
  // Quieter than textMuted, still ≥4.5 on surface / elevated / sunken.
  textSubtle: '#786653',
  // §5.2 retires gradients outside celebrations: a flat pair keeps the shell
  // mark's glyph on the same fill as the button label.
  brandGradient: ['#6F4E37', '#6F4E37'],
});
