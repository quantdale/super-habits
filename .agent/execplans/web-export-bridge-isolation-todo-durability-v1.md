# Web Export Bridge Isolation, To Do Quick-Add Durability & Final PR Acceptance

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Eliminate the confirmed web-export (production `npm run build:web`) abort and the
To Do Quick-Add remount data-loss defect, independently certify the combined
PR #82 + PR #83 changes, and prepare (never apply) an owner-actionable
release-governance handoff. Production release stays blocked. The simulation
bridge security boundary is strengthened, never weakened.

## Context

- Branch: `web-export-bridge-isolation-v1` (successor to PR #83 head
  `caace05a`), published as PR #84 (stacked on #83). Ancestry:
  `main` `e6cf0d34` → PR #82 `a70026ec` → PR #83 `caace05a` → PR #84
  `fcfdb2e8`. PR #82/#83 left unchanged. This campaign's engineering is confined
  to the successor branch.
- Predecessor ExecPlans (`security-blocked-ci-qualification-recovery.md`, PR #82;
  `e2e-stabilization-visual-release-gates.md`, PR #83) are COMPLETED.

### Production export root cause (PROVEN, not assumed)

`npm run build:web` aborted on BOTH Vercel projects AND locally at `caace05a`
with `ABORT[build:web]: the simulation data bridge reached a PRODUCTION export`.
This is a SOURCE defect on every production export, not a Vercel/env issue.

`build-dist-web.mjs` scans `dist/` for the needle `__shdatabridge`
(`scanDirectoryForNeedle`). That needle is the bridge MODULE identifier
`__shDataBridge`, which is ALWAYS bundled (AppProviders statically imports
`installSimulationDataBridge`). Minified production bundle ground truth
(entry-*.js): UNARMED (prod) `installSimulationDataBridge=function(){…return!1;
return!1;const t=globalThis;return t.__shDataBridge||…}` + `isBridgeEnabled =
function _(){return!1}`; ARMED (sim) `…return!1;0;const t=globalThis;return
t.__shDataBridge||…}` + `isBridgeEnabled = function _(){return!0}`. So in
production the bridge is NOT armed (installer returns before installing;
`window.__shDataBridge` never created); the identifier survives only as (a) the
`BRIDGE_GLOBAL='__shDataBridge'` const and (b) unreachable dead code. The
minifier erases any stable armed-only substring, so NO substring scan can
soundly distinguish armed from unarmed. The guard was therefore a false positive
on the inert identifier.

### The security invariant

A production/ordinary-preview export must expose NO callable simulation mutation
bridge. The bridge may exist only in an explicitly authorized hermetic simulation
build. No public-env authorization; no global mutation API; no user-controlled
activation; no production fixture use; release-profile guard unweakened.

### Fix strategy (build-time module isolation — the stronger isolation contract)

EXCLUDE the `dataBridge` mutation module from production Metro bundles entirely
(a no-op stub), so `__shDataBridge` is genuinely absent from production
artifacts. The unchanged `__shdatabridge` guard then becomes a SOUND, fail-closed
proof of absence (it still aborts if the real module ever leaks in). The guard is
NOT weakened, deleted, or made to ignore the mutation API.

- `core/simulation/dataBridge.stub.ts` (new): exports only
  `installSimulationDataBridge(): boolean => false`. No mutation API, no global,
  and its source contains the bridge identifier nowhere.
- `metro.config.js` + `scripts/metro-sim-bridge-resolver.js`: resolver routes the
  `dataBridge` specifier to the stub unless `SH_SIM_BRIDGE === 'armed'` (set only
  by `build-dist-e2e.mjs` for `build:e2e:sim`).
- Build-control env `SH_SIM_BRIDGE` (`armed` = real module; anything else = stub).
  `build-dist-web.mjs` sets `disabled` explicitly (dotenv cannot override an
  already-set env var), making production dotenv-proof and fail-closed.

## Scope

- P1: production web-export abort + simulation-bridge isolation, negative tests,
  hosted Vercel verification (report-only).
- P2: Quick-Add remount state loss — reproduce, fix, regression tests.
- P3: visual-evidence integrity (preserve strict comparison).
- P4: workout draft-durability regression re-verification.
- P5: combined PR #82+#83+successor read-only acceptance review.
- P6: release-governance handoff (prepare only; do NOT apply).
- P7: validation ledger.

## Non-Goals

- No merge to main in this campaign; no deployment; no ruleset/environment/Vercel
  setting changes; no dependency-security exceptions; no test suppression; no
  tolerance widening; no major framework upgrades; no workout persistence
  redesign. (Controlled main integration is a separate, later owner-directed
  operation outside this plan's engineering scope.)

## Current Checkpoint

- Current Milestone: Complete — PR #84 engineering (production web-export bridge
  isolation + To Do Quick Add durability) implemented, independently verified,
  and published on the PR #84 successor head (engineering landed through
  `d5fa162e`, finalized at `fcfdb2e8`).
- Completed: state + stacking verified; production abort reproduced locally with
  the exact Vercel message; unarmed-vs-armed minified ground truth captured; root
  cause proven to be an over-broad guard matching the always-bundled inert module
  identifier; build-time module isolation implemented (stub + metro resolver +
  build-control env); negative/fixture/routing tests added; production export
  proved bridge-free and hermetic sim export proved bridge-armed; Quick Add draft
  lifted to survive empty/populated remounts with a discriminating E2E + durable
  DB/outbox assertions; workout reload regression re-verified (Work-timer signal);
  strict visual suite green with zero golden changes; combined stacked-PR
  acceptance review recorded; release-governance handoff prepared (not applied).
- In Progress: None — campaign engineering complete.
- Important modified files: `core/simulation/dataBridge.stub.ts`,
  `scripts/metro-sim-bridge-resolver.js`, `metro.config.js`,
  `scripts/build-dist-web.mjs`, `scripts/build-dist-e2e.mjs`,
  `tests/productionBridgeIsolation.test.ts`, `features/todos/TodosScreen.tsx`,
  `features/todos/TodoQuickCapture.tsx`, the Quick Add durability E2E spec (exact
  paths in Changed Files / Areas), and this plan.
- Last successful validation: `npm run agent:plan:validate:all` pass;
  `npm run typecheck` pass (0 errors); `npm run lint` pass (0/0);
  `npm test` pass (3069 passed / 3 skipped); `npm run build:web` pass (dist
  bridge-free); `npm run build:e2e:sim` pass (bridge armed); bridge-isolation
  tests pass; Quick Add durability E2E 3/3; workout reload regression pass;
  visual 34/34 strict; P0 journeys 25/25. Dependency-security audit remains red
  (external release blocker, not campaign engineering).
- Current failures: None in campaign scope. The dependency-security audit
  (`braces`, `node-forge`) stays red by design as an external release blocker.
- Relevant quarantines: None introduced. Known external gates (hosted Supabase
  qualification, backup-provenance rollout, old-client compatibility, native
  lifecycle/SH-11/SH-21 certification, dependency-security advisories) are
  tracked as release blockers, not as this campaign's work.
- Blockers: None blocking this campaign's engineering. Source integration and
  production release remain owner-gated on the unresolved dependency-security
  advisories and a verified production-deployment hold.
- Exact next action: None — no further implementation action for this campaign.
- Remaining definition of done: None — all campaign engineering complete and
  validated. External release gates are tracked in Outcomes & Retrospective and
  the acceptance report as release blockers.

## Progress

- [x] Phase 0 state verification (SHAs, stacking, predecessor plans)
- [x] Phase 1.A reproduce + root-cause (over-broad guard vs inert module identifier)
- [x] Phase 1.D fix (build-time module isolation)
- [x] Phase 1.E negative tests (stub purity, resolver routing, guard fixture)
- [x] Phase 1.F hosted Vercel verification (both preview projects build)
- [x] Phase 2 Quick-Add fix + discriminating E2E regression
- [x] Phase 3 visual evidence integrity (34/34 strict, zero golden changes)
- [x] Phase 4 workout regression re-verify (Work-timer durability signal)
- [x] Phase 5 combined stacked-PR acceptance review
- [x] Phase 6 governance handoff prepared (not applied)
- [x] Phase 7 validation ledger
- [x] Phase 8 adversarial independent review
- [x] Phase 9 publish successor PR (#84)
- [x] Phase 10 final acceptance report produced

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
- Quick Add draft loss was two-fold: two component instances AND a
  `Screen` scroll-container swap (`ScrollView`↔`View`) that remounts the subtree
  on empty/populated flips. Lifting the draft into the section (controlled
  component) is what makes the no-data-loss guarantee hold across ANY remount.

## Decision Log

- Use build-time module isolation (Metro resolver stub) as the stronger isolation
  contract, keeping the `__shdatabridge` guard as fail-closed proof. Rationale:
  satisfies "replace/refine the proof only with an independently verified stronger
  isolation contract"; does NOT weaken the guard (it stays broad and fail-closed);
  deterministic (not dependent on minifier DCE quirks).
- Lift Quick Add draft state into the section and keep a single stable instance.
  Rationale: state-lifting guarantees the data contract across the scroll-container
  remount; the single instance removes the duplicate control. No layout change
  (pixel-identical per strict visual suite).

## Validation Ledger

- `npm run typecheck` — pass (0 errors).
- `npm run lint` (max-warnings 0) — pass (0 errors, 0 warnings).
- `npm test` (unit + integration) — pass (3069 passed, 3 skipped, 0 failed).
- `tests/ciLaneIntegrity.test.ts` — pass (13/13).
- `npm run build:web` (production) — pass (dist/ contains no bridge identifier).
- `npm run build:e2e:sim` (hermetic simulation) — pass (dist-sim/ retains the
  armed mutation bridge).
- `tests/productionBridgeIsolation.test.ts` — pass (stub purity, resolver
  routing, guard injection-fixture detection).
- Quick Add durability E2E (chromium) — pass (3/3; DB + sync_outbox verified).
- Workout reload regression (chromium) — pass (Work-timer durability signal).
- Visual regression — pass (34/34 at `maxDiffPixels: 0`, zero golden changes).
- P0 journeys — pass (25/25).
- `scripts/audit-runtime-deps.mjs` — RED (exit 1): `braces` + `node-forge`
  unresolved highs (external release blocker; no exception added).
- `npm run agent:plan:validate:all` — pass (all versioned plans valid).

## Changed Files / Areas

- `core/simulation/dataBridge.stub.ts` — no-op stub (no mutation API, no global).
- `scripts/metro-sim-bridge-resolver.js` — tested resolver decision logic.
- `metro.config.js` — resolver-based module isolation.
- `scripts/build-dist-web.mjs` / `scripts/build-dist-e2e.mjs` — build-control env
  - strengthened non-requesting guard.
- `features/todos/TodosScreen.tsx` — single stable Quick Capture + lifted draft.
- `features/todos/TodoQuickCapture.tsx` — controlled draft (title/onTitleChange).
- `e2e/todo-quickadd-durability.spec.ts` — discriminating Quick Add durability E2E.
- `tests/productionBridgeIsolation.test.ts` — bridge isolation + guard tests.
- `docs/reports/web-export-todo-durability-acceptance-report.md` — acceptance report.

## Recovery / Resume Instructions

1. `git -C <repo> status --short` (expect clean on the successor branch).
2. Read this plan's `Current Checkpoint` and `Outcomes & Retrospective`.
3. Verify SHAs: main `e6cf0d34`, PR82 `a70026ec`, PR83 `caace05a`, PR84
   `fcfdb2e8`.
4. This campaign's engineering is COMPLETED. Do not repeat it. Any further work is
   the separate owner-directed source integration / release-governance effort
   (see the acceptance report and the new integration report), not this plan.

## Outcomes & Retrospective

Delivered and independently verified on the PR #84 successor head (engineering
through `d5fa162e`, finalized `fcfdb2e8`):

- Production web-export abort resolved by BUILD-TIME MODULE ISOLATION: the
  simulation mutation module is excluded from ordinary exports (no-op stub), so
  the unchanged `__shdatabridge` guard is now a sound, fail-closed proof of
  absence rather than a false positive on the inert identifier. Proven
  positively (hermetic sim export retains the armed bridge) and negatively
  (production export contains no bridge identifier; injected fixtures are
  detected; ambient/dotenv flags cannot arm the module).
- Quick Add draft durability resolved by a single stable instance plus lifted
  draft state; a discriminating E2E proves unsaved text survives empty↔populated
  transitions, submits exactly one To Do, and writes the correct durable DB row
  and sync_outbox intent. Reload boundary documented separately.
- Workout reload/recovery durability preserved; the prior "Skip set" review
  finding is resolved (the readiness signal is the Work timer, tied to the
  settled draft write).
- Strict cross-platform visual evidence preserved (34/34 at `maxDiffPixels: 0`,
  zero golden/tolerance/mask changes).
- Security integrity preserved: `braces` (GHSA-vfj7-8cjw-p6xm) and `node-forge`
  (GHSA-86w9-cpqp-85rv) remain unresolved highs; the dependency-security audit
  stays red with no exception, no allowlist change, and no gate weakening. CI
  remains honest (green E2E never flips the run green while the audit is red).

NOT complete here (external release blockers, tracked separately — not campaign
engineering and not claimed as done): hosted Supabase Auth/PostgREST/RLS
qualification; production backup-provenance migration rollout; old-client
compatibility; native Android/iOS lifecycle qualification; SH-11 native
scheduling rejection; SH-21 cloud-artifact inspection; remediation of the two
dependency-security advisories; and the production-release governance enablement
(main branch/environment protections, Vercel deployment authorization). A
verified production-deployment hold and owner governance decisions are
prerequisites to any unqualified production promotion. Production release is NOT
authorized by this campaign.
