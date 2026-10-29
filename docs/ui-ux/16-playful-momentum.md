# Playful Momentum — SuperHabits UI v2 design spec + delivery ledger

**Status:** ACTIVE (v2 canonical). **P0 shipped 2026-10-29.**
Owner: Michael Dale Palaca · Repo: `quantdale/super-habits` · Baseline: `origin/main` @ `b6761699` (2026-10-29)

This document is the adapted design brief v2 ("Playful Momentum") and is the **visual-values authority**: where it
disagrees with `13-calm-momentum-design-system.md` (amended per §9) or older `docs/ui-ux/*` files, **this document
wins** for visual values. `12-pop-design-system.md` is historical.

Supersedes `docs/ui-ux/16-v4-calm-momentum-finish.md` (neutral "Calm Momentum, finished" V4 — rejected as "too
professional") and the v1 working brief (neutral direction).
Owner ask: _"add some fun into it, kind of like a similar design dna to duolingo, brilliant, and other similar apps."_

Scope: **visual/UX only.** No domain, data, sync, backup, migration or routing changes. Every test ID, accessible
role/label, product-facing string, and the one global Add flow (`Add → Describe it`) stays exactly as it is.

Working artifacts (design workstation `/workspace/ui-overhaul/` — referenced by description only, never committed):

- `refs-v2/` — 16 Refero references + `SOURCES.md` (links, what to take) · `refs-v2/_candidates/` (~140 reviewed)
- `direction-v2.png` — contact sheet of 6 key refs + core color tokens (regenerate: `tools/make_direction_v2.py`)
- `current/` — 26 "before" captures of `main` (1280×800 + 390×844) · `tools/uiaudit-visual-regression.spec.ts` capture harness
- `BRIEF.v1.md`, `refs/`, `direction.png` — the rejected neutral direction, kept for the record

---

## 1. What makes Duolingo / Brilliant (and Finch, Headspace, Forest, Streaks, Elevate) work

Observed in `refs-v2/` (Duolingo, Brilliant, Headspace, Atoms, Roots, Nike, Ahead). Finch, Forest, Streaks, Elevate and
Habitica are not in Refero's catalog. The notes on them below come from general knowledge, not from screenshots.

1. **White canvas, loud objects.** The page is plain white or charcoal. All the color lives in a few chunky objects:
   buttons, path nodes, progress bars, badges. That is why it feels fun and still clean. (`01`, `04`, `08`)
2. **Pressable 3D, not gradients.** Buttons, option rows and nodes are **flat solid fills with a darker bottom "lip"**
   (≈4px). Pressing pushes the face down into the lip. Cards use a 2px light border plus a 2–4px bottom border. There
   are no blurry drop shadows and no gradients. (`01`, `03`, `04`, `05`)
3. **A small, saturated, harmonious palette.** About six bright hues at similar lightness. Each hue has one job: green
   means go/correct, blue means info, gold means XP/rewards, orange means streak, purple means premium/special. Headspace
   gives each category one flat hue. (`14`)
4. **Rounded, heavy, friendly type.** Duolingo uses Feather Bold for headlines and DIN Next Rounded for UI. Titles and
   numbers are heavy (800), body text is calm (500–600), and the scale stays small and strict.
5. **A character and illustrations at the right moments.** The mascot appears in onboarding, celebrations and empty
   states, and stays out of operational rows. Brilliant uses simple isometric 3D objects. Finch uses a pet that grows
   with self-care. (`02`, `08`, `15`)
6. **Progress you can see.** Duolingo has a path of nodes and Brilliant a node map. Forest grows a tree and Roots shows a
   landscape. Thick bars and rings show progress, and every action visibly moves something. (`01`, `09`, `12`)
7. **Celebrations sized to the achievement.** A tiny pop and haptic for each check, a "+XP" float for a quest, and a
   full-screen moment only for streak milestones and level-ups. (`02`, `07`, `16`)
8. **Big, forgiving targets.** 48–56px buttons, full-width option rows, one obvious CTA pinned at the bottom. (`03`)
9. **Patterns we deliberately do NOT copy:** Duolingo's guilt (the crying mascot, "you'll lose your streak!"
   notifications), hearts/lives as punishment, leaderboards against strangers, and gem shops. These conflict with
   design DNA P6/P7 and the Momentum Garden spec.

## 2. Vision constraints kept (from the repo docs)

- **One question per screen** (13 §2): Today → _What matters today?_ · To Do → _What do I need to do?_ · Habits → _Did
  I do today's check-ins?_ · Focus → _Am I focusing right now?_ (calmest screen) · Workout → _What am I training and
  logging right now?_ · Calories → _What did I eat / what's left today?_
- **One dominant action per state** (02 P3). In v2 this is literally _the one chunky colored button_.
- **Never imply moral failure** (02 P7, momentum-garden spec): zero and missed states are neutral. The garden never
  wilts and the mascot is never sad. Streak copy celebrates returning ("Welcome back — day 1 of a new run").
- **Momentum Garden is the growth metaphor** (02 §1). It becomes the visual spine: the mascot lives there, the Today
  path leads into it, and celebrations plant things in it.
- **Reward the behavior, not app opening** (02 P6) and healthy engagement only. XP comes only from real actions (the
  existing ledger). No streak-loss threats, no random rewards, no dark patterns.
- **Section color is an identity, applied with discipline** (02 P2). Each section owns one hue, but surfaces stay
  white/charcoal.
- **Contracts:** six nav labels unchanged; Settings and Command Center stay overlays; 14 theme IDs kept;
  `validate:themes` ≥ baseline; and the test-enforced limits in §8.

## 3. Direction in 5 bullets

1. **White canvas, chunky color objects.** Plain white (charcoal in dark mode) with 2px-border cards. All the color goes
   into pressable 3D buttons, nodes, bars and badges.
2. **The "Sprout" palette.** Brand Sprout green (growth/garden), plus Sky (To Do), Grape (Focus), Coral (Workout),
   Berry (Calories) and Lagoon (Health). Gold is for XP and Flame for streaks. Every hue has a _bright_ fill for shapes,
   a _solid_ (white-label, AA-contrast) variant for buttons and text, and a _lip_ for depth.
3. **Keep Nunito, disciplined.** Nunito stays (it is already installed and close to DIN Round). Headings, buttons and
   numbers use 800, body 600, and 900 only for celebration numbers. Eight roles, sentence case.
4. **The garden as a game world.** A "Today path" of round 3D nodes (today's quests and plan) leads into the Momentum
   Garden. "Sprout", a seedling mascot drawn in SVG, appears in empty states, celebrations and onboarding, never in
   operational rows.
5. **Celebrations sized to the achievement.** On a check-in: pop + light haptic. On a quest: "+XP" float + chime (sounds
   already exist). On a streak milestone or level-up: a full-screen moment of at most 2.8s that can be dismissed
   anywhere. All animation is built on the installed Reanimated 4 and respects reduced motion.

## 4. Design principles (v2)

1. **Fun is in the objects, calm is in the canvas.** Never tint the page or nest colored cards. Color belongs to things
   you can press or things that show progress.
2. **One hue per job.** A hue says which section (or which reward) something belongs to. Avoid rainbow rows. A screen
   uses its own section hue plus Gold/Flame for rewards, and nothing else.
3. **Everything pressable looks pressable.** Every primary or secondary action and every selectable option has the lip.
   Static information has no lip.
4. **Juice follows causality** (02 P5). Feedback starts from the control that was touched and is proportional to the
   achievement.
5. **The garden grows, it never dies.** Progress only accumulates. Absence shows as rest ("Sprout is napping"), not
   decay.
6. **Big and forgiving.** Targets of 48px or more, primary CTA 52px, generous spacing. Dense operational screens
   (Workout session, Calories form) keep their density and drop the decoration.
7. **Character with restraint.** The mascot gets at most one appearance per screen, and only in hero, empty or
   celebration contexts.
8. **Every playful moment has a calm fallback**: reduced motion, sound off, haptics off (existing settings).

## 5. Token system

Contrast was computed with the repo's WCAG formula (`core/theme/contrast.ts` / `scripts/validate-theme-contrast.mjs`).
The existing checks: `buttonText` on `button`/`buttonHover`/`buttonActive` ≥4.5, `text`/`textMuted` on surfaces ≥4.5,
`accent` on surface ≥4.5, `primary` on surface ≥3 (non-text). All values below pass them.

### 5.1 Section and reward hues (`constants/sectionColors.ts`, `tailwind.config.js`)

Each hue has three tiers:

- **bright** is for shapes, nodes, bars, rings, illustrations and icons. Never put white text on it.
- **solid** is the button face (white label) and the colored-text color in light mode.
- **lip** is the pressable depth under a solid.

`tint` = bright mixed 14% into white for light mode, or 18% into `#1A1F2B` for dark mode.

| Key (role)                            | bright                    | solid (light)                                    | white on solid | lip       | tint L    | solid on tint | tint D    | bright on surface D | ink `#10131A` on bright (dark button) |
| ------------------------------------- | ------------------------- | ------------------------------------------------ | -------------- | --------- | --------- | ------------- | --------- | ------------------- | ------------------------------------- |
| `brand` + `habits` — **Sprout**       | `#4DC93A`                 | `#1A7F2B`                                        | 5.10           | `#135B1F` | `#E6F7E3` | 4.56          | `#233E2E` | 7.63                | 8.61                                  |
| `todos` — **Sky**                     | `#2FA8F7`                 | `#1769D8`                                        | 5.19           | `#114C9C` | `#E2F3FE` | 4.57          | `#1E3850` | 6.33                | 7.14                                  |
| `focus` — **Grape**                   | `#A37BFF`                 | `#6F45E6`                                        | 5.72           | `#5032A6` | `#F2EDFF` | 5.00          | `#333051` | 5.36                | 6.05                                  |
| `workout` — **Coral**                 | `#FF6A4D`                 | `#BF351E`                                        | 5.61           | `#8A2616` | `#FFEAE6` | 4.85          | `#432C31` | 5.82                | 6.57                                  |
| `calories` — **Berry**                | `#FF6FAE`                 | `#C02670`                                        | 5.60           | `#8A1B51` | `#FFEBF4` | 4.91          | `#432D43` | 6.38                | 7.20                                  |
| `health` — **Lagoon**                 | `#22CCB8`                 | `#0B7A72`                                        | 5.20           | `#085852` | `#E0F8F5` | 4.68          | `#1B3E44` | 8.16                | 9.20                                  |
| `danger` — **Cherry**                 | `#FF5A5F`                 | `#C9283A`                                        | 5.46           | `#911D2A` | `#FFE8E9` | 4.67          | `#432A34` | 5.40                | 6.09                                  |
| reward `accent` (XP/level) — **Gold** | `#FFC81F`                 | ink label `#1F2430` (10.0)                       | —              | `#E0A800` | `#FFF7E0` | ink 14.5      | `#433D29` | 10.62               | 11.98                                 |
| reward `streak` — **Flame**           | `#FF9A1F`                 | ink label (7.3) · text `#B34D00` (5.28 on white) | —              | `#D97A00` | `#FFF1E0` | —             | `#433529` | 7.76                | —                                     |
| reward `frozen` — **Ice**             | `#5CCBFF`                 | text `#0B6E99` (5.67)                            | —              | `#2FA3D9` | `#E8F8FF` | —             | `#263E51` | 8.98                | —                                     |
| reward `badge`                        | Gold (as above)           | text `#9A5B00` (5.43)                            |                |           |           |               |           |                     |                                       |
| reward `day` / `quest`                | Sprout / Grape (as above) |                                                  |                |           |           |               |           |                     |                                       |

Rules:

- On a section screen, its **primary CTA** uses that section's solid with its lip. Today, Settings and global actions
  use Sprout.
- Gold and Flame appear only on reward elements (XP bar, streak chip, badges, celebrations).
- Calories moves from amber to Berry so it no longer collides with Gold/Flame. Workout becomes Coral, which reads
  clearly apart from Flame (`#FF9A1F`) at node size.
- User-chosen habit colors (data, e.g. `#ef4444`) render as the habit's node or check fill only, never as text.

### 5.2 Neutrals — light (`themes/light.ts`)

| Token                                   | Value                                                  | Contrast / notes                                                        |
| --------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| `background`                            | `#FFFFFF`                                              | Duolingo-style white canvas                                             |
| `surface`                               | `#FFFFFF`                                              | cards are defined by their 2px border, not by fill                      |
| `surfaceElevated`                       | `#FFFFFF`                                              | sheets and dialogs (+ elevation)                                        |
| `surfaceSunken`                         | `#F3F5F9`                                              | input wells, bar tracks, inactive segments, locked nodes                |
| `surfaceHover` / `surfaceActive`        | `#F7F8FB` / `#EDF0F5`                                  |                                                                         |
| `border`                                | `#E3E6EE`                                              | 2px card and option outline                                             |
| `borderStrong` (**card lip**)           | `#D5DAE3`                                              | bottom border of pressable cards and secondary buttons                  |
| `text`                                  | `#1F2430`                                              | 15.5 on white, 14.2 on sunken                                           |
| `textMuted`                             | `#5B6475`                                              | 5.96 on white, 5.46 on sunken                                           |
| `textSubtle` (new)                      | `#656D80`                                              | 5.18 on white, 4.75 on sunken; placeholders and meta                    |
| `iconMuted`                             | `#9AA2B1`                                              | inactive/decorative icons only (non-text)                               |
| `primary` (non-text marks)              | `#1A7F2B`                                              | 5.1 on white (passes the ≥3 check)                                      |
| new `primaryBright`                     | `#4DC93A`                                              | shapes/nodes; never text                                                |
| `button` / `buttonText`                 | `#1A7F2B` / `#FFFFFF`                                  | 5.10                                                                    |
| `buttonHover` / `buttonActive`          | `#17742A` / `#135B1F`                                  | 5.89 / 8.26 with white                                                  |
| new `buttonLip`                         | `#135B1F`                                              |                                                                         |
| `secondary` (secondary button face)     | `#FFFFFF` + 2px `border` + lip `borderStrong`          | label `#1769D8` (Sky solid) or `text`                                   |
| `accent` (links, focus ring, selection) | `#1769D8`                                              | 5.19 on white                                                           |
| `chipBackground` / `chipBorder`         | `#FFFFFF` / `#E3E6EE`                                  | selected chip = section tint bg + section solid 2px border + solid text |
| `overlayScrim`                          | `rgba(16, 19, 26, 0.55)`                               |                                                                         |
| `tabRail` / `tabRailBorder`             | `#FFFFFF` / `#E3E6EE` (2px top)                        |                                                                         |
| `shadowColor`                           | `#10131A`                                              | only for level3                                                         |
| `brandGradient`                         | `['#4DC93A', '#4DC93A']`                               | type kept; renders flat (gradients retired outside celebration)         |
| `glow`                                  | `transparent`                                          | retired                                                                 |
| status success                          | = Sprout (solid `#1A7F2B`, bg `#E6F7E3`)               |                                                                         |
| status warning                          | Gold (bg `#FFF7E0`, text `#9A5B00`)                    |                                                                         |
| status danger                           | Cherry (solid `#C9283A`, text `#C9283A`, bg `#FFE8E9`) | write failures and destructive confirms only                            |
| `webThemeColor` / `statusBarStyle`      | `#FFFFFF` / `dark`                                     |                                                                         |

### 5.3 Neutrals — dark (`themes/dark.ts`)

| Token                                        | Value                                                     | Contrast / notes                                     |
| -------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| `background`                                 | `#131722`                                                 | blue-charcoal, not indigo-plum                       |
| `surface`                                    | `#1A1F2B`                                                 |                                                      |
| `surfaceElevated`                            | `#232938`                                                 |                                                      |
| `surfaceSunken`                              | `#0F121A`                                                 |                                                      |
| `surfaceHover` / `surfaceActive`             | `#202635` / `#2A3142`                                     |                                                      |
| `border` / `borderStrong` (lip)              | `#2E3546` / `#0B0E14`                                     | the lip is darker than the surface                   |
| `text`                                       | `#F4F6FB`                                                 | 15.2 on surface, 16.6 on canvas                      |
| `textMuted`                                  | `#AAB2C3`                                                 | 7.7 on surface, 6.8 on raised                        |
| `textSubtle`                                 | `#8A93A6`                                                 | 5.3 / 4.7                                            |
| `iconMuted`                                  | `#6D7690`                                                 | non-text                                             |
| `primary`                                    | `#4DC93A`                                                 | 7.6 on surface                                       |
| `button` / `buttonText`                      | `#4DC93A` / `#10131A`                                     | 8.61. Dark buttons are bright fill with an ink label |
| `buttonHover` / `buttonActive` / `buttonLip` | `#5AD447` / `#3DB52C` / `#1A7F2B`                         | ink 9.68 / 6.94                                      |
| `accent`                                     | `#2FA8F7`                                                 | 6.33                                                 |
| section buttons (dark)                       | bright fill + ink `#10131A` label, lip = light-mode solid | see the §5.1 last column                             |
| `overlayScrim`                               | `rgba(0, 0, 0, 0.65)`                                     |                                                      |
| `webThemeColor` / `statusBarStyle`           | `#131722` / `light`                                       |                                                      |

### 5.4 Themes

Keep all 14 IDs. `light`/`dark` adopt 5.2/5.3. The other 12 keep their canvas character and become **brand-hue swaps**:
each theme replaces Sprout as `button`/`primary` with its own solid/bright/lip triple. It still has to pass ≥4.5
`buttonText` on `button`. Section hues stay the same in every theme unless the theme has a `sectionOverrides` entry.
Nord still asserts `--sh-background` `#2e3440` (`theming.spec.ts`). Add contrast checks for `textSubtle` and
`buttonText` on `buttonLip`.

### 5.5 Typography — keep Nunito (decision)

Alternatives considered:

- **Fredoka**: great chunky display, weak body text, would be a new dependency.
- **Baloo 2**: too cartoonish.
- **Varela Round**: single weight.
- **Quicksand**: too thin.
- **M PLUS Rounded 1c**: heavy download.

Nunito is a free rounded sans that sits close to DIN Next Rounded. It is already installed
(`@expo-google-fonts/nunito`), and `e2e/visual-regression.spec.ts` already awaits its faces. So: **no new font
dependency**. Fun comes from weight and size discipline, not more families. Optional later experiment: Fredoka for
`display` only (one dependency), not in this plan.

| Role           | Size / line     | Family (weight)                | Tracking                | Use                                                                                 |
| -------------- | --------------- | ------------------------------ | ----------------------- | ----------------------------------------------------------------------------------- |
| `display`      | 40 / 44         | `Nunito_900Black`              | −0.5                    | celebration numbers (streak 30, Level 4)                                            |
| `metric`       | 30 / 36         | `Nunito_800ExtraBold`, tabular | −0.3                    | kcal left, timer (idle 56/60 = `metricLg`), totals                                  |
| `titleXl`      | 28 / 34         | 800                            | −0.3                    | hero titles, empty-state headline                                                   |
| `titleLg`      | 24 / 30         | 800                            | −0.2                    | screen title                                                                        |
| `titleMd`      | 18 / 24         | 800                            | 0                       | card, sheet and group titles                                                        |
| `bodyLg`       | 17 / 24         | 600 (`Nunito_600SemiBold`)     | 0                       | inputs, primary reading                                                             |
| `bodyMd`       | 15 / 22         | 600; row titles 700            | 0                       | rows                                                                                |
| `button` (new) | 16 / 20 (lg 17) | 800                            | +0.2, **sentence case** | button labels. No CSS uppercase, so accessible names and `getByText` stay identical |
| `label`        | 13 / 18         | 700                            | +0.1                    | chips, tabs (tab 12/16, ≥11 test), badges                                           |
| `caption`      | 12 / 16         | 600                            | 0                       | metadata                                                                            |

Bans: raw `text-[9–11px]` and `text-xs/sm` on product text (lint), weight 400 (looks thin next to 800), uppercase
eyebrows (one `label` overline per screen allowed, e.g. "UP NEXT", which stays because tests assert it).

### 5.6 Spacing, layout, radii

- Spacing scale unchanged: `4/8/12/16/24/32/48`. Page gutter 16 / 24 / 32 (`pageGutterForWidth`). Group gap 24, inside
  a group 12, card padding 16 (hero 20).
- Content max width 640 (phone-like column on desktop, centered). Dashboard ≥1280 uses a 2-column grid of max 1040.
- **Radii** (playful but systematic): `xs 8` (checkbox, tag) · `sm 12` (inputs, chips-rect, small buttons) ·
  `md 16` (buttons, option rows, list cards) · `lg 20` (cards, hero) · `xl 28` (sheets top, dialogs, celebration card) ·
  `full` (nodes, avatars, pills, capture button).
- Row heights: todo row 52 (tests 48–56); habit row 60 (tests 48–64); option row 56; set-log row 48. Tap targets ≥ 48
  for checks/primary actions, ≥ 44 elsewhere.

### 5.7 Depth and elevation (pressable system)

| Token              | Spec                                                                           | Use                                                |
| ------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------- |
| `depth.lip.lg`     | 4px solid `lip` under the face                                                 | lg buttons (52 + 4), path nodes (64 + 6 for nodes) |
| `depth.lip.md`     | 3px                                                                            | md buttons (44 + 3), option rows                   |
| `depth.lip.sm`     | 2px                                                                            | sm buttons, chips that toggle                      |
| `depth.card`       | 2px `border` all round + 4px `borderStrong` bottom                             | pressable cards (habit card, routine card, quest)  |
| `depth.flat`       | 2px `border` all round, no lip                                                 | static info cards (stats, macros)                  |
| pressed            | face `translateY = lip`, lip collapses to 0, 80ms                              | every pressable above                              |
| disabled           | face `surfaceSunken`, label `textSubtle`, lip `border`                         |                                                    |
| `elevation.level3` | `0 12 32 rgba(16,19,26,0.18)` (light); dark = `surfaceElevated` + 2px `border` | sheets, dialogs, celebration card only             |

There are no blur shadows on cards, no colored glows, no gradients on surfaces. One exception: celebration
backgrounds may use a two-stop **same-hue** radial (bright→solid) behind the mascot.

Implementation: `core/ui/Pressable3D.tsx` = outer `View` (lip color, radius) → `Animated.View` face with
`marginBottom: lip`. A Reanimated shared value drives `translateY` and the lip height. On web it is the same tree
(RN-web), so there is no CSS-only fork.

### 5.8 Motion and celebration (`core/theme/motion.ts`)

Installed and usable: `react-native-reanimated` 4.2.1 + `react-native-worklets` 0.7.4 (barely used today:
`app/index.tsx` only), `react-native-gesture-handler`, `react-native-svg` 15.15.3, `expo-haptics`, `expo-audio`,
`expo-linear-gradient`. **Existing reward plumbing:** `lib/rewardFeedback.ts` (tiers `light`/`success`/`milestone`,
haptics + chimes `assets/sounds/reward-{quest,level}.wav`, user toggles in Settings → Accessibility) and
`RewardCelebrationOverlay.tsx` (top banner, 16 confetti, 2.8s auto-dismiss). **No new animation, sound or haptics
dependency is needed.** Lottie is not installed and not proposed; all illustration motion is SVG + Reanimated.

| Moment                                                       | Trigger (existing tier)   | Motion                                                                                                                                                      | Duration                            | Feedback                       |
| ------------------------------------------------------------ | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------ |
| Press                                                        | any Pressable3D           | face down by lip, `withTiming`                                                                                                                              | 80ms down / 120ms up                | —                              |
| Check-in / todo done                                         | `light`                   | check node scale 1→1.2→1 (`withSpring` damping 12, stiffness 320) + 6-dot burst in section bright + row tint flash                                          | ≤400ms                              | light haptic, no sound         |
| "+XP" float                                                  | XP awarded on that action | "+10" `label` in Gold rises 24px and fades                                                                                                                  | 600ms                               | —                              |
| Progress bar fill                                            | value change              | `withTiming` 450ms `Easing.out(cubic)` + one 300ms highlight sweep                                                                                          | 450ms                               | —                              |
| Quest complete                                               | `success`                 | quest card stamps a check, chest wobble ±6° ×2                                                                                                              | 700ms                               | success haptic + quest chime   |
| Streak +1                                                    | first activity of day     | Flame chip bumps 1→1.15, number rolls up                                                                                                                    | 500ms                               | —                              |
| Milestone (streak 3/7/14/30…, level-up, badge, complete day) | `milestone`               | existing overlay becomes a **celebration card** (radius 28, mascot "cheer" pose, `display` number, one CTA "Keep going"), confetti 24 pieces in reward hues | auto-dismiss 2.8s, dismiss anywhere | milestone haptic + level chime |
| Garden grows                                                 | new contribution          | the new plant scales from 0 with a soft spring and leaves sway once                                                                                         | 800ms                               | —                              |
| Ambient                                                      | —                         | mascot idle "breath" (scale 1→1.02) **only** in the Garden and empty states; stops after 3 cycles                                                           | 3×2s                                | —                              |

Reduced motion (`useReducedMotion()` + OS setting): no translate, scale or confetti. Opacity cross-fade of 120ms only.
Sound and haptics follow the existing toggles. Celebrations never block input (keep `pointerEvents: box-none`).

### 5.9 Iconography and illustration

- **UI icons:** keep `MaterialIcons` _rounded-style glyphs_ for ordinary controls. This keeps
  `e2e/helpers/a11yAudit.ts` icon-font detection and the visual spec's icon-font readiness unchanged.
- **Hero icons (new, SVG):** about 14 duotone icons in `core/ui/illustrations/icons/`: 6 tabs (Today sun-path, To Do
  check-list, Habits sprout, Focus timer-leaf, Workout dumbbell, Calories bowl) plus flame, XP bolt, freeze shield,
  trophy, chest, badge ribbon, seedling, garden. Each is a 2-tone flat shape (bright + lip) on a 24/32/48 grid.
- **Mascot "Sprout":** a seedling with a round face growing out of the Momentum Garden. Built from simple SVG geometry
  (react-native-svg) with 5 poses: `idle`, `cheer`, `nap` (rest/empty, never sad), `think` (empty search/command),
  `proud` (milestone). Used at most once per screen.
- **No emoji in UI chrome** (habit time-of-day ☀️⛅🌙🔄, 🎉🏆🏋️, ⚠️). They are replaced by hero icons or MaterialIcons.
  User content can still contain emoji.

## 6. Component standards (`core/ui`)

| Component                            | Standard                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Pressable3D** (new)                | The single depth primitive (§5.7), with props `lip`, `faceColor`, `lipColor`, `radius`. Used by Button, OptionRow, PathNode, pressable Card. Handles reduced motion and the web `:focus-visible` ring (2px `accent`, offset 3).                                                                                                                                                                                                                                                                                    |
| **Button**                           | Sizes `sm 36+2`, `md 44+3`, `lg 52+4` (lip), radius 16 (sm 12). `primary` = section/brand solid face + white label (dark: bright + ink) + lip. `secondary` = white face, 2px `border`, `borderStrong` lip, label = section solid. `ghost` = text-only in section solid. `danger` = Cherry. `celebrate` = Gold face, ink label, Gold lip (reward CTAs only). Label role `button`, sentence case, icon 20 + gap 8. Full-width on phone for screen CTAs, pinned above the tab bar when it is the screen's one action. |
| **IconButton**                       | 44×44 + 2 lip, white face, 2px border, radius 14, 22px icon in `textMuted`; header actions use the flat variant (no lip).                                                                                                                                                                                                                                                                                                                                                                                          |
| **OptionRow** (new)                  | Duolingo "goal commit" (`refs-v2/03`): full-width 56px, radius 16, white face + 2px border + 3px lip; selected = section tint face, 2px section-solid border, solid-color lip, trailing check badge. Used for theme, preset, quick-capture type, routine pick, meal pick.                                                                                                                                                                                                                                          |
| **Chip**                             | 32px, radius full, 2px border, `label` 13/700; selected = section tint + section solid border/text. At most one row; overflow goes to a "More" sheet.                                                                                                                                                                                                                                                                                                                                                              |
| **SegmentedControl**                 | 40px track `surfaceSunken` radius 14; thumb = white Pressable3D (2px lip) with `label` in section solid.                                                                                                                                                                                                                                                                                                                                                                                                           |
| **TextField**                        | 52px, radius 12, `surfaceSunken` face + 2px transparent border; focus = 2px `accent` border + white face; label `label` 13/700 above; error = Cherry text + icon.                                                                                                                                                                                                                                                                                                                                                  |
| **NumberStepper**                    | Field with two 40px round Pressable3D +/- in section bright with ink glyph.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Card**                             | `depth.flat` (static) or `depth.card` (pressable), radius 20, padding 16, white. Header = `titleMd` + optional hero icon 32 on the left. `hero` variant (≤1/screen) = section **bright** face with ink text or **solid** face with white text, plus mascot/illustration slot, radius 20. No tinted bodies, no nested cards.                                                                                                                                                                                        |
| **ListRow / ListGroup**              | Group = one `depth.flat` card with hairline (1px `border`) dividers; rows 52–60, leading 40px icon tile (section tint + solid glyph) or check node.                                                                                                                                                                                                                                                                                                                                                                |
| **CheckNode** (new)                  | 32px circle (48 hit), 2px `border` + 2px lip. Done = section bright fill, white ✓ glyph, lip = solid; plays the check-in burst. Quantitative = ring progress around the node.                                                                                                                                                                                                                                                                                                                                      |
| **PathNode** (new)                   | 64px circle Pressable3D (6px lip). States: done (section bright + check), current (bright + white ring pulse ×1 + "Start" tooltip bubble), upcoming (`surfaceSunken` + `iconMuted` glyph, lip `border`), reward (chest / garden icon in Gold). Labels sit beside the node, `bodyMd` 700.                                                                                                                                                                                                                           |
| **ProgressBar**                      | 14px tall, radius full, track `surfaceSunken`, fill section bright with a 4px lighter top highlight (`rgba(255,255,255,0.35)`), optional value label inside on the right. XP bar uses Gold. Ring: 10px stroke, round caps.                                                                                                                                                                                                                                                                                         |
| **StreakChip / XpChip** (new, shell) | 32px pill: flame icon + count in Flame text / bolt + XP in Gold-ink. Tap opens Achievements (existing label "Level & Streaks card — open achievements" kept on its card).                                                                                                                                                                                                                                                                                                                                          |
| **PageHeader**                       | `titleLg` 800 left, optional `caption` date, flat IconButtons right. On Today, the top row also shows StreakChip + XpChip.                                                                                                                                                                                                                                                                                                                                                                                         |
| **Tabs (bottom bar)**                | 64 + safe area, white, 2px top border. 6 destinations + center capture. Each tab = 48px tile: hero icon 28 (inactive = monochrome `iconMuted` version; active = full duotone section colors) + label 12/16 700 (≥11 test). Active tile = section tint bg radius 14 + 2px section-bright border (Duolingo active tab box). Capture = 52px round Sprout Pressable3D with a white "+".                                                                                                                                |
| **Sidebar (≥900)**                   | 900–1279: 80px rail of the same tiles. ≥1280: 248px sidebar with logo + mascot mark, 48px rows (hero icon 28 + `bodyMd` 800 label), active = tint + 2px bright border radius 14, Sprout "Add" lg button at the top, StreakChip/XpChip at the bottom.                                                                                                                                                                                                                                                               |
| **Sheet / Dialog**                   | Sheet radius 28 top, 5px handle, title `titleMd` 800 centered, close = flat IconButton, pinned full-width primary lg button. Dialog max 440, radius 28, level3, mascot slot optional.                                                                                                                                                                                                                                                                                                                              |
| **Celebration card**                 | The existing `RewardCelebrationOverlay` keeps its top-anchored, non-blocking behavior, restyled: radius 28 card, reward hue bright face, mascot pose, `display` number, `bodyMd` line, Gold `celebrate` CTA.                                                                                                                                                                                                                                                                                                       |
| **Empty state**                      | Mascot pose 120px (`nap`/`think`), `titleMd` one friendly sentence, `caption`, one primary lg button. Never guilt copy.                                                                                                                                                                                                                                                                                                                                                                                            |
| **Toast**                            | 48px pill at the bottom above the tab bar, `text` on white with 2px border + lip, leading hero icon, ≤2s.                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Charts**                           | Bars radius 8 top, section bright, track sunken; heatmap = 5-step ramp tint→bright, done cells get a 2px lip; no gridlines except one baseline; numbers 800 tabular.                                                                                                                                                                                                                                                                                                                                               |

## 7. Per-screen redesign notes (with references)

**Shell.** Refs: Duolingo tab bar (`01`, `04`), Headspace hue-per-section (`14`). White canvas, 2px-border tab bar
with duotone hero icons and an active tinted tile. Sprout capture button. Desktop gets a sidebar with the same tiles.
The Streak and XP chips live in the Today header (phone) and the sidebar footer (desktop).

**Today / Overview** — _What matters today?_ Refs: Duolingo path (`01`), Brilliant "for you" (`08`), Duolingo quests
(`04`).

- Header "Good evening" (string kept) + Streak/XP chips.
- **Hero = Up next card** (`hero` in Sky bright, ink text): "UP NEXT" overline kept, task title `titleLg`, reason as
  caption, Sky primary "Open To-Do" lg button. Sprout peeks from the card corner (`idle`).
- **"Today's path"**: the 3 daily quests (existing `QuestRow` data) + Today's plan + the garden as 4–5 PathNodes
  zig-zagging down. This is a presentation of existing quest/plan state, so no new data.
- Glance stats as one `depth.flat` card of 5 tiles with hero icons in section bright.
- The Level & Streaks card (label kept) uses Gold XP bar + Flame count.
- Momentum Garden card: illustrated art (`12` mood) with "Your garden is ready for today" neutral state kept.
- Desktop: path + hero on the left, garden and level on the right.

**To Do** — _What do I need to do?_ Ref: Duolingo quests card rhythm (`04`); keep density.

- Title "To Do" with no eyebrow duplication; summary as one caption (overdue in Cherry text).
- Composer = sunken TextField + 52px Sky round Pressable3D "+" (the "Add task" button stays exactly one).
- Rows 52 inside ListGroups ("Today", "Upcoming", "Someday" if they already exist): CheckNode in Sky, title 700,
  caption meta, Urgent as a small Cherry tag.
- On complete: check burst + "+XP" float, then the row slides into "Completed" (collapsed group).
- Empty: Sprout `nap` + "Nothing on your plate. Enjoy it!" + Add task.

**Habits** — _Did I do today's check-ins?_ Refs: Atoms flames (`11`), Brilliant path (`09`), Duolingo achievements
(`05`).

- Day strip = 7 round 44px day nodes (done day = Sprout bright + lip; today = 2px Sprout ring), not pills.
- Time-of-day groups get hero icons instead of emoji.
- Habit row 60 = habit-color icon tile, name 800, schedule caption, trailing CheckNode 48 (binary) or ring node with
  "2/8" (quantitative, + button). 0/x neutral.
- Check-in plays the burst + Flame bump when it extends the streak.
- Detail sheet: Flame hero with `display` streak count, month heatmap, best-streak tile, "Welcome back" copy after a
  gap.

**Focus** — _Am I focusing right now?_ (calmest) Refs: Headspace (`13`), Forest grows-a-tree concept (public
knowledge).

- Idle: Grape `hero` card with a big `metricLg` timer and a small Sprout-sapling illustration that **grows in discrete
  stages at 25/50/75/100%** of the session (static between stages; an event, not ambient motion).
- One Grape lg "Start focus". Mode = SegmentedControl. Presets as OptionRows in a sheet.
- Running: timer + 12px ring + Pause (secondary) and End (ghost) only, as in the W8 contract.
- Finish: sapling is planted in the garden (Garden grows moment) + `success` feedback.

**Workout landing** — _What am I training?_ Refs: Nike milestone (`16`), Brilliant path (`09`).

- Status hero in Coral: "Rest day" or "Routine 2 today" with one Coral lg CTA ("Choose a routine" / "Start").
- Quick start as pressable routine cards (`depth.card`) with a dumbbell hero icon.
- "This week" = 7 day nodes in a row (done = Coral bright check, rest = moon icon sunken, planned = outline) with a day
  sheet for assigning. The two bordered boxes per row go away; assignment labels are kept.

**Workout session.** Operational: decoration off. Refs: Train set table (v1 `refs/07`).

- Sticky header (timer tabular 800 + Coral "Finish").
- Exercise cards `depth.flat`, set rows 48 with sunken inputs and a CheckNode in Coral (pop, light haptic, no XP float
  mid-session).
- Finish → PR/milestone celebration card (trophy hero icon, no emoji).

**Calories** — _What's left today?_ Ref: Duolingo quests bars (`04`); FoodNoms structure (v1 `refs/05`).

- Hero `depth.flat` card: "1,400 kcal left" `metric`, Berry 14px bar, macros as three labeled mini bars, all in Berry (one hue per screen).
- Form/Diary SegmentedControl.
- Form: fields + one Berry lg "Add".
- Frequent foods as 2-line chip wrap; quick kcal amounts as sm Pressable3D buttons.
- Diary: meals as ListGroups with subtotal; logging an entry gives a light pop only.

**Settings.** Ref: Duolingo profile/settings (`06`).

- Sheet with bold `titleMd` group titles; rows in `depth.flat` groups.
- Theme picker = OptionRows with live mini-previews.
- Sounds/Haptics toggles (existing) use a chunky switch (Sprout track, white knob with lip).
- No narration paragraphs.

**Command Center + Quick capture.** Ref: Brilliant speech-bubble recommendation (`08`).

- Quick capture: title field first.
- Type picker = a row of 6 OptionRow-style tiles with hero icons (Task/Habit/Calorie/Project/Goal/Focus, labels kept)
  that take their section color when selected.
- Sprout primary "Capture", ghost "Describe it".
- Command Center: Sprout `think` with a speech bubble ("Tell me what to add") above an input-first field, example chips
  while empty, and the Sprout primary run button enabled once there is input.

**Gamification surfaces** (Achievements, LevelHero, XpBar/XpRing, QuestRow, WeekStrip, BadgeGrid). Refs: Duolingo
achievements/quests (`04`, `05`), Brilliant league (`10`, used only for layout).

- Badge tiles = hexagon/ribbon hero icons in tier colors (Bronze `#D0874A`, Silver `#AAB2C3`, Gold `#FFC81F`, Platinum
  `#5CCBFF`) with a lip. Locked = sunken monochrome, with no "missing" language.
- QuestRow = `depth.card` with a Gold progress bar + chest.
- WeekStrip = 7 Flame/Ice nodes (frozen day = Ice shield).
- Weekly Review shows **you vs your past weeks** (no strangers).

**Momentum Garden.** Ref: Roots (`12`).

- Flat illustrated garden on a soft sky band with one plant species per contributing area: Tasks = Sky flowers, Habits
  = Sprout shrubs, Focus = Grape trees, Workout = Coral cacti, Nutrition = Berry berries, Planning = Gold sunflowers.
  These reuse the existing contribution areas.
- Read-only; explanation text kept. No wilting; "ready" state = Sprout `nap` beside an empty bed.

## 8. Reconciliation with existing reward / XP / Momentum Garden features

| Existing                                                                                    | v2 treatment                                                                      | Constraint kept                                                              |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `gamification.domain.ts` XP, levels, streak multiplier, milestones, freezes, quests, badges | Visual only: Gold XP, Flame streak, Ice freezes, Gold chest quests, tiered badges | No ledger/schema change; XP only from real actions (P6)                      |
| `lib/rewardFeedback.ts` tiers + `assets/sounds/reward-*.wav` + Settings toggles             | Map motion tiers 1:1 to `light/success/milestone` (§5.8)                          | Check-off stays haptic-only, no sound ("forbids celebrating every checkbox") |
| `RewardCelebrationOverlay` (top-anchored, box-none, 2.8s)                                   | Restyled as a celebration card + mascot                                           | Non-blocking, dismiss anywhere, provider decides tiers                       |
| Streak freezes / grace                                                                      | Ice shield nodes; "Saved by a freeze" copy                                        | Never "you lost your streak"                                                 |
| Momentum Garden (`features/momentum/*`)                                                     | Illustrated world + mascot home; Focus/quests "plant" into it                     | Read-only, deterministic, attributable, no punitive states                   |
| Quests (seeded daily 3)                                                                     | Today path nodes + QuestRow cards                                                 | Same 3 quests, same order                                                    |
| Achievements (milestone-first W13 layout)                                                   | Same structure, chunky badge tiles                                                | `All badges` disclosure, labels unchanged                                    |

Test-enforced limits (unchanged):

- todo rows 48–56 (`todos-convergence`); habit rows 48–64 and checks ≥48 (`habits-w7`)
- tab labels ≥11px and targets ≥44 at 360–412 (`health-nav-w10`)
- workout controls ≥40/44 (`workout-w9`); pomodoro controls ≥44 within 360 (`pomodoro.spec`)
- one exact "Add task" button
- texts "UP NEXT" / "Good evening" / "Appearance" / placeholders "What do you want to remember?" and "Add a todo…"
- `Section tabs` tablist name
- Nord `#2e3440`
- habit-count not red (`habits-w7-audit`)
- ≤800ms habit check-in and ≤500ms todo search budgets: celebrations must run off the JS critical path (Reanimated UI
  thread) and never delay state updates

## 9. Spec conflicts and P0 resolutions

| #   | Repo spec / doc                                                                     | Says                                                                                       | v2 wants                                                                                          | Resolution (adopted in P0)                                                                                                         |
| --- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| C1  | `docs/ui-ux/13` §7                                                                  | 3D lip retired from default button; only `celebrate`                                       | Lip on every primary/secondary button and option                                                  | Amend: lip = default pressable affordance; **gradient** stays retired                                                              |
| C2  | 13 §3 rule 4, §15                                                                   | Controls 10–12, cards 16, sheets 20–24; nothing >24 except pills; "26–34pt radii rejected" | Buttons 16, cards 20, sheets/dialogs 28                                                           | Amend radii table to §5.6; cap at 28                                                                                               |
| C3  | 13 §3 rule 3                                                                        | Cards get at most level1 shadow; shadow = z only                                           | Pressable cards get a 4px bottom border (lip)                                                     | Clarify: lip is a border, not a shadow; blur shadows still z-only                                                                  |
| C4  | 13 §5                                                                               | 800/900 rare; titles 700, body 600                                                         | Titles/buttons/numbers 800; display 900                                                           | Amend type table to §5.5                                                                                                           |
| C5  | 13 §4, `ui-ux-visual-coherence` "Section accents remain accents, not surface paint" | Hue only on icon/bar/progress; neutral cards                                               | One hero per screen may be a solid/bright section face; buttons take section solid                | Amend requirement: "a screen MAY own one solid hero and section-colored primary actions; card bodies remain neutral"               |
| C6  | 13 §12                                                                              | No continuous ambient animation                                                            | Mascot idle breath (3 cycles) in Garden/empty states only; Focus sapling grows in discrete stages | Amend: ambient allowed only in Garden/empty/celebration, ≤3 cycles, off under reduced motion                                       |
| C7  | 13 §11, 02 P6, rewardFeedback                                                       | Celebration reserved for real milestones; never celebrate every checkbox                   | Small inline check burst on every check-in                                                        | Clarify tiers: inline ≤400ms pop + light haptic per action is "feedback", not "celebration"; full celebrations stay milestone-only |
| C8  | 13 §15                                                                              | Gamified surfaces inside operational flows rejected                                        | Workout session/Calories get pops only                                                            | Keep the rule: no XP floats/mascot inside Workout session or Calories form, only check pops                                        |
| C9  | 13 §15 / SYS-17                                                                     | Uppercase letter-spaced eyebrows rejected                                                  | Duolingo-style uppercase buttons                                                                  | **No conflict**: v2 keeps sentence-case buttons (protects accessible names); one overline per screen                               |
| C10 | 12 Pop doc (superseded)                                                             | —                                                                                          | v2 is not Pop: Pop failed on gradients, tinted canvas, tinted nested cards, doc copy              | Mark 12 as historical; v2 lives in new `docs/ui-ux/16-playful-momentum.md`, which wins over 13 for visual values                   |
| C11 | `ui-ux-visual-coherence` "Cards use tokenized default padding spacing.lg"           | ✓ compatible (16)                                                                          | —                                                                                                 | none                                                                                                                               |

## 10. Phased plan (small PRs, one Pi session each ≈ 30–60 min)

Per-phase rules:

- Branch `ui/v2-pNN-<slug>` off fresh `main`, presentation-only.
- Gates: `npm run typecheck && npm run lint && npm run test:unit && npm run validate:themes`, then
  `npm run build:e2e && npm run e2e`.
- No test ID, role, label or asserted-copy edits.
- Linux goldens are regenerated with `npm run visual:update` and every diff image is reviewed. Win32 goldens are
  deferred to P22 on Michael's Windows machine.
- Before/after captures are produced with `tools/uiaudit-visual-regression.spec.ts`.

The 30 goldens: `shell-today-*`(5), `todos-*`(5), `habits-*`(2), `focus-idle`, `workout-landing`, `calories-*`(2),
`quick-capture`, `settings-*`(3), `command-input`, `achievements`, `review-step1-*`(2), `progress-details`,
`timeline-*`(2), `plan-hub-*`(2).

| #   | Phase                              | Scope                                                                                                                                                                                                                                                                              | Acceptance criteria                                                                                                                                     | Tests / snapshots affected                                                       |
| --- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| P0  | Spec + doc                         | `docs/ui-ux/16-playful-momentum.md` (this brief), amend 13 per §9 C1–C10, OpenSpec change `ui-v2-playful-momentum` modifying `ui-ux-visual-coherence`; lint rules (warn): no `text-[Npx]`, no raw Tailwind palette, no emoji in JSX chrome                                         | `openspec validate --all` green; no runtime diff                                                                                                        | none                                                                             |
| P1  | Color tokens                       | `themes/light.ts`, `themes/dark.ts`, `tokens.ts` (+`primaryBright`, `buttonLip`, `textSubtle`), `createTheme.ts`, `constants/sectionColors.ts` (sections + reward), `tailwind.config.js`, `validate-theme-contrast.mjs` (+2 checks)                                                | Exact §5.1–5.3 values; validate:themes ≥ baseline + new checks; `tests/sectionColors.test.ts`, `tests/theme.registry.test.ts` updated to the new values | all 30 goldens; `habits-w7-audit` (not red) still passes                         |
| P2  | Typography                         | `designTokens.typography` (+`button`, `metricLg`), `core/ui/Text.tsx`; replace raw sizes in `core/ui`                                                                                                                                                                              | Nunito only (no dependency change); 8 roles; tab label ≥11                                                                                              | all goldens; font list in `visual-regression.spec.ts` unchanged                  |
| P3  | Geometry + depth tokens            | `designTokens.radius/elevation` + new `depth`, `layout.contentMaxWidth 640`, focus ring `:focus-visible` (`useKeyboardFocusRing.ts`)                                                                                                                                               | Radii §5.6; no blur shadow on cards; pointer click shows no ring                                                                                        | all goldens; `a11y.spec`, `a11y-audit-contract`                                  |
| P4  | Motion foundation                  | `core/theme/motion.ts`, new `core/ui/motion/{usePressDepth,useCheckBurst,useXpFloat,useProgressFill}.ts` on Reanimated 4, wired to `lib/rewardFeedback` tiers                                                                                                                      | Reduced motion = opacity only; no JS-thread work >16ms per press (React profiler); `tests/rewardFeedback.test.ts` green                                 | none visual (hooks unused yet); unit tests for hooks' reduced-motion branch      |
| P5  | Pressable3D + Button + IconButton  | `core/ui/Pressable3D.tsx`, `Button.tsx` (drop gradient; variants §6), `IconButton.tsx`                                                                                                                                                                                             | Lip sizes 2/3/4; pressed translate = lip; `tests/uiTouchTargetContract.test.ts` green; one-primary note in JSDoc                                        | ≈all goldens                                                                     |
| P6  | Inputs and selection               | `TextField`, `NumberStepperField`, `SegmentedControl`, `PillChip`→Chip, new `OptionRow`, new `CheckNode`                                                                                                                                                                           | §6 specs; `workout-editor-input-reliability`, `calories-w10` (no clipping) green                                                                        | goldens with inputs/chips                                                        |
| P7  | Surfaces and progress              | `Card` (flat/card/hero), `ListRow/ListGroup`, `PageHeader`, `SectionLabel`, `StatBlock`, `FeatureStatCard`, new `ProgressBar`/`ProgressRing`, `SkeletonBlock`, `EmptyStateCard`                                                                                                    | No tinted bodies or nested cards; row limits pass (`todos-convergence`, `habits-w7`)                                                                    | all goldens; `todos-empty-360`                                                   |
| P8  | Overlays + celebration card        | `Modal` (sheet/dialog/drawer radius 28), `MenuSheet`, `useConfirmationDialog`, `RewardCelebrationOverlay` restyle (keeps box-none + 2.8s), banners/toast                                                                                                                           | `gamification.spec`, `settings.spec`, `pwa-update.spec` green; celebration never blocks taps                                                            | `quick-capture`, `settings-*`, `command-input`, `achievements`, `review-step1-*` |
| P9  | Icons + mascot + emoji purge       | `core/ui/illustrations/icons/*` (14 duotone SVG), `core/ui/illustrations/Sprout.tsx` (5 poses), replace chrome emoji (HabitsScreen, WorkoutSessionScreen, ValidationError, TodosScreen, BackgroundWarning, TodoAssociationPicker, HealthScreen, HabitDayStrip, GuidedPlanningFlow) | Emoji lint → error for chrome; SVGs carry `accessibilityElementsHidden`/`aria-hidden` (decorative) so labels don't change                               | affected goldens; `a11yAudit` unchanged (MaterialIcons kept)                     |
| P10 | Shell                              | `app/index.tsx` tab bar (tiles, duotone icons, Sprout capture), sidebar ≥900/≥1280, Streak/XP chips                                                                                                                                                                                | `health-nav-w10(-measure)` ≥44 / ≥11px at 360–412; breakpoints 899/900 behave as today; tablist "Section tabs"                                          | all goldens (esp. `shell-today-768/1280`)                                        |
| P11 | Today                              | `features/overview/*` (hero, Today's path from quests/plan, glance card, level card), `features/momentum/MomentumCard.tsx`                                                                                                                                                         | "UP NEXT"/"Good evening" visible; quest order unchanged; `overview.spec`, `momentum-garden.spec`, `gamification.spec` green                             | `shell-today-*` (5)                                                              |
| P12 | To Do                              | `features/todos/*` (composer, rows, completion animation, empty)                                                                                                                                                                                                                   | Exactly one "Add task"; completion pop off the critical path (`todo-quickadd-durability`, ≤500ms search)                                                | `todos-*` (5)                                                                    |
| P13 | Habits                             | `features/habits/*` (day nodes, rows, CheckNode, detail sheet streak)                                                                                                                                                                                                              | ≤800ms check-in budget; rows 48–64; checks ≥48; 0/x neutral                                                                                             | `habits-390-light`, `habits-quantitative-detail`                                 |
| P14 | Focus                              | `features/pomodoro/*` (hero timer, staged sapling, preset OptionRows sheet)                                                                                                                                                                                                        | Running state per W8 (only Pause/Resume + End); controls ≥44 within 360                                                                                 | `focus-idle-390-light`                                                           |
| P15 | Workout landing + routine detail   | `WorkoutScreen.tsx`, `RoutineDetailScreen.tsx`                                                                                                                                                                                                                                     | Coral hero + one CTA; week day nodes keep assignment labels; `workout-w9(-audit)`, `workout-gym-v2` green                                               | `workout-landing-390-light`                                                      |
| P16 | Workout session                    | `WorkoutSessionScreen.tsx`                                                                                                                                                                                                                                                         | No XP float/mascot mid-session; set CheckNode pop; `workout-w95`, `workout-snapshot-ordering` green                                                     | add `workout-session-390-light` golden                                           |
| P17 | Calories                           | `features/calories/*`                                                                                                                                                                                                                                                              | One hue (Berry); SUR-07 no overlap; chip wrap ≤2 lines; `calories*.spec` green                                                                          | `calories-390-light/dark`                                                        |
| P18 | Settings                           | `features/settings/*`, `ThemePreviewCard` → OptionRow previews, chunky Switch                                                                                                                                                                                                      | Existing Sounds/Haptics toggles unchanged in behavior; `settings.spec`, `secondary-surface-w13`, `portable-backup.spec` green                           | `settings-top-390/1280`, `settings-backup-390`                                   |
| P19 | Command Center + Quick capture     | `features/command/*`, quick capture in `app/index.tsx`                                                                                                                                                                                                                             | Placeholders and type labels unchanged; `command*.spec` green                                                                                           | `command-input-390`, `quick-capture-390`                                         |
| P20 | Gamification surfaces + Garden art | `AchievementsScreen`, `BadgeGrid`, `LevelHero`, `XpBar`, `XpRing`, `QuestRow`, `WeekStrip`, `MomentumGardenArt`, `MomentumDetailView`                                                                                                                                              | Garden read-only, no punitive art (`momentum-garden-hardening` spec); `All badges` disclosure kept                                                      | `achievements-390-light`, `progress-details`, `shell-today-*`                    |
| P21 | Secondary surfaces + 12 themes     | Planning Hub, Weekly Review, Progress/Activity, Health; `core/theme/themes/*` brand-hue swaps                                                                                                                                                                                      | validate:themes ≥ baseline; `theming.spec` (Nord) green; `planning-w11/w12`, `weekly-review` green                                                      | `plan-hub-*`, `review-step1-*`, `timeline-*`                                     |
| P22 | Close-out                          | win32 golden regeneration on Windows, `VISUAL_AUDIT=1` captures to `docs/ui-ux/v2-audit/`, lint rules → error, ledger close                                                                                                                                                        | `npm run e2e:full` green on Linux and Windows; Michael sign-off on the before/after board                                                               | all win32 goldens                                                                |

Parallelism: P1–P9 are sequential (foundation). After P10, the screen phases P11–P19 are independent and can run in
parallel Pi sessions. P20 depends on P11.

## 11. New dependencies

**None required.**

- Reanimated 4, worklets, gesture-handler, react-native-svg, expo-haptics, expo-audio and expo-linear-gradient are
  already installed.
- Nunito is already installed.
- Reward sounds already exist.

Explicitly not proposed: Lottie, Skia, Moti, a new font. Optional future experiment: `@expo-google-fonts/fredoka`
(display-only). That would be one dependency and would need the repo's dependency health check.

## 12. Decisions (Michael, current defaults — PROVISIONAL, may change)

Recorded 2026-10-29. These are Michael's current defaults for the former open questions; they are provisional and may
be revised before the owning phases land.

1. **Mascot "Sprout"** — YES, character approved, and the name is **Sprout** (seedling growing out of the Momentum
   Garden, §5.9 poses).
2. **Brand green** — **Sprout green is the brand and the global primary CTA color.** Violet is retired as the default
   identity; it survives as the Focus section hue (**Grape**) and inside the **Royal Purple** theme.
3. **Calories hue** — moves from amber to **Berry**, freeing Gold/Flame for rewards only.
4. **Today's path** — built from **quests and plan only** (no Up-next node; the Up-next hero card stays its own
   surface).
5. **Typography** — v2 keeps **Nunito** (§5.5) and needs **NO new dependencies**. The v1 Inter decision is void.
6. **Dependencies** — none (§11). The optional Fredoka display experiment remains out of plan.

## 13. Ledger

Per-phase delivery record. One entry per shipped phase; update at each merge.

### P0 — Spec + doc + OpenSpec + lint guardrails (2026-10-29, branch `ui/v2-p00-spec`)

Shipped (ONE commit):

- This document (`docs/ui-ux/16-playful-momentum.md`): brief v2 adapted as the spec + ledger, §9 resolutions adopted,
  §12 records Michael's provisional defaults (Sprout mascot + name; Sprout green brand/primary CTA with violet retired
  to Focus "Grape" + Royal Purple theme; Calories = Berry; Today's path from quests and plan only — no Up-next node;
  Nunito kept, no new deps — v1 Inter decision void).
- Superseded V4 (#131) neutral artifacts: `docs/ui-ux/16-v4-calm-momentum-finish.md` kept with a SUPERSEDED banner
  (links stay valid); `openspec/changes/ui-v4-visual-finish/` deleted (never applied/archived); replaced by
  `openspec/changes/ui-v2-playful-momentum/` (MODIFIED capability `ui-ux-visual-coherence` per §9 C1–C11; tasks =
  P0..P22, P0 checked).
- `docs/ui-ux/13-calm-momentum-design-system.md` amended per §9 C1–C10 (short amendment notes pointing here);
  `docs/ui-ux/12-pop-design-system.md` marked HISTORICAL (C10). `docs/ui-ux/README.md` index updated.
- Lint guardrails (WARN, opt-in) renamed `eslint.v4-guardrails.config.mjs` → `eslint.ui-guardrails.config.mjs`
  (run `npx eslint -c eslint.ui-guardrails.config.mjs core/ui features`). Three rules, per-rule warning counts at P0:
  raw `text-[Npx]` sizes **27**, raw Tailwind palette colors **2**, emoji in JSX chrome **5** (total **34** warnings,
  0 errors). The main `eslint.config.mjs` is untouched so `npm run lint --max-warnings 0` stays green.
- Zero runtime diff: no app code, tokens, themes, components, test assertions, or `package*.json` changes. No E2E run
  (no runtime change).

Gates (all pass): `npm run openspec:validate`, `npm run typecheck`, `npm run lint` (0 errors, 0 warnings),
`npm run test:unit`, `npm run validate:themes`.

Next: P1 (color tokens — §5.1–5.3 values into `core/theme`/`constants/sectionColors.ts`/`tailwind.config.js`, +2
contrast checks) on its own branch `ui/v2-p01-color-tokens` off fresh `main`.
