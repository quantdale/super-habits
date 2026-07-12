# SuperHabits Multi-Theme System — Design Proposal

Status: Proposal (no runtime changes in this document's commit)
Companion artifact: `scripts/validate-theme-contrast.mjs` — runnable WCAG validation of every palette proposed below (140 checks, all passing).

---

## 1. Summary

SuperHabits today ships a well-factored two-theme system: a `ThemeProvider` exposing 13 semantic tokens, resolved from a `system | light | dark` mode persisted in AsyncStorage. This proposal extends it to **14 themes** (the existing Light and Dark plus 12 new ones) without changing the app's architecture style: tokens stay the single source of truth, components keep consuming `useAppTheme().tokens`, and NativeWind classes remain reserved for layout, spacing, typography, and the theme-independent section accents.

The proposal covers:

- An expanded token schema (24 tokens) adding the roles the current schema lacks: primary, secondary, accent, button fills, and hover/active states.
- A theme registry architecture where adding a theme means adding **one file** and registering it in **one line** — no component edits.
- A full catalog of 12 new themes with WCAG-validated palettes, visual descriptions, and use-case recommendations.
- A "day slot / night slot" persistence model that keeps the existing System/Light/Dark UX intact while letting any theme fill either slot.
- A coverage map of every UI surface that must inherit theme colors, and a phased refactor plan for the ~18 files that still hardcode hex values.

---

## 2. Current State Analysis

### 2.1 What exists

| Layer | File | Role today |
|---|---|---|
| Token provider | `core/providers/ThemeProvider.tsx` | `ThemeTokens` (13 tokens), `LIGHT_TOKENS`/`DARK_TOKENS`, mode persistence (`superhabits.theme.mode`), OS-appearance listener, web `data-theme` attribute + `<meta name="theme-color">` |
| Section identity | `constants/sectionColors.ts` | Per-feature accents (Todos blue, Habits green, Focus purple, Workout orange, Calories amber) with light-tint and 700-level text variants |
| Utility classes | `tailwind.config.js` | Static section colors, `brand` purple scale, `surface` — **not** theme-aware |
| Web baseline | `global.css` | Hardcoded body backgrounds for light and `html[data-theme="dark"]` |
| Consumers | `core/ui/*`, `features/*`, `app/(tabs)/_layout.tsx` | Inline `style={{ color: tokens.text }}` pattern; Tailwind classes for structure |

### 2.2 What works well (and should be preserved)

1. **Tokens-as-inline-style is already the dominant pattern.** `Screen`, `Card`, `Modal`, `TextField`, `PillChip`, `PageHeader`, `Button` (partially) and both layouts read from `tokens`. Multi-theming is mostly a matter of widening the token set, not re-plumbing components.
2. **Section accents are deliberately theme-independent.** The five feature colors are product identity (documented color psychology in `sectionColors.ts`). They should survive theme switches — with a per-theme override hook for extreme palettes (see §7).
3. **Mode persistence and system-follow already exist** and map cleanly onto the extended model.

### 2.3 Gaps blocking multi-theme

1. **Missing token roles.** No `primary`, `secondary`, `accent`, button fill/label, or hover/active tokens. `Button` hardcodes `bg-brand-500` (violet) and `#ef4444` danger; every themed button would today stay purple.
2. **Hardcoded hex values in ~18 files.** A repo scan finds ~130 hex literals in `features/` + `core/` + `app/`. The most load-bearing:
   - `core/ui/Card.tsx` — `border-slate-200` utility class fallback.
   - `core/ui/Button.tsx` — `bg-brand-500`, danger `#ef4444`.
   - `core/ui/Modal.tsx` — scrim `rgba(0,0,0,0.5)` (too light for dark themes).
   - `core/ui/InAppNoticeBanner.tsx` — `NOTICE_ACCENT = "#2563eb"`.
   - `features/settings/SettingsScreen.tsx`, `features/command/CommandScreen.tsx`, `features/overview/OverviewScreen.tsx` — `#475569` neutral accent plus dark-mode ternaries.
   - `features/shared/GitHubHeatmap.tsx` — empty-cell `#e2e8f0`, labels `#94a3b8`, legend chip `#f1f5f9` (already visibly wrong in Dark mode).
   - Chart components (`DailyCalorieChart`, `MacroDonutChart`, `ProgressRing`) — axis/label/track colors.
3. **`resolvedTheme === "dark"` ternaries** in `app/(tabs)/_layout.tsx` and `SettingsScreen.tsx` re-derive colors that should be tokens (e.g., the overview tab color, settings accent). Every new theme would multiply these branches.
4. **Web baseline can't scale.** `global.css` enumerates one selector per theme; with 14 themes this must become CSS custom properties set by the provider.
5. **A latent accessibility bug in the current Light theme:** `textMuted` (`#64748b`) on `surfaceElevated` (`#f8f7ff`) measures **4.47:1**, just under WCAG AA (4.5:1). The proposed Light palette nudges it to `#5d6c83` (5.01:1) — visually near-identical.

---

## 3. Design Goals

1. **One source of truth.** All theme-dependent color decisions live in theme definition files. Components never branch on theme identity or appearance.
2. **Open/closed registry.** Adding theme #15 touches `core/theme/themes/` and one registry line — zero component, screen, or CSS edits.
3. **WCAG AA floor, AAA where free.** Every text-bearing pair ≥ 4.5:1 (including button hover/active states); non-text UI indicators ≥ 3:1 (WCAG 1.4.11). Enforced by a CI script, not by review vigilance.
4. **Preserve product identity.** Section accents, layout, radii, elevation, and typography are theme-invariant. Themes recolor the *chrome*, not the *brand*.
5. **No UX regression.** The System/Light/Dark mode chips keep working exactly as today; theme selection layers on top.

---

## 4. Token Schema v2

`ThemeTokens` grows from 13 to 24 tokens. Existing names are kept verbatim so Phase 0 (see §11) is a pure widening — no consumer changes needed to compile.

```ts
// core/theme/tokens.ts
export type ThemeAppearance = "light" | "dark";

export type ThemeTokens = {
  // ── Brand & interaction ─────────────────────────────────────────────
  primary: string;         // NEW: the theme's identity color (icons, rings, links-as-chrome)
  secondary: string;       // NEW: quiet companion fill (selected chips, secondary pills)
  accent: string;          // NEW: text-grade highlight (links, emphasis, notice accents), AA on surface
  button: string;          // NEW: primary button fill
  buttonText: string;      // NEW: label on button/buttonHover/buttonActive (AA on all three)
  buttonHover: string;     // NEW: pointer-hover fill (web) / focus fill
  buttonActive: string;    // NEW: pressed fill (Pressable pressed state, web :active)

  // ── Surfaces ────────────────────────────────────────────────────────
  background: string;      // kept: screen background
  surface: string;         // kept: cards, sheets, inputs
  surfaceElevated: string; // kept: inset rows, nested panels
  surfaceHover: string;    // NEW: hoverable rows/list items (derived, see below)
  surfaceActive: string;   // NEW: pressed rows/list items (derived)
  overlay: string;         // NEW: modal scrim (rgba; heavier on dark themes)

  // ── Structure ───────────────────────────────────────────────────────
  border: string;          // kept
  tabRail: string;         // kept
  tabRailBorder: string;   // kept

  // ── Content ─────────────────────────────────────────────────────────
  text: string;            // kept
  textMuted: string;       // kept
  iconMuted: string;       // kept

  // ── Semantic status ─────────────────────────────────────────────────
  dangerBackground: string; // kept
  dangerBorder: string;     // kept
  dangerText: string;       // kept
  successText: string;      // NEW: replaces scattered #22c55e / #16a34a
  warningText: string;      // NEW: replaces scattered #92400e / amber literals

  // ── Platform ────────────────────────────────────────────────────────
  statusBarStyle: "light" | "dark"; // kept
  webThemeColor: string;            // kept: PWA <meta name="theme-color">
};

export type ThemeDefinition = {
  id: string;                 // stable kebab-case key, persisted
  name: string;               // display name
  appearance: ThemeAppearance;
  description: string;        // one-liner shown in the picker
  tokens: ThemeTokens;
  /** Optional remap when the default section accents clash or fail contrast. */
  sectionOverrides?: Partial<Record<SectionKey, { fill: string; text: string }>>;
};
```

**Mapping to the required roles:** Primary → `primary`; Secondary → `secondary`; Background → `background`; Surface/card → `surface` (+ `surfaceElevated`); Text → `text`/`textMuted`; Accent → `accent`; Button → `button`/`buttonText`; Border → `border`; Hover/active → `buttonHover`, `buttonActive`, `surfaceHover`, `surfaceActive`.

**Derivation rules** (implemented in a `createTheme()` factory so theme authors may omit them):

- `surfaceHover` = surface blended 6% toward `text`; `surfaceActive` = 10% toward `text`. Non-text fills, so no AA requirement — only perceptibility.
- `overlay` = `rgba(0,0,0,0.50)` for light themes, `rgba(0,0,0,0.65)` for dark themes (a heavier scrim is needed to separate a dark dialog from a dark page).
- `iconMuted` defaults to `textMuted`; `webThemeColor` defaults to `background` (dark) or `primary` (light); `statusBarStyle` derived from `appearance`.
- Semantic status colors default per appearance (the current Light/Dark danger sets) and are overridable — Crimson Red overrides them (see §6.6).

---

## 5. Architecture

### 5.1 Module layout

```
core/theme/
  tokens.ts            # ThemeTokens, ThemeDefinition, ThemeAppearance types
  createTheme.ts       # factory: fills derived tokens, dev-mode contrast assertions
  registry.ts          # THEME_REGISTRY: Record<ThemeId, ThemeDefinition>; ordered id lists
  themes/
    light.ts           # existing Light, migrated verbatim (+ new roles)
    dark.ts            # existing Dark, migrated verbatim (+ new roles)
    midnight-blue.ts
    forest-green.ts
    ocean-teal.ts
    royal-purple.ts
    crimson-red.ts
    sunset-orange.ts
    rose-pink.ts
    cyberpunk-neon.ts
    nord-arctic.ts
    solarized.ts
    emerald-dark.ts
    coffee-brown.ts
  index.ts             # public re-exports
```

`core/providers/ThemeProvider.tsx` keeps its name and export (`useAppTheme`) but delegates all color knowledge to the registry. This respects the repo's layering rules: `core/theme` has no React imports except in the provider; theme files are pure data.

```ts
// core/theme/registry.ts
import { light } from "./themes/light";
import { dark } from "./themes/dark";
import { midnightBlue } from "./themes/midnight-blue";
// ... one import per theme

export const THEME_REGISTRY = {
  [light.id]: light,
  [dark.id]: dark,
  [midnightBlue.id]: midnightBlue,
  // ...
} as const satisfies Record<string, ThemeDefinition>;

export type ThemeId = keyof typeof THEME_REGISTRY;
export const LIGHT_THEME_IDS = /* ids where appearance === "light" */;
export const DARK_THEME_IDS  = /* ids where appearance === "dark" */;
export const DEFAULT_LIGHT_THEME_ID: ThemeId = "light";
export const DEFAULT_DARK_THEME_ID: ThemeId = "dark";
```

Adding a future theme = one new file in `themes/` + one import/registration line. `ThemeId` is derived from the registry, so the selector UI, persistence validation, and typechecking all pick the new theme up automatically.

### 5.2 Provider model — "day slot / night slot"

The existing `ThemeMode = "system" | "light" | "dark"` keeps its exact meaning: *which appearance is active*. Theme selection adds two slots:

```ts
type ThemeContextValue = {
  mode: ThemeMode;                    // unchanged
  resolvedTheme: ResolvedTheme;       // unchanged ("light" | "dark" appearance)
  themeId: ThemeId;                   // NEW: the active theme's id
  theme: ThemeDefinition;             // NEW: full definition (for the picker)
  tokens: ThemeTokens;                // unchanged shape, widened
  setMode: (mode: ThemeMode) => void; // unchanged
  setTheme: (id: ThemeId) => void;    // NEW
};
```

Resolution: `mode` (+ OS appearance when `system`) picks the appearance; the appearance picks the slot; the slot holds a theme id.

- `lightThemeId` — used whenever the resolved appearance is light (default `"light"`).
- `darkThemeId` — used whenever the resolved appearance is dark (default `"dark"`).
- `setTheme(id)` writes the slot matching the theme's appearance, and — when the current mode is a fixed one — flips `mode` to that appearance so the chosen theme becomes visible immediately. In `system` mode it just fills the slot ("your dark theme is now Nord Arctic").

This model gives "hybrid" usage for free: Solarized by day, Nord Arctic by night, switching automatically with the OS — while a user who wants "always Cyberpunk" simply gets `mode: "dark"` + `darkThemeId: "cyberpunk-neon"`.

### 5.3 Web integration — CSS custom properties

`global.css` currently hardcodes two body backgrounds. With 14 themes this becomes:

```css
body, #root {
  background-color: var(--sh-background, #f8f7ff);
}
```

The provider's existing `document` effect grows by one loop:

```ts
document.documentElement.setAttribute("data-theme", theme.appearance); // kept for e2e + CSS hooks
document.documentElement.setAttribute("data-theme-id", theme.id);
for (const [key, value] of Object.entries(tokens)) {
  document.documentElement.style.setProperty(`--sh-${kebabCase(key)}`, String(value));
}
```

This also future-proofs web-only styling (scrollbar colors, selection color, PWA splash) without per-theme CSS. The `<meta name="theme-color">` behavior is unchanged — each theme supplies `webThemeColor`.

### 5.4 NativeWind stance

**Recommendation: do not make Tailwind theme-aware.** The app already has exactly one theming mechanism (tokens via inline style); introducing a parallel one (CSS-variable-backed Tailwind colors) would create two sources of truth and NativeWind class-caching pitfalls on native. Instead:

- Tailwind keeps: layout, spacing, typography, radii, and the static **section** colors (`bg-todos`, `text-habits-dark`, …).
- Theme-ish utilities are removed from shared primitives: `bg-brand-500` in `Button`, `border-slate-200` in `Card` (both already have inline-style siblings — the class is a fallback that fights the token).
- A guard script (§12) prevents new raw-hex or slate-class drift in `core/ui`.

### 5.5 `createTheme()` factory + dev assertions

```ts
export function createTheme(input: ThemeInput): ThemeDefinition {
  const tokens = withDerivedTokens(input);      // fills §4 derivation rules
  if (__DEV__) assertContrast(input.id, tokens); // same math as the CI script
  return { ...input, tokens };
}
```

`assertContrast` throws in development if any AA pair fails, so a mis-authored theme is caught at boot, not in review.

---

## 6. Theme Catalog

### 6.0 Validation methodology

Every palette below was validated with `scripts/validate-theme-contrast.mjs` (WCAG 2.1 relative-luminance math). Per theme, 10 checks:

| Pair | Threshold |
|---|---|
| `text` on `background` / `surface` / `surfaceElevated` | ≥ 4.5:1 (AA) |
| `textMuted` on `surface` / `surfaceElevated` | ≥ 4.5:1 (AA) |
| `buttonText` on `button` / `buttonHover` / `buttonActive` | ≥ 4.5:1 (AA) |
| `accent` (as text) on `surface` | ≥ 4.5:1 (AA) |
| `primary` on `surface` (non-text UI) | ≥ 3.0:1 (WCAG 1.4.11) |

**Result: 140/140 checks pass.** Body text achieves AAA (≥ 7:1) in all 14 themes. Notable design choice: dark themes with very saturated primaries (Forest, Emerald, Nord, Cyberpunk) use **dark labels on bright button fills** rather than white-on-mid-tone — this is what lets their pressed/hover states stay AA instead of dipping below 4.5:1 the way white-on-`#3B82F6` (3.68:1) does.

Summary — each theme's *weakest* text-bearing pair (AA requires ≥ 4.5; everything else in the theme scores higher, with body text at AAA in all 14):

| Theme | Appearance | Weakest text pair | Ratio |
|---|---|---|---|
| Light | light | textMuted / surfaceElevated | 5.01 |
| Dark | dark | buttonText / button | 5.70 |
| Midnight Blue | dark | buttonText / button | 5.17 |
| Forest Green | dark | buttonText / buttonActive | 6.23 |
| Ocean Teal | light | textMuted / surfaceElevated | 5.02 |
| Royal Purple | dark | buttonText / button | 5.70 |
| Crimson Red | dark | buttonText / button | 4.83 |
| Sunset Orange | light | buttonText / button | 5.18 |
| Rose Pink | light | textMuted / surfaceElevated | 4.57 |
| Cyberpunk Neon | dark | buttonText / buttonActive | 4.98 |
| Nord Arctic | dark | accent / surface | 4.94 |
| Solarized | light | textMuted / surfaceElevated | 4.94 |
| Emerald Dark | dark | buttonText / buttonActive | 5.30 |
| Coffee Brown | light | textMuted / surfaceElevated | 4.87 |

*(Full per-pair output: run the script.)*

Hover/active semantics everywhere: **surface** hover/active are derived (§4); **button** hover/active are explicit and listed per theme; on native, `buttonActive`/`surfaceActive` map to `Pressable`'s pressed state, hover applies on web and pointer-equipped tablets.

---

### 6.1 Light *(existing — refined)*

Kept as the default. Two refinements: `textMuted` `#64748b → #5d6c83` (fixes the 4.47:1 AA miss on elevated surfaces) and the default button fill documented as `#7C3AED` (brand-600) instead of `bg-brand-500` `#8B5CF6`, whose white label sits at 4.23:1 — marginally under AA today.

| Role | Value | | Role | Value |
|---|---|---|---|---|
| Primary | `#7C3AED` | | Text / Muted | `#0f172a` / `#5d6c83` |
| Secondary | `#ede9fe` | | Accent | `#6D28D9` |
| Background | `#f8f7ff` | | Button / label | `#7C3AED` / `#ffffff` |
| Surface / Elevated | `#ffffff` / `#f8f7ff` | | Button hover / active | `#6D28D9` / `#5B21B6` |
| Border | `#e2e8f0` | | Tab rail / border | `#eeecf8` / `#d4d0ee` |

**Feel:** the current airy lavender-white workspace. **Best for:** general use, default. **Class:** Light.

### 6.2 Dark *(existing — extended)*

Kept verbatim; gains the new roles.

| Role | Value | | Role | Value |
|---|---|---|---|---|
| Primary | `#A78BFA` | | Text / Muted | `#e2e8f0` / `#a6b0c2` |
| Secondary | `#2b2350` | | Accent | `#C4B5FD` |
| Background | `#0f1221` | | Button / label | `#7C3AED` / `#ffffff` |
| Surface / Elevated | `#171a2a` / `#111427` | | Button hover / active | `#6D28D9` / `#5B21B6` |
| Border | `#334155` | | Tab rail / border | `#1a1f34` / `#2e3552` |

**Feel:** the current cool indigo night mode. **Best for:** general use, low light. **Class:** Dark.

### 6.3 Midnight Blue

| Role | Value | | Role | Value |
|---|---|---|---|---|
| Primary | `#3B82F6` | | Text / Muted | `#e8f0fb` / `#9fb3d1` |
| Secondary | `#1e3a5f` | | Accent | `#7DD3FC` |
| Background | `#0a1526` | | Button / label | `#2563EB` / `#ffffff` |
| Surface / Elevated | `#112036` / `#0d1a2d` | | Button hover / active | `#1D4ED8` / `#1E40AF` |
| Border | `#23395a` | | Tab rail / border | `#0d1b2f` / `#1e3350` |

**Feel:** a deep navy cockpit — calm, cold, and serious, like an IDE at 1 a.m. Blue-tinted grays keep hierarchy readable without warmth. Sky-blue accents read as instrumentation rather than decoration.
**Best for:** productivity and coding; the most conservative dark upgrade for office use. **Class:** Dark.

### 6.4 Forest Green

| Role | Value | | Role | Value |
|---|---|---|---|---|
| Primary | `#4ADE80` | | Text / Muted | `#e4eee6` / `#9db4a4` |
| Secondary | `#1d3528` | | Accent | `#A3E635` |
| Background | `#0c1712` | | Button / label | `#34D399` / `#052e1f` |
| Surface / Elevated | `#13211a` / `#101d16` | | Button hover / active | `#5FE3AC` / `#2BBE88` |
| Border | `#24382c` | | Tab rail / border | `#101c15` / `#20342a` |

**Feel:** a pine forest after dusk — moss-dark surfaces with bright leaf-green interactions. Because Habits already owns green, this theme feels "native" to the app's core loop; lime accents give completed streaks extra pop.
**Best for:** habit-focused daily use and evening journaling; users who find blue-dark themes sterile. **Class:** Dark.

### 6.5 Ocean Teal

| Role | Value | | Role | Value |
|---|---|---|---|---|
| Primary | `#0D9488` | | Text / Muted | `#0f3d3b` / `#42706b` |
| Secondary | `#ccfbf1` | | Accent | `#0E7490` |
| Background | `#f2fafa` | | Button / label | `#0F766E` / `#ffffff` |
| Surface / Elevated | `#ffffff` / `#eaf5f5` | | Button hover / active | `#115E59` / `#134E4A` |
| Border | `#cbe5e2` | | Tab rail / border | `#e4f2f1` / `#c4dedb` |

**Feel:** a bright coastal morning — white cards floating on sea-glass. Teal is the classic "calm competence" hue; the deep-cyan accent keeps links distinct from the primary.
**Best for:** general use and design work in daylight; a fresh alternative to the lavender default. **Class:** Light.

### 6.6 Royal Purple

| Role | Value | | Role | Value |
|---|---|---|---|---|
| Primary | `#A78BFA` | | Text / Muted | `#efeafb` / `#b4a8d6` |
| Secondary | `#33265c` | | Accent | `#FBBF24` |
| Background | `#160f2b` | | Button / label | `#7C3AED` / `#ffffff` |
| Surface / Elevated | `#211a3e` / `#1b1435` | | Button hover / active | `#6D28D9` / `#5B21B6` |
| Border | `#382b63` | | Tab rail / border | `#191133` / `#302355` |

**Feel:** velvet and gold — a saturated violet night with warm amber accents that read as gilt edges. It's the app's own brand purple turned up to "evening gown."
**Best for:** general use for users who love the brand color; gaming/leisure sessions. **Class:** Dark.

### 6.7 Crimson Red

| Role | Value | | Role | Value |
|---|---|---|---|---|
| Primary | `#F87171` | | Text / Muted | `#fbedee` / `#d3a6ac` |
| Secondary | `#3d1d24` | | Accent | `#FBBF24` |
| Background | `#190c10` | | Button / label | `#DC2626` / `#ffffff` |
| Surface / Elevated | `#241318` / `#1f1014` | | Button hover / active | `#B91C1C` / `#991B1B` |
| Border | `#47242b` | | Tab rail / border | `#1d0e12` / `#3a1d24` |

**Feel:** a dark theater — near-black cherry surfaces with crimson drive and gold trim. High-energy without glare.
**Best for:** gaming and workout-heavy users (it flatters the Workout orange); short intense sessions rather than all-day reading. **Class:** Dark.
**Design note:** because the primary is red, destructive actions must not rely on hue alone here. This theme overrides the danger set toward a distinct rose (`dangerText #FDA4AF` on `#451a1e` fills) **and** the refactor keeps danger buttons paired with confirmation copy/icons app-wide (§8), so "delete" stays distinguishable in every theme.

### 6.8 Sunset Orange

| Role | Value | | Role | Value |
|---|---|---|---|---|
| Primary | `#EA580C` | | Text / Muted | `#3b1d0f` / `#7c4a21` |
| Secondary | `#fed7aa` | | Accent | `#7E22CE` |
| Background | `#fff9f2` | | Button / label | `#C2410C` / `#ffffff` |
| Surface / Elevated | `#ffffff` / `#fff3e6` | | Button hover / active | `#9A3412` / `#7C2D12` |
| Border | `#f3dfc9` | | Tab rail / border | `#fdf0e2` / `#eed7bc` |

**Feel:** golden hour — cream pages, ember-orange actions, and a dusk-violet accent that completes the sunset gradient. Warm without being yellow-tinted enough to distort content colors.
**Best for:** general use; motivational/energetic daily planning; pairs naturally with the Calories and Workout sections. **Class:** Light.

### 6.9 Rose Pink

| Role | Value | | Role | Value |
|---|---|---|---|---|
| Primary | `#DB2777` | | Text / Muted | `#3f1226` / `#8b5f70` |
| Secondary | `#fce7f3` | | Accent | `#9D174D` |
| Background | `#fdf5f8` | | Button / label | `#BE185D` / `#ffffff` |
| Surface / Elevated | `#ffffff` / `#fbeaf1` | | Button hover / active | `#9D174D` / `#831843` |
| Border | `#f3d7e2` | | Tab rail / border | `#faeaf1` / `#eed0dd` |

**Feel:** soft blush stationery — quiet pink washes with confident magenta actions. Deliberately desaturated backgrounds keep it elegant rather than saccharine.
**Best for:** general use and journaling; users who want gentle, personal-feeling tools. **Class:** Light.

### 6.10 Cyberpunk Neon

| Role | Value | | Role | Value |
|---|---|---|---|---|
| Primary | `#FF2ED1` | | Text / Muted | `#eaf2ff` / `#8b93b8` |
| Secondary | `#1d1145` | | Accent | `#00E5FF` |
| Background | `#07080f` | | Button / label | `#FF2ED1` / `#14020f` |
| Surface / Elevated | `#0e1020` / `#0a0c18` | | Button hover / active | `#FF5CDC` / `#E51EB8` |
| Border | `#262b4a` | | Tab rail / border | `#0a0c16` / `#202440` |

**Feel:** neon signage on wet asphalt — near-black indigo with magenta and cyan reserved for interactive elements only. The discipline is the design: large fields stay dark, neon stays scarce, so it reads "arcade" without eye strain.
**Best for:** gaming and late-night focus sprints; OLED devices (true-black adjacency saves battery). **Class:** Dark.
**Design note:** this theme uses `sectionOverrides` (§7) to swap the five section accents to neon-grade variants so tab icons don't look muddy against near-black.

### 6.11 Nord Arctic

| Role | Value | | Role | Value |
|---|---|---|---|---|
| Primary | `#88C0D0` | | Text / Muted | `#eceff4` / `#c2c9d6` |
| Secondary | `#434c5e` | | Accent | `#A3BE8C` |
| Background | `#2e3440` | | Button / label | `#88C0D0` / `#20262e` |
| Surface / Elevated | `#3b4252` / `#343b49` | | Button hover / active | `#9BCDDC` / `#79B2C4` |
| Border | `#4c566a` | | Tab rail / border | `#333947` / `#454f63` |

**Feel:** the beloved developer palette — polar-night grays that are *soft* rather than black, frost-blue interactions, aurora-green accents. Noticeably lower overall contrast tension than the other dark themes; the calmest long-session option.
**Best for:** coding and all-day productivity; users coming from Nord editors/terminals will feel at home instantly. **Class:** Dark.

### 6.12 Solarized

| Role | Value | | Role | Value |
|---|---|---|---|---|
| Primary | `#268BD2` | | Text / Muted | `#073642` / `#51666d` |
| Secondary | `#eee8d5` | | Accent | `#5a60ba` |
| Background | `#fdf6e3` | | Button / label | `#1a6e9e` / `#ffffff` |
| Surface / Elevated | `#fffcf2` / `#eee8d5` | | Button hover / active | `#15597f` / `#104963` |
| Border | `#ddd1ae` | | Tab rail / border | `#f6eed7` / `#dccfa8` |

**Feel:** aged paper under warm lamplight — Ethan Schoonover's famously low-glare base tones with the canonical solar blue. Two faithfulness compromises for accessibility: button fills darken `#268BD2` to `#1a6e9e` (white labels on canonical blue are 3.7:1), and the violet accent deepens `#6c71c4` to `#5a60ba` (4.27 → 5.36:1).
**Best for:** coding and reading-heavy productivity in bright environments. **Class:** Hybrid — this spec is the light half; its natural night partner is Nord Arctic (or a future Solarized Dark theme file), and the day/night slot model (§5.2) makes that pairing one tap.

### 6.13 Emerald Dark

| Role | Value | | Role | Value |
|---|---|---|---|---|
| Primary | `#10B981` | | Text / Muted | `#e7f0ec` / `#96aba1` |
| Secondary | `#173029` | | Accent | `#6EE7B7` |
| Background | `#0a0f0d` | | Button / label | `#10B981` / `#04241a` |
| Surface / Elevated | `#111917` / `#0d1412` | | Button hover / active | `#34D399` / `#0DA678` |
| Border | `#1f2e29` | | Tab rail / border | `#0d1310` / `#1c2a24` |

**Feel:** jewel-case minimalism — a neutral near-black canvas (distinctly *not* green-washed, unlike Forest Green) where vivid emerald is the only voice. Terminal-heritage green-on-black, refined.
**Best for:** coding and focused deep work; OLED-friendly. **Class:** Dark.

### 6.14 Coffee Brown

| Role | Value | | Role | Value |
|---|---|---|---|---|
| Primary | `#8B5E3C` | | Text / Muted | `#33261c` / `#75634f` |
| Secondary | `#e9dbcc` | | Accent | `#0F766E` |
| Background | `#faf6f0` | | Button / label | `#6F4E37` / `#ffffff` |
| Surface / Elevated | `#ffffff` / `#f3ebe1` | | Button hover / active | `#5A3F2C` / `#46311F` |
| Border | `#e7dacb` | | Tab rail / border | `#f4ede3` / `#e2d3c0` |

**Feel:** a café notebook — latte cream, espresso text, and a glazed-ceramic teal accent that keeps it from going monochrome-sepia. The warmest, most analog-feeling theme in the set.
**Best for:** journaling, reading, general use; people who plan their day over coffee. **Class:** Light.

---

## 7. Section Accents Under Themes

The five section colors are product identity and stay theme-independent **by default** — a Todos card is blue in Nord and blue in Rose Pink. Two mechanisms keep them accessible everywhere:

1. **Appearance-keyed variants (systematize what exists).** `app/(tabs)/_layout.tsx` already flips between `SECTION_TEXT_COLORS` (700-level, for light surfaces) and `SECTION_COLORS` (500-level, for dark surfaces). This branch moves into the theme system: `constants/sectionColors.ts` gains `getSectionAccents(appearance)` returning `{ fill, text, tint }` per section, where `tint` on dark appearances becomes `${fill}1F` (12% alpha) instead of the hardcoded `*-50` pastels (which are illegible as chip backgrounds on dark surfaces).
2. **Per-theme `sectionOverrides`** (§4) for the rare theme where defaults clash. Proposed usage: only Cyberpunk Neon (neon-grade section set) and Crimson Red (Workout's orange shifts to `#FB923C` so it doesn't melt into the crimson chrome). All other themes use defaults — overrides are an escape hatch, not a requirement, so theme authoring stays one-file cheap.

---

## 8. UI Coverage Map

Which surfaces inherit theme tokens, and which token drives each. Items marked ⚠ are the gaps the refactor closes (§11).

| Area | Component(s) | Tokens |
|---|---|---|
| Screen background | `Screen`, `TabSlot` | `background` |
| Top tab rail | `app/(tabs)/_layout.tsx` | `tabRail`, `tabRailBorder`, active tab face `background`, inactive icon `iconMuted`; ⚠ Overview tab color `#475569`/ternary → `textMuted` |
| Cards | `Card` (all 3 variants), `FeatureStatCard`, `EmptyStateCard`, `StatBlock` | `surface`, `surfaceElevated`, `border`, `text`, `textMuted`; ⚠ drop `border-slate-200` class |
| Page headers | `PageHeader`, `SectionTitle` | `text`, `textMuted` |
| Buttons | `Button` | ⚠ primary → `button`/`buttonText` + `buttonHover`/`buttonActive` (replaces `bg-brand-500`); danger → `dangerText`-family fills (replaces `#ef4444`); ghost → `surfaceElevated`/`border`/`text` (already tokenized) |
| Chips & filters | `PillChip` | inactive `surfaceElevated`/`border`/`textMuted` (done); active keeps section color by design; non-section chips (Settings mode chips) → `button`/`buttonText` |
| Inputs | `TextField`, `NumberStepperField` | `surface`, `border`, `text`, `textMuted` placeholder; focus ring → `primary` (new affordance, web) |
| Modals & dialogs | `Modal`, `useConfirmationDialog`, `LinkedActionTargetPickerModal`, `CalorieGoalModal`, `SavedMealSearchModal` | `background`, `border`, `text`; ⚠ scrim `rgba(0,0,0,0.5)` → `overlay` |
| Menus / pickers | target pickers, saved-meal search results | `surface`, `surfaceHover` (new hover), `surfaceActive` (pressed), `border` |
| Notifications | `InAppNoticeBanner` | `surface`, `text`, `textMuted`, `iconMuted`; ⚠ `NOTICE_ACCENT #2563eb` → `accent` (+ `${accent}16` icon well) |
| Tables / lists | `TodoItem`, workout tables, `SwipeableCard`, `SwipeRightActions` | `surface`, `border`, `text`, `textMuted`; swipe action fills stay semantic (danger = `dangerText` family, complete = `successText` family) ⚠ |
| Status/error text | `ValidationError`, inline `#b91c1c`/`#92400e` literals | ⚠ → `dangerText`, `warningText`, `successText` |
| Charts | `DailyCalorieChart`, `MacroDonutChart`, `ProgressRing`, `HabitCircle` | axis/labels → `textMuted`; grid/track → `border`; series stay section-colored ⚠ |
| Heatmap | `GitHubHeatmap` | ⚠ empty cell `#e2e8f0` → `border`; labels `#94a3b8` → `iconMuted`; legend chip `#f1f5f9` → `surfaceElevated`; intensity ramp stays section green |
| Neutral screens | Settings, Command, Overview accents (`#475569`) | ⚠ → `textMuted` (as the "neutral accent"), removing the dark-mode ternaries |
| Status bar / PWA | `StatusBar`, `<meta theme-color>`, `global.css` | `statusBarStyle`, `webThemeColor`, `--sh-background` (§5.3) |

Deliberately **not** themed: section identity colors (fills/series), the habit "garden" illustration greens (`FocusSprout`, `GardenGrid` — botanical, not chrome), and semantic red/green meaning (recolorable per theme, but never repurposed).

---

## 9. Theme Selector UI

The Settings ▸ Appearance card grows from three mode chips into a two-level picker. No new screen; it stays one card.

```
┌─ Appearance ────────────────────────────────────────────┐
│ Mode      [ System ]  [ Light ]  [ Dark ]               │
│                                                         │
│ Day theme (used when light)                             │
│ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐  →             │
│ │▓ ● ──│ │▓ ● ──│ │▓ ● ──│ │▓ ● ──│  (h-scroll)      │
│ │Light ✓│ │Ocean  │ │Sunset │ │Rose   │                 │
│ └───────┘ └───────┘ └───────┘ └───────┘                 │
│                                                         │
│ Night theme (used when dark)                            │
│ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐  →             │
│ │▓ ● ──│ │▓ ● ──│ │▓ ● ──│ │▓ ● ──│                  │
│ │Dark ✓ │ │Midnight│ │Nord  │ │Cyber  │                 │
│ └───────┘ └───────┘ └───────┘ └───────┘                 │
│                                                         │
│ ┌ Preview strip ────────────────────────────────────┐   │
│ │ Card title      [Primary button]  [chip] [chip]   │   │
│ │ Muted description text · link accent              │   │
│ └───────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

- **`ThemePreviewCard`** (new `core/ui` primitive): a ~72×56 swatch rendered *from the theme's own tokens* — background field, floating `surface` chip, `primary` dot, two `text`/`textMuted` strokes — plus name and a `Light`/`Dark` badge. Selected card shows a `primary`-colored ring + check. Cards are `accessibilityRole="radio"` within a labeled radio group, and the name text is real text (screen-reader friendly), never baked into an image.
- **Interaction:** tapping a card calls `setTheme(id)` — instant, whole-app live preview (the provider re-renders; no confirmation step, no restart). The mode chips keep their exact current behavior. When mode is `light`, the night row stays visible but dimmed with the caption "shown when Dark mode is active" (and vice versa), teaching the slot model passively.
- **Ordering:** Light/Dark defaults first, then by catalog order. With 12+ themes per row, horizontal scroll (`HorizontalScrollArea` already exists) beats a grid on phones.
- The existing "Current selection" info row and `FeatureStatCard` ("Theme mode") extend to show the active theme name, e.g. *"Nord Arctic · Dark · following system."*

---

## 10. Persistence & Migration

**Storage** (AsyncStorage, alongside the existing key):

| Key | Value | Notes |
|---|---|---|
| `superhabits.theme.mode` | `"system" \| "light" \| "dark"` | **unchanged** — v1 key keeps working as-is |
| `superhabits.theme.slots.v2` | `{"lightThemeId":"solarized","darkThemeId":"nord-arctic"}` | new; JSON; written on every `setTheme` |

**Why not one combined JSON blob:** reusing the v1 mode key means zero migration for the mode itself, old builds remain forward-compatible (they simply ignore the slots key), and a corrupted slots value degrades to the current behavior — exactly the failure mode the app has today.

**Read path (provider bootstrap):** parse slots → validate both ids against `THEME_REGISTRY` (unknown/removed id → that slot's default, then persist the correction) → resolve as in §5.2. Writes are fire-and-forget with `.catch(() => undefined)`, matching the existing pattern. The one-frame default-theme flash on cold start is the same behavior light/dark users see today; no gating needed.

**Future sync note:** slots are deliberately device-local (like the current mode), matching the command-rollout toggle's "device-local and disposable" precedent. If theme sync is ever wanted, the slots object is one JSON row in the existing backup path.

---

## 11. Refactoring Plan

Phased so every phase ships green (`typecheck`, `vitest`, `build:web`, Playwright) and is independently revertable.

**Phase 0 — Foundation (no visual change).**
Create `core/theme/` (types, factory, registry) and move `LIGHT_TOKENS`/`DARK_TOKENS` into `themes/light.ts` / `themes/dark.ts`, widened with the new roles at their current effective values (button = brand purple, accent = brand text purple, notice accent stays blue via `accent` only after Phase 1). Rewire `ThemeProvider` to the registry + slot resolution + CSS custom properties. `useAppTheme()` keeps its shape (superset), so **zero consumer edits compile-break**. Add `validate-theme-contrast` to CI.

**Phase 1 — Primitive sweep (`core/ui`).**
`Button` (token fills + pressed/hover states via `Pressable` state callback), `Card` (drop slate class), `Modal` (`overlay`), `PillChip` (non-section usage), `InAppNoticeBanner` (`accent`), `TextField`/`NumberStepperField` (focus ring), `SwipeRightActions`, `EmptyStateCard`, `StatBlock`, `ValidationError` (`dangerText`). After this phase, *any* registered theme renders correctly in all shared chrome.

**Phase 2 — Screen sweep (`features/`, `app/`).**
Remove `resolvedTheme` ternaries and neutral-accent literals in Settings/Command/Overview (→ `textMuted`), tab layout Overview color, restore-warning/error literals (→ `warningText`/`dangerText`), success literals (→ `successText`). Introduce `getSectionAccents(appearance)` and migrate `SECTION_COLORS_LIGHT` chip/tint usages.

**Phase 3 — Data-viz sweep.**
`GitHubHeatmap`, `DailyCalorieChart`, `MacroDonutChart`, `ProgressRing`, `HabitCircle`: axis labels, grids, tracks, empty cells → tokens (this also fixes the existing dark-mode heatmap bug). Series colors stay section-driven.

**Phase 4 — Catalog + picker.**
Land the 12 theme files, `ThemePreviewCard`, the Appearance card redesign, slots persistence, and e2e coverage.

Estimated diff surface: ~25 files, of which ~14 are new theme/infra files; phases 1–3 are mechanical token substitutions.

---

## 12. Testing & Guardrails

- **Contrast CI gate:** `node scripts/validate-theme-contrast.mjs` (added with this proposal; wired as `npm run validate:themes` in Phase 0, later importing the real registry instead of its embedded copy). Fails the build on any AA regression — theme PRs can't merge ugly.
- **Dev-boot assertion:** `createTheme` re-runs the same checks in `__DEV__` (§5.5).
- **Unit (Vitest):** slot resolution matrix (mode × OS appearance × slots), unknown-id fallback + self-heal, v1-only-storage path, registry invariants (unique ids, both default ids present, every id kebab-case).
- **E2E (Playwright, static `dist/` per repo convention):** select a night theme in Settings → assert `html[data-theme-id]` and `--sh-background`; reload → persisted; switch mode chips → correct slot's theme appears. One axe-style spot check on Settings in the darkest (Cyberpunk) and lightest (Solarized) themes.
- **Drift guard:** a small grep-based check (same CI job) rejecting new 6-digit hex literals in `core/ui/**` outside `core/theme/`, so the primitive layer stays token-pure after Phase 1.

---

## 13. Risks & Open Questions

| Risk | Mitigation |
|---|---|
| Section accents look off on an exotic theme | `sectionOverrides` escape hatch (§7); only 2 of 12 proposed themes need it |
| Red-primary theme vs. destructive-action affordance | Crimson overrides danger set + danger actions keep icon/copy signals (§6.7) |
| NativeWind class caching fights dynamic colors | Avoided by policy: dynamic color never goes through Tailwind classes (§5.4) |
| Theme count creep degrades the picker | Horizontal-scroll rows scale to ~20; beyond that, group by appearance into a modal gallery (registry already carries the metadata) |
| Contrast math ≠ perception (e.g., pure-saturated accents can shimmer on dark) | Catalog already tones neon usage (§6.10); preview strip in the picker lets users judge before committing — and switching back is one tap |

Open questions for the team:

1. Should `system` mode's slots be user-visible from day one, or should v1 of the picker expose a single "theme" choice (auto-assigning the slot) and reveal day/night pairing later? (Proposal assumes visible from day one — it's two labeled rows.)
2. Do we want the two Light-theme refinements (`textMuted`, button fill) shipped in Phase 0 as a silent accessibility fix, or held for the catalog release? (Proposal: Phase 0 — it's a compliance fix.)
3. Is a Solarized **Dark** counterpart wanted in the initial catalog? It's one more file under this architecture.
