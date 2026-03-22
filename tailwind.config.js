/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("nativewind/preset")],
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./features/**/*.{js,jsx,ts,tsx}", "./core/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Per-section colors
        todos: { DEFAULT: "#3B82F6", light: "#EFF6FF", dark: "#2563EB" },
        habits: { DEFAULT: "#10B981", light: "#ECFDF5", dark: "#059669" },
        focus: { DEFAULT: "#8B5CF6", light: "#F5F3FF", dark: "#7C3AED" },
        workout: { DEFAULT: "#F97316", light: "#FFF7ED", dark: "#EA580C" },
        calories: { DEFAULT: "#F59E0B", light: "#FFFBEB", dark: "#D97706" },

        // Keep brand as alias for backward compat — maps to focus purple
        brand: {
          50: "#f8f7ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8B5CF6",
          600: "#7C3AED",
          700: "#6D28D9",
          800: "#5B21B6",
          900: "#4C1D95",
        },

        // App background
        surface: "#f8f7ff",
      },
    },
  },
  plugins: [],
};
