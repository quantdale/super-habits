# ExecPlan: Production Gym Convergence and Real-World Certification

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Reconcile the clean-room OpenGym-inspired design slice with the already-shipped
SuperHabits Gym V2 implementation so the repository has one truthful production
Gym, no discoverable fake prototype route, accurate planning/documentation state,
and evidence from realistic browser and native use. The campaign is complete
only when repository-owned Critical/High defects found during the audit are
fixed with regression proof and the exact pushed `main` state is verified.

## Context

- Repository: `quantdale/super-habits` at `D:\Documents\tryPython\superhabits`.
- Starting SHA: `2a13a3181aafe87689ebe291f9e34b549745f22f` (`main`), clean and
  equal to `origin/main` at campaign start.
- The canonical app is a single-page Expo/React Native shell. Workout is the
  production Gym surface under `features/workout/WorkoutScreen.tsx`; local
  SQLite is authoritative and the existing backup/sync contracts remain in
  force.
- The historical Phase-0 design slice is `features/workout/OpenGymInspiredGymPrototype.tsx`
  exposed by `app/gym-prototype.tsx`; it uses hard-coded representative data
  and no-op handlers.
- Completed Gym contracts are preserved in the archived records
  `openspec/changes/archive/2026-08-30-add-gym-training-system-v2/`,
  `openspec/changes/archive/2026-08-30-add-gym-workout-v2/`, and
  `openspec/changes/archive/2026-08-30-harden-post-gym-release-convergence-v1/`.
- At campaign start, `.agent/EXECUTION_PROMPT.md` still named the already-
  completed async/lifecycle campaign as active. This campaign reconciled that
  handoff without reopening landed async work; the handoff now records this
  campaign as completed.
- Relevant rules read before implementation: `AGENTS.md`, `.agent/PLANS.md`,
  project/rule docs, feature/RN/DB skills, and `docs/testing/autonomous-qa.md`.

## Scope

- Side-by-side semantic audit of the prototype and all current Gym surfaces:
  Today/planning, routine builder/detail, catalog/custom exercises, guided
  sessions, timers/recovery, progression/history/analytics, body weight,
  reminders, and backup/restore/sync boundaries.
- Integrate only product ideas that are demonstrably missing or materially
  improve the real implementation, using existing SQLite/domain/UI/testing
  seams; no second state or persistence system.
- Remove the fake prototype route/component unless the audit proves a
  development-only fixture is still necessary.
- Reconcile OpenGym documentation, current Gym documentation/maps/README, the
  active handoff, OpenSpec lifecycle state, and non-archived completed changes.
- Execute affected and broad static, browser, simulation, recovery/sync, and
  available Android QA; fix and retest repository-owned failures.
- Commit coherent milestones, push `main` under repository governance, and
  verify exact remote SHA/CI status where access permits.

## Non-Goals

- No OpenGym AGPL source, assets, dataset, CSS, icons, or copied text.
- No new top-level navigation tab, second Workout product, new state-management
  framework, two-way sync rewrite, or unrelated feature expansion.
- No destructive reset of user work, migration rewrite, production secrets,
  guessed Supabase operations, or iOS claims from Windows.
- No blanket archiving of OpenSpec changes based only on checked boxes; each
  lifecycle decision must be supported by code, evidence, and current Git.

## Current Checkpoint

- Current milestone: Evidence-led Gym UX fixes, stale-prototype removal,
  OpenSpec/doc lifecycle reconciliation, route-free build verification, and
  focused/infrastructure/integration/timezone/static-contract/deterministic/P0
  checks are green. The full local-only browser matrix, dummy remote-boundary
  sync lane, broad gates, and milestone push are complete; the final plan
  closure and exact-head status record are captured here.
- Completed: Read repository startup/control-plane docs, Gym/OpenGym master
  plan, Gym V2 proposals/design/spec/tasks/ExecPlans, post-Gym convergence
  artifacts, production Workout implementation, and relevant feature/domain/data
  code. Ran required Git, plan, and OpenSpec baseline commands.
- In progress: none. The Exercise library now explains empty results, adapts
  equipment choices to the active search/body-area/modality, and offers a
  reset. The builder Start action is a guarded fixed modal footer, and Week
  actions expose 44 px targets/selected semantics. A focused test initially
  exposed that the full-week editor labeled
  every Rest chip identically; `PillChip` now supports contextual labels and
  Workout supplies weekday-specific labels. Its first post-fix run also
  required updating assertions to the now-contextual names and exposed that
  `PillChip` itself remained 40 px high; the global pill minimum is now 44 px.
  The landing `WorkoutWeekCard` initially still measured 37.125 × 24 px because
  NativeWind did not apply its arbitrary class dimensions; explicit inline min
  dimensions are now added and the E2E assertion covers both surfaces.
  The final agent-browser visual pass confirms 44 × 44 landing controls and a
  fully in-viewport builder footer at 390 × 844. The prototype files are
  deleted, the master plan records the Phase-0 slice as historical/removed,
  and OpenSpec archive cleanup reduced active work to one explicitly blocked
  external simulation change. Native qualification remains blocked because
  all local AVDs are API 35.
- Important modified files: `core/ui/Modal.tsx`, `core/ui/PillChip.tsx`,
  `features/workout/WorkoutScreen.tsx`,
  `features/workout/RoutineDetailScreen.tsx`, and
  `features/workout/WorkoutGymPanels.tsx`, plus this plan and gitignored
  dogfood evidence; the two prototype files are removed. Current Gym/docs
  maps, the 16 archived OpenSpec change records under
  `openspec/changes/archive/2026-08-30-*/`, the corresponding current specs,
  and the blocked simulation proposal are also reconciled.
- Last successful validation: updated source `npm run typecheck` and changed-
  file ESLint passed with zero warnings; full focused Workout/Gym browser
  evidence is 15/15; agent-browser visual checks confirm fixed mobile
  dimensions/footer; `npm run openspec:validate` passed 45/45 after archive
  reconciliation. The rebuilt export now has exactly three static routes and
  no `/gym-prototype` artifact; OpenSpec 45/45 and plan validation are green.
  The route-free focused Workout/Gym suite is 15/15, infrastructure is 10/10,
  and real-SQLite integration is 227/227. The timezone matrix is 5 zones × 43
  tests, all green; themes are 140/140, Supabase schema and impact maps are
  valid, simulation model is 23/23, deterministic simulation is 23/23, and all
  versioned plans validate. The workstation-configured browser run recorded
  222 passed, 14 expected remote-capability skips, and 2 isolated
  environment/timing classifications; the clean local-only rerun passed 194
  tests with 44 expected capability skips. The current local-only rebuild
  contains no public Supabase credentials.
- Current failures: None observed in repository-owned gates. Native smoke,
  persistence, and lifecycle are environment-blocked by the API-35-only local
  Android targets; iOS is environment-blocked by missing Xcode tooling.
- Relevant quarantines: Native/iOS/remote evidence from prior campaigns is
  historical until independently rerun on this exact source tree.
- Blockers: No local implementation blocker. Native Android remains an
  environment blocker because all installed AVDs are API 35; iOS, Supabase,
  GitHub status, and Vercel availability must be checked rather than assumed.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — preserve the completed convergence commit and
  evidence; no further repository mutation is needed for this campaign.
  `format:check` is a known baseline gap in 67 historical/agent files; changed
  campaign files have targeted formatting checks and `git diff --check`.
- Remaining definition of done: All repository-supported definition-of-done
  items are satisfied; native lanes are explicitly environment-blocked, and
  the final report records the exact pushed `main` and CI availability.

## Progress

- [x] Read required repository, workflow, feature/RN/DB, Gym/OpenGym, QA, and
      OpenSpec artifacts.
- [x] Establish exact starting Git state and run baseline plan/OpenSpec checks.
- [x] Perform semantic prototype-vs-production audit and real runtime review.
- [x] Decide and implement the smallest coherent production UX improvements.
- [x] Remove/quarantine the stale prototype route and reconcile docs.
- [x] Classify and safely reconcile non-archived OpenSpec lifecycle drift.
- [x] Run affected QA, browser/P0/simulation/recovery lanes, and native lanes
      where the environment supports them.
- [x] Fix, regression-test, and retest all repository-owned defects found.
- [x] Complete final validation, commit/push, exact-head verification, and
      close this ExecPlan.

## Surprises & Discoveries

- The expected starting SHA is exact: `2a13a318`, and `main` already equals
  `origin/main`.
- The production tree already contains the major OpenGym concepts (Today,
  weekly plan/overrides, catalog/custom exercises, modality-aware sessions,
  progression, history, body weight, and recovery), while the prototype remains
  a hard-coded design slice.
- OpenSpec CLI currently reports multiple changes as `in-progress` despite
  many completed ExecPlans; task-checkbox drift must be audited individually.
- The repository-local executor handoff is stale relative to the completed
  async/lifecycle ExecPlan and current Git history.

## Decision Log

- 2026-08-30 — Use a new non-OpenSpec campaign ExecPlan initially — the first
  milestone is reconciliation/certification; open a new OpenSpec change only if
  the audit proves a material new product contract is needed.
- 2026-08-30 — Treat `WorkoutScreen` plus its real data/domain/session/detail
  surfaces as the only production Gym; the Phase-0 route is not a fallback
  product surface.
- 2026-08-30 — Preserve frozen historical OpenSpec evidence and compatibility
  fixtures while correcting only current-facing lifecycle/status claims.

## Validation Ledger

- 2026-08-30 — `git status --short` — PASS; clean starting tree.
- 2026-08-30 — `git branch -vv`, `git branch -a`, `git log --oneline --decorate -30` —
  PASS; only local `main` plus `origin/main`, HEAD `2a13a318`.
- 2026-08-30 — `git remote -v` and local/remote SHA comparison — PASS;
  `main == origin/main == 2a13a3181aafe87689ebe291f9e34b549745f22f`.
- 2026-08-30 — `npm run agent:plans` — PASS; existing plans discovered,
  including completed Gym and convergence plans.
- 2026-08-30 — `npm run agent:plan:validate:all` — PASS; all versioned plans
  structurally valid at baseline.
- 2026-08-30 — `npm run openspec:validate` — PASS; 47/47 items.
- 2026-08-30 — Required source/design reads — PASS; prototype, production
  Workout, panels, builder/detail, session, catalog, data/domain, recovery,
  and current Gym tests inspected.
- 2026-08-30 — `npm run test:unit` — PASS; 119 files / 1,608 tests.
- 2026-08-30 — `npm run build:web` — PASS; fresh static export, but `/gym-prototype`
  remains a discoverable static route and is a confirmed lifecycle finding.
- 2026-08-30 — `npx playwright test e2e/workout.spec.ts --project=chromium` —
  PASS; 8/8 legacy Workout tests.
- 2026-08-30 — `npx playwright test e2e/workout-gym-v2.spec.ts --project=journeys` —
  TEST_BUG/command selection; no tests found, assertions unchanged.
- 2026-08-30 — `npx playwright test e2e/workout-gym-v2.spec.ts --project=chromium` —
  PASS; 6/6 Gym V2 tests.
- 2026-08-30 — agent-browser dogfood setup and real app review — PASS with one
  reproducible medium UX finding recorded in the gitignored report:
  unmatched Exercise library search has no explicit empty state. Mobile review
  also recorded evidence for small week controls and a non-sticky builder CTA.
- 2026-08-30 — Android preflight — PASS for tool discovery; two connected API-35
  x86_64 targets, Java 17, Maestro 2.9.0, package absent before provisioning.
- 2026-08-30 — Native provisioner on `emulator-5554` — ENVIRONMENT; target is
  API 35/x86_64 and the runner correctly rejected it. `emulator-5556` and the
  available `braintraining-qa36` AVD are also API 35; no API-36 AVD is installed.
- 2026-08-30 — SDK API-36 image install attempt — ENVIRONMENT; the available
  package was listed but the local sdkmanager attempt stalled before download
  or license output and was stopped. No native qualification was claimed.
- 2026-08-30 — Agent-browser mobile measurement — PASS for reproducibility;
  `Monday rest` measured 37.125 × 24 px at 390 × 844, below the 44–48 px
  practical target. The routine-builder Start action also scrolled out of the
  visible modal body after exercise setup.
- 2026-08-30 — Product fixes implemented — `RoutineDetailScreen` now derives
  equipment chips from current query/body-area/modality matches, renders an
  accessible no-results/reset state, and uses a loading-guarded modal footer
  for Start workout; `WorkoutWeekCard` assignment actions now expose 44 px
  minimum targets and selected semantics; `Modal` gained an optional footer.
- 2026-08-30 — Focused source checks after fixes — PASS; `npm run typecheck`
  and ESLint on all changed source/spec files passed with zero warnings. The
  only lint issue was a React-hooks/refs false positive on an event callback;
  it has a narrow documented suppression because the ref is read only on
  press, not during render.
- 2026-08-30 — Updated focused browser run — one new assertion was a TEST_BUG:
  it expected weekday-specific labels before the product exposed them. The
  failure artifact is preserved under `.cursor/playwright-output/e2e-failures/`;
  source now adds contextual `PillChip` labels for the full-week editor, so the
  corrected assertion also verifies the real accessibility contract.
- 2026-08-30 — Final focused browser retest — PASS; 15/15 Workout + Gym V2
  tests, including no-results/reset, adaptive equipment filters, contextual
  weekday labels, 44 px Week controls, and fixed footer viewport fit.
- 2026-08-30 — Fresh agent-browser visual pass — PASS for fixed canonical Gym
  states at 390 × 844; landing Week rest measured 44 × 44 and builder Start
  measured 316 × 48 with bottom 815.86 inside the 844 px viewport.
- 2026-08-30 — Prototype lifecycle — PASS; `app/gym-prototype.tsx` and
  `features/workout/OpenGymInspiredGymPrototype.tsx` removed after confirming
  no production references. The OpenGym master plan now records the slice as
  historical/removed with explicit deferred ideas and archive links.
- 2026-08-30 — OpenSpec lifecycle reconciliation — PASS; 16 stale completed or
  superseded change directories were archived through the OpenSpec workflow,
  generated main specs received real purposes, no-delta historical changes were
  archived with `--skip-specs`, and only `add-user-simulation-platform` remains
  active with its two external blockers documented. `openspec validate` passed
  45/45 after reconciliation.
- 2026-08-30 — Post-removal `npm run build:web` — PASS; static route inventory
  is `/`, `/_sitemap`, and `/+not-found`; `dist/gym-prototype.html` and active
  source references are absent (historical mentions remain only in the
  explicitly labeled master record).
- 2026-08-30 — Post-removal OpenSpec/plan validation — PASS; `openspec validate`
  45/45, this Plan-Version 2 ExecPlan valid, and `git diff --check` has no
  whitespace errors.
- 2026-08-30 — Route-free focused browser retest — PASS; `e2e/workout.spec.ts`
  plus `e2e/workout-gym-v2.spec.ts` passed 15/15.
- 2026-08-30 — `npx playwright test e2e/infrastructure.spec.ts --project=chromium`
  — PASS; 10/10, including COOP/COEP, service-worker freshness, OPFS lock,
  and clean DB initialization.
- 2026-08-30 — `npm run test:integration` — PASS; 41 files / 227 tests,
  including migration 24, Gym integrity, body weight, planning/override,
  durable session recovery, Backup/Portable, owner binding, and sync tests.
- 2026-08-30 — `npm run qa:timezones` — PASS; Asia/Manila, UTC,
  America/New_York, Pacific/Honolulu, and Pacific/Kiritimati, 43 tests each.
- 2026-08-30 — `npm run validate:themes` — PASS; 140 contrast checks.
- 2026-08-30 — `npm run supabase:schema:validate` — PASS; repository migration
  and owner/RLS/backup/Gym contract checks.
- 2026-08-30 — `npm run qa:impact:validate` — PASS; 13 rules.
- 2026-08-30 — `npm run sim:validate` — PASS; 23 scenarios and clean API-leg
  guards.
- 2026-08-30 — `npm run qa:simulation -- --all --mode deterministic` — PASS;
  all 23 deterministic scenarios passed, including the 356-step long-term
  recovery scenario and 132-step sustained-use soak.
- 2026-08-30 — `npm run e2e:journeys:p0` — PASS; 25/25 P0 journeys across
  cross-feature, command, day rollover, and focus lifecycle behavior.
- 2026-08-30 — `npm run e2e` — FAIL/triaged; 222/238 passed, 14 expected
  remote-capability skips, with Settings empty-device copy failing because the
  workstation injects a malformed/configured Supabase env and the matching
  portable-owner step timing out in the ordinary journey run. Sibling account
  paths passed; artifacts are preserved under `.cursor/playwright-output/`.
- 2026-08-30 — `npx playwright test e2e/settings.spec.ts --project=chromium` —
  FAIL/ENVIRONMENT configuration mismatch; same Settings assertion fails
  isolated while the second test passes. The test expects local-only env but
  the current bundle was built with workstation Supabase variables.
- 2026-08-30 — Explicit local-only web rebuild — PASS; the first `cross-env`
  shell invocation was an ENVIRONMENT/tool lookup miss, then the direct pinned
  `cross-env.cmd` path built successfully with empty Supabase variables (Expo
  reported only the unrelated Vercel OIDC variable).
- 2026-08-30 — Local-only `npx playwright test e2e/settings.spec.ts
--project=chromium` — PASS; 2/2, including the previously mismatched
  `Remote backup is not configured.` assertion.
- 2026-08-30 — Full local-only `npm run e2e` — PASS; 194/238 tests passed
  and 44 remote-capability tests were expected skips. This included the
  canonical Gym journeys, cross-feature P0 coverage, heavy-device
  responsiveness, persistence, and simulation browser lanes.
- 2026-08-30 — `npm run build:sync` — PASS; isolated `dist-sync` export has
  three static routes and dummy non-routable Supabase configuration only.
- 2026-08-30 — `npm run e2e:sync` — PASS; 40/46 remote-boundary journeys
  passed and 6 explicitly capability-gated restore-completion steps skipped.
  This covered sync failures/requeue/backoff, Ask V2, backup integrity,
  portable owner recovery, Recoverable Account V1, and offline outbox
  durability.
- 2026-08-30 — `npm run qa:native:android -- --serial emulator-5554` —
  ENVIRONMENT; the runner rejected the API-35 target because the documented
  local qualification contract requires API 36 x86_64. The fresh report is
  `simulation-output/native/native-android-smoke-2026-08-30T123508151Z.json`.
- 2026-08-30 — `npm run qa:native:targeted -- --serial emulator-5554` and
  `npm run qa:native:lifecycle -- --serial emulator-5554` — ENVIRONMENT; both
  correctly blocked on the same API-35 target and wrote fresh reports.
- 2026-08-30 — `npm run qa:native:ios` — ENVIRONMENT; Windows has no Xcode
  `xcrun`/`simctl`, so no iOS result is claimed.
- 2026-08-30 — `npm run qa:fast` — PASS; typecheck, full ESLint with zero
  warnings, and 119 unit files / 1,608 tests.
- 2026-08-30 — `npm run test:integration` — PASS; 41 files / 227 tests,
  including measured portable and backup performance output.
- 2026-08-30 — final contract gates — PASS; `openspec validate` 45/45,
  all versioned ExecPlans valid, QA impact map valid (13 rules), Supabase
  schema contract valid, timezone matrix 5 × 43, theme contrast 140/140.
- 2026-08-30 — `npm run build:web` — PASS; workstation-configured export
  contains only `/`, `/_sitemap`, and `/+not-found`; no prototype route.
- 2026-08-30 — `npm test` — PASS; 160 files / 1,835 tests, including the
  previously timing-sensitive restore coordinator coverage.
- 2026-08-30 — `npm run agent:resume -- --plan
.agent/execplans/production-gym-convergence-and-real-world-certification-v1.md`
  and `npm run sim:validate` — PASS; the plan checkpoint reconciled against
  Git and the simulation model has 23 valid scenarios with clean API guards.
- 2026-08-30 — `git push origin main` — PASS; implementation milestone
  `efbc8ad9d3473f36766dd9983a4bff4276f4292a` advanced `origin/main` from the
  starting SHA, and local/remote refs matched immediately afterward.
- 2026-08-30 — `npm run format:check` — FAIL/known baseline gap; 67 historical,
  agent, and older docs/tooling files report style drift. Targeted formatting
  checks for changed campaign files pass; no campaign diff whitespace error.
- 2026-08-30 — `npm run agent:plan:validate:all` — PASS; all discovered
  versioned ExecPlans, including this ACTIVE plan, validate.
- 2026-08-30 — `npm test` — FLAKY_TEST/host contention on the full parallel
  Vitest run: 1,832 passed, 3 `restore.coordinator` tests timed out at their
  fixed 5 s limit with 3 mocked-DB unhandled rejections; no changed Gym test
  failed. Preserved as a baseline artifact/result for this run.
- 2026-08-30 — `npx vitest run tests/restore.coordinator.test.ts` twice — PASS;
  18/18 both runs (4,358 ms and 3,888 ms), supporting FLAKY_TEST rather than
  PRODUCT_BUG classification. No assertion or timeout was weakened.

## Changed Files / Areas

- `.agent/execplans/production-gym-convergence-and-real-world-certification-v1.md`
  and `.agent/EXECUTION_PROMPT.md` — durable campaign state and completed
  handoff.
- `features/workout/RoutineDetailScreen.tsx`,
  `features/workout/WorkoutGymPanels.tsx`,
  `features/workout/WorkoutScreen.tsx`, `core/ui/Modal.tsx`, and
  `core/ui/PillChip.tsx` — production Workout UX/accessibility fixes.
- `e2e/workout-gym-v2.spec.ts` — regression coverage for the exercised UX
  contracts.
- `app/gym-prototype.tsx` and
  `features/workout/OpenGymInspiredGymPrototype.tsx` — removed fake route and
  representative-data component.
- `docs/OPEN_GYM_GYM_INTEGRATION_MASTER_PLAN.md`, current Gym maps/knowledge
  docs, and current `openspec/specs/` — reconciled production truth.
- `openspec/changes/archive/2026-08-30-*/` — 16 completed or superseded
  historical changes moved through the archive workflow; the simulation
  proposal records its two external blockers.
- `simulation-output/` — ignored browser/native evidence only; no generated
  output is tracked.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, and this ExecPlan.
2. Run `git status --short`, `git diff --stat`, `git diff --name-only`, and
   `git branch -vv`; Git is authoritative.
3. Run `npm run agent:resume -- --plan
.agent/execplans/production-gym-convergence-and-real-world-certification-v1.md`.
4. Inspect the checkpoint and recent QA artifacts, then continue only from
   `Exact next action`.
5. Before each implementation or context-heavy validation milestone, update
   this plan with the exact command, changed areas, classifications, and next
   action. Preserve original failures and artifacts.

## Outcomes & Retrospective

- Status: Completed.
- Summary: The hard-coded OpenGym-inspired route was removed. Its useful
  Today/Week, adaptive exercise discovery, previous-context, and action-first
  interaction ideas are represented by the real SQLite-backed Workout V2
  surface, with a guarded fixed Start footer, explicit empty search state,
  contextual planning labels, and mobile-sized controls. Sixteen completed or
  superseded OpenSpec records were archived and current-facing documentation
  now points at production truth.
- Proof: Focused Workout/Gym browser coverage is 15/15; the full local-only
  browser matrix is 194 passed with 44 expected remote-capability skips; the
  dummy sync lane is 40 passed with 6 capability-gated skips; unit,
  integration, deterministic simulation, timezone, schema, impact, theme,
  and web-export gates are green. Native smoke/persistence/lifecycle are
  explicitly blocked by the machine's API-35-only AVDs, and iOS is blocked by
  missing Xcode on Windows.
- Follow-up: Run the documented native Android/iOS lanes when their required
  environments are available. The only remaining unarchived OpenSpec change
  is the simulation platform's externally blocked optional lanes; its local
  deterministic runner remains valid and usable.
