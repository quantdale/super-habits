## MODIFIED Requirements

### Requirement: Shared primitives use semantic design tokens

The shared UI primitives (`Screen`, `Card`, `Modal`, `PillChip`) and the shell
navigation rail SHALL use the semantic tokens from `core/theme/designTokens.ts`
(`spacing`, `radius`, `size`, `layout`) instead of ad hoc per-component numbers
where a token exists. This SHALL NOT create a parallel design system. The V4
finish values are normative (`docs/ui-ux/16-v4-calm-momentum-finish.md` §5):
neutral ink-first light/dark palettes with the added `textSubtle` and
`focusRing` tokens, radii capped at 16 except circles, the 4/8/12/16/24/32/48
spacing scale (plus `2` hair for optical nudges), one page gutter, one 24px
group gap, and neutral elevation levels (no colored shadows; `glow` retired).

#### Scenario: Screen padding follows the spacing token

- **GIVEN** a `Screen` with default padding
- **WHEN** it renders on any platform or viewport
- **THEN** its horizontal padding is `spacing.lg` and its bottom padding is
  `spacing.xxl`, matching the semantic token rather than a hard-coded number

#### Scenario: Interactive controls keep a ~48dp touch target

- **GIVEN** any interactive control (button, chip, tab, quick-add submit)
- **WHEN** it is rendered
- **THEN** its minimum height or width is at least `size.touchTargetMin` (48)
  or the surrounding container satisfies the 48dp contract

#### Scenario: Cards use the tokenized default padding

- **GIVEN** a `Card` without an explicit `innerClassName`
- **WHEN** it renders
- **THEN** its body padding is `spacing.lg`, and accent tint/bar geometry is
  unchanged

#### Scenario: Geometry stays inside the V4 radius and elevation budget

- **GIVEN** any shared primitive surface (card, chip, button, sheet, dialog)
- **WHEN** it renders in light or dark theme
- **THEN** its radius is one of the §5.6 values with nothing above 16 except
  circular shapes
- **AND** ordinary cards use a hairline border instead of a shadow, and no
  surface uses a colored shadow or gradient

### Requirement: Section accents remain accents, not surface paint

Feature accent colors SHALL be used for selection, progress, small emphasis,
and key icons. The page surface, typography, cards, and default controls SHALL
use the neutral semantic tokens so no section reads as a separate mini-brand.
Under V4, neutral carries the page and hue carries meaning: the six harmonized
section hues (§5.3) SHALL appear only in the active nav indicator, the one
hero/progress surface per screen, completion checks, and charts — never as
card or canvas paint. Brand violet is retired as the default identity; it
survives as the Focus hue and the "Royal Purple" theme, and the interactive
accent (focus ring, links, switches, selection) is the indigo `accent` token.
Reward colors stay on reward surfaces only. If removing a color loses no
information, it is removed.

#### Scenario: Today cards keep neutral surfaces with accent details

- **GIVEN** the Today/Overview dashboard with multiple section cards
- **WHEN** it renders in light or dark theme
- **THEN** card surfaces use the neutral surface tokens and section colors
  appear only as accents (icon tile, top bar, progress)

#### Scenario: Section hues are signal, not wallpaper

- **GIVEN** any of the six section surfaces
- **WHEN** it renders in light or dark theme
- **THEN** no card, panel, or canvas is painted in a section hue and no
  Tailwind palette utility is used for color
- **AND** hue appears only where removing it would lose information (active
  nav, hero/progress, completion, charts)

## ADDED Requirements

### Requirement: Product text uses type roles only

All product text SHALL render through `core/ui/Text` typography roles (§5.5:
Inter scale with tabular numerals on `metric*` and numeric columns). Raw size
utilities in `className` (for example `text-[Npx]`) on product text SHALL NOT
be used; section headers are sentence case, uppercase is reserved for the
single rare `overline` role, and weights 800/900 are banned.

#### Scenario: No raw pixel text sizes in shared UI and features

- **GIVEN** the `core/ui/**` and `features/**` TSX sources
- **WHEN** the P0 lint guardrails run (WARN now, error at P20)
- **THEN** no `text-[Npx]` className literal is reported
- **AND** metric values render with tabular figures in light and dark themes

### Requirement: One icon family and no emoji in UI chrome

UI chrome SHALL use one outline icon family (Ionicons outline via the
`core/ui/Icon.tsx` wrapper at 20/24px) that inherits `textMuted`, with active
state `text`. Emoji SHALL NOT appear in app-produced UI text or strings (user
content may contain emoji); validation, celebration, and time-of-day states use
icon + text semantics instead.

#### Scenario: Emoji are limited to user content

- **GIVEN** any `core/ui/**` or `features/**` TSX surface
- **WHEN** it renders app-produced text (habit time-of-day labels, workout
  completion, validation messages, clear actions)
- **THEN** no emoji literal is rendered and the state is conveyed by the icon
  system with unchanged accessible labels

### Requirement: Rows carry lists; cards represent act-on units

The default container for repeated content SHALL be an inset grouped list
(surface body, hairline separators, 52px rows) rather than nested or tinted
cards. A card SHALL only represent a discrete object the user can act on as a
unit. Each screen keeps at most one hero surface and one primary (ink) button
per view, and zero/missed states are neutral ink — never danger red.

#### Scenario: Lists read as flat grouped rows

- **GIVEN** To Do, Habits, Settings, Workout week, or Calories diary content
- **WHEN** it renders in light or dark theme
- **THEN** repeated rows sit in grouped lists with hairline separators and no
  tinted card nested inside a tinted panel

### Requirement: Visual goldens regenerate deliberately per phase

The curated visual goldens SHALL be regenerated on Linux inside each phase PR
(`npm run visual:update`) with every diff image inspected; thresholds are
never loosened to pass. Win32 baselines are deliberately deferred to P20
(regenerated on the Windows workstation, or the win32 comparison temporarily
skipped via the existing platform-scoped template until then), and a golden
change without a ledger note is not acceptable.

#### Scenario: A phase PR owns its golden churn

- **GIVEN** a P1–P9 phase PR that changes rendered appearance
- **WHEN** the visual suite runs
- **THEN** the linux goldens are regenerated in that PR and their diff images
  are reviewed
- **AND** any `*-win32.png` baseline is left for P20 as recorded in the ledger
