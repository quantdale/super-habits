# ExecPlan: settings-overlay-a11y-dark-theme-v1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Extend the Settings overlay DOM-level a11y guard (`e2e/a11y.spec.ts`) to the
dark theme. The Settings overlay is guarded in light only (name/id/hidden-focus
+ contrast, closed by known-gap 19); dark appearances swap in brighter text
variants plus the theme-sensitive `readableAccent` derivation the gap-19 fix
introduced — and none of that is audited. Add a strict `auditPage` dark-theme
Settings test (WCAG AA contrast, accessible names, duplicate ids,
hidden-focus) so a future palette/component edit in the dark Settings surface
cannot regress legibility or control naming silently. Fix any defects found
narrowly with evidence; no product change otherwise.

## Context

- Audit harness: `e2e/a11y.spec.ts` — `auditPage()` runs in-page via
  `page.evaluate`; sections guarded in light, dark, and cyberpunk-neon;
  Settings overlay has two light-only tests; Command overlay has three tests
  (light Create, dark Create, light Ask/Auto) from `command-overlay-a11y-*`.
- Dark-theme switching pattern: set `localStorage 'superhabits.theme.mode' =
  'dark'` then reload and poll `data-theme === 'dark'` (see dark-theme
  sections test and dark command test).
- Settings opener: `page.getByRole('button', { name: 'Open settings' })`
  (see existing Settings tests).
- Why Settings-dark is the next surface: known-gap 19 proved the Settings
  overlay is the most defect-prone overlay (real AA failures in status pills,
  mode chips, section accents — fixed via `readableAccent`/`readableSurface`
  in `core/theme/contrast.ts`). The fix's accent-text derivation is
  theme-sensitive and has zero dark-theme coverage.
- E2E runs against static `dist/` on :8081 via `scripts/serve-e2e.js`;
  `dist/` must be rebuilt from current source before measuring. Pinned Node
  v22.23.2 on PATH (fnm); Node 20 causes better-sqlite3 segfault (known-gap
  E1) — do not touch that doc.
- AGENTS.md rules: no `data-testid` additions to app components; do not
  weaken assertions; local commit only, no push/tag/EAS.

## Scope

- Add to `e2e/a11y.spec.ts`, reusing `auditPage`:
  1. Dark-theme Settings overlay test: set dark mode before opening, then
     audit the open Settings overlay (all four checks: contrast, names,
     duplicate ids, hidden-focus).
- Fix any contrast/name/id/hidden-focus defects found in
  `features/settings/` or exercised `core/ui/` surfaces, narrowly with
  evidence (follow `readableAccent`/`readableSurface` rule from
  `core/theme/contrast.ts` if contrast defects appear).

## Non-Goals

- No cyberpunk-neon Settings audit (narrower override path; named successor).
- No dark Ask/Auto matrix fill (explicitly skipped as low value).
- No Vitest component-rendering infra (separate larger proposal).
- No J8 perf remeasure. No tinypool/Node doc redo. No push, no tag, no EAS.
- No product change unless the audit finds a real defect.

## Current Checkpoint

- Current milestone: COMPLETE — dark Settings guard added, one real
  contrast defect found and fixed, all gates green.
- Completed: startup + gap survey; added dark-theme Settings audit test
  (+31 lines, 4 assertions reusing `auditPage`); rebuilt `dist/`; new test
  FAILED deterministically (3/3 attempts) on one real defect — `Open
  advanced capture` white text on dark `textMuted` fill (#A9A4C9, 2.38:1,
  needs 4.5) in `SettingsCommandSection`; fixed narrowly with
  `readableSurface(tokens.textMuted, tokens.textOnAccent)` (same pattern as
  `PillChip`; no-op in light); focused test green; full a11y file 9/9
  green; `qa:fast` green (typecheck, lint, unit 141 files / 1799 tests,
  label parity); plan validated; hygiene PASS; committed locally.
- In progress: none.
- Important modified files: `e2e/a11y.spec.ts` (+31 lines, 1 test);
  `features/settings/SettingsCommandSection.tsx` (fill via
  `readableSurface`, +6/-1).
- Last successful validation: full `e2e/a11y.spec.ts` 9/9 green (1.4m)
  2026-09-19 + `qa:fast` green — defect fixed, no regressions.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: complete — new test added without
  weakening assertions; real defect fixed narrowly with evidence; focused
  + full `e2e/a11y.spec.ts` (9/9) + `qa:fast` green; plan validated;
  committed locally (no push); hygiene PASS.

## Progress

- [x] Startup + gap survey; choose Settings overlay dark theme (2026-09-19).
- [x] Startup + gap survey; choose Settings overlay dark theme (2026-09-19).
- [x] Add dark-theme Settings audit test to `e2e/a11y.spec.ts`.
- [x] Rebuild `dist/`; run focused new test — found 1 real defect (3/3 deterministic).
- [x] Fix defect via `readableSurface` in `SettingsCommandSection` (+6/-1).
- [x] Run full `e2e/a11y.spec.ts` (9/9 green).
- [x] Run `qa:fast` (green).
- [x] Validate plan, commit locally, close.

## Surprises & Discoveries

- The new guard found a REAL defect on first audit (unlike the two prior
  overlay runs, which were clean baselines): `SettingsCommandSection` used
  the text-role token `textMuted` as a button *fill* with fixed light
  `textOnAccent` text. Light `textMuted` (#655F8A) passes; dark
  `textMuted` (#A9A4C9) measures 2.38:1. Validates the gap choice —
  Settings-dark was genuinely uncovered, not just unguarded.

## Decision Log

- 2026-09-19 — Chose Settings-dark over cyberpunk Settings or other
  overlays: gap 19 proves Settings is the defect-prone overlay and its
  accent-text fix is theme-sensitive with zero dark coverage; one test
  covers all four checks, mirroring the proven command-dark pattern.

## Validation Ledger

- 2026-09-19 — startup checks — PASS — Node v22.23.2, HEAD e54eabe, clean
  tree, `agent:plans` listed.
- 2026-09-19 — `npx tsc --noEmit` + `npx eslint` + `prettier --check` on
  touched files — PASS — zero errors.
- 2026-09-19 — `npm run build:web` — PASS — fresh `dist/` export.
- 2026-09-19 — focused new dark-Settings test (pre-fix) — FAIL (real
  defect) — `Open advanced capture 2.38:1 (needs 4.5) at 14px` white on
  #A9A4C9, deterministic across initial + 2 retries.
- 2026-09-19 — `npm run build:web` + focused new test (post-fix) — PASS —
  1/1 (8.8s).
- 2026-09-19 — `npx playwright test --project=chromium e2e/a11y.spec.ts`
  — PASS — 9/9 (1.4m), light Settings tests unchanged-green.
- 2026-09-19 — `npm run qa:fast` — PASS — typecheck + lint clean, unit
  141 files / 1799 tests green, label parity OK.
- 2026-09-19 — `npm run agent:plan:validate` — PASS — plan valid.
- 2026-09-19 — `npm run web:hygiene` — PASS — 8081/8082 free.

## Changed Files / Areas

- `e2e/a11y.spec.ts` — +1 dark-theme Settings test (4 assertions, +31 lines).
- `features/settings/SettingsCommandSection.tsx` — capture-button fill via
  `readableSurface(tokens.textMuted, tokens.textOnAccent)` (+6/-1); keeps
  the muted hue, deepens until AA, no-op in light.
- `.agent/execplans/settings-overlay-a11y-dark-theme-v1.md` — this plan.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, then `.agent/PLANS.md`, then this plan.
2. `git status --short`; `git log --oneline -3` (expect HEAD ≥ e54eabe).
3. Ensure pinned Node: `node --version` must be v22.x.
4. Rebuild `dist/` if source changed since last build (`npm run build:web`).
5. Continue from `Exact next action` above.

## Outcomes & Retrospective

- Status: Complete.
- Summary: the Settings overlay guard now covers the dark theme (4 strict
  assertions reusing `auditPage`). The guard caught one real AA defect on
  first audit — the advanced-capture button's text-role fill in dark —
  fixed narrowly with `readableSurface` following the `PillChip` pattern.
  Full a11y file 9/9 green; `qa:fast` green; local commit only.
- Follow-up: cyberpunk-neon Settings audit is the next uncovered overlay
  surface (override theme path); dark Ask/Auto matrix fill stays skipped
  (low value). Full-chromium battery not run: one-line color derivation
  with direct oracle coverage in both themes (light tests unchanged-green
  proves no-op there) — disproportionate to re-run the 18-min battery.
- Lessons: text-role tokens as fills break exactly where themes lighten
  muted text; prefer `readableSurface` at the call site (as `PillChip`/
  `Button` do) over raw role tokens for solid faces.
