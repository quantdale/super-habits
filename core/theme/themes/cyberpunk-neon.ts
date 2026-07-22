import { createTheme } from '@/core/theme/createTheme';

export const cyberpunkNeon = createTheme({
  id: 'cyberpunk-neon',
  name: 'Cyberpunk Neon',
  appearance: 'dark',
  description: 'Neon signage on wet asphalt. Gaming and late-night focus sprints.',
  primary: '#FF2ED1',
  secondary: '#1d1145',
  accent: '#00E5FF',
  button: '#FF2ED1',
  buttonText: '#14020f',
  buttonHover: '#FF5CDC',
  buttonActive: '#E51EB8',
  background: '#07080f',
  surface: '#0e1020',
  surfaceElevated: '#0a0c18',
  border: '#262b4a',
  tabRail: '#0a0c16',
  tabRailBorder: '#202440',
  text: '#eaf2ff',
  textMuted: '#8b93b8',
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
