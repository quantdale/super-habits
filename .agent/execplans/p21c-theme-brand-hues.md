Plan-Version: 2
Status: COMPLETED

# P21 part C — 12 theme brand-hue swaps

## Purpose / User Outcome

Each of the 12 non-default themes stops inheriting Sprout as its button/primary
brand and carries its own solid / bright / lip triple, so _Crimson Red_ really
is red and _Ocean Teal_ really is teal on the primary CTA, progress fill, node
and chip text. Canvas character and every theme ID are unchanged.

## Context

- Spec: `docs/ui-ux/16-playful-momentum.md` §5.1–5.4 (esp. §5.4), §10 row P21.
- Token model `core/theme/tokens.ts`; derivation `core/theme/createTheme.ts`.
- `light`/`dark` are frozen (§5.2/§5.3): their token output must stay
  byte-identical (it is asserted by `tests/theme.registry.test.ts`, the
  `--sh-*` CSS vars and the 30 goldens).
- Rendered brand consumers (read-only for this task):
  `core/ui/{Button,ProgressBar,ProgressRing,CheckNode,NumberStepperField,
SegmentedControl,OptionRow,Card}.tsx`, `features/overview/*`.

## Scope

`core/theme/themes/*` (the 12 non-default themes), `scripts/validate-theme-contrast.mjs`,
`tests/theme.registry.test.ts`, new `e2e/theming-brand-hue.spec.ts`.

## Non-Goals

No `light.ts` / `dark.ts` edits, no `features/*`, no `core/ui/*`, no
`constants/sectionColors.ts`, no goldens, no new dependencies.

## Current Checkpoint

- Current milestone: complete.
- Completed: all 12 non-default themes author their own solid / bright / lip
  triple, `textSubtle` and a flat `brandGradient`; validator extended from 168
  to 266 checks; unit matrix and a new E2E sweep added; `light`/`dark` proven
  byte-identical.
- In progress: None.
- Important modified files: the 12 `core/theme/themes/*.ts` files,
  `scripts/validate-theme-contrast.mjs`, `tests/theme.registry.test.ts`, new
  `e2e/theming-brand-hue.spec.ts`.
- Last successful validation: `npm run validate:themes` (266 checks pass),
  `npm run typecheck`, `npm run lint`, `npm run test:unit` (2923 tests),
  `npm run build:e2e`, and the theming / a11y / settings-ripple Playwright lanes.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: None.

## Progress

- [x] Read spec, token model, createTheme, registry, validator, tests, a11y/
      theming E2E, rendered brand consumers.
- [x] Record validator baseline (168) and pre-change token snapshot.
- [x] Author the 12 brand triples + `textSubtle` + flat `brandGradient`.
- [x] Extend the validator (textSubtle on elevated/sunken, primary as text on
      surface/background/elevated/chip, ink on bright) and the unit matrix.
- [x] New `e2e/theming-brand-hue.spec.ts`: live `--sh-*` assertions per theme,
      15 measured fill pairs per theme, DOM audit per theme, Settings audit.
- [x] Rebuild `dist/` and run the theming, a11y and settings-ripple lanes.

## Surprises & Discoveries

- `createTheme` already derived `primaryBright = primary` and
  `buttonLip = buttonActive`, so the swap was really about authority: which of
  the theme's own hues is the _solid_ (label-bearing face) versus the _bright_
  (shapes only). Fluent values that were previously "button" are now "primary".
- Chip tint (`chipBackground`) is derived from `primary`, and at the default
  10%/20% mix 8 themes drop the brand ink below 4.5. `sunset-orange`,
  `midnight-blue`, `royal-purple` and `nord-arctic` pin the tint explicitly.
- Ink-labelled dark themes need a lip that stays under the face _and_ under
  their own `buttonActive`; `forest-green`, `emerald-dark`, `cyberpunk-neon`,
  `royal-purple`, `nord-arctic` therefore author `buttonLip` explicitly.
- Pre-existing, canvas-owned AA findings (unchanged tokens on `main`):
  Flame `text` (`#B34D00`) on `coffee-brown`/`solarized` `surfaceElevated`
  (4.47 / 4.31), and section `bright` used as text on the first-run/quest cards.
  They belong to `constants/sectionColors.ts` + `features/*`, outside this split;
  the new spec pins them as an exact list so any _new_ finding fails.

## Decision Log

- Solid = the theme's existing `button`; bright = its existing
  `primaryBright` family member that clears ink ≥4.5 and 3:1 on every neutral;
  lip = a value below the face that clears the label floor (≥4.5).
- `primary` is the theme's own solid where it clears 4.5 as text; `midnight-blue`
  lifts `#3B82F6 → #4A90F7` (was 4.45 on its card) and `solarized` deepens its
  accent to `#545bb4` (4.49 on `#eee8d5`).
- `royal-purple` moves to the §5.3 bright-fill/ink-label pattern because
  `#7C3AED` was 2.87 as a mark on the velvet card.
- `light`/`dark` untouched: verified byte-identical across all 45 tokens
  (HEAD bundle vs working tree bundle).

## Validation Ledger

- `npm run validate:themes` → **266 checks pass** (baseline 168).
- `npx vitest run --project unit` (whole unit project) → 179 files / 2923 tests pass.
- `npm run typecheck` → 0 errors. `npm run lint` → clean.
- `npm run build:e2e` → hermetic export OK.
- `E2E_PORT=8097 npx playwright test --project=chromium e2e/theming-brand-hue.spec.ts`
  → 3/3 pass (12-theme light sweep, 12-theme dark sweep, Settings sweep).
- `... e2e/theming.spec.ts` → 3/3 pass (incl. Nord `--sh-background #2e3440`).
- `... e2e/a11y.spec.ts` → 15/15 pass.
- `--project=journeys e2e/journeys/settings-ripple.spec.ts` → 6/6 pass.

## Changed Files / Areas

- `core/theme/themes/{coffee-brown,crimson-red,cyberpunk-neon,emerald-dark,
forest-green,midnight-blue,nord-arctic,ocean-teal,rose-pink,royal-purple,
solarized,sunset-orange}.ts` — brand triple, `textSubtle`, flat gradient,
  pinned chip tint where derived failed.
- `scripts/validate-theme-contrast.mjs` — 5 new check rows (+ literal-color
  resolution).
- `tests/theme.registry.test.ts` — extended matrix + `brand-hue swaps` block.
- `e2e/theming-brand-hue.spec.ts` — new, 3 tests.

## Recovery / Resume Instructions

`node scripts/validate-theme-contrast.mjs`, then
`E2E_PORT=8097 npx playwright test --project=chromium e2e/theming-brand-hue.spec.ts`.

## Outcomes & Retrospective

Shipped. Light/dark untouched and provably identical; the 12 themes now own
their brand hue end to end, with contrast measured on both the token matrix and
the rendered DOM. Follow-up for another owner: the Flame/reward text tier and
the section-bright-as-text findings outside this file split.
