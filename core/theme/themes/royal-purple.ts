import { createTheme } from '@/core/theme/createTheme';

/**
 * Royal Purple — Playful Momentum §5.4 "brand-hue swap": velvet-and-gold
 * canvas kept, brand role is Violet, never Sprout. The theme moves its button
 * onto the §5.3 **bright fill + ink label** pattern (`#10131A`): the previous
 * `#7C3AED` face reads 2.87:1 as a mark on the velvet card (below the 3:1
 * non-text floor), while Bright Violet clears both the mark floor and the
 * label floor with one hue.
 */
export const royalPurple = createTheme({
  id: 'royal-purple',
  name: 'Royal Purple',
  appearance: 'dark',
  description: 'Velvet and gold. General use for brand-color lovers; leisure sessions.',
  // Solid tier: 6.02:1 as colored text on the velvet card face.
  primary: '#A78BFA',
  primaryBright: '#A78BFA',
  secondary: '#33265c',
  accent: '#FBBF24',
  button: '#A78BFA',
  buttonText: '#10131A',
  buttonHover: '#B9A0FC',
  buttonActive: '#9370F7',
  // Press depth: below the face and below `buttonActive`, still readable
  // under the ink label (4.84:1).
  buttonLip: '#8F69F2',
  background: '#160f2b',
  surface: '#211a3e',
  surfaceElevated: '#1b1435',
  border: '#382b63',
  tabRail: '#191133',
  tabRailBorder: '#302355',
  text: '#efeafb',
  textMuted: '#b4a8d6',
  // Quieter than textMuted, still ≥4.5 on surface / elevated / sunken.
  textSubtle: '#978CB8',
  // The derived tint reads 4.25:1 under the brand label, so the inactive
  // chip face is pinned (4.62:1).
  chipBackground: '#362C5C',
  // `textOnAccent` is DERIVED from `buttonText`, and this theme's button is the
  // §5.3 bright fill + ink label — so without this pin the token would become
  // `#10131A` and paint the "on accent" ink at ~1:1 on the accent fills it
  // actually lands on (amber `#FBBF24`, danger rose `#E11D48`). Pin the
  // pre-swap value: it is what the fixed-fill consumers were validated against
  // and it is the label colour of the theme's saturated solids.
  textOnAccent: '#ffffff',
  brandGradient: ['#A78BFA', '#A78BFA'],
});
