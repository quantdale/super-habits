/**
 * WCAG 2.1 contrast validation for the proposed SuperHabits theme catalog.
 *
 * Companion artifact to docs/multi-theme-system-design.md. Run with:
 *   node scripts/validate-theme-contrast.mjs
 *
 * Exit code is non-zero when any check fails, so this can become a CI gate
 * once the theme registry lands (the palettes below are the proposal's
 * source of truth until then).
 *
 * Checks (all AA thresholds; AAA reported where achieved):
 *   - text          vs background / surface / surfaceElevated  >= 4.5
 *   - textMuted     vs surface / surfaceElevated               >= 4.5
 *   - buttonText    vs button / buttonHover / buttonActive     >= 4.5
 *   - accentText    vs surface                                 >= 4.5
 *   - primary       vs surface (non-text UI, WCAG 1.4.11)      >= 3.0
 */

function luminance(hex) {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Proposed theme catalog — see docs/multi-theme-system-design.md for rationale. */
export const PROPOSED_THEMES = {
  light: {
    appearance: "light",
    background: "#f8f7ff", surface: "#ffffff", surfaceElevated: "#f8f7ff",
    primary: "#7C3AED", secondary: "#ede9fe", accentText: "#6D28D9",
    button: "#7C3AED", buttonHover: "#6D28D9", buttonActive: "#5B21B6", buttonText: "#ffffff",
    text: "#0f172a", textMuted: "#5d6c83", border: "#e2e8f0",
  },
  dark: {
    appearance: "dark",
    background: "#0f1221", surface: "#171a2a", surfaceElevated: "#111427",
    primary: "#A78BFA", secondary: "#2b2350", accentText: "#C4B5FD",
    button: "#7C3AED", buttonHover: "#6D28D9", buttonActive: "#5B21B6", buttonText: "#ffffff",
    text: "#e2e8f0", textMuted: "#a6b0c2", border: "#334155",
  },
  "midnight-blue": {
    appearance: "dark",
    background: "#0a1526", surface: "#112036", surfaceElevated: "#0d1a2d",
    primary: "#3B82F6", secondary: "#1e3a5f", accentText: "#7DD3FC",
    button: "#2563EB", buttonHover: "#1D4ED8", buttonActive: "#1E40AF", buttonText: "#ffffff",
    text: "#e8f0fb", textMuted: "#9fb3d1", border: "#23395a",
  },
  "forest-green": {
    appearance: "dark",
    background: "#0c1712", surface: "#13211a", surfaceElevated: "#101d16",
    primary: "#4ADE80", secondary: "#1d3528", accentText: "#A3E635",
    button: "#34D399", buttonHover: "#5FE3AC", buttonActive: "#2BBE88", buttonText: "#052e1f",
    text: "#e4eee6", textMuted: "#9db4a4", border: "#24382c",
  },
  "ocean-teal": {
    appearance: "light",
    background: "#f2fafa", surface: "#ffffff", surfaceElevated: "#eaf5f5",
    primary: "#0D9488", secondary: "#ccfbf1", accentText: "#0E7490",
    button: "#0F766E", buttonHover: "#115E59", buttonActive: "#134E4A", buttonText: "#ffffff",
    text: "#0f3d3b", textMuted: "#42706b", border: "#cbe5e2",
  },
  "royal-purple": {
    appearance: "dark",
    background: "#160f2b", surface: "#211a3e", surfaceElevated: "#1b1435",
    primary: "#A78BFA", secondary: "#33265c", accentText: "#FBBF24",
    button: "#7C3AED", buttonHover: "#6D28D9", buttonActive: "#5B21B6", buttonText: "#ffffff",
    text: "#efeafb", textMuted: "#b4a8d6", border: "#382b63",
  },
  "crimson-red": {
    appearance: "dark",
    background: "#190c10", surface: "#241318", surfaceElevated: "#1f1014",
    primary: "#F87171", secondary: "#3d1d24", accentText: "#FBBF24",
    button: "#DC2626", buttonHover: "#B91C1C", buttonActive: "#991B1B", buttonText: "#ffffff",
    text: "#fbedee", textMuted: "#d3a6ac", border: "#47242b",
  },
  "sunset-orange": {
    appearance: "light",
    background: "#fff9f2", surface: "#ffffff", surfaceElevated: "#fff3e6",
    primary: "#EA580C", secondary: "#fed7aa", accentText: "#7E22CE",
    button: "#C2410C", buttonHover: "#9A3412", buttonActive: "#7C2D12", buttonText: "#ffffff",
    text: "#3b1d0f", textMuted: "#7c4a21", border: "#f3dfc9",
  },
  "rose-pink": {
    appearance: "light",
    background: "#fdf5f8", surface: "#ffffff", surfaceElevated: "#fbeaf1",
    primary: "#DB2777", secondary: "#fce7f3", accentText: "#9D174D",
    button: "#BE185D", buttonHover: "#9D174D", buttonActive: "#831843", buttonText: "#ffffff",
    text: "#3f1226", textMuted: "#8b5f70", border: "#f3d7e2",
  },
  "cyberpunk-neon": {
    appearance: "dark",
    background: "#07080f", surface: "#0e1020", surfaceElevated: "#0a0c18",
    primary: "#FF2ED1", secondary: "#1d1145", accentText: "#00E5FF",
    button: "#FF2ED1", buttonHover: "#FF5CDC", buttonActive: "#E51EB8", buttonText: "#14020f",
    text: "#eaf2ff", textMuted: "#8b93b8", border: "#262b4a",
  },
  "nord-arctic": {
    appearance: "dark",
    background: "#2e3440", surface: "#3b4252", surfaceElevated: "#343b49",
    primary: "#88C0D0", secondary: "#434c5e", accentText: "#A3BE8C",
    button: "#88C0D0", buttonHover: "#9BCDDC", buttonActive: "#79B2C4", buttonText: "#20262e",
    text: "#eceff4", textMuted: "#c2c9d6", border: "#4c566a",
  },
  solarized: {
    appearance: "light",
    background: "#fdf6e3", surface: "#fffcf2", surfaceElevated: "#eee8d5",
    primary: "#268BD2", secondary: "#eee8d5", accentText: "#5a60ba",
    button: "#1a6e9e", buttonHover: "#15597f", buttonActive: "#104963", buttonText: "#ffffff",
    text: "#073642", textMuted: "#51666d", border: "#ddd1ae",
  },
  "emerald-dark": {
    appearance: "dark",
    background: "#0a0f0d", surface: "#111917", surfaceElevated: "#0d1412",
    primary: "#10B981", secondary: "#173029", accentText: "#6EE7B7",
    button: "#10B981", buttonHover: "#34D399", buttonActive: "#0DA678", buttonText: "#04241a",
    text: "#e7f0ec", textMuted: "#96aba1", border: "#1f2e29",
  },
  "coffee-brown": {
    appearance: "light",
    background: "#faf6f0", surface: "#ffffff", surfaceElevated: "#f3ebe1",
    primary: "#8B5E3C", secondary: "#e9dbcc", accentText: "#0F766E",
    button: "#6F4E37", buttonHover: "#5A3F2C", buttonActive: "#46311F", buttonText: "#ffffff",
    text: "#33261c", textMuted: "#75634f", border: "#e7dacb",
  },
};

const AA = 4.5;
const AAA = 7;
const NON_TEXT = 3;

let failures = 0;
let checksRun = 0;

for (const [name, t] of Object.entries(PROPOSED_THEMES)) {
  const checks = [
    ["text on background", t.text, t.background, AA],
    ["text on surface", t.text, t.surface, AA],
    ["text on surfaceElevated", t.text, t.surfaceElevated, AA],
    ["textMuted on surface", t.textMuted, t.surface, AA],
    ["textMuted on surfaceElevated", t.textMuted, t.surfaceElevated, AA],
    ["buttonText on button", t.buttonText, t.button, AA],
    ["buttonText on buttonHover", t.buttonText, t.buttonHover, AA],
    ["buttonText on buttonActive", t.buttonText, t.buttonActive, AA],
    ["accentText on surface", t.accentText, t.surface, AA],
    ["primary on surface (non-text)", t.primary, t.surface, NON_TEXT],
  ];
  console.log(`\n== ${name} (${t.appearance}) ==`);
  for (const [label, fg, bg, min] of checks) {
    const r = contrast(fg, bg);
    checksRun += 1;
    const pass = r >= min;
    if (!pass) failures += 1;
    const grade = !pass ? "FAIL" : min === NON_TEXT ? "OK  " : r >= AAA ? "AAA " : "AA  ";
    console.log(`  ${grade} ${label.padEnd(30)} ${r.toFixed(2)}:1 (min ${min})`);
  }
}

console.log(
  failures === 0
    ? `\nAll ${checksRun} contrast checks pass.`
    : `\n${failures} of ${checksRun} contrast checks FAILED.`,
);
process.exit(failures === 0 ? 0 : 1);
