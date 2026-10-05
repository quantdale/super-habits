## Design — Frontend V3 "Calm Momentum"

Full design authority: `docs/ui-ux/13-calm-momentum-design-system.md`.
Reference decisions: `docs/ui-ux/14-v3-reference-ledger.md`.
Defect evidence: `docs/ui-ux/15-v3-defect-ledger.md` + `docs/ui-ux/v3-audit/`.
This file records only decisions specific to implementing the change.

### D1. Token strategy — evolve, do not fork

`core/theme/designTokens.ts` and `core/theme/tokens.ts` keep their export
shape so 20 screens don't change import paths. V3 changes **values and
derivation** in `createTheme`:

- radii: xs 8, sm 10, md 12, lg 16, xl 24 (was 10/14/20/26/34); `full` stays
  for chips.
- typography roles flattened per design-system §5 (`titleLg` 22/700,
  `titleMd` 17/700, body 400–500 weights, `display` reserved).
- `canvasTint` removed from derivation (renders as a stray arc on desktop —
  SYS-15); `Screen` stops consuming it.
- elevation: page cards default to level1-or-none; colored `glow` shadows only
  for floating capture affordance and modals.
- dark-theme hero derivation inverted: dark accent fill + light ink (fixes
  SYS-10) and validated by contrast checks in `core/theme/contrast.ts` tests.

Theme registry (14 themes) keeps working unchanged — derivations live in one
place. `npm run validate:themes` must pass after every token touch.

### D2. Component changes (single owner: foundation wave)

- `Button`: four levels (`primary/secondary/tertiary/danger`) + `celebrate`
  variant carrying the old 3D lip; radius 12; heights sm 36 / md 44 / lg 52.
  `TactileButton` becomes a thin deprecated wrapper re-exporting Button
  `celebrate` (call sites migrate mechanically).
- `Card`: variants `standard/inset/hero/stat`; header band removed; `header*`
  props render as quiet title rows; radius 16.
- `PageHeader`: compact — title 22/700 + optional actions row; `subtitle`
  prop deprecated (screens move copy into contextual captions).
- `Screen`: gutters 16/24/32 by breakpoint; wash removed; keeps safe-area and
  centered-column behavior.
- `Modal`: standard anatomy (handle/title/close/scroll bounds/keyboard
  avoidance) — behavior preserved, visuals normalized.
- New `SectionLabel` primitive (caption eyebrow) replacing slab headers.
- `StatBlock` neutralized; `EmptyStateCard` quieted.

### D3. Navigation five-destination model (W4, validated in W10)

NAV_ITEMS becomes: Today, To Do, Habits, Focus, Health + center capture slot.
`Health` renders a parent surface with Workout/Nutrition entries and active-
session shortcut. `AppSection` gains `'health'` while `workout`/`calories`
remain valid sections (deep-links, linked-action targets, command executor
keep working — they set the parent then delegate). **Validation gate:** before
W10 closes, measure tap-depth for the three most common health flows (start
workout, log meal, check calories-left) against the six-tab model; if the
parent adds a tap or drops task-switch success, ship the six-tab fallback with
the visual restyle only. Journeys keep their labels working: section switcher
labels are an observability contract (`journey-label-parity`), so any label
change updates both the rail and the parity test in the same commit.

### D4. Screen reconstruction order and ownership

Foundation (W3) is single-owner. Screen waves (W5–W13) may parallelize across
disjoint feature directories once W3 lands; shared primitives and the shell
stay with the foundation owner. Each wave: implement → build:e2e → audit-harness
capture → inspect against reference lock → record defects → fix → re-render.

### D5. Visual regression (W15)

`e2e/visual-regression.spec.ts` with `toHaveScreenshot` baselines under
`e2e/__screenshots__/`; deterministic rendering (fixed viewport, disabled
animations via reduced-motion emulation, seeded TYPICAL fixture, stable clock
helper where needed). Thresholds never loosened to pass; a baseline change
requires a ledger note. Baselines curated (shell, nav, six sections, quick
capture, settings, dark, one tablet/one desktop width) — not every state.

### D6. What we do not touch

- `core/db/*`, `core/sync/*` semantics, `core/backup/*`, `core/portable/*`,
  Supabase edge functions, notification scheduling logic.
- Domain math (`*.domain.ts`) unless a UI defect traces to it (then: repro +
  regression test + narrow fix).
- Production Supabase state (campaign §34).
- Known CI dependency-audit reds (braces, node-forge) — campaign §36.

### D7. Risks

- **Selector churn:** restyled components may break e2e selectors; fix specs
  when the product contract improves, never weaken assertions (campaign §45).
- **Snapshot flakiness on web fonts:** Nunito loads via expo-font; the static
  export inlines it — verify baselines are stable across two runs before
  curating.
- **Five-tab ambiguity:** Health parent may hurt direct Workout/Calories
  access; D3's validation gate decides with evidence, not preference.
- **Theme-token value drift across 14 themes:** every token change runs
  `npm run validate:themes` + theming e2e spec.
