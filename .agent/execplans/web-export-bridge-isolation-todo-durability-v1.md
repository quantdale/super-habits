# Web Export Bridge Isolation, Todo Quick-Add Durability & Final PR Acceptance

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Eliminate the remaining confirmed web-export (production `npm run build:web`)
abort and the Todo Quick-Add remount data-loss defect, independently certify the
combined PR #82 + PR #83 changes, and prepare (never apply) an owner-actionable
release-governance handoff. Production release stays blocked. The simulation
bridge security boundary is strengthened, never weakened.

## Context

- Branch state (verified 2026-10-22): `origin/main` = `e6cf0d34`, PR #82 head
  `a70026ec`, PR #83 head `caace05a` (stacked: merge-base(#82,#83)=#82 head;
  merge-base(main,#83)=main). Working tree clean on `e2e-stabilization-visual-fidelity`.
- Successor branch to publish: `web-export-bridge-isolation-v1` (created from
  verified PR #83 head `caace05a`). PR #82/#83 left unchanged.
- The two predecessor ExecPlans
  (`security-blocked-ci-qualification-recovery.md`, PR #82; and
  `e2e-stabilization-visual-release-gates.md`, PR #83) are COMPLETED.

### Production export root cause (PROVEN, not assumed)

`npm run build:web` (`scripts/build-dist-web.mjs`) aborts after export with
`ABORT[build:web]: the simulation data bridge reached a PRODUCTION export ...`
on BOTH Vercel projects AND locally at `caace05a`. This is a SOURCE defect on
every production export, not a Vercel/env issue.

Root cause: `build-dist-web.mjs` scans `dist/` for the needle `__shdatabridge`
(case-insensitive) via `scanDirectoryForNeedle`. That needle is the bridge
MODULE identifier `__shDataBridge`, which is ALWAYS bundled (AppProviders
statically imports `installSimulationDataBridge` from
`core/simulation/dataBridge`). Minified production bundle evidence (entry-*.js):

- UNARMED (prod): `installSimulationDataBridge=function(){if('undefined'==typeof
globalThis)return!1;return!1;const t=globalThis;return t.__shDataBridge||(...)}`
  and `isBridgeEnabled = function _(){return!1}`.
- ARMED (sim): `...return!1;0;const t=globalThis;return t.__shDataBridge||(...)}`
  and `isBridgeEnabled = function _(){return!0}`.

So in production the bridge is NOT armed (`isBridgeEnabled()` folds false, the
installer returns before installing, `window.__shDataBridge` is never created);
the identifier survives only as (a) the `BRIDGE_GLOBAL='__shDataBridge'` const
and (b) unreachable dead code after `return!1`. The minifier erases any stable
armed-only SUBSTRING (`return!0` vs `return!1`), so NO substring scan of the
bundle can soundly distinguish armed from unarmed. The guard is therefore a
false positive on the inert identifier.

### The security invariant (Phase 1.C)

A production/ordinary-preview export must expose NO callable simulation
mutation bridge. Bridge may exist only in an explicitly authorized hermetic
simulation build. No public-env authorization; no global mutation API; no
user-controlled activation; no production fixture use; release-profile guard
unweakened.

### Fix strategy (build-time module isolation — the stronger isolation contract)

The sound fix is to EXCLUDE the `dataBridge` mutation module from production
Metro bundles entirely (a no-op stub), so `__shDataBridge` is genuinely absent
from production artifacts. Then the existing `__shdatabridge` guard becomes a
SOUND, fail-closed proof of absence (it still aborts if the real module ever
leaks in), rather than an over-broad false positive. The guard is NOT weakened,
deleted, or made to ignore the mutation API.

- `core/simulation/dataBridge.stub.ts` (new): exports only
  `installSimulationDataBridge(): boolean => false`. No `__shDataBridge`, no
  mutation API.
- `metro.config.js`: `resolver.resolveRequest` routes the `dataBridge` specifier
  to the stub unless the build is the authorized hermetic sim build; delegates
  all other specifiers to the default resolver (metro-resolver sets
  `context.resolveRequest = resolve`, so `@/` still resolves).
- Build-control env `SH_SIM_BRIDGE` (`armed` = real module; anything else =
  stub). `build-dist-e2e.mjs` (sim path) sets `armed`; `build-dist-web.mjs` sets
  `disabled` explicitly (dotenv cannot override an already-set env var), making
  production dotenv-proof and fail-closed.

## Scope

- P1: production web-export abort + simulation-bridge isolation, negative tests,
  hosted Vercel verification (report-only).
- P2: Todo Quick-Add remount state loss — reproduce, fix, regression tests.
- P3: visual-evidence integrity spot-check (preserve strict comparison).
- P4: workout draft-durability regression re-verification.
- P5: combined PR #82+#83+successor read-only acceptance review.
- P6: release-governance handoff (prepare only; do NOT apply).
- P7: validation ledger.

## Non-Goals

- No merge to main; no deployment; no ruleset/environment/Vercel setting changes;
  no dependency-security exceptions; no test suppression; no tolerance widening;
  no major framework upgrades; no workout persistence redesign.

## Current Checkpoint

- Current Milestone: Phase 1 root cause proven + design locked; implementing fix.
- Completed: Phase 0 state verified (SHAs/stacking); predecessor plans read;
  production abort reproduced locally with the exact Vercel message; unarmed vs
  armed minified bundle ground-truth captured; sound fix (module isolation)
  designed; no other app code references `__shDataBridge` outside `dataBridge.ts`.
- In Progress: implementing module isolation (stub + metro resolver + build env).
- Important modified files (planned): `core/simulation/dataBridge.stub.ts` (new),
  `metro.config.js`, `scripts/build-dist-web.mjs`, `scripts/build-dist-e2e.mjs`,
  plus regression tests under `tests/`.
- Last successful validation: `npm run build:e2e:sim` (armed, bridge present),
  `npm run build:web` reproduces abort (pre-fix).
- Exact next action: create `dataBridge.stub.ts`, wire the metro resolver, update
  build scripts, then validate `npm run build:web` passes and `dist/` has no
  `__shDataBridge`, while `build:e2e:sim` retains it.
- Remaining DoD: Phases 1–7 complete; successor branch + PR published; final
  report produced.

## Progress

- [x] Phase 0 state verification
- [x] Phase 1.A reproduce + root-cause (module identifier false positive)
- [ ] Phase 1.D fix (module isolation)
- [ ] Phase 1.E negative tests
- [ ] Phase 1.F hosted Vercel verification (report-only)
- [ ] Phase 2 Todo Quick-Add fix + regression
- [ ] Phase 3 visual evidence spot-check
- [ ] Phase 4 workout regression re-verify
- [ ] Phase 5 combined PR acceptance review
- [ ] Phase 6 governance handoff (prepare)
- [ ] Phase 7 validation ledger
- [ ] Phase 8 adversarial independent review
- [ ] Phase 9 publish successor PR
- [ ] Phase 10 final report

## Surprises & Discoveries

- The minifier folds `isBridgeEnabled()` to `return!0`/`return!1` and leaves the
  `__shDataBridge` assignment as reachable (armed) or unreachable (unarmed) dead
  code — but the STRING `__shDataBridge` is present in BOTH. Substring scanning
  cannot be a sound armed-detector; module exclusion is the only sound static
  proof. This is why the guard must stay broad (`__shdatabridge`) and isolation
  must move to the module graph.
- Only `AppProviders.tsx` pulls `dataBridge` into the Metro bundle;
  `simulation/runner/apiLeg.ts` and the Vitest integration test consume it
  outside Metro (Node/browser), so stubbing the module is safe.

## Decision Log

- Use build-time module isolation (Metro resolver stub) as the "stronger
  isolation contract", keeping the `__shdatabridge` guard as fail-closed proof.
  Rationale: satisfies "replace/refine proof only with an independently verified
  stronger isolation contract"; does NOT weaken the guard (it stays broad and
  fail-closed); deterministic (not dependent on terser DCE quirks).

## Validation Ledger

- (to be filled) typecheck, lint, unit, integration, prod build (no `__shDataBridge`),
  sim build (bridge present), bridge isolation tests, Todo regression, workout
  reload regression, chromium/visual/p0 journeys, ciLaneIntegrity, dependency
  audit (expected red: braces, node-forge).

## Changed Files / Areas

- `core/simulation/dataBridge.stub.ts` — no-op stub (no mutation API, no global).
- `metro.config.js` — resolver-based module isolation.
- `scripts/build-dist-web.mjs` / `scripts/build-dist-e2e.mjs` — build-control env.
- `features/todos/TodosScreen.tsx` — Quick-Add remount fix (Phase 2).
- `tests/*` — bridge isolation + Todo regression tests.

## Recovery / Resume Instructions

1. `git -C <repo> status --short` (expect clean on the successor branch).
2. Read this plan's `Current Checkpoint`; resume from `Exact next action`.
3. Verify SHAs: main `e6cf0d34`, PR82 `a70026ec`, PR83 `caace05a`.
4. Validate with `npm run build:web` (must pass, no `__shDataBridge` in dist) and
   `npm run build:e2e:sim` (bridge present).
