# ExecPlan: command-overlay-a11y-dark-modes-v1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Extend the Command Center overlay DOM-level a11y guard (`e2e/a11y.spec.ts`,
added in `command-overlay-a11y-audit-v1`, commit ac9bde2) beyond the
light-theme Create-mode baseline. The overlay has three modes (Ask / Create /
Auto via `ModeToggle`) and theme-sensitive tokens; only light-theme Create
(empty + parsed) is guarded. Add strict `auditPage` coverage (WCAG AA
contrast, accessible names, duplicate ids, hidden-focus) for the dark-theme
overlay and for the Ask + Auto mode states, so a future palette/component
edit in those states cannot regress legibility or control naming silently.
Fix any defects found narrowly with evidence; no product change otherwise.

## Context

- Audit harness: `e2e/a11y.spec.ts` — `auditPage()` runs in-page via
  `page.evaluate`; sections already guarded in light, dark, and
  cyberpunk-neon themes. Settings overlay has two tests. Command overlay has
  one test (empty Create + parsed create-task, light only).
- Opener: `openCommandScreen(page)` in `e2e/helpers/commandObservation.ts`
  (Quick capture → Describe it → pin Create mode → `#command-input`
  visible). Mode switching: `ModeToggle` buttons named exactly `Ask`,
  `Create`, `Auto` (role=button). Theme switching pattern: set
  `localStorage 'superhabits.theme.mode' = 'dark'` then reload and poll
  `data-theme === 'dark'` (see dark-theme sections test).
- Modes render: Create → `CommandInputCard` + parse result cards;
  Ask → `AskConversationView`; Auto → `AutoModeView`. Both Ask/Auto have
  empty input states auditable without submitting anything.
- Prior plan: `.agent/execplans/command-overlay-a11y-audit-v1.md`
  (COMPLETED, commit ac9bde2). Baseline was clean; value here is the
  regression guard, not a fix.
- E2E runs against static `dist/` on :8081 via `scripts/serve-e2e.js`;
  `dist/` must be rebuilt from current source before measuring. Pinned Node
  v22.23.2 on PATH (fnm); Node 20 causes better-sqlite3 segfault (known-gap
  E1) — do not touch that doc.
- AGENTS.md rules: no `data-testid` additions to app components; do not
  weaken assertions; local commit only, no push/tag/EAS.

## Scope

- Add to `e2e/a11y.spec.ts`, reusing `auditPage`:
  1. Dark-theme command overlay test: set dark mode before opening, then
     audit empty Create state + parsed create-task state (mirror of the
     existing light test).
  2. Ask + Auto mode states test (light theme): open overlay, click `Ask`,
     audit empty Ask state; click `Auto`, audit empty Auto state.
- Fix any contrast/name/id/hidden-focus defects found in
  `features/command/` or exercised `core/ui/` surfaces, narrowly with
  evidence (follow `readableAccent`/`readableSurface` rule from
  `core/theme/contrast.ts` if contrast defects appear).

## Non-Goals

- No full theme×mode matrix (no dark Ask/Auto); dark Create + light Ask/Auto
  covers the new token paths without a 3×3 explosion. Sections already guard
  the three-theme path.
- No Vitest component-rendering infra (separate larger proposal).
- No J8 perf remeasure. No tinypool/Node doc redo. No push, no tag, no EAS.
- No product change unless the audit finds a real defect.

## Current Checkpoint

- Current milestone: COMPLETE — guard extended and green; no defects found.
- Completed: startup + gap survey; added 2 overlay audit tests (dark Create
  empty+parsed, light Ask/Auto empty — 16 strict assertions reusing
  `auditPage`); rebuilt `dist/`; focused Command Center run 3/3 green;
  full a11y file 8/8 green; `qa:fast` green (typecheck, lint, unit 141
  files / 1799 tests, label parity); plan validated; hygiene PASS;
  committed locally.
- Completed: startup (AGENTS.md + PLANS.md read, Node v22.23.2 confirmed,
  `agent:plans` listed, HEAD ac9bde2 confirmed ahead of origin, clean tree);
  gap survey (dark theme + Ask/Auto chosen); mode/theme switching mechanics
  confirmed (`ModeToggle` labels Ask/Create/Auto; dark via localStorage +
  reload + `data-theme` poll); selector survey (Ask/Auto toggle clicks are
  unique at click time; Ask card buttons are Ask/Try again, Auto card is
  Send); added 2 tests (+73 lines) to `e2e/a11y.spec.ts` reusing `auditPage`.
- In progress: validation — rebuild `dist/`, focused new-test run.
- Important modified files: `e2e/a11y.spec.ts` (+73 lines, 2 tests, 16 assertions).
- Last successful validation: full `e2e/a11y.spec.ts` 8/8 green (1.3m)
  2026-09-19 — dark overlay + Ask/Auto baselines clean, no defects found,
  no product change needed.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: (1) new tests added without weakening
  assertions; (2) focused a11y run green; (3) full `e2e/a11y.spec.ts` green;
  (4) `qa:fast` green per impact map; (5) plan validated; (6) local commit,
  no push; (7) hygiene (ports free).

## Progress

- [x] Startup + gap survey; choose dark theme + Ask/Auto (2026-09-19).
- [x] Add dark-theme overlay + Ask/Auto audit tests to `e2e/a11y.spec.ts`.
- [x] Rebuild `dist/`; run focused new tests; record baseline (3/3 green).
- [x] Fix defects if found (none found — clean baseline recorded).
- [x] Run full `e2e/a11y.spec.ts` (8/8 green).
- [x] Run `qa:fast` (green; no product change so no broader escalation).
- [x] Validate plan, commit locally, close.
- [ ] Validate plan, commit locally, close.

## Surprises & Discoveries

- Both new states were clean on first audit: dark Create (empty + parsed)
  and light Ask/Auto (empty) pass all four checks each — the overlay's
  cards already use contrast-safe variants across themes and modes. Value
  is the regression guard, not a fix (same pattern as the prior Run 1).

## Decision Log

- 2026-09-19 — Chose dark Create (empty+parsed) + light Ask/Auto (empty)
  over the full 3×3 matrix: covers each new token path once, keeps the
  increment focused and box-executable; sections already own the theme
  matrix. Dark Ask/Auto left as a named successor if these find anything
  theme-sensitive.

## Validation Ledger

- 2026-09-19 — startup checks — PASS — Node v22.23.2, HEAD ac9bde2, clean
  tree, `agent:plans` listed.
- 2026-09-19 — `npx tsc --noEmit` + `npx eslint e2e/a11y.spec.ts` — PASS —
  zero errors (one prettier format auto-fixed).
- 2026-09-19 — `npm run build:web` — PASS — fresh `dist/` export.
- 2026-09-19 — `npx playwright test --project=chromium e2e/a11y.spec.ts
  -g "Command Center"` — PASS — 3/3 (dark + Ask/Auto baselines clean).
- 2026-09-19 — `npx playwright test --project=chromium e2e/a11y.spec.ts`
  — PASS — 8/8 (1.3m), no regressions.
- 2026-09-19 — `npm run qa:fast` — PASS — typecheck + lint clean, unit
  141 files / 1799 tests green, label parity OK.
- 2026-09-19 — `npm run agent:plan:validate` — PASS — plan valid.
- 2026-09-19 — `npm run web:hygiene` — PASS — 8081/8082 free.

## Changed Files / Areas

- `e2e/a11y.spec.ts` — +2 tests reusing `auditPage` (+74 lines, 16 assertions).
- `.agent/execplans/command-overlay-a11y-dark-modes-v1.md` — this plan.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, then `.agent/PLANS.md`, then this plan.
2. `git status --short`; `git log --oneline -3` (expect HEAD ≥ ac9bde2).
3. Ensure pinned Node: `node --version` must be v22.x.
4. Rebuild `dist/` if source changed since last build (`npm run build:web`).
5. Continue from `Exact next action` above.

## Outcomes & Retrospective

- Status: Complete.
- Summary: the Command Center overlay guard now covers the dark theme
  (empty Create + parsed create-task) and the Ask + Auto mode states
  (empty), reusing the strict DOM-level `auditPage` harness — 16 new
  assertions, all clean on first audit, no product change needed. Full
  a11y file is 8/8 green; `qa:fast` green; local commit only.
- Follow-up: no theme-sensitive defects appeared, so dark Ask/Auto is a
  low-value matrix fill — skip unless the overlay gains theme-specific
  cards. Successor: bounded Vitest RN component-render infra proposal
  only if clearly high-value; otherwise further a11y on the next
  uncovered surface.
- Lessons: surveying button-label collisions before writing mode-switch
  clicks (Ask/Auto toggle vs card buttons) kept the new tests strict-mode
  safe with zero retries.
