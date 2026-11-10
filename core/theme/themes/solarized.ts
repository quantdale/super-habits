import { createTheme } from '@/core/theme/createTheme';

/**
 * Solarized — Playful Momentum §5.4 "brand-hue swap": aged-paper canvas kept,
 * brand now Solarized blue instead of Sprout. The solid / bright / lip triple
 * lives in `primary`, `primaryBright` and the `button`…`buttonLip` band.
 */
export const solarized = createTheme({
  id: 'solarized',
  name: 'Solarized',
  appearance: 'light',
  description: 'Aged paper under warm lamplight. Coding and reading-heavy productivity.',
  // Solid tier: 5.43:1 as colored text on the paper card face.
  primary: '#1a6e9e',
  // Shapes/nodes tier: 3.73:1 on the paper face, ink #10131A reads 4.86:1.
  // Darkened from the canonical #268BD2 so both floors hold on #fffcf2.
  primaryBright: '#2588CE',
  secondary: '#eee8d5',
  // Deepened from the canonical #6c71c4 (4.27:1) to keep AA on surface.
  accent: '#545bb4',
  // Darkened from the canonical #268BD2 — white labels on it are 3.7:1, below AA.
  button: '#1a6e9e',
  buttonText: '#ffffff',
  buttonHover: '#15597f',
  buttonActive: '#104963',
  // Press depth: below the face and readable under the white label.
  buttonLip: '#104963',
  background: '#fdf6e3',
  surface: '#fffcf2',
  surfaceElevated: '#eee8d5',
  border: '#ddd1ae',
  tabRail: '#f6eed7',
  tabRailBorder: '#dccfa8',
  text: '#073642',
  textMuted: '#51666d',
  // Quieter than textMuted, still ≥4.5 on surface / elevated / sunken.
  textSubtle: '#546970',
  brandGradient: ['#1a6e9e', '#1a6e9e'],
});
