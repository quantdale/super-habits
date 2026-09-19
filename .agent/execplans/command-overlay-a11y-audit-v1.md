# ExecPlan: command-overlay-a11y-audit-v1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

The global Command Center overlay (Add → Describe it) is the only top-level
surface with zero DOM-level accessibility conformance coverage: `e2e/a11y.spec.ts`
guards the six sections in three themes plus the Settings overlay, but never
opens the command overlay. Extend the same strict `auditPage` guard (WCAG AA
contrast, accessible names, duplicate ids, hidden-focus) to the command
overlay so a future palette/component edit there cannot regress legibility or
control naming silently. Fix any defects found without weakening assertions.

## Context

- Audit harness: `e2e/a11y.spec.ts` — `auditPage()` runs in-page via
  `page.evaluate`; `auditSections()` loops sections. Settings overlay has two
  dedicated tests (names/ids/focus + contrast) as the pattern to copy.
- Opener: `openCommandScreen(page)` in `e2e/helpers/commandObservation.ts`
  (Quick capture → Describe it → pin Create mode → `#command-input` visible).
- Prior art: known-gap 19 (Settings contrast, closed 2026-09-14) — fixes used
  `readableAccent`/`readableSurface` from `core/theme/contrast.ts`; follow the
  same rule if command-overlay defects are found.
- E2E runs against static `dist/` on :8081 via `scripts/serve-e2e.js`
  (playwright config); `dist/` must be rebuilt from current source before
  measuring. Chromium available on this box.
- AGENTS.md rules: no `data-testid` additions to app components; if a selector
  breaks after a UI change, update the spec, not the assertion.

## Scope

- Add command-overlay audit test(s) to `e2e/a11y.spec.ts` reusing `auditPage`:
  opened overlay in Create mode (empty input state); plus a parsed-command
  state (result/preview cards) in the same session if cheap.
- Fix any contrast/name/id/hidden-focus defects the audit finds in
  `features/command/` or shared `core/ui/` surfaces it exercises.

## Non-Goals

- No Vitest component-rendering infra (no @testing-library installed; RN
  rendering in node env is a separate, larger proposal — not this increment).
- No theme-matrix repeat for the overlay (light only) unless a defect suggests
  otherwise; sections already guard the three-theme path.
- No J8 perf remeasure (host was load-noisy; explicitly skipped per mission).
- No tinypool/Node doc redo. No push, no tag, no EAS submit.

## Current Checkpoint

- Current milestone: COMPLETE — guard added and green; no overlay defects found.
- Completed: startup + gap survey; added command-overlay audit test
  (empty Create state + parsed create-task state, 8 strict assertions reusing
  `auditPage`); rebuilt `dist/`; new test green 4.3s; full a11y file 6/6
  green; `qa:fast` green (typecheck, lint, unit 141 files / 1799 tests,
  label parity); port hygiene PASS; plan validated; committed locally.
- In progress: none.
- Important modified files: `e2e/a11y.spec.ts` (+31 lines).
- Last successful validation: `qa:fast` green + a11y 6/6 green 2026-09-19.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: complete (all conditions proven).

## Progress

- [x] Survey gaps; choose command-overlay a11y (2026-09-19).
- [x] Survey gaps; choose command-overlay a11y (2026-09-19).
- [x] Add overlay audit test(s) to `e2e/a11y.spec.ts`.
- [x] Rebuild `dist/`; run focused a11y spec; record baseline.
- [x] Fix defects if found (none found — clean baseline recorded).
- [x] Run `qa:fast` (green; no product change so no broader escalation).
- [x] Validate plan, commit locally, close.

## Surprises & Discoveries

- The command overlay was fully clean on first audit (empty + parsed states,
  all four checks each) — input card, mode toggle, parse-result card, and
  draft preview already use contrast-safe variants. The value of this
  increment is the regression guard, not a fix.

## Decision Log

- 2026-09-19 — Chose command-overlay a11y over Vitest component-rendering:
  no render infra installed and RN-in-node is a large env risk; the a11y
  extension reuses the proven `auditPage` harness for a real uncovered
  user-facing surface. Fully box-executable.

## Validation Ledger

- 2026-09-19 — startup checks — PASS — Node v22.23.2, HEAD 6316e08, clean tree.
- 2026-09-19 — `npx tsc --noEmit` + `npx eslint e2e/a11y.spec.ts` — PASS — zero errors.
- 2026-09-19 — `npm run build:web` — PASS — fresh `dist/` export.
- 2026-09-19 — `npx playwright test --project=chromium e2e/a11y.spec.ts -g "Command Center overlay"` — PASS — 1/1 (4.3s), empty + parsed states clean.
- 2026-09-19 — `npx playwright test --project=chromium e2e/a11y.spec.ts` — PASS — 6/6 (1.1m), no regressions.
- 2026-09-19 — `npm run qa:fast` — PASS — typecheck + lint clean, unit 141 files / 1799 tests green, label parity OK.
- 2026-09-19 — `npm run web:hygiene` — PASS — 8081/8082 free.

## Changed Files / Areas

- `e2e/a11y.spec.ts` — new command-overlay guard test (+31 lines, 8 assertions).
- `.agent/execplans/command-overlay-a11y-audit-v1.md` — this plan.
- No product code changed (overlay was clean).

## Recovery / Resume Instructions

1. Read `AGENTS.md`, then `.agent/PLANS.md`, then this plan.
2. `git status --short`; `git log --oneline -3` (expect HEAD ≥ 6316e08).
3. Ensure pinned Node: `node --version` must be v22.x.
4. Continue from `Exact next action` above.

## Outcomes & Retrospective

- Status: Complete.
- Summary: the last unaudited top-level surface (Command Center overlay) is
  now guarded by the same strict DOM-level a11y audit as sections + Settings
  (contrast, names, ids, hidden-focus × empty/parses states). Baseline is
  clean — no product change needed. All gates green; local commit only.
- Follow-up: natural next gaps (separate increments) — overlay audit in dark
  theme; Ask/Auto mode states; Vitest component-rendering infra proposal.
- Lessons: reusing `auditPage` + `openCommandScreen`/`parseCommand` helpers
  made this a ~30-line, zero-flake addition; focused single-spec runs avoid
  the host-load noise documented for full batteries (known-gap 15).
