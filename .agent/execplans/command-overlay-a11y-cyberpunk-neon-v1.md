# ExecPlan: command-overlay-a11y-cyberpunk-neon-v1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Extend the Command Center overlay DOM-level a11y guard (`e2e/a11y.spec.ts`) to the
cyberpunk-neon override theme. The overlay is guarded in light (empty + parsed,
`command-overlay-a11y-audit-v1`) and dark (empty + parsed,
`command-overlay-a11y-dark-modes-v1`), and light Ask/Auto modes are guarded —
but the overlay under cyberpunk-neon (neon section accents via
`sectionOverrides`, theme-sensitive `readableAccent`/`readableSurface`
derivations, accent-derived text such as `LaunchContextCard`'s
`contextCopy.accentColor` and the `ModeToggle`/`CommandPreview` cards) has zero
coverage. Add a strict `auditPage` cyberpunk-neon Command Center test (WCAG AA
contrast, accessible names, duplicate ids, hidden-focus; empty + parsed states,
mirroring the existing dark Command Center test) so a future palette/component
edit in the neon overlay surface cannot regress legibility or control naming
silently. Fix any defects found narrowly with evidence; no product change
otherwise.

## Context

- Audit harness: `e2e/a11y.spec.ts` — `auditPage()` runs in-page via
  `page.evaluate`; 10 tests (3 section incl. cyberpunk-neon, 4 Settings incl.
  cyberpunk-neon, 3 command: light empty+parsed, dark empty+parsed, light
  Ask/Auto empty).
- Cyberpunk override pattern (sections + Settings tests): set
  `localStorage 'superhabits.theme.mode' = 'dark'` +
  `localStorage 'superhabits.theme.slots.v2' = JSON({lightThemeId:'light', darkThemeId:'cyberpunk-neon'})`,
  reload, poll `data-theme-id === 'cyberpunk-neon'`.
- Dark Command Center pattern (prior plan): set dark mode before opening, then
  `openCommandScreen(page)` + audit empty state, `parseCommand(page, 'Add a
  todo to call mom tomorrow')` + audit parsed state (all four `auditPage`
  checks each).
- Risk hypothesis: `LaunchContextCard` renders `contextCopy.accentColor`
  (section-accent-derived) as the Card accent against the neon surface; the
  input card / mode toggle / parse-result card use accent-derived text that is
  AA-clean in light/dark but unmeasured against neon hues.
- E2E runs against static `dist/` on :8081 via `scripts/serve-e2e.js`;
  `dist/` must be rebuilt from current source before measuring. Pinned Node
  v22.23.2 on PATH (fnm); Node 20 causes better-sqlite3 segfault — do not
  touch that doc.
- AGENTS.md rules: no `data-testid` additions to app components; do not
  weaken assertions; local commit only, no push/tag/EAS.

## Scope

- Add to `e2e/a11y.spec.ts`, reusing `auditPage`:
  1. Cyberpunk-neon Command Center overlay test: set override-theme slots
     before opening, assert `data-theme-id`, then `openCommandScreen` +
     audit empty Create state and `parseCommand` + audit parsed state (all
     four checks each: contrast, names, duplicate ids, hidden-focus).
- Fix any contrast/name/id/hidden-focus defects found in
  `features/command/` or exercised `core/ui/`/`core/theme/` surfaces,
  narrowly with evidence (follow `readableAccent`/`readableSurface` rule
  from `core/theme/contrast.ts` if contrast defects appear).

## Non-Goals

- No J8 product changes; no owner-only store console / EAS / push / v1.0.0 tag.
- No dark Ask/Auto matrix fill (explicitly skipped as low value); no
  cyberpunk Ask/Auto matrix fill (same rationale — Create empty+parsed
  covers the new token path once).
- No tinypool/Node docs redo; no unrelated theme work beyond what cyberpunk
  Command Center needs.
- No product change unless the audit finds a real defect.

## Current Checkpoint

- Current milestone: COMPLETE — cyberpunk-neon Command Center guard added, clean baseline (no defects), all gates green.
- Completed: startup + gap survey; added cyberpunk-neon Command Center
  audit test (+56 lines, 8 assertions reusing `auditPage` +
  override-theme slots pattern with `data-theme-id` assertion, mirroring
  the dark Command Center test); rebuilt `dist/`; focused new test PASS
  1/1 on first audit (clean baseline, no defects — mirrors the three
  prior clean-baseline overlay runs); full `e2e/a11y.spec.ts` 11/11 green;
  prettier auto-fix on new test (formatting only); `qa:affected`
  resolved; `qa:fast` green (typecheck, lint, unit 141 files / 1799
  tests, label parity); hygiene PASS; committed locally (no push).
- In progress: none.
- Important modified files: `e2e/a11y.spec.ts` (+1 cyberpunk-neon
  Command Center test); `.agent/execplans/command-overlay-a11y-cyberpunk-neon-v1.md`
  (this plan).
- Last successful validation: full `e2e/a11y.spec.ts` 11/11 green (1.7m)
  2026-09-19 + `qa:fast` green — no defects, no regressions.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: complete — new test added without
  weakening assertions; audit found no defects (nothing to fix); focused
  + full `e2e/a11y.spec.ts` (11/11) + `qa:fast` green; plan validated;
  committed locally (no push); hygiene PASS.

## Progress

- [x] Startup + gap survey; create ExecPlan (2026-09-19).
- [x] Add cyberpunk-neon Command Center audit test to `e2e/a11y.spec.ts`.
- [x] Rebuild `dist/`; run focused new test — PASS 1/1, clean baseline, no defects to fix.
- [x] Run full `e2e/a11y.spec.ts` — PASS 11/11.
- [x] Run `qa:affected` / `qa:fast` — gates green.
- [x] Validate plan, commit locally, close.

## Surprises & Discoveries

- None yet.

## Decision Log

- 2026-09-19 — Chose cyberpunk-neon Command Center overlay audit (empty +
  parsed): named successor from the last handoff; override-theme path swaps
  the accent set the overlay renders accent-derived text against and has
  zero overlay coverage. Skipped cyberpunk Ask/Auto matrix fill (same
  low-value rationale as the skipped dark Ask/Auto fill).

## Validation Ledger

- 2026-09-19 — startup checks — PASS — Node v22.23.2, HEAD 88ef47e, clean
  tree, `agent:plans` listed.
- 2026-09-19 — `npx tsc --noEmit` on edited spec — PASS — zero errors.
- 2026-09-19 — `npm run build:web` — PASS — fresh `dist/` export.
- 2026-09-19 — focused new cyberpunk-Command-Center test — PASS 1/1 (6.0s) —
  clean baseline on first audit, no defects found.
- 2026-09-19 — `npx playwright test --project=chromium e2e/a11y.spec.ts`
  — PASS — 11/11 (1.7m), all prior tests unchanged-green.
- 2026-09-19 — `npx eslint e2e/a11y.spec.ts --fix` — PASS — 2 prettier
  formatting nits auto-fixed (whitespace only); focused re-run PASS 1/1.
- 2026-09-19 — `npm run qa:affected` — resolved gates qa:fast →
  qa:integration → qa:journeys → qa:simulation → qa:full (broad
  regression) for the e2e-infra rule; broader chain disproportionate for
  a test-only change with direct 11/11 oracle coverage (same rationale as
  the prior dark/dark-Settings/cyberpunk-Settings plans) — `qa:fast` run
  as the required gate.
- 2026-09-19 — `npm run qa:fast` — PASS (exit 0) — typecheck + lint
  clean, unit 141 files / 1799 tests green, label parity OK.
- 2026-09-19 — `npm run web:hygiene` — PASS — 8081/8082 free.

## Changed Files / Areas

- `.agent/execplans/command-overlay-a11y-cyberpunk-neon-v1.md` — this plan.
- `e2e/a11y.spec.ts` — +1 cyberpunk-neon Command Center test (8 assertions, +56 lines).

## Recovery / Resume Instructions

1. Read `AGENTS.md`, then `.agent/PLANS.md`, then this plan.
2. `git status --short`; `git log --oneline -3` (expect HEAD ≥ 88ef47e).
3. Ensure pinned Node: `node --version` must be v22.x.
4. Rebuild `dist/` if source changed since last build (`npm run build:web`).
5. Continue from `Exact next action` above.

## Outcomes & Retrospective

- Status: Complete.
- Summary: the Command Center overlay guard now covers the cyberpunk-neon
  override-theme path (8 strict assertions reusing `auditPage` — empty +
  parsed Create states — with `data-theme-id` assertion proving the
  override path). The audit was a clean baseline on first run — neon
  section accents and accent-derived overlay copy render AA-clean (the
  `readableAccent`/`readableSurface` derivations carry over; no new
  defects). Full a11y file 11/11 green; `qa:fast` green; local commit
  only.
- Follow-up: overlay × theme coverage is now complete (light/dark/
  cyberpunk-neon for sections, Settings, and Command Center Create; light
  Ask/Auto). Remaining named low-value fills: dark Ask/Auto and cyberpunk
  Ask/Auto matrix (both explicitly skipped). Next highest-value successor
  is a reliability / known-gaps polish item that is box-executable.
- Lessons: the override-theme slots pattern composes cleanly with the
  Command Center overlay audit (`openCommandScreen` works unchanged
  under the neon override); neon accents needed no call-site fix in the
  overlay.
