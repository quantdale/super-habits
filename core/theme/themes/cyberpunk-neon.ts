import { createTheme } from '@/core/theme/createTheme';

/**
 * Cyberpunk Neon — Playful Momentum §5.4 "brand-hue swap": the wet-asphalt
 * canvas and its §5.4 `sectionOverrides` are unchanged; only the brand band
 * stops borrowing Sprout. `primary` (colored text), `primaryBright`
 * (shapes/nodes) and the `button`…`buttonLip` band carry Neon's own
 * solid / bright / lip triple.
 */
export const cyberpunkNeon = createTheme({
  id: 'cyberpunk-neon',
  name: 'Cyberpunk Neon',
  appearance: 'dark',
  description: 'Neon signage on wet asphalt. Gaming and late-night focus sprints.',
  // Solid tier: 5.89:1 as colored text on this canvas.
  primary: '#FF2ED1',
  primaryBright: '#FF2ED1',
  secondary: '#1d1145',
  accent: '#00E5FF',
  // Ink-label neon face (§5.3 dark pattern): 6.28 / 7.48 / 4.98.
  button: '#FF2ED1',
  buttonText: '#14020f',
  buttonHover: '#FF5CDC',
  buttonActive: '#E51EB8',
  // Press depth: below the face and readable under the ink label (4.67:1).
  buttonLip: '#D927B2',
  background: '#07080f',
  surface: '#0e1020',
  surfaceElevated: '#0a0c18',
  border: '#262b4a',
  tabRail: '#0a0c16',
  tabRailBorder: '#202440',
  text: '#eaf2ff',
  textMuted: '#8b93b8',
  // This canvas is darker than the default dark, so textSubtle is pinned
  // independently of textMuted (≥4.5 on surface / elevated / sunken).
  textSubtle: '#7F86A9',
  brandGradient: ['#FF2ED1', '#FF2ED1'],
  // This canvas (#07080f) is far darker than the default dark (#131722), so the
  // §5.1 danger wash (#432A34) would lift the panel and drop this theme's
  // already-muted textMuted to 4.30:1. A deeper Cherry wash keeps both the
  // danger text (6.75:1) and textMuted (5.07:1) AA-clean on this canvas.
  dangerBackground: '#361E29',
  dangerBorder: '#911D2A',
  // Large fields stay dark; neon is reserved for interactive elements —
  // the default (muted) section fills would look flat here, so tab icons
  // get a neon-grade variant of each section's hue.
  sectionOverrides: {
    todos: { fill: '#38BDF8', text: '#38BDF8', tint: '#38BDF81F' },
    habits: { fill: '#4ADE80', text: '#4ADE80', tint: '#4ADE801F' },
    focus: { fill: '#C084FC', text: '#C084FC', tint: '#C084FC1F' },
    workout: { fill: '#FB923C', text: '#FB923C', tint: '#FB923C1F' },
    calories: { fill: '#FDE047', text: '#FDE047', tint: '#FDE0471F' },
  },
});
