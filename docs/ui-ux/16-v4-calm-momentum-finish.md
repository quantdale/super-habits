> **SUPERSEDED by [`16-playful-momentum.md`](./16-playful-momentum.md)** (2026-10-29,
> BRIEF v2 "Playful Momentum"): the neutral V4 direction was rejected as "too
> professional". Kept for the record only — where this file conflicts with doc
> 16, doc 16 wins. Do not implement from this document. The
> `openspec/changes/ui-v4-visual-finish` change was deleted (never applied);
> its replacement is `openspec/changes/ui-v2-playful-momentum`.

# SuperHabits — V4 "Calm Momentum, finished" — visual finish spec & ledger

Owner: Michael Dale Palaca · Repo: `quantdale/super-habits` · Baseline: `origin/main` @ `b6761699` (2026-10-29)
Status: **SUPERSEDED** (2026-10-29 by `16-playful-momentum.md`) — P0 shipped
2026-10-29 under the old direction; P1–P20 never ran and are void (replaced by
doc 16's P0–P22 plan).
Scope: **visual/UX only.** No domain, data, sync, backup, migration or routing changes. Every test ID, accessible
role/label, product-facing label, and the one global Add flow (`Add → Describe it`) stays exactly as is.

This document is the durable in-repo V4 ledger: the design brief adapted as
spec. §1–§8 are normative for P1–P20; §9 records the decisions Michael made
on the brief's open questions; §10 tracks per-phase delivery. The OpenSpec
change `openspec/changes/ui-v4-visual-finish` carries the capability delta for
`ui-ux-visual-coherence`.

Design working artifacts (held in the owner's external design workspace —
referenced here by description only; the binaries are never committed):

- Current-state audit — 26 Playwright captures of `main` (1280×800 and 390×844, light + dark for Today/To Do/Workout/Calories) plus one mobile-light contact image.
- Reference set — 16 Refero reference screens with a source-links file plus the full reviewed candidate pool.
- Direction board — one-page contact sheet of the chosen direction.
- Capture harness — a Playwright visual-audit capture spec to re-run after each phase for before/after evidence.

---

## 1. The vision, in Michael's own words (from the repo)

- **North star** (`docs/ui-ux/13-calm-momentum-design-system.md` §2): _"A screen answers one question first. Everything on
  it either serves that answer or gets quiet. Momentum comes from frictionless frequent actions, not from decoration."_
  Today → _What matters today?_ · To Do → _What do I need to do?_ · Habits → _Did I do today's check-ins?_ · Focus →
  _Am I focusing right now?_ (calmest screen) · Workout → _What am I training and logging right now?_ · Calories →
  _What did I eat / what's left today?_
- **Design DNA** (`02-design-dna.md`, "Warm Momentum"): _"calm clarity of a serious productivity tool with the warmth and
  tactile feedback of a habit/wellness app"_ — calm not sterile, friendly not childish, rewarding not manipulative,
  **colorful not noisy**, dense enough for power users. Metaphor: growth/accumulation → the **Momentum Garden**.
  P1 _Calm first, delight second_ · P2 _Section color is an accent, not a theme_ · P3 _One dominant action per state_ ·
  P4 _Progressive disclosure_ · P7 _Recovery is part of the product — never imply moral failure._
- **Product direction** (`docs/product-notes/2026-08-31-ui-ux-simplification-mobbin-direction.md`): _"Make Super Habits
  feel simple even though it is powerful."_ Willing to do a major surface overhaul; no sunk-cost thinking; redesign the
  surface, not the engine.
- **V3 rejections** (13 §15): colored shadows, gradient surfaces, tinted canvas, tinted-cards-in-tinted-cards, 26–34pt
  radii, doc-copy subtitles, rainbow metadata strips, FABs over content, gamified surfaces inside operational flows.
- **Momentum Garden spec** (`openspec/specs/momentum-garden`): read-only, attributable, never punitive — neutral
  _"Your garden is ready for today"_, no warning red, no wilted plants.
- **Contracts** (`openspec/specs/ui-ux-visual-coherence`, `navigation`): primitives use `core/theme/designTokens.ts`
  tokens, no parallel design system; six labels Today/To Do/Habits/Focus/Workout/Calories unchanged; 14-theme registry
  keeps ≥140 passing contrast checks (`npm run validate:themes`); Settings/Command Center remain overlays.

**Diagnosis:** the _rules_ are already right (V3 Calm Momentum). What still reads "vibe-coded" is that the **token
values and primitives never left "Pop"**: lavender canvas, violet+fuchsia brand, Tailwind-500 rainbow section hues,
Nunito's rounded letterforms, filled Material icons, emoji in chrome, and per-screen ad-hoc type sizes. V4 finishes the
job: same principles, new values, stricter primitives.

## 2. Top vibe-coded smells (evidence: `current/`)

1. **Default "AI violet" identity.** Light theme = lavender canvas `#F5F3FF` + violet `#6C4CF5` + fuchsia accent
   `#C026D3`; dark = indigo-plum `#0C0A1D/#171436`. The single most recognizable generated-app palette. The Today hero is
   a saturated violet slab (`overview-mobile-light.png`).
2. **Rainbow of stock Tailwind-500 hues.** `#3B82F6/#10B981/#8B5CF6/#F97316/#F59E0B/#14B8A6` all at once: the stat grid has
   five differently-colored icons; Workout paints rust buttons + peach-tinted cards; Calories paints brown/amber; Focus is
   violet-on-violet. Section color is still _wallpaper_, not signal — violating 13 §4 and P2.
3. **Rounded "friendly" type everywhere + tiny sizes.** Nunito (400–900) + 362× `text-sm`, 176× `text-xs`, and
   `text-[9px]/[10px]/[11px]` literals bypass `core/ui/Text` roles. Uppercase letter-spaced eyebrows on every block
   ("TODAY AT A GLANCE", "TO DO" above "Todos", "QUICK START", "THIS WEEK", "FREQUENT FOODS").
4. **Pill & chip soup.** 87× `rounded-full`; presets, priorities, frequent foods, quick kcal amounts, theme mode, weekday
   strip, quick-capture types are all pills of equal weight — no hierarchy (`pomodoro-*`, `calories-*`, `quick-capture-*`).
5. **Card soup / nested surfaces.** Tinted cards inside tinted panels (Workout "This week" pink panel with bordered
   Rest/+ boxes; Settings: card › card › card with explanatory paragraphs; Focus: three stacked lavender cards).
6. **Inconsistent spacing rhythm.** Ad-hoc utilities (169× `gap-2`, 95× `mt-1`, 83× `mt-2`, 25× `mt-0.5`, 16× `py-1.5`…)
   rather than tokens; group gaps vary 12–32px between screens; desktop content is a 760px column glued left with a
   blank right half (`*-desktop-light.png`).
7. **Iconography & emoji mismatch.** Filled MaterialIcons (97 uses) mixed with emoji in UI chrome (☀️⛅🌙🔄 habit times,
   🎉🏆🏋️ workout, ⚠️ validation, "✕ clear"). Bright magenta 2px focus ring shows on pointer-clicked tabs.
8. **Doc-copy & duplicated status.** Settings narrates ("Choose how super-habits should look on this device", "Following
   your device setting. Light mode is active right now…"); Command Center still shows "Parsing saves text…" and a disabled
   "Parse command" button; Workout "Rest day — Recover, or start any routine below — your weekly plan stays unchanged."
   Also: 14 novelty themes (Cyberpunk Neon, Sunset Orange…) each re-tint the whole app, multiplying the noise.

## 3. Chosen direction (5 bullets)

1. **Warm-neutral, ink-first.** Sand-gray canvas, white surfaces, near-black ink for text _and_ the primary button
   (Things/Craft/Linear). Brand violet retires as the default; one interactive accent (indigo) only for focus ring, links,
   switches, selection.
2. **Color = signal.** Six harmonized section hues (Radix-scale, equal chroma) appear only in: active nav indicator, the
   one hero/progress per screen, completion checks, and charts. Never as card or canvas paint. Garden/gamification keep
   their reward colors, only on reward surfaces.
3. **Professional type.** Inter (400/500/600, 700 for display only) with tabular numerals; 8-role scale; sentence-case
   section headers; no uppercase eyebrows except one tiny overline role.
4. **Flat grouped lists over cards.** iOS-style inset groups with hairline separators for rows; cards only for discrete
   objects (a routine, a session, a meal). Radii 8–12, hairline borders, shadows only for floating layers.
5. **Linear-grade desktop + palette.** ≥1280: labeled 232px sidebar and a centered 720–1080 content grid; Command Center
   and Quick Capture become a keyboard-first palette (input first, grouped results, shortcut hints).

---

## 4. Design principles (V4, consistent with 02/13)

1. **One question, one hero, one primary.** Each screen keeps its 13 §2 question; max one hero surface and one ink
   primary button per view.
2. **Neutral carries the page; hue carries meaning.** If removing a color loses no information, remove it.
3. **Rows, not cards.** Default container = grouped list. A card must represent a thing the user can act on as a unit.
4. **Numbers are the interface.** kcal, timer, sets, streaks use `metric` roles with tabular figures; labels are quiet.
5. **Same rhythm everywhere.** Only token spacing (4/8/12/16/24/32/48); one page gutter; one group gap (24).
6. **Delight is earned.** Motion/celebration only for completion and real milestones (level-up, PR, streak record).
7. **Calm in dark too.** Dark = neutral charcoal, not indigo; hues desaturate to step-11 text colors.
8. **Never punitive** (P7): zero/missed states are neutral ink, never danger red.

## 5. Token system

All values below are exact. Contrast ratios computed with the repo's WCAG formula (same as `core/theme/contrast.ts`).

### 5.1 Neutral color — light (default theme `light`)

| Token (ThemeTokens)                          | Value                                                           | Notes / contrast                                               |
| -------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------- |
| `background` (canvas)                        | `#F9F9F8`                                                       | sand-2; no tint, no wash                                       |
| `surface`                                    | `#FFFFFF`                                                       | cards, grouped-list bodies, tab bar                            |
| `surfaceElevated` (raised: sheets, popovers) | `#FFFFFF`                                                       | + elevation level2/3                                           |
| `surfaceSunken`                              | `#F1F0EF`                                                       | input wells, tracks, segmented track                           |
| `surfaceHover`                               | `#E9E8E6`                                                       | web hover, pressed rows                                        |
| `surfaceActive`                              | `#E2E1DE`                                                       | pressed/selected neutral                                       |
| `border` (hairline)                          | `#E9E8E6`                                                       | row separators, card outline                                   |
| `borderStrong`                               | `#DAD9D6`                                                       | inputs, segmented outline, focusable outlines                  |
| `text`                                       | `#21201C`                                                       | 16.3:1 on white                                                |
| `textMuted` (secondary)                      | `#63635E`                                                       | 6.0:1 on white, 5.3:1 on sunken                                |
| **new** `textSubtle` (tertiary/placeholder)  | `#6B6A64`                                                       | ≥4.5:1 on white and sunken                                     |
| `iconMuted`                                  | `#82827C`                                                       | decorative/inactive icons only (3.9:1, non-text)               |
| `primary` / `button` (ink)                   | `#21201C`                                                       | `buttonText` `#FFFFFF` (16.3:1)                                |
| `buttonHover` / `buttonActive`               | `#33322E` / `#46453F`                                           |                                                                |
| `secondary` (tonal neutral)                  | `#F1F0EF`                                                       | secondary button fill                                          |
| `accent` (interactive accent)                | `#3E63DD`                                                       | focus ring, links, switch-on, text selection (4.9:1 on canvas) |
| **new** `focusRing`                          | `#3E63DD` @ 2px, offset 2                                       | web `:focus-visible` only                                      |
| `overlayScrim`                               | `rgba(17, 17, 16, 0.40)`                                        |                                                                |
| `tabRail` / `tabRailBorder`                  | `#FFFFFF` / `#E9E8E6`                                           |                                                                |
| `shadowColor`                                | `#000000`                                                       | neutral shadows only                                           |
| `brandGradient`                              | `['#21201C', '#21201C']`                                        | kept for type compat; **no gradients** rendered                |
| `glow`                                       | `transparent`                                                   | retired                                                        |
| `chipBackground` / `chipBorder`              | `#FFFFFF` / `#DAD9D6`                                           | neutral chips                                                  |
| status — danger                              | solid `#E5484D`, text `#B8262B`, bg `#FCEDED`, border `#F4C7C7` | text 5.5:1 on bg                                               |
| status — warning                             | solid `#FFC53D`, text `#955300`, bg `#FFF9EC`, border `#F3D9A4` | text 5.7:1 on bg                                               |
| status — success                             | solid `#30A46C`, text `#1B7A4E`, bg `#EAF6F0`, border `#B9E2CC` | text 4.8:1 on bg                                               |
| `webThemeColor` / `statusBarStyle`           | `#F9F9F8` / `dark`                                              |                                                                |

### 5.2 Neutral color — dark (default theme `dark`)

| Token                              | Value                                         | Notes / contrast                                     |
| ---------------------------------- | --------------------------------------------- | ---------------------------------------------------- |
| `background`                       | `#111110`                                     | sand-dark-1 (no indigo)                              |
| `surface`                          | `#191918`                                     |                                                      |
| `surfaceElevated`                  | `#222221`                                     | sheets/popovers (elevation by lightness, not shadow) |
| `surfaceSunken`                    | `#0D0D0C`                                     |                                                      |
| `surfaceHover` / `surfaceActive`   | `#2A2A28` / `#31312E`                         |                                                      |
| `border` / `borderStrong`          | `#2A2A28` / `#3B3A37`                         |                                                      |
| `text`                             | `#EEEEEC`                                     | 15.1:1 on surface                                    |
| `textMuted`                        | `#B5B3AD`                                     | 8.4:1                                                |
| `textSubtle`                       | `#8A8983`                                     | 5.0:1 on surface, 4.5:1 on raised                    |
| `iconMuted`                        | `#7C7B74`                                     | non-text                                             |
| `primary` / `button`               | `#EEEEEC` with `buttonText` `#111110`         | inverted ink button, 16.3:1                          |
| `buttonHover` / `buttonActive`     | `#DEDDDA` / `#CFCECA`                         |                                                      |
| `accent` / `focusRing`             | `#9EB1FF`                                     | 9.2:1 on canvas                                      |
| `overlayScrim`                     | `rgba(0, 0, 0, 0.60)`                         |                                                      |
| status — danger                    | solid `#E5484D`, text `#FF9592`, bg `#3A2120` |                                                      |
| status — warning                   | solid `#FFC53D`, text `#FFCA16`, bg `#3E351E` |                                                      |
| status — success                   | solid `#30A46C`, text `#3DD68C`, bg `#1D2F25` |                                                      |
| `webThemeColor` / `statusBarStyle` | `#111110` / `light`                           |                                                      |

### 5.3 Section hues (replace `constants/sectionColors.ts` + `tailwind.config.js` colors)

Harmonized (Radix step 9 fills, step 11 text). `tint` = fill mixed 10% into white (light) / 16% into `#191918` (dark).

| Section          | fill      | text (light)      | tint (light) | text (dark) | tint (dark) | Ink on fill                                                          |
| ---------------- | --------- | ----------------- | ------------ | ----------- | ----------- | -------------------------------------------------------------------- |
| todos (indigo)   | `#3E63DD` | `#3A5BC7` (6.0:1) | `#ECEFFC`    | `#9EB1FF`   | `#1F2538`   | white 5.2:1                                                          |
| habits (green)   | `#30A46C` | `#1B7A4E` (5.3:1) | `#EAF6F0`    | `#3DD68C`   | `#1D2F25`   | `#21201C` 5.2:1                                                      |
| focus (violet)   | `#6E56CF` | `#6550B9` (6.2:1) | `#F0EEFA`    | `#BAA7FF`   | `#272335`   | white 5.4:1                                                          |
| workout (tomato) | `#E54D2E` | `#C02F0F` (5.8:1) | `#FCEDEA`    | `#FF977D`   | `#3A211C`   | white 3.9:1 (large/bold only) → prefer ink 4.2 or text color on tint |
| calories (amber) | `#FFC53D` | `#955300` (6.0:1) | `#FFF9EC`    | `#FFCA16`   | `#3E351E`   | `#21201C` 10.3:1 (never white)                                       |
| health (teal)    | `#12A594` | `#007467` (5.7:1) | `#E7F6F4`    | `#0BD8B6`   | `#182F2C`   | `#21201C` 5.3:1                                                      |

Rules: fills only for ≤24px marks (check, dot, bar, ring, active-tab indicator) and charts; text color for in-row
emphasis; tint only for the screen's single hero/progress surface. Reward colors (XP/streak/badges in
`SECTION_COLORS`' reward block) keep their semantic roles but adopt the same step-9/step-11 discipline. User-chosen
habit colors (data, e.g. `#ef4444`) are rendered only as a 10px dot / check fill — never as text or background.

### 5.4 Themes

Keep all 14 theme IDs (Settings behavior unchanged; `theming.spec.ts` still asserts Nord's `#2e3440` background).
`light`/`dark` adopt 5.1/5.2. The other 12 become **accent variants on the neutral system**: each keeps its own canvas
character at ≤4% tint (Nord, Solarized, Coffee keep their signature backgrounds) but buttons go ink, cards go neutral,
and its hue maps only to `accent`. `npm run validate:themes` must stay ≥140 passing checks; add checks for `textSubtle`
on `surface`/`surfaceSunken` and `buttonText` on `button`.

### 5.5 Typography (`designTokens.typography`, `fonts`)

Family: **Inter** via `@expo-google-fonts/inter` (`Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`,
`Inter_700Bold`). Nunito removed. `fontVariant: ['tabular-nums']` on every `metric*` and any column of numbers.

| Role                   | Size / line | Weight                   | Tracking        | Use                                                        |
| ---------------------- | ----------- | ------------------------ | --------------- | ---------------------------------------------------------- |
| `display`              | 34 / 40     | 700                      | −0.6            | celebrations only                                          |
| `metricLg` (new)       | 56 / 60     | 500                      | −1.5            | Focus timer digits                                         |
| `metric`               | 28 / 34     | 600                      | −0.4            | kcal left, totals, streak count                            |
| `titleXl`              | 26 / 32     | 600                      | −0.4            | empty-state titles (rare)                                  |
| `titleLg`              | 22 / 28     | 600                      | −0.3            | screen title (PageHeader)                                  |
| `titleMd`              | 17 / 24     | 600                      | −0.2            | group/sheet/card titles                                    |
| `bodyLg`               | 16 / 24     | 400                      | 0               | primary reading, inputs                                    |
| `bodyMd`               | 15 / 22     | 400 (500 for row titles) | 0               | list rows                                                  |
| `label`                | 13 / 18     | 500                      | 0               | buttons, chips, segmented                                  |
| `caption`              | 12 / 16     | 400                      | 0               | metadata, helper text                                      |
| `overline` (new, rare) | 11 / 14     | 600                      | +0.4, uppercase | max one per screen; tab labels use 11/14 500 sentence case |

Bans: raw `text-[9–11px]`, `text-xs/sm/base` on product text (lint rule: only `<Text variant>`), weight 800/900,
uppercase section headers (sentence-case `titleMd`/`label` instead).

### 5.6 Spacing, layout, radii

- Spacing scale unchanged (`0/4/8/12/16/24/32/48`); add `2` (`hair`) for icon/text optical nudges only.
- Rhythm: page top 16 → title → 16 → first group; **between groups 24**; inside a group 12; row internal 12×16.
- Gutter: 16 phone / 24 tablet / 32 desktop (unchanged helper `pageGutterForWidth`).
- Content width: lists & forms `contentMaxWidth: 720`; dashboard grid `layout.dashboardMaxWidth: 1080` (new), centered
  in the space right of the sidebar (fixes the left-glued 760 column).
- Radii (`radius`): `xs 6` (tags, checkboxes) · `sm 8` (chips, small buttons, inputs) · `md 10` (buttons, segmented) ·
  `lg 12` (cards, grouped lists) · `xl 16` (sheets top corners, dialogs, hero) · `full` (avatars, dots, capture button).
  Nothing > 16 except circles.
- Row heights: list row 52 (todo/settings; tests require 48–56), habit row 56 (tests 48–64), compact row 44 (pickers),
  set-log row 48. Tap targets ≥ 44 (≥ 48 for check/complete controls — existing tests).

### 5.7 Elevation

| Level    | Light                                    | Dark                                   | Use                                                  |
| -------- | ---------------------------------------- | -------------------------------------- | ---------------------------------------------------- |
| `level0` | none                                     | none                                   | page, rows, ordinary cards (hairline border instead) |
| `level1` | `0 1 2 rgba(0,0,0,0.04)` + 1px `border`  | border only                            | selected segment thumb, sticky headers               |
| `level2` | `0 4 16 rgba(0,0,0,0.08)` + 1px `border` | `surfaceElevated` + 1px `borderStrong` | popovers, menus, toasts, capture button              |
| `level3` | `0 12 32 rgba(0,0,0,0.14)`               | `surfaceElevated` + 1px `borderStrong` | sheets, dialogs, command palette                     |

No colored shadows (`glow` retired). RN: `elevation` 0/1/4/8.

### 5.8 Motion (`core/theme/motion.ts`, `springs`)

- Durations: `instant 90` (press), `fast 140` (hover/toggle), `base 200` (sheet/expand), `slow 280` (page-level, rare).
- Easing: standard `cubic-bezier(0.2, 0, 0, 1)`; exit `cubic-bezier(0.3, 0, 1, 1)`.
- Springs: `press {speed: 50, bounciness: 0}` (scale 0.98, no bounce) · `pop {speed: 30, bounciness: 6}` (completion
  check only) · `enter {speed: 20, bounciness: 0}`.
- Completion: check fills + 1 scale pop 1→1.12→1 (≤200ms); haptic light on native. Celebration overlay only for
  milestones. `useReducedMotion()` → opacity-only, 0ms springs.

### 5.9 Iconography

One outline family through a new `core/ui/Icon.tsx` wrapper (semantic names → glyphs), using **Ionicons outline**
(already in `@expo/vector-icons`, no new dependency) at 20/24px, stroke-consistent; icons inherit `textMuted`, active =
`text`. **No emoji in UI chrome** (user content may contain emoji). Replacements: Anytime `repeat-outline`, Morning
`sunny-outline`, Afternoon `partly-sunny-outline`, Evening `moon-outline`, workout complete `trophy-outline`,
validation `alert-circle-outline`, close `close`.

## 6. Component standards (`core/ui`)

| Component                       | Standard                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Button**                      | Heights sm 32 / md 40 / lg 48 (hitSlop to ≥44). Radius `md 10`. `primary` = ink fill, white label 13–15/500; `secondary` = `surface` + 1px `borderStrong`, ink label; `tonal` (new) = section tint + section text (in-section affirmative like "Start", "Log food"); `ghost` = text only; `danger` = solid danger; `celebrate` = only in reward moments. One primary per view. Icon+label gap 8. Loading keeps width. |
| **IconButton**                  | 36 visual / 44 hit, ghost by default (no circle outline), hover `surfaceHover`, 20px icon. Header actions grouped right with 4px gap.                                                                                                                                                                                                                                                                                 |
| **TextField**                   | 44 high, `surface` fill + 1px `borderStrong` (or `surfaceSunken` borderless for search), radius `sm 8`, label above (`label`, `textMuted`), helper/error below (`caption`). Focus: border → `accent` + 2px ring web. Placeholder `textSubtle`.                                                                                                                                                                        |
| **NumberStepperField**          | Field + two 36px ghost icon buttons inside the field; value in tabular `bodyLg`.                                                                                                                                                                                                                                                                                                                                      |
| **SegmentedControl**            | 32 high, `surfaceSunken` track radius 10, thumb `surface` + level1, label 13/500. Max 4 segments; more → Select/Menu.                                                                                                                                                                                                                                                                                                 |
| **PillChip → Chip**             | 28 high, radius 8 (filters may be full), 1px `borderStrong`, `label` 13/500; selected = ink fill + white text (or section tint for section-scoped filters). Never more than one chip row visible; overflow → "More" sheet.                                                                                                                                                                                            |
| **Card**                        | `surface`, 1px `border`, radius 12, padding 16, no shadow, no header band, no tint. Variants: `standard`, `hero` (≤1/screen: section tint bg, no border), `inset` (sunken), `stat` (see StatBlock).                                                                                                                                                                                                                   |
| **ListGroup / ListRow** (new)   | Inset grouped list: optional header (`label`, `textMuted`, sentence case, 8 above rows) → `surface` card radius 12 → rows 52 with 16 padding, leading 20px icon or 24px check, title `bodyMd`/500, one-line `caption` meta, trailing value/chevron/action; hairline separator inset to text start. Replaces ad-hoc rows in To Do, Habits, Settings, Workout week, Calories diary.                                     |
| **PageHeader**                  | Title `titleLg` left; date/context as `caption` above _or_ below (one line); actions = IconButtons right; no eyebrow + title duplication ("TO DO / Todos" → "To Do"). 56 tall on phone.                                                                                                                                                                                                                               |
| **SectionLabel**                | Sentence-case `label` 13/500 `textMuted` (not uppercase overline).                                                                                                                                                                                                                                                                                                                                                    |
| **Tabs (bottom bar)**           | 56 + safe area, `surface` + top hairline. 6 destinations + center capture: icons 22 outline, label 11/14 500 (test: ≥11px), inactive `iconMuted`, active `text` + 3px×16px section-hue indicator above icon. No capsule, no outline ring. Capture: 44 circle ink fill, white `add` icon, level2.                                                                                                                      |
| **Sidebar (≥900)**              | 900–1279: 64px icon rail; ≥1280: 232px labeled sidebar (`surface`, right hairline): app mark + name, "New" (capture) ink button, six destinations as 32px rows (icon + label + optional count), secondary group (Plan, Review, Achievements, Settings). Active row = `surfaceActive` + section-hue 2px left bar.                                                                                                      |
| **Sheets / Modal**              | Bottom sheet: radius 16 top, handle 36×4, title row (`titleMd` left + ghost close), body padding 16–24, pinned action bar with hairline top. Dialog: max 440, radius 16, level3. Drawer (Settings): 480 on desktop, full-height sheet on phone. Scrim per tokens. One primary action, destructive separated left.                                                                                                     |
| **Command palette**             | 600 wide desktop / full-width sheet phone; input 52 high borderless with leading search icon; context line as `caption` ("From Today"); results grouped (Suggestions, Create, Navigate) as 40px rows with right-aligned shortcut hints; examples only while empty.                                                                                                                                                    |
| **Empty states**                | 40px sunken circle + 20px icon, `titleMd` one sentence, optional `caption`, one `secondary` button. No illustration blobs.                                                                                                                                                                                                                                                                                            |
| **Banners / toasts**            | Inline banner: tint bg of status + 16px icon + one line + one action; toast level2, ≤2s, bottom above tab bar.                                                                                                                                                                                                                                                                                                        |
| **StatBlock / FeatureStatCard** | Neutral; value in `metric` ink, label `caption`; at most one hue (the icon). Group stats into one card with internal dividers instead of 5 separate tiles.                                                                                                                                                                                                                                                            |
| **Progress & charts**           | Bars 6px on `surfaceSunken`, section fill; rings 6px stroke; heatmaps 5-step ramp of section tint→fill; gridlines hairline `border`; axes `caption` `textSubtle`; no gradients, no 3D, labels in tabular numbers.                                                                                                                                                                                                     |
| **Skeleton**                    | `surfaceSunken`, same geometry as content, 1.2s shimmer off under reduced motion.                                                                                                                                                                                                                                                                                                                                     |

## 7. Per-screen redesign notes

**Shell (all screens)** — Ref: Linear sidebar (`refs/13`, `refs/14`). Neutral canvas, new tab bar, ≥1280 labeled
sidebar, centered content. Remove violet capture gradient; capture = ink circle. Fix focus ring to `:focus-visible`.

**Today / Overview** — Q: _What matters today?_ Ref: Haptic dashboard (`refs/03`), Structured timeline (`refs/06`).
Header "Good evening" `titleLg` + date `caption`, actions right. Hero = **Up next** card in `surface` with a 3px todos
indicator, task title `titleMd`, reason as `caption`, one ink "Open To Do" button (no violet slab). "Today at a glance"
→ one card with 5 inline stats divided by hairlines (tasks 0/1, habits 0/4, focus 25 min, workout Done, kcal 600/2000),
values ink `metric`-small (20/600 tabular), hue only on 16px icons. Below: grouped list "Plan" (Today's plan row with
chevron), "Momentum" (Level & streak row + compact garden strip). Desktop ≥1280: 2-col grid (operational 640 | 360
reflection) inside 1080 max.

**To Do** — Q: _What do I need to do?_ Ref: Craft (`refs/11`), Superlist dark (`refs/12`), Linear list (`refs/13`).
Title "To Do"; summary line as one `caption` (overdue count in danger text). One composer row (sunken field + inline
ink add button) and one search field with filter icon — merge into a single toolbar row on ≥768. Rows 52: 22px circle
check (section fill when done), title `bodyMd`/500, meta `caption` (date · priority · repeat) with priority as text color
only for Urgent, trailing ghost "more". Completed: `textSubtle` + filled check, no strikethrough. Desktop: Linear-style
40px rows inside 720 column.

**Habits** — Q: _Did I do today's check-ins?_ Ref: Atoms (`refs/01`), Roots (`refs/02`). Day strip: 7 compact 40×52
date cells (weekday `caption` over date `label`), today = ink fill, completion = 4px dot below — no pill row. Groups
Morning/Afternoon/Evening/Anytime as ListGroups with Ionicons headers (no emoji). Habit row 56: name `bodyMd`/500,
schedule `caption`, trailing 48px check (binary) or "2/8" tabular + 36px add (quantitative); 0/x neutral ink. Detail
sheet: streak `metric` + month heatmap (habit tint ramp) + history list.

**Focus (Pomodoro)** — Q: _Am I focusing right now?_ (calmest). Ref: FocusPomo (`refs/09`). Idle: centered timer
`metricLg` 56 ink, mode as segmented (Focus/Short/Long), one ink "Start focus" lg button, "Up next: Short break" caption;
presets and durations collapse into a "Session settings" row → sheet; "Link a todo" as a ListRow. No lavender stack of
cards. Running: timer + thin 4px focus-violet progress ring, Pause (secondary) + End (ghost). Nothing else.

**Workout landing** — Q: _What am I training now?_ Ref: Train (`refs/07`), Dropset (`refs/08`). Today card: status
line ("Rest day · Tue") + one ink "Choose a routine" or tonal "Start Routine 2" — no peach panel, no rust buttons.
Quick start = ListGroup of routines (name, "6 exercises · last: yesterday", trailing tonal Start). "This week" = 7-row
ListGroup: weekday `label` 40px column, assignment `bodyMd`, trailing ghost menu (Rest/Assign) instead of two bordered
boxes per row. Library/history as rows with chevrons.

**Workout session** — Ref: Train set table (`refs/07`), Dropset (`refs/08`). Sticky header: elapsed timer tabular +
Finish (ink). Each exercise = card: title `titleMd`, columns Set · Prev · kg · Reps · ✓ in tabular `bodyMd`, 48px rows,
inputs sunken, completed row = success tint + filled check. Rest timer as bottom toast bar. PR celebration uses icon
(trophy-outline) + `display`, no emoji.

**Calories** — Q: _What's left today?_ Ref: FoodNoms (`refs/04`, `refs/05`). Header: "1,400 kcal left" `metric` +
"600 of 2,000 logged" `caption` + one 6px amber bar; macros as three inline columns (Protein/Carbs/Fat: "14 / 150 g"
tabular + 4px bars) in the same hero card ("Edit goal" ghost). Form/Diary segmented (32px, neutral thumb — not brown).
Form: one field group (Food, kcal, macros) + ink "Add"; Frequent foods and quick amounts as one wrap of 28px neutral
chips max 2 lines + "More". Diary: meals as ListGroups (meal header with subtotal), entries 52 rows with macro caption.

**Settings modal** — Ref: Matter appearance (`refs/10`), iOS grouped settings. Drawer with search-free grouped lists:
Appearance (Theme mode segmented in-row; Theme → picker sheet with real mini-previews), Accessibility, Notifications,
Backup & account, Data, Developer/Internal (collapsed). Each row = label · value · chevron; no narration paragraphs (move
to `caption` only where a decision needs it). Back = ghost chevron in sheet header.

**Command Center + Quick capture** — Ref: Linear command (`refs/15`), Raycast (`refs/16`). Quick capture sheet: title
field first (borderless 17/500), type selector as one segmented/menu row with section-hue dot (not six chips), priority as
a compact menu, primary "Capture" ink right-aligned in the action bar, "Describe it" ghost left. Command Center: palette
anatomy (§6); "Parse command" becomes the Enter action shown as a hint and an enabled-on-input primary button.

**Secondary** (Planning Hub, Weekly Review, Achievements, Momentum Garden, Health, Progress, Activity) — apply ListGroup

- Card rules; Garden art stays (product metaphor) but sits on `surface` with neutral frame; achievements grid uses
  neutral tiles with earned = reward color icon only.

## 8. Phased implementation plan (small PRs, one Pi session each ≈ 30–60 min)

Ground rules for every phase:

- Branch per phase off fresh `main` (`ui/v4-pNN-<slug>`), one PR, presentation-only diff.
- Gates: `npm run typecheck && npm run lint && npm run test:unit && npm run validate:themes`, then
  `npm run build:e2e && npm run e2e` (chromium + journeys + pwa + visual). No test ID / role / label / copy-contract
  edits (exception: copy deletions already sanctioned by 13 §5 and called out in the phase).
- Visual goldens: regenerate **linux** goldens with `npm run visual:update` in the phase PR and inspect every diff
  image; **win32** goldens (`*-win32.png`) can't be produced on Linux — mark them in the PR and regenerate in P20 on
  Michael's Windows workstation (or temporarily skip win32 comparisons per the existing platform-scoped template).
- Before/after captures: run `tools/uiaudit-visual-regression.spec.ts` into `docs/ui-ux/v4-audit/pNN/` (or attach to PR).
- Each phase adds an entry to a new `docs/ui-ux/16-v4-calm-momentum-finish.md` ledger and, in P0, an OpenSpec change
  `ui-v4-visual-finish` (modified capability: `ui-ux-visual-coherence`).

| #   | Phase                              | Scope (files)                                                                                                                                                                                                                              | Acceptance criteria                                                                                                                                                                                                 | Snapshot / test impact                                                            |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| P0  | Spec + guardrails                  | `docs/ui-ux/16-…md` (this brief), `openspec/changes/ui-v4-visual-finish/{proposal,tasks,specs}`; ESLint rule (warn) banning `text-[Npx]`, raw Tailwind palette colors, emoji literals in `core/ui`/`features/**` JSX                       | `openspec validate --all` passes; lint passes with warnings counted in PR body; zero runtime diff                                                                                                                   | none                                                                              |
| P1  | Color tokens (default light/dark)  | `core/theme/themes/{light,dark}.ts`, `tokens.ts` (+`textSubtle`, `focusRing`), `createTheme.ts` (derive neutral chip/glow/gradient), `scripts/validate-theme-contrast.mjs` (+new pairs)                                                    | Values exactly §5.1/5.2; ≥140 + new contrast checks pass; `tests/theme.registry.test.ts` green                                                                                                                      | all 30 linux goldens; `theming.spec.ts` unchanged (Nord untouched)                |
| P2  | Section hues                       | `constants/sectionColors.ts`, `tailwind.config.js` colors (+drop `brand` violet alias → neutral), reward colors §5.3                                                                                                                       | No Tailwind-500 hex remains in `constants/`/`tailwind.config.js`; `tests/sectionColors.test.ts` updated to new values; `habits-w7-audit` "not red" check still passes                                               | all goldens                                                                       |
| P3  | Typography                         | add `@expo-google-fonts/inter`, `app/_layout.tsx` fonts, `designTokens.fonts/typography` (§5.5), `core/ui/Text.tsx`; update `APP_FONT_FAMILIES` in `e2e/visual-regression.spec.ts`                                                         | No Nunito import left; metrics tabular; `health-nav-w10` label ≥11px passes; text never clips at 360 + 200% scale                                                                                                   | all goldens; `visual-regression.spec.ts` font list edit                           |
| P4  | Geometry, elevation, motion tokens | `designTokens.radius/elevation/springs/layout`, `motion.ts`, `useKeyboardFocusRing.ts` (`:focus-visible` only)                                                                                                                             | Radii ≤16 except circles; no shadow on ordinary cards; pointer click shows no ring, Tab shows 2px accent ring (`a11y.spec`, `a11y-audit-contract`)                                                                  | all goldens                                                                       |
| P5  | Icon system + emoji purge          | new `core/ui/Icon.tsx` (Ionicons outline map), migrate 97 MaterialIcons uses, replace emoji in chrome (Habits time-of-day, WorkoutSession, ValidationError, TodosScreen "✕ clear", BackgroundWarning, TodoAssociationPicker, HealthScreen) | No emoji in non-user-content JSX (lint rule → error); icon-font readiness list in `visual-regression.spec.ts` and `/material/` check in `e2e/helpers/a11yAudit.ts` updated to Ionicons; accessible labels unchanged | all goldens; `a11yAudit.ts` helper edit; `habits-w7` icon-picker labels unchanged |
| P6  | Primitives A: actions & inputs     | `Button` (+`tonal`), `IconButton`, `TextField`, `NumberStepperField`, `SegmentedControl`, `PillChip`                                                                                                                                       | Matches §6; `tests/uiTouchTargetContract.test.ts` green; one-primary rule documented in component JSDoc                                                                                                             | goldens with buttons/inputs (≈all)                                                |
| P7  | Primitives B: surfaces & lists     | `Card`, new `ListGroup`/`ListRow`, `SectionLabel`, `PageHeader` (no eyebrow dup), `EmptyStateCard`, `StatBlock`, `FeatureStatCard`, `SkeletonBlock`, `Screen` rhythm (group gap 24)                                                        | No header bands/tints in Card; PageHeader renders single title; `todos-convergence` row 48–56 and `habits-w7` row 48–64 still pass                                                                                  | all goldens; `todos-empty-360`                                                    |
| P8  | Overlays                           | `Modal` (dialog/bottom-sheet/drawer anatomy), `MenuSheet`, `useConfirmationDialog`, `InAppNoticeBanner`, `UpdateAvailableBanner`                                                                                                           | Radii 16, level3, pinned action bar; Settings/Command/QuickCapture still overlays; `settings.spec`, `pwa-update.spec` green                                                                                         | `quick-capture`, `settings-*`, `command-input`, `achievements`, `review-step1-*`  |
| P9  | Shell: tab bar + sidebar           | `app/index.tsx` tab bar/rail, capture slot, content width (`layout.dashboardMaxWidth`)                                                                                                                                                     | §6 Tabs/Sidebar; `health-nav-w10(-measure)` ≥44 targets and ≥11px labels at 360–412; rail breakpoints 899/900 behave as today; tablist name "Section tabs" unchanged                                                | all goldens (esp. `shell-today-1280/768`)                                         |
| P10 | Today / Overview                   | `features/overview/*`, Momentum Garden compact card                                                                                                                                                                                        | One hero, single stats card, no violet slab; "UP NEXT"/"Good evening" texts unchanged (tests key on them); `overview.spec`, `momentum-garden.spec` green                                                            | `shell-today-*` (5)                                                               |
| P11 | To Do                              | `features/todos/TodosScreen.tsx` + rows/composer                                                                                                                                                                                           | §7 To Do; "Add task" exact-button inventory = 1; `todos*.spec`, `todo-quickadd-durability` green                                                                                                                    | `todos-390-*`, `todos-long-title`, `todos-heavy-1280`, `todos-empty-360`          |
| P12 | Habits                             | `features/habits/*` (screen, day strip, detail sheet)                                                                                                                                                                                      | Day strip cells, ListGroups, neutral 0/x; `habits*.spec` (incl. ≤800ms check-in) green                                                                                                                              | `habits-390-light`, `habits-quantitative-detail`                                  |
| P13 | Focus                              | `features/pomodoro/*`                                                                                                                                                                                                                      | Idle = timer + segmented + one primary; settings in sheet; running state per W8 contract; `pomodoro*.spec` green                                                                                                    | `focus-idle-390-light`                                                            |
| P14 | Workout landing + routine detail   | `WorkoutScreen.tsx`, `RoutineDetailScreen.tsx`                                                                                                                                                                                             | No peach panels/rust fills; week ListGroup with menu; `workout-w9(-audit)` ≥40/44 targets, `workout-gym-v2` green                                                                                                   | `workout-landing-390-light`                                                       |
| P15 | Workout session                    | `WorkoutSessionScreen.tsx`                                                                                                                                                                                                                 | Set table §7; PR moment without emoji; `workout-w95`, `workout-editor-input-reliability`, `workout-snapshot-ordering` green                                                                                         | (no golden today — add `workout-session-390-light`)                               |
| P16 | Calories                           | `features/calories/*`                                                                                                                                                                                                                      | Hero with macros, neutral segmented, chip wrap ≤2 lines + More; `calories*.spec` (no clipping, SUR-07) green                                                                                                        | `calories-390-light/dark`                                                         |
| P17 | Settings modal                     | `features/settings/*`, `ThemePreviewCard`                                                                                                                                                                                                  | Grouped rows label·value·chevron; no narration paragraphs except sanctioned captions; `settings.spec`, `secondary-surface-w13`, `portable-backup.spec` green                                                        | `settings-top-390/1280`, `settings-backup-390`                                    |
| P18 | Command Center + Quick capture     | `features/command/*`, quick-capture in `app/index.tsx`                                                                                                                                                                                     | Palette anatomy; placeholders "What do you want to remember?" / "Add a todo…" unchanged; `command*.spec` green                                                                                                      | `command-input-390`, `quick-capture-390`                                          |
| P19 | Secondary surfaces + 12 themes     | Planning Hub, Weekly Review, Achievements, Progress/Activity, Health; `core/theme/themes/*` accent-variant rework                                                                                                                          | validate:themes ≥ baseline; `planning-w11/w12`, `weekly-review`, `gamification`, `theming` green                                                                                                                    | `plan-hub-*`, `review-step1-*`, `progress-details`, `timeline-*`, `achievements`  |
| P20 | Close-out                          | win32 golden regen on Windows, `VISUAL_AUDIT=1` re-capture to `docs/ui-ux/v4-audit/`, ledger close, lint rules → error                                                                                                                     | Full `npm run e2e:full` green on Linux CI + Windows; before/after board attached; Michael sign-off                                                                                                                  | win32 goldens (all 30)                                                            |

Order rationale: tokens first (P1–P5) make every later diff small and mostly mechanical; primitives (P6–P8) give each
screen phase only layout work; screens (P10–P18) are independent after P9 and can be parallelized across Pi sessions.

## 9. Decisions (recorded by Michael, 2026-10-29)

The brief's open questions are decided as follows; these are binding for P1–P20:

- **Brand identity — DECIDED:** violet is retired as the default look. It
  survives as the Focus section hue and as the "Royal Purple" theme. The
  alternative (keeping violet as the generic `accent`) is **not** taken: the
  interactive accent is indigo (`#3E63DD` / `#9EB1FF`) per §3/§5.
- **Font change — DECIDED:** add `@expo-google-fonts/inter` in **P3** (the
  dependency is accepted; run the repo's dependency health check in that PR —
  production-dependency advisory gate). Native bundle size +~300 KB accepted.
- **14 themes — DECIDED:** keep **all 14 theme IDs as accent variants** on the
  neutral system (§5.4). No theme is removed; pruning novelty themes stays a
  product decision outside this plan.
- **Golden churn — DECIDED:** regenerate the **linux** visual goldens
  deliberately per phase (`npm run visual:update` inside the phase PR, every
  diff image inspected). **win32 baselines are deferred to P20** (regenerated
  on Michael's Windows workstation, or the win32 comparison is temporarily
  skipped via the existing platform-scoped template until then).
- Copy deletions (doc-copy paragraphs in Settings/Command/Workout) remain
  sanctioned by 13 §5 but any string asserted by a spec must stay or be changed
  with that spec in the same PR.

## 10. Ledger

One entry per phase PR: what shipped, gate results, guardrail warning counts,
and visual-golden handling. Warning counts for the P0 guardrail rules are
recorded here and in the PR body; P20 turns the rules to `error` and folds
them into the main `eslint.config.mjs`. The guardrails are opt-in so the
`npm run lint` CI gate stays green: `npx eslint -c eslint.v4-guardrails.config.mjs core/ui features`.

| Phase                  | Date       | Branch / PR                | Shipped                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Gates                                                                                                                                                                                                                             | Visual goldens         |
| ---------------------- | ---------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| P0 — Spec + guardrails | 2026-10-29 | `ui/v4-p00-spec` (this PR) | This ledger (spec + decisions); OpenSpec change `ui-v4-visual-finish` (MODIFIED `ui-ux-visual-coherence`); three WARN `no-restricted-syntax` guardrails in the new opt-in `eslint.v4-guardrails.config.mjs` (imports `eslint.config.mjs`, which stays byte-identical to `main`, and appends the warn block; scoped to `core/ui/**` + `features/**` TSX) — run with `npx eslint -c eslint.v4-guardrails.config.mjs core/ui features` — raw `text-[Npx]` **27** warnings, raw Tailwind palette utilities **2**, emoji literals in UI text **5** (34 total, 0 errors). **Zero runtime diff** — no app code, tokens, themes, components, test assertions, or package files changed. | `openspec validate --all` pass · `npm run typecheck` pass · `npm run lint` pass (0 errors, 0 warnings — guardrails run separately via the opt-in config) · `npm run test:unit` pass · `npm run validate:themes` pass (140 checks) | none (no runtime diff) |
