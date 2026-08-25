# ExecPlan: Momentum Garden V1 Hardening & Qualification

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Close the release-quality evidence gaps left by Momentum Garden V1. The
observable outcome is a stable, bounded, read-only Garden that does not regress
canonical Habit/Overview behavior, survives the prior long-run simulation,
passes the required browser and repository gates, and has honest current-source
Android/performance evidence.

## Context

- Active campaign prompt: `.agent/EXECUTION_PROMPT.md`.
- Predecessor change: `openspec/changes/add-momentum-garden-v1/`, complete at
  baseline `0187b98cc48691ee0410cb84923571e355b97902`.
- Current reconciled tip: `3de21e8aacf269e6be074e9289c662da1f95002f`, which
  activates this campaign through `.agent/EXECUTION_PROMPT.md`.
- Product constraints: SQLite remains the source of truth; Momentum remains a
  derived read-only model; no Garden persistence, migration, sync, backup,
  restore, portable-export, account, remote, score, or reward boundary.
- Required QA guidance: `docs/testing/autonomous-qa.md`,
  `docs/testing/native-e2e.md`, and `qa/impact-map.json`.

## Scope

- Audit the predecessor's changed contracts and all direct/transitive callers.
- Reproduce/classify/fix the late deterministic `Start focus` failure.
- Measure and repair only demonstrated Garden read, habit-window, async-race,
  or whole-app performance regressions.
- Prove focused and impact-selected browser, simulation, real-SQLite,
  timezone/theme, sync/restore isolation, and sequential Android behavior.
- Reconcile documentation, OpenSpec, ExecPlan, Git, and exact-SHA evidence.

## Non-Goals

- Reopening or reimplementing the completed Momentum Garden feature.
- Adding an event ledger, schema migration, cache/persistence silo, sync or
  backup entity, export field, remote service, durable preference, score, XP,
  punishment, social mechanic, or unrelated cleanup wave.
- Claiming native/iOS/CI success without executed reports.

## Current Checkpoint

- Current milestone: Momentum Garden V1 hardening, qualification, strict
  validation, and delivery evidence are complete.
- Completed: fetched `origin/main`; inspected the remote advancement from
  `0187b98` to `3de21e8`; fast-forwarded clean local `main`; read `AGENTS.md`,
  `.agent/PLANS.md`, `.agent/PLANNER_HANDOFF.md`, the active execution prompt,
  structure/workflow/QA/native guidance, impact map, and predecessor
  OpenSpec artifacts; ran `npm run agent:plans`; created the new OpenSpec
  change and this Version-2 ExecPlan.
- Completed since setup: audited all direct Momentum callers and the shared
  simulation Calories locator; traced `buildDayCompletions` full-history and
  bounded callers; reproduced the long-run host/resource failure; classified
  it as renderer retention caused by service workers in the simulation
  runner; added runner service-worker isolation and removed the loopback escape
  navigation from the DB harness; added stale-request guards, bounded active
  habit/daily-plan reads, malformed-date hardening, and focused regression
  coverage.
- Completed qualification: the focused Momentum Garden Playwright journey
  passed 4/4; P0 journeys passed 25/25; the broader Playwright suite passed
  194 tests with 43 explicit skips; `qa:fast`, integration, timezone, theme,
  typecheck, lint, formatting, and the full Vitest suite all passed. The
  deterministic simulation library validated 22/22 scenarios and the exact
  long-run scenario passed twice from fresh builds, including steps 202 and 322.
- In progress: None — all implementation, validation, and delivery evidence is
  complete.
- Completed performance/data-boundary proof: two independent HEAVY J8 samples
  stayed within the existing D14 ceilings. The earlier sample measured
  `coldOverview=603ms`, `maxSwitch=677ms`, `diarySearch=424ms`, and
  `pickerSearch=188ms`; the final full-suite sample measured
  `coldOverview=581ms`, `maxSwitch=571ms`, `diarySearch=347ms`, and
  `pickerSearch=130ms`. The focused Garden journey covered empty and typical
  fixtures, repeated 7/28/7 toggles, reload/refresh, and read-only oracles;
  real-SQLite Momentum integration coverage preserved deleted/out-of-window
  filtering and source/outbox stability. Query review found no N+1 path;
  active-habit and completed-daily-plan reads now have explicit caps.
- Completed native qualification on the isolated `emulator-5556`
  `Nitro_API_36` API-36 x86_64 target: current-source provisioning/install,
  smoke 2/2, persistence/targeted 11/11, and lifecycle 6/6 all passed. The
  Gym lifecycle flow was made gesture-safe for Android navigation clipping and
  then replayed successfully end-to-end; an earlier preserved React Native
  relaunch abort (`AppRegistryBinding::startSurface failed. Global was not
installed`) and a clipped-header selector failure were retained and
  classified as `FLAKY_TEST`/`TEST_BUG` evidence before successful replay.
- Important modified files: `simulation/runner/execute.ts`,
  `e2e/helpers/dbHarness.ts`, `features/momentum/`,
  `features/overview/OverviewScreen.tsx`, `e2e/momentum-garden.spec.ts`,
  `tests/momentum.domain.test.ts`, `simulation/README.md`, and all files under
  this campaign's OpenSpec directory.
- Last successful validation: the chained final `qa:full` run passed typecheck,
  lint, 150 Vitest files / 1,792 tests, OpenSpec validation, 194/237 full
  Playwright tests with 43 explicit skips, and all 22 deterministic simulation
  scenarios. Its HEAVY J8 sample measured
  `coldOverview=581ms`, `maxSwitch=571ms`, `diarySearch=347ms`, and
  `pickerSearch=130ms`. The final sequential Android lifecycle lane
  passed 6/6 in
  `simulation-output/native/native-android-lifecycle-2026-08-25T160757780Z.json`;
  the current-source APK/build provenance is in
  `simulation-output/native/native-android-build.json`. The exact deterministic
  long-run reports are
  `simulation-output/run_mt8mo82a_c46112d7/run-report.json` and
  `simulation-output/run_mt8mygod_ms607iel/run-report.json`; the controlled
  diagnostic replay passed all 356 steps at
  `simulation-output/run_mt8la7uq_bt1h40cf/` with renderer count held at 4–5.
- Current failures: None for campaign/product or repository QA. Initial
  `git pull --ff-only` attempts failed to connect to GitHub, but the subsequent
  fetch succeeded; that environment result is retained as history only.
- Current platform limitation: `npm run qa:native:ios` is an explicit
  `ENVIRONMENT` result on this Windows host because `xcrun/simctl` is
  unavailable; the report is
  `simulation-output/native/native-ios-smoke-2026-08-25T165214766Z.json`.
- Relevant quarantines: the preserved first default long-run attempt reached
  the former Focus point but later hung after step 322 without a report; its
  artifacts are kept under `simulation-output/run_mt8jqvi8_0k3wq4y0/`. The
  earlier pre-fix run's renderer accumulation and shell `Access is denied`
  evidence establish the host/resource classification. Native qualification
  is complete on Android; iOS remains an honest Windows `ENVIRONMENT`
  limitation because no executable macOS/Xcode lane was run.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: Complete — all campaign tasks and acceptance
  gates in `.agent/EXECUTION_PROMPT.md` are proven; the final commit/push is the
  normal repository handoff for this completed plan.

## Progress

- [x] Reconcile current `main` with the fetched `origin/main`.
- [x] Read required startup, QA, native, predecessor, and workflow artifacts.
- [x] Create the hardening OpenSpec change and Version-2 ExecPlan.
- [x] Resolve impact-selected gate set and complete startup reconciliation.
- [x] Complete whole-codebase contract audit.
- [x] Reproduce/classify/repair the long-run deterministic Focus failure.
- [x] Measure bounded reads and repeated UI behavior; add regression proof.
- [x] Complete browser, simulation, repository, and sequential native lanes.
- [x] Reconcile final validators and complete normal Git delivery.

## Surprises & Discoveries

- The first `git pull --ff-only` attempts could not connect, but a later
  `git fetch origin --prune` succeeded and found one legitimate remote commit:
  `3de21e8` adding the active execution prompt. The fetched ref was applied
  with a safe fast-forward merge.
- The predecessor OpenSpec task 8.5 remains unchecked even though its ExecPlan
  records the implementation commit; the new campaign treats the predecessor
  as complete and owns only the hardening prompt's remaining work.
- The first fresh default long-run attempt reached the historical `Start focus`
  sequence successfully but later stopped after the same high-round-trip
  harness pattern, with renderer count rising to roughly 245 and no report.
  A controlled replay with service workers blocked completed all 356 steps and
  held the renderer count at 4–5, isolating the failure to runner/browser
  infrastructure rather than the Focus product action.
- The Momentum data path was already bulk and date-bounded for timestamp
  sources. The concrete read hardening needed was an explicit cap for active
  habits that have relevant completions and an explicit cap for completed daily
  plans; no per-habit query or write boundary was introduced.
- Two independent HEAVY J8 runs stayed under the unchanged D14 ceilings, and
  the full deterministic library's `typical-device-walk`, `j8-three-months-in`,
  and long-term recovery scenarios supplied additional representative and
  long-history coverage. The campaign therefore retained the existing
  performance contract instead of adding speculative caching or a new Garden
  persistence boundary.
- The final iOS command produced the expected Windows `ENVIRONMENT` report;
  no canonical known-gap or impact-map edit was justified because the existing
  docs already state the Windows/iOS and HEAVY-vs-load-test limitations and the
  impact rules already select the full affected gate set.

## Decision Log

- 2026-08-25 — Use `harden-momentum-garden-v1` as the new change slug because
  the fetched execution prompt names it and the predecessor must remain
  historical.
- 2026-08-25 — Keep the target branch `main` per the active execution prompt;
  use fast-forward-only reconciliation and normal pushes, never reset or force
  push.
- 2026-08-25 — Do not change implementation before reproducing the long-run
  failure and measuring the read paths; evidence determines whether a fix is
  warranted.
- 2026-08-25 — Block service workers in simulation-owned browser contexts.
  Simulation validates app behavior and SQLite persistence; PWA lifecycle
  behavior remains covered by the dedicated Playwright infrastructure/PWA
  projects. This prevents service-worker client retention during hundreds of
  app↔DB-harness navigations without weakening scenario assertions.
- 2026-08-25 — Keep `buildDayCompletions`' optional full-history path intact;
  only the Momentum reader supplies a bounded window. Add request/mount guards
  at the Overview and Progress detail boundaries so stale async reads cannot
  overwrite current state.

## Validation Ledger

- 2026-08-25 — `git fetch origin --prune` — PASS; fetched `origin/main` at
  `3de21e8`.
- 2026-08-25 — `git merge --ff-only origin/main` — PASS; local `main` now
  equals fetched `origin/main`, clean tree.
- 2026-08-25 — `git pull --ff-only` — ENVIRONMENT; two connection attempts to
  GitHub failed before the successful fetch; no local changes were discarded.
- 2026-08-25 — `npm run agent:plans` — PASS; all discovered historical plans
  were COMPLETED and no separate ACTIVE plan superseded this campaign.
- 2026-08-25 — `npm run qa:affected -- --base 0187b98` — PASS; documentation
  artifacts matched `agent-workflow-and-documentation`, resolving `qa:fast`
  and `tests/agent-execplan.test.ts`; the active hardening prompt separately
  requires broader feature/simulation/native gates.
- 2026-08-25 — fresh `npm run build:web` — PASS before the controlled replay;
  the exact default post-fix run is still required after final formatting.
- 2026-08-25 — first fresh default long-run replay — ENVIRONMENT/TEST_INFRA;
  reached historical step 202 but later hung around step 322 as Chromium
  renderers accumulated; preserved under
  `simulation-output/run_mt8jqvi8_0k3wq4y0/` without a report.
- 2026-08-25 — controlled long-run replay with service workers blocked — PASS;
  `simulation-output/run_mt8la7uq_bt1h40cf/` contains the report, action log,
  screenshots, and all 356 passed steps, including the former Focus and late
  sequence points.
- 2026-08-25 — `npm run typecheck` — PASS.
- 2026-08-25 — focused Vitest (`momentum.domain`, `habits.domain`,
  `integration/momentumGarden`) — PASS; 3 files and 63 tests.
- 2026-08-25 — Prettier check — initially found six mechanically formatted
  files; `npx prettier --write` applied the required formatting. A clean check
  remains part of the next validation batch.
- 2026-08-25 — exact default deterministic long-run replay #1 — PASS; all 356
  steps, including the historical Focus and late sequence, passed at
  `simulation-output/run_mt8mo82a_c46112d7/run-report.json`.
- 2026-08-25 — exact default deterministic long-run replay #2 — PASS; all 356
  steps passed from fresh build/state at
  `simulation-output/run_mt8mygod_ms607iel/run-report.json`.
- 2026-08-25 — `npm run qa:simulation -- --all --mode deterministic` — PASS;
  `sim:validate` found 22 valid scenarios and all 22 deterministic runs passed;
  the run directories are retained under `simulation-output/`.
- 2026-08-25 — focused Momentum Garden Playwright journey — PASS; 4/4,
  including rapid 7/28/7 toggling, reload, reduced motion, keyboard, and
  read-only oracle coverage.
- 2026-08-25 — `npm run qa:journeys` — PASS; fresh export and P0 journeys
  passed 25/25.
- 2026-08-25 — `npm run e2e` — PASS; 194 passed and 43 explicit skips out of
  237 listed tests; no failure was hidden or weakened.
- 2026-08-25 — repository gates — PASS; `qa:fast` (113 unit files / 1,580
  tests), `qa:integration` (37 files / 212 tests), `qa:timezones` (all five
  zones), `validate:themes` (140 contrast checks), and `npm test` (150 files /
  1,792 tests).
- 2026-08-25 — Android preflight/provision/install — PASS on isolated
  `emulator-5556` (`Nitro_API_36`, API 36, x86_64); build provenance and APK
  identity are in `simulation-output/native/native-android-build.json`.
- 2026-08-25 — `NATIVE_ANDROID_SERIAL=emulator-5556 npm run
qa:native:android` — PASS; smoke 2/2 at
  `simulation-output/native/native-android-smoke-2026-08-25T151508812Z.json`.
- 2026-08-25 — `NATIVE_ANDROID_SERIAL=emulator-5556 npm run
qa:native:targeted` — PASS; persistence 11/11 at
  `simulation-output/native/native-android-persistence-2026-08-25T151318562Z.json`.
- 2026-08-25 — focused Gym lifecycle replay — PASS at
  `simulation-output/native/native-android-all-2026-08-25T155807398Z.json`;
  final flow uses safe-band swipes and an extra bottom scroll to keep Android
  navigation gestures/clipping out of the assertion path.
- 2026-08-26 — `NATIVE_ANDROID_SERIAL=emulator-5556 npm run
qa:native:lifecycle` — PASS; all 6/6 flows at
  `simulation-output/native/native-android-lifecycle-2026-08-25T160757780Z.json`.
- 2026-08-25 — first native lifecycle attempts — preserved failure evidence;
  selector/gesture failures and one intermittent RN relaunch abort were
  replayed and resolved/classified. Earlier conflicted `emulator-5558`
  attempts remain `ENVIRONMENT` because that target was running the unrelated
  brain-training app and are not product evidence.
- 2026-08-26 — final `npm run qa:full` — PASS; typecheck, lint, 150 Vitest
  files / 1,792 tests, OpenSpec validation, full Playwright 194/237 with 43
  explicit skips, and all 22 deterministic scenarios passed. The HEAVY J8
  timing line was `coldOverview=581ms`, `maxSwitch=571ms`,
  `diarySearch=347ms`, `pickerSearch=130ms`.
- 2026-08-26 — `npm run qa:native:ios` — ENVIRONMENT; Windows has no
  `xcrun/simctl`, report retained at
  `simulation-output/native/native-ios-smoke-2026-08-25T165214766Z.json`.
- 2026-08-26 — `openspec validate --all --strict` — initially FAIL/SPEC_AMBIGUITY
  on the unrelated `harden-ui-ux-mass-implementation-wave-v1` requirement
  lacking RFC-2119 wording; campaign validation passed. The wording was
  corrected without changing behavior; the repository-wide rerun passed 45/45.
- 2026-08-26 — final non-mutating gates — PASS; `npm run qa:affected` resolved
  the expected broad gate set, `npm run qa:integration` passed 212/212,
  `npm run qa:timezones` passed 43/43 in each of five zones,
  `npm run validate:themes` passed 140/140, and `npm run qa:journeys` passed
  25/25 from a fresh web export.
- 2026-08-26 — final hygiene/plan checks — PASS; selected-path Prettier check,
  `git diff --check`, the campaign ExecPlan validator, and
  `npm run agent:plan:validate:all` all passed. The final fetch left local
  `main` and `origin/main` equal at `3de21e8` before delivery.
- 2026-08-26 — CI workflow inspection — PASS; `.github/workflows/ci.yml`
  triggers on every push and runs the main quality/full-browser/deterministic/
  sync-boundary lanes on a direct `main` push. Native remains intentionally
  outside this credential-free workflow and is covered by the executed local
  Android evidence plus the explicit Windows/iOS environment result.

## Changed Files / Areas

- `openspec/changes/harden-momentum-garden-v1/proposal.md` — campaign intent
  and capability contract.
- `openspec/changes/harden-momentum-garden-v1/specs/momentum-garden-hardening/spec.md`
  — hardening behavior requirements.
- `openspec/changes/harden-momentum-garden-v1/design.md` — implementation and
  evidence decisions.
- `openspec/changes/harden-momentum-garden-v1/tasks.md` — verifiable task
  checklist.
- `openspec/changes/harden-momentum-garden-v1/execplan.md` — durable campaign
  checkpoint and validation ledger.
- `.maestro/flows/` — corrected native gesture/scroll synchronization and
  preserved semantic assertions for current-source Android lanes.
- `core/ui/Modal.tsx` — safe Android bottom-sheet navigation padding and
  gesture ownership needed by the current native qualification.
- `features/momentum/`, `features/overview/`, `simulation/`, `e2e/`, and
  `tests/` — bounded reads, stale-load guards, simulation isolation, and
  regression coverage.
- `openspec/changes/harden-ui-ux-mass-implementation-wave-v1/specs/` —
  spec-only RFC-2119 wording repair required by repository-wide strict
  validation.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, `.agent/PLANNER_HANDOFF.md`,
   `.agent/EXECUTION_PROMPT.md`, and this ExecPlan.
2. Run `npm run agent:resume -- --plan
openspec/changes/harden-momentum-garden-v1/execplan.md` and inspect Git/QA
   discrepancy warnings.
3. Run `git status --short`, `git diff --stat`, `git diff --name-only`, and
   inspect the current checkpoint's affected files and artifacts.
4. Continue from the exact next action, updating this checkpoint before and
   after every material audit, failure, fix, delegation, and validation gate.

## Outcomes & Retrospective

- Status: Completed; implementation, validation, and delivery evidence are
  complete.
- Summary: The late deterministic timeout was eliminated at the simulation
  browser/harness boundary, Momentum reads were bounded and race-safe, and the
  affected browser, simulation, repository, performance, SQLite-isolation, and
  Android lanes are green.
- Proof: The validation ledger above names the exact reports and classifications;
  the only platform limitation is the explicit Windows/iOS `ENVIRONMENT`
  result, while the repository-wide strict OpenSpec and all versioned plan
  validators pass.
- Remaining work: None in this campaign.
- Follow-up: Run the normal post-push exact-SHA GitHub Actions inspection; no
  additional product work is indicated by the campaign evidence.
