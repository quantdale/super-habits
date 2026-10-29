/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('nativewind/preset')],
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './features/**/*.{js,jsx,ts,tsx}',
    './core/**/*.{js,jsx,ts,tsx}',
  ],
  // Keep the emitted CSS independent of incidental words in source. Tailwind's
  // extractor treats any bare word in a scanned file as a class candidate, so
  // backup generation code using the identifier `ordinal` (chunk ordinals) made
  // it emit an unused `.ordinal` utility. That changed the CSS bundle hash even
  // though nothing applied the class. Blocking these words keeps the built CSS
  // stable as source evolves, which the zero-tolerance visual goldens depend on.
  blocklist: ['ordinal', 'slashed-zero', 'proportional-nums'],
  theme: {
    extend: {
      colors: {
        // Per-section hues — Playful Momentum §5.1. DEFAULT = `solid` (colored
        // text + white-label face), `bright` = shapes/nodes, `lip` = pressable
        // depth, `light`/`dark` = the tintLight / tintDark washes.
        todos: { DEFAULT: '#1769D8', bright: '#2FA8F7', lip: '#114C9C', light: '#E2F3FE', dark: '#1E3850' },
        habits: { DEFAULT: '#1A7F2B', bright: '#4DC93A', lip: '#135B1F', light: '#E6F7E3', dark: '#233E2E' },
        focus: { DEFAULT: '#6F45E6', bright: '#A37BFF', lip: '#5032A6', light: '#F2EDFF', dark: '#333051' },
        workout: { DEFAULT: '#BF351E', bright: '#FF6A4D', lip: '#8A2616', light: '#FFEAE6', dark: '#432C31' },
        calories: { DEFAULT: '#C02670', bright: '#FF6FAE', lip: '#8A1B51', light: '#FFEBF4', dark: '#432D43' },

        // Reward hues (§5.1) — Gold/Flame/Ice only on reward elements.
        reward: {
          accent: '#FFC81F',
          streak: '#FF9A1F',
          frozen: '#5CCBFF',
          badge: '#FFC81F',
          day: '#4DC93A',
          quest: '#A37BFF',
        },

        // Sprout brand scale (§5.1/§5.2): 50 = tint, 400 = bright,
        // 500 = solid (button face / colored text), 700 = lip.
        brand: {
          50: '#E6F7E3',
          100: '#C9EFC2',
          200: '#A4E294',
          300: '#78D266',
          400: '#4DC93A',
          500: '#1A7F2B',
          600: '#17742A',
          700: '#135B1F',
          800: '#0F4719',
          900: '#0B3612',
        },

        // App background
        surface: '#FFFFFF',
      },
    },
  },
  plugins: [],
};
