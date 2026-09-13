# ExecPlan: Warm Momentum 2.4 — Reliability, Heavy-State Performance, Product Completion

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

The app stays stable under real weight: no service-worker registration
crash on reload races, journey tests cannot silently rot against renamed
labels, heavy-state performance headroom is visible before it becomes a
failure, and the cheap remaining product gaps are closed. No
domain/data/sync/Gym V2 changes.

## Context

- WM2.3 closed (`7a0983b` on origin/main) with full Chromium 116/0, 3× P0
  25/25, hygiene PASS. Retrospective items carried here: workbox
  `waiting` crash evidence; "main/nightly-only lanes rot silently".
- Crash evidence: workbox-window 7.3.0 `register()` — during the WM2.3
  diagnostic (reload-during-seed), `navigator.serviceWorker.register()`
  resolved `undefined` and workbox's `this._registration.waiting` threw
  `TypeError: Cannot read properties of undefined (reading 'waiting')`
  (unhandled rejection; app survived).
- P2 journey ceiling headroom: maxSwitch 704ms against 800ms ceiling
  (12% headroom at the worst step) — visible drift tracking is the goal.

## Scope

- `core/pwa/registerServiceWorker.ts` registration-boundary hardening.
- New `scripts/journey-label-parity.mjs` + parser unit test + `qa:fast`
  wiring.
- P2 journey headroom metadata + 15% floor.
- Known-gaps triage sweep (CLOSED/DEFERRED/EXTERNAL) in
  `docs/testing/known-gaps.md`.
- Docs `docs/ui-ux/11-warm-momentum-2-4.md`.

## Non-Goals

- No workbox replacement or patch-package fork, no PWA update-UX
  redesign, no new perf frameworks, no native lanes, no domain/data/sync
  changes, no new product surfaces.

## Current Checkpoint

- Current milestone: Campaign closed — all gates green, commits pushed.
- Completed: SW registration boundary guard + reload-race regression E2E
  (pwa-update 5/5, three consecutive runs); journey-label parity script +
  parser tests + qa:fast wiring + negative check (8 named failures on a
  scratch rename); P2 journey headroom metadata + 15% floor (adoption:
  maxSwitch 595ms/25.6% headroom); CG-7/CG-8/CG-9 closed in known-gaps;
  CG-9 required two proven mechanisms (proportional bounds; pickPort
  bind-race with child-watching probes + bounded retries) fixed to 8/8
  clean full-parallel vitest battery.
- In progress: none.
- Modified files: core/pwa/registerServiceWorker.ts, vitest.config.ts,
  tests/web-lifecycle.test.ts, tests/integration/fixtures.test.ts,
  tests/integration/portableLargeDataset.test.ts,
  scripts/journey-label-parity.mjs (new),
  tests/journeyLabelParity.test.ts (new), e2e/pwa-update.spec.ts,
  e2e/journeys/three-months-in.spec.ts, package.json (qa:fast),
  docs/testing/known-gaps.md, docs/ui-ux/11-warm-momentum-2-4.md,
  openspec/changes/harden-warm-momentum-2-4-reliability-performance-
  completion-v1/*.
- Last successful validation: typecheck 0 errors; lint clean;
  vitest 1892/1892 with 8/8 clean full-parallel battery; openspec
  validate (all) green; plan validate green; sim validate 23 scenarios;
  impact map valid; full Chromium 116 passed / 0 failed / 7 skipped;
  3 consecutive P0 25/25; web:verify exit 0 (117.3s, port released);
  web:hygiene PASS (8081/8082 free).
- Current failures: none.
- Relevant quarantines: none.
- Blockers: none.
- Exact next action: none — campaign closed.
- Remaining definition of done: complete.

## Progress

- [x] SW registration boundary guard + reload-race regression E2E.
- [x] Journey-label parity script + parser tests + qa:fast wiring + negative check.
- [x] P2 journey headroom metadata + 15% floor.
- [x] CG-7 / CG-8 / CG-9 closed in known-gaps with evidence.
- [x] Full gates green (see Validation Ledger); commits pushed.
- 2026-09-03: WM2.4 OpenSpec change created from WM2.3 retrospective
  evidence (SW race trace, label-rot class, headroom thinness).
- 2026-09-03: All four workstreams implemented and gated; CG-9 flake class
  root-caused (two mechanisms) and fixed; campaign closed and pushed.

## Surprises & Discoveries

- The SW race was real and reproducible from the WM2.3 diagnostic trace:
  workbox-window reads `registration.waiting` immediately after register()
  resolves, which can be `undefined` on reload races. A boundary `.then/
.catch` fully covers it — no workbox patch needed.
- CG-9 was two bugs wearing one coat: (a) timeouts tighter than the
  operation's meaning under parallel load (5s default vs real-SQLite
  integration tests), and (b) a `pickPort()` TOCTOU bind race where the
  readiness probe was not watching the child — a dead server burned the
  full probe budget instead of failing in ~100ms. Proportional bounds
  fixed (a); child-watching probes + a bounded 3-attempt spawn retry
  fixed (b). Eight-run full-parallel battery clean after both.
- The flake-hunt protocol that worked: loop `npm test` in the background
  with full-log retention until reproduction, then read the _captured_
  stack (timeout vs assertion tells the mechanism immediately).

## Decision Log

- D1: Defensive registration boundary, not a workbox patch — falsy
  registration → log-and-noop; `.catch()` at the call boundary; update
  flow unchanged.
- D2: Label parity is a static script in the PR lane, not a runtime E2E.
- D3: Headroom reporting lives inside the existing P2 journey metadata;
  15% floor assertion on budgeted steps.
- D4: Completion sweep is triage-first; no silent shrinking of the gaps
  list.

## Validation Ledger

- `npm run typecheck` — 0 errors (final code).
- `npm run lint` — clean at `--max-warnings 0`.
- `npm test` — 1892/1892 tests, 166 files; plus 8/8 clean full-parallel
  battery after the CG-9 bind-race fix (pre-fix: 4 failures across 7 runs).
- `npx openspec validate --all` — all items valid (49/49 with WM2.4).
- `npm run agent:plan:validate` — plan format valid.
- `npm run sim:validate` — 23 scenarios valid, apiLeg guards clean.
- `npm run qa:impact:validate` — impact map valid (13 rules).
- `node scripts/journey-label-parity.mjs` — OK (rail + all e2e maps agree);
  negative check: scratch rename → 8 named failures, exit 1.
- `npx playwright test e2e/pwa-update.spec.ts` — 5/5, three consecutive
  runs (incl. the new reload-race regression test).
- `npx playwright test e2e/journeys/three-months-in.spec.ts` — 7/7 with
  headroom reporting (coldOverview 554ms/88.9%, maxSwitch 595ms/25.6%,
  diarySearch 357ms/28.6%, pickerSearch 107ms/78.6%).
- `npm run e2e:journeys:p0` — 25/25, three consecutive runs (1.9m/1.5m/1.1m).
- Full Chromium suite — 116 passed / 0 failed / 7 skipped (11.8m).
- `npm run build:web` — exit 0 against final code.
- `npm run web:verify` — exit 0 in 117.3s (port released).
- `npm run web:hygiene` — PASS (8081/8082 free).

## Changed Files / Areas

- Planned: core/pwa/registerServiceWorker.ts, scripts/journey-label-
  parity.mjs, e2e/helpers/ (label maps), e2e/journeys/three-months-in.
  spec.ts, docs/testing/known-gaps.md, docs/ui-ux/11-warm-momentum-2-4.md,
  openspec/changes/harden-warm-momentum-2-4-reliability-performance-
  completion-v1/*.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan.
2. `git status --short` + `git log --oneline -3` (WM2.3 tip 7a0983b).
3. `npm run agent:resume -- --plan <this plan>`.
4. Resume from Current Checkpoint → "Exact next action".

## Outcomes & Retrospective

- WM2.4 shipped: SW registration can no longer crash on reload races
  (boundary-guarded, regression-gated by E2E); journey labels are guarded
  in the PR lane (the rot class from WM2.3 is closed structurally); P2
  journey reports headroom and fails below a 15% floor; CG-7/CG-8/CG-9
  closed with evidence.
- The CG-9 hunt consumed most of the campaign: ~30 full-parallel vitest
  runs across three fix iterations. Retrospective lesson: when a flake
  spans _different_ files per run, hunt mechanisms, not files — the first
  fix (timeouts) removed mechanism (a) and exposed mechanism (b), which
  only a captured stack trace could reveal.
- Remaining honest gaps stay listed in known-gaps (native lanes, live
  notification delivery, disposable-backend scheduling) with their
  DEFERRED/EXTERNAL rationale.
