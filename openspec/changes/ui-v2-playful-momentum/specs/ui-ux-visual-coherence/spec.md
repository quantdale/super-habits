## MODIFIED Requirements

### Requirement: Shared primitives use semantic design tokens

The shared UI primitives (`Screen`, `Card`, `Modal`, `PillChip`, `Button`) and
the shell navigation SHALL use the semantic tokens from
`core/theme/designTokens.ts` (`spacing`, `radius`, `size`, `layout`, and the
new `depth`) instead of ad hoc per-component numbers where a token exists.
This SHALL NOT create a parallel design system. The Playful Momentum v2 values
are normative (`docs/ui-ux/16-playful-momentum.md` §5): the Sprout palette with
bright/solid/lip tiers, white/charcoal neutrals with 2px card borders, the
4/8/12/16/24/32/48 spacing scale, one page gutter (16/24/32), one 24px group
gap, radii `8/12/16/20/28/full` (nothing above 28), and the pressable depth
system (`depth.lip.lg|md|sm`, `depth.card`, `depth.flat`) where the lip is a
solid bottom **border** under a flat face — never a blur shadow (blur shadows
stay z-only; `elevation.level3` for sheets, dialogs, and celebration cards
only). Gradients remain retired from surfaces (the single exception: a
same-hue two-stop radial behind celebration art, §5.7).

#### Scenario: Screen padding follows the spacing token

- **GIVEN** a `Screen` with default padding
- **WHEN** it renders on any platform or viewport
- **THEN** its horizontal padding is `spacing.lg` and its bottom padding is
  `spacing.xxl`, matching the semantic token rather than a hard-coded number

#### Scenario: Interactive controls keep a ~48dp touch target

- **GIVEN** any interactive control (button, chip, tab, quick-add submit)
- **WHEN** it is rendered
- **THEN** its minimum height or width is at least `size.touchTargetMin` (48)
  or the surrounding container satisfies the 48dp contract (primary CTA 52 + 4
  lip; option rows 56; set-log rows 48)

#### Scenario: Cards use the tokenized default padding

- **GIVEN** a `Card` without an explicit `innerClassName`
- **WHEN** it renders
- **THEN** its body padding is `spacing.lg` (16; hero 20), and accent tint/bar
  geometry is unchanged

#### Scenario: Geometry stays inside the v2 radius and depth budget

- **GIVEN** any shared primitive surface (card, chip, button, option row, node,
  sheet, dialog)
- **WHEN** it renders in light or dark theme
- **THEN** its radius is one of the §5.6 values (8/12/16/20/28/full), nothing
  above 28
- **AND** pressable surfaces carry a 2–4px solid bottom lip (a border, not a
  shadow) and static info cards use the flat 2px border with no lip
- **AND** no surface uses a colored blur shadow or a surface gradient

### Requirement: Section accents remain accents, not surface paint

Feature accent colors SHALL be used for selection, progress, small emphasis,
and key icons. The page surface, typography, and default card bodies SHALL use
the neutral semantic tokens so no section reads as a separate mini-brand. Under
Playful Momentum v2, color lives in chunky objects on a white/charcoal canvas:
each section owns one hue with bright/solid/lip tiers (§5.1 — Sprout green is
the brand and global primary CTA; violet is retired as the default identity and
survives as the Focus hue "Grape" and the Royal Purple theme). A screen MAY own
one hero surface in its section's bright or solid face and its primary CTA uses
the section solid (white label; dark theme: bright fill + ink label) with the
matching lip. Reward hues (Gold XP, Flame streaks, Ice freezes, badge tiers)
appear only on reward elements. User-chosen habit colors render as node/check
fills only, never as text.

#### Scenario: Today cards keep neutral surfaces with accent details

- **GIVEN** the Today/Overview dashboard with multiple section cards
- **WHEN** it renders in light or dark theme
- **THEN** ordinary card surfaces use the neutral surface tokens with 2px
  borders, and section colors appear only on the one hero, the primary CTA,
  progress/completion objects, and icons

#### Scenario: One solid hero per screen, hue per job

- **GIVEN** any of the six section surfaces
- **WHEN** it renders in light or dark theme
- **THEN** at most one hero surface is painted in the section's bright/solid
  face and the screen's primary CTA uses the section solid with its lip
- **AND** the canvas is never tinted, no colored card nests inside a colored
  card, and Gold/Flame/Ice appear only on XP, streak, and freeze elements

## ADDED Requirements

### Requirement: Product text uses type roles only

All product text SHALL render through `core/ui/Text` typography roles
(`docs/ui-ux/16-playful-momentum.md` §5.5): Nunito only (no new font
dependency), headings/buttons/numbers at weight 800, body 600, `display` 900
for celebration numbers only, weight 400 banned, eight roles with sentence
case. Button labels use the `button` role in sentence case (never CSS
uppercase, so accessible names and asserted copy stay identical); uppercase is
reserved for at most one `label` overline per screen (existing asserted
overlines like "UP NEXT" are kept). Raw size utilities in `className` (for
example `text-[Npx]`, `text-xs`/`text-sm` on product text) SHALL NOT be used;
metric and numeric values use tabular figures.

#### Scenario: No raw pixel text sizes in shared UI and features

- **GIVEN** the `core/ui/**` and `features/**` TSX sources
- **WHEN** the lint guardrails run (WARN in the opt-in
  `eslint.ui-guardrails.config.mjs` through P0–P21, error folded into the main
  config at P22)
- **THEN** no `text-[Npx]` className literal is reported
- **AND** metric values render with tabular figures in light and dark themes

#### Scenario: Button labels keep their accessible names

- **GIVEN** any primary, secondary, ghost, danger, or celebrate button
- **WHEN** it renders with its label role
- **THEN** the label is sentence case with no CSS uppercase transform and the
  accessible name matches the product-facing string

### Requirement: Pressable depth is the default affordance; no emoji in UI chrome

Every pressable control (primary/secondary buttons, selectable option rows,
toggle chips, nodes) SHALL use the pressable-3D lip depth primitive
(`Pressable3D`, §5.7: flat face + darker bottom lip; pressed state pushes the
face into the lip, 80ms down / 120ms up; reduced motion = opacity only).
Static information SHALL NOT carry a lip. UI chrome SHALL NOT contain emoji
literals; habit time-of-day, celebration, warning, and similar states use the
duotone SVG hero-icon family and the "Sprout" mascot (5 poses, decorative,
`aria-hidden`), keeping existing accessible labels unchanged. User content may
contain emoji. Raw Tailwind palette color utilities SHALL NOT be used in UI
chrome; section/theme tokens carry color.

#### Scenario: Pressables carry a lip, static surfaces do not

- **GIVEN** any button, option row, toggle chip, check node, or path node
- **WHEN** it renders or is pressed
- **THEN** its face sits on a solid darker lip and pressing translates the face
  into the lip (opacity-only under reduced motion)
- **AND** static info cards, rows, and panels have no lip

#### Scenario: Emoji are limited to user content

- **GIVEN** any `core/ui/**` or `features/**` TSX surface
- **WHEN** it renders app-produced text (habit time-of-day labels, workout
  completion, validation messages, clear actions)
- **THEN** no emoji literal is rendered and the state is conveyed by hero icons
  or the mascot with unchanged accessible labels

### Requirement: Feedback is per-action; celebration is milestone-only

Completion feedback SHALL follow the §5.8 tiers wired to the existing
`lib/rewardFeedback` tiers: an inline check burst (≤400ms, light haptic, no
sound) is **feedback** and may run on every check-in; the `success` tier (quest
chime + haptic) is for quest completion; full celebrations (mascot
celebration card, confetti, chime, ≤2.8s, dismiss anywhere, non-blocking) are
reserved for real milestones (streak/level/badge/complete-day). Celebration
motion SHALL run off the JS critical path (Reanimated UI thread) and never
delay state updates or block input. Ambient motion is allowed only in Garden,
empty-state, and celebration contexts (mascot idle breath ≤3 cycles; the Focus
sapling grows in discrete stages at session thresholds). Everything respects
`useReducedMotion()` and the existing sound/haptic toggles.

#### Scenario: A check-in gets feedback, not a celebration

- **GIVEN** a habit check-in or todo completion
- **WHEN** the action commits
- **THEN** an inline burst + light haptic runs ≤400ms without delaying the
  state update, and no full celebration overlay is shown

#### Scenario: Milestone celebrations stay bounded and dismissible

- **GIVEN** a streak milestone, level-up, badge, or complete-day event
- **WHEN** the milestone celebration shows
- **THEN** it auto-dismisses in ≤2.8s, can be dismissed anywhere, never blocks
  taps, and degrades to a 120ms opacity cross-fade under reduced motion

### Requirement: Operational flows stay decoration-light

Dense operational surfaces (Workout session logging, Calories form) SHALL keep
their density and drop the decoration: no mascot, no XP floats, and no
celebration cards mid-session — completion gets a check-node pop only. Zero and
missed states across the product SHALL stay neutral (the garden never wilts,
the mascot is never sad, no "you lost your streak" language).

#### Scenario: Workout session and Calories form allow pops only

- **GIVEN** an active Workout session or the Calories form
- **WHEN** a set is logged or an entry is added
- **THEN** the feedback is a check pop (light haptic) with no XP float, mascot,
  or celebration card

### Requirement: Visual values authority is doc 16

`docs/ui-ux/16-playful-momentum.md` SHALL be the visual-values authority for
the Playful Momentum v2 work. Where it conflicts with
`docs/ui-ux/13-calm-momentum-design-system.md` (as amended by its v2 P0 notes)
or older `docs/ui-ux/*` documents, doc 16 wins. `docs/ui-ux/12-pop-design-system.md`
and `docs/ui-ux/16-v4-calm-momentum-finish.md` are historical records and SHALL
NOT be implemented from.

#### Scenario: Visual values resolve to doc 16

- **GIVEN** a visual-values disagreement between doc 16 and docs 12/13/16-v4
- **WHEN** an implementation decision is made in P1–P22
- **THEN** doc 16's values are applied and the older document is treated as
  record only

### Requirement: Visual goldens regenerate deliberately per phase

The curated visual goldens SHALL be regenerated on Linux inside each phase PR
(`npm run visual:update`) with every diff image inspected; thresholds are
never loosened to pass. Win32 baselines are deliberately deferred to P22
(regenerated on the Windows workstation, or the win32 comparison temporarily
skipped via the existing platform-scoped template until then), and a golden
change without a ledger note is not acceptable. Before/after captures are
produced with the design-workstation capture harness referenced in doc 16 §10.

#### Scenario: A phase PR owns its golden churn

- **GIVEN** a P1–P21 phase PR that changes rendered appearance
- **WHEN** the visual suite runs
- **THEN** the linux goldens are regenerated in that PR and their diff images
  are reviewed
- **AND** any `*-win32.png` baseline is left for P22 as recorded in the ledger
