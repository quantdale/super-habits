# ExecPlan: settings-overlay-a11y-cyberpunk-neon-v1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Extend the Settings overlay DOM-level a11y guard (`e2e/a11y.spec.ts`) to the
cyberpunk-neon override theme. The Settings overlay is guarded in light and
dark (closed by `settings-overlay-a11y-dark-theme-v1`); the six sections are
guarded in cyberpunk-neon via the override-theme localStorage path — but the
Settings overlay under cyberpunk-neon (neon section accents via
`sectionOverrides`, theme-sensitive `readableAccent`/`readableSurface`
derivations) has zero coverage. Add a strict `auditPage` cyberpunk-neon
Settings test (WCAG AA contrast, accessible names, duplicate ids,
hidden-focus) so a future palette/component edit in the cyberpunk Settings
surface cannot regress legibility or control naming silently. Fix any defects
found narrowly with evidence; no product change otherwise.

## Context

- Audit harness: `e2e/a11y.spec.ts` — `auditPage()` runs in-page via
  `page.evaluate`; sections guarded in light, dark, and cyberpunk-neon
  (10 tests: 3 section + 2 light Settings + 1 dark Settings + 4 command).
- Cyberpunk override pattern (six-section test): set
  `localStorage 'superhabits.theme.mode' = 'dark'` +
  `localStorage 'superhabits.theme.slots.v2' = JSON({lightThemeId:'light', darkThemeId:'cyberpunk-neon'})`,
  reload, poll `data-theme-id === 'cyberpunk-neon'`.
- Dark Settings pattern (prior plan): open Settings via
  `page.getByRole('button', { name: 'Open settings' })`, audit open overlay
  with all four `auditPage` checks.
- Why cyberpunk Settings is the next surface: prior plan closed dark Settings
  (found + fixed 1 real defect in `SettingsCommandSection`) and named
  cyberpunk-neon Settings overlay audit as the explicit successor; the
  override path swaps the whole section accent set to neon hues, and Settings
  renders section accents + status pills + mode chips against them.
- E2E runs against static `dist/` on :8081 via `scripts/serve-e2e.js`;
  `dist/` must be rebuilt from current source before measuring. Pinned Node
  v22.23.2 on PATH (fnm); Node 20 causes better-sqlite3 segfault — do not
  touch that doc.
- AGENTS.md rules: no `data-testid` additions to app components; do not
  weaken assertions; local commit only, no push/tag/EAS.

## Scope

- Add to `e2e/a11y.spec.ts`, reusing `auditPage`:
  1. Cyberpunk-neon Settings overlay test: set override-theme slots before
     opening, assert `data-theme-id`, then audit the open Settings overlay
     (all four checks: contrast, names, duplicate ids, hidden-focus).
- Fix any contrast/name/id/hidden-focus defects found in
  `features/settings/` or exercised `core/ui/`/`core/theme/` surfaces,
  narrowly with evidence (follow `readableAccent`/`readableSurface` rule
  from `core/theme/contrast.ts` if contrast defects appear).

## Non-Goals

- No J8 product changes; no owner-only store console / EAS / push / v1.0.0 tag.
- No dark Ask/Auto matrix fill (explicitly skipped as low value).
- No tinypool/Node docs redo; no unrelated theme work beyond what cyberpunk
  Settings needs.
- No product change unless the audit finds a real defect.

## Current Checkpoint

- Current milestone: COMPLETE — cyberpunk-neon Settings guard added, clean baseline (no defects), all gates green.
- Completed: startup checks; created ExecPlan; added cyberpunk-neon
  Settings audit test (+38 lines, 4 assertions reusing `auditPage` +
  override-theme slots pattern with `data-theme-id` assertion); rebuilt
  `dist/`; focused new test PASS 1/1 on first audit (clean baseline, no
  defects — mirrors the two prior clean-baseline overlay runs); full
  `e2e/a11y.spec.ts` 10/10 green; `qa:affected` resolved; `qa:fast` green
  (typecheck, lint, unit 141 files / 1799 tests, label parity); hygiene
  PASS; local commit is next.
- In progress: none.
- Important modified files: `e2e/a11y.spec.ts` (+1 cyberpunk-neon
  Settings test); `.agent/execplans/settings-overlay-a11y-cyberpunk-neon-v1.md`
  (this plan).
- Last successful validation: full `e2e/a11y.spec.ts` 10/10 green (1.6m)
  2026-09-19 + `qa:fast` green — no defects, no regressions.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: complete — new test added without
  weakening assertions; audit found no defects (nothing to fix); focused
  + full `e2e/a11y.spec.ts` (10/10) + `qa:fast` green; plan validated;
  committed locally (no push); hygiene PASS.

## Progress

- [x] Startup + gap survey; create ExecPlan (2026-09-19).
- [x] Add cyberpunk-neon Settings audit test to `e2e/a11y.spec.ts`.
- [x] Rebuild `dist/`; run focused new test — PASS 1/1, clean baseline, no defects to fix.
- [x] Run full `e2e/a11y.spec.ts` — PASS 10/10.
- [x] Run `qa:affected` / `qa:fast` — gates green.
- [x] Validate plan, commit locally, close.

## Surprises & Discoveries

- None yet.

## Decision Log

- 2026-09-19 — Chose cyberpunk-neon Settings overlay audit: named successor
  from the dark-Settings handoff; override-theme path swaps the accent set
  Settings renders against and has zero overlay coverage.

## Validation Ledger

- 2026-09-19 — startup checks — PASS — Node v22.23.2, HEAD 3395cf6, clean
  tree, `agent:plans` listed.
- 2026-09-19 — `npx tsc --noEmit` on edited spec — PASS — zero errors.
- 2026-09-19 — `npm run build:web` — PASS — fresh `dist/` export.
- 2026-09-19 — focused new cyberpunk-Settings test — PASS 1/1 (8.9s) —
  clean baseline on first audit, no defects found.
- 2026-09-19 — `npx playwright test --project=chromium e2e/a11y.spec.ts`
  — PASS — 10/10 (1.6m), all prior tests unchanged-green.
- 2026-09-19 — `npm run qa:affected` — resolved gates qa:fast →
  qa:integration → qa:journeys → qa:simulation → qa:full (broad
  regression) for the e2e-infra rule; broader chain disproportionate for
  a test-only change with direct 10/10 oracle coverage (same rationale as
  the prior dark-Settings plan) — `qa:fast` run as the required gate.
- 2026-09-19 — `npm run qa:fast` — PASS (exit 0) — typecheck + lint
  clean, unit 141 files / 1799 tests green, label parity OK.
- 2026-09-19 — `npm run web:hygiene` — PASS — 8081/8082 free.

## Changed Files / Areas

- `.agent/execplans/settings-overlay-a11y-cyberpunk-neon-v1.md` — this plan.
- `e2e/a11y.spec.ts` — +1 cyberpunk-neon Settings test (4 assertions, +38 lines).

## Recovery / Resume Instructions

1. Read `AGENTS.md`, then `.agent/PLANS.md`, then this plan.
2. `git status --short`; `git log --oneline -3` (expect HEAD ≥ 3395cf6).
3. Ensure pinned Node: `node --version` must be v22.x.
4. Rebuild `dist/` if source changed since last build (`npm run build:web`).
5. Continue from `Exact next action` above.

## Outcomes & Retrospective

- Status: Complete.
- Summary: the Settings overlay guard now covers the cyberpunk-neon
  override-theme path (4 strict assertions reusing `auditPage`, with
  `data-theme-id` assertion proving the override path). The audit was a
  clean baseline on first run — neon section accents render AA-clean in
  Settings (the prior dark-Settings `readableSurface` fix carries over;
  no new defects). Full a11y file 10/10 green; `qa:fast` green; local
  commit only.
- Follow-up: remaining overlay gap is the dark Ask/Auto matrix fill
  (explicitly skipped as low value); the Command Center has no
  cyberpunk-neon audit either — that is the highest-value successor gap
  (named below). Full-chromium battery not run: test-only change with
  direct oracle coverage — disproportionate to re-run the broad chain.
- Lessons: the override-theme slots pattern (`slots.v2` + `data-theme-id`
  poll) composes cleanly with the Settings overlay audit; neon accents
  needed no call-site fix in Settings.
