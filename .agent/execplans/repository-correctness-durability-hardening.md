# ExecPlan: Repository correctness, durability, CI, security, and hardening campaign

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Resolve or honestly classify every materially credible finding in the whole-
repository hardening campaign. The resulting `main` branch must have explicit
runtime support, crash-safe local correctness at SQLite/sync boundaries,
validated feature mutation semantics, reproducible security contracts, durable
regressions for concurrency/fault/restart cases, and a normal push to
`origin/main`.

## Context

- Repository: `C:\Users\Michael Roy\Documents\super-habits`.
- Authoritative branch/worktree at startup: local `main`, one worktree,
  `HEAD=origin/main=45fecf619671ee38c7ecd62d1ac5582b830460fa`; after the
  campaign wave and CI-driven follow-ups, the latest validated pushed tip is
  `cbf08b513ab64f781ffc1ae29c46dece14eef8e8`.
- Local SQLite is the source of truth. Runtime schema authority is bootstrap
  DDL plus append-only migrations in `core/db/client.ts`; current version is
  14 after the durable outbox migration.
- Synced entities are `todos`, `habits`, `calorie_entries`, and
  `workout_routines`; linked actions, local-only logs, and nested workout
  tables have separate persistence semantics documented by the repository
  rules.
- Existing completed OpenSpec/ExecPlan campaigns are prior evidence, not a
  substitute for verifying the current tip. The existing
  `production-correctness-hardening` change is complete and does not cover all
  findings in this campaign.
- Repository skills applied: `.agents/skills/db-and-sync-invariants`,
  `.agents/skills/feature-module-pattern`, and
  `.agents/skills/rn-expo-conventions`. OpenSpec artifacts will be updated or
  added when the final design materially changes externally visible guarantees.

## Scope

- A: establish and enforce one supported Node runtime and hermetic CI install.
- B: linked-action crash recovery and exactly-once effects across restart.
- C: atomic habit threshold transitions under real concurrency.
- D/E: durable ordered sync outbox and atomic local tombstone plus remote-delete
  intent for every synced entity.
- F/G/H: calorie, workout parent/child, and stale/no-op mutation integrity.
- I/J: repository-owned Supabase contract, Edge Function authentication, and
  server-side abuse/rate control.
- K: current native-critical flow inventory and reusable cloud workflow coverage.
- L/M/N: runtime validation, lint/effect architecture, and efficient day
  rollover scheduling.
- Repository-wide trust-boundary sweep, dependency audit, migration/OpenSpec
  reconciliation, escalating QA, coherent commits, and push verification.

## Non-Goals

- No force push, hard reset, destructive remote reset, production schema drop,
  or deletion of user-owned work.
- No broad framework-major dependency upgrade unrelated to the runtime contract.
- No weakening assertions, thresholds, retries, meaningful tests, or documented
  capability boundaries to obtain green output.
- No claim of exactly-once behavior without restart/replay evidence.
- No native iOS or cloud Supabase claim when the required credentials/tooling are
  unavailable; such evidence remains explicitly classified.

## Current Checkpoint

- Current milestone: P0 through P3 repository-side hardening and the P4
  settings/lint/rollover work are implemented. CI-driven follow-ups have now
  corrected shared-OPFS project parallelism, the habit schedule assertion, and
  the remaining navigation/action synchronization defects. The active-section
  selector now matches the shell's top-level container, section switching waits
  for the requested heading, and linked-action journey toggles wait for the
  live checkbox state or committed removal from the collapsed completed list.
  Focused linked-action journeys and simulation lane validation pass. Remaining
  work is the final commit/push, post-fix GitHub CI inspection, and completion
  validation.
- Completed: exact Git topology capture; current dependency engine inspection;
  mandatory architecture/workflow/QA/OpenSpec context reads; applicable
  database, feature, and Expo skills read; `npm ci` from the committed lockfile
  with postinstall patches.
- Completed: typecheck, lint, and the full Vitest unit/integration baseline under
  Node 22. The local suite is stable; the CI Node 20 contract remains a real
  repository defect even though the reported IPC failure did not reproduce
  locally under the supported runtime.
- Completed: P0 runtime contract and CI install/cache changes; SQLite
  `sync_outbox` migration 14; revision-aware ordered persistence and
  enqueue-during-flush protection; synced task/habit/calorie/workout writes;
  atomic synced tombstones; linked-action claim/recovery and habit receipt;
  `RETURNING` habit thresholds; calorie ledger/cache semantics; workout active
  parent validation and historical-log preservation.
- Completed: revision-order protection for out-of-order prepared sync
  callbacks; notification threshold `RETURNING`; OpenSpec change
  `correctness-durability-security-hardening`; additive Supabase sync baseline
  and private AI quota migrations; static Supabase contract validator; function-
  level AI auth, bounded body, quota, timeout, and generic-error boundary;
  auth/quota/provider-suppression tests.
- Completed: provider context separation removed all React lint warnings;
  stable Habit Reminder action/replay and Habit Insights Maestro flows are
  included in both Android and iOS reusable EAS lanes. Local Android/iOS
  execution was attempted and classified `ENVIRONMENT` because this Windows
  host has no booted target/Xcode simulator.
- Completed: the first post-wave full-suite run exposed and fixed a real
  transaction-serialization regression in concurrent recurring expansion, a
  stale linked-effect parameter list, a missing test mock export, and the
  now-intended workout child-tombstone expectation. The corrected full suite
  passes 780 tests across 78 files.
- In progress: record the third CI failure and deterministic selector/action
  correction, commit the regression fix, push, and inspect the final post-fix
  GitHub CI.
- Important modified files: package/CI runtime contract; `core/db/client.ts`,
  `core/db/transactions.ts`, `core/sync/sync.engine.ts`,
  `core/sync/syncPersistence.ts`, `core/sync/syncedMutation.ts`, linked-action
  execution/data/effect modules, and synced feature data layers.
- Last successful validation: focused migration (22), sync engine/persistence
  (15), linked-action recovery (10), habit concurrency (3), exactly-once effect
  adapters (4), delete atomicity (5), calorie integrity (3), workout integrity
  (1), affected unit data-layer tests (29), AI security (8), full Vitest (780),
  full Chromium (88 passed/7 documented skips), full journeys (62 passed/10
  documented skips), and all 17 deterministic simulation scenarios pass;
  typecheck and lint pass. `npm ci` installed 1,138 packages under Node
  `v22.23.2`; npm reports 16 framework-owned advisories (6 moderate, 10 high).
- Current failures: the first pushed run `31740558470` had quality `success`
  but E2E `failure` because the top-level `workers: 2` ran projects sharing
  localhost OPFS concurrently. The serial fix was pushed in `0cc417e` and the
  second run `31744190344` proved that the linked-action and simulation
  failures were gone. Its only remaining failure was the habit schedule reload
  assertion: the pre-reload check matched a modal label, not the rendered card,
  so it could reload before the save/refresh boundary was observable. The test
  now exits edit mode and scopes both checks to the habit card; the focused case
  passes five repetitions and the full habits spec passes 11/11. The third run
  `31747362847` then exposed two deterministic harness synchronization defects:
  the habit-linked journey clicked a task twice before the first refresh had
  committed, and simulation `4.4` could query a habit ring before section
  navigation settled. The fixes use the exact active shell container, wait for
  the requested section heading, target the checkbox's semantic label, and poll
  the live DOM after each toggle. The focused habit-linked journey, generic
  chain-reaction journey, and full `4.4` scenario/seeded/repro lane now pass.
  `npm audit`
  and `npm audit --omit=dev` report 16 Expo/Metro transitive
  advisories whose only available fix is an incompatible Expo 53/RN downgrade.
  Live Supabase verification is credential-dependent. Native execution is an
  explicit environment blocker; lint has 0 errors and 0 warnings.
- Relevant quarantines: inherited documented web/native/dependency gaps remain
  untouched until impact is re-evaluated.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: run repeated focused simulation/E2E checks and the affected
  repository gates for the selector/action correction, update OpenSpec
  task/checkpoint evidence, fetch/reconcile `origin/main`, commit and push the
  final regression fix, then inspect the new GitHub Actions run.
- Remaining definition of done: all A–N findings resolved/disproven or
  explicitly classified external after repository-side work; regression and
  fault-injection coverage added; final QA/plan/OpenSpec validation complete;
  coherent commits pushed to `origin/main`; GitHub CI inspected.

## Audit Finding Matrix

| Finding                         | Priority | Initial status               | Current root-cause hypothesis                                                                      | Required proof / outcome                                                                          |
| ------------------------------- | -------- | ---------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| A CI/runtime contract           | P0       | VERIFIED (configuration)     | CI/docs say Node 20 while lock engines require Node 22.22.1+; node_modules cache skips `npm ci`    | Align package engines, CI, docs, doctor, install cache; prove full Vitest stability               |
| B Linked Actions crash recovery | P1       | VERIFIED (source mechanism)  | Planned executions are returned as duplicates; non-idempotent habit effects have no atomic receipt | Add recoverable claim state, execution-aware transactional habit effects, and restart/fault tests |
| C Habit threshold concurrency   | P1       | VERIFIED (source mechanism)  | Atomic increment is followed by an independent count read                                          | `RETURNING` mutation result plus barrier/concurrent threshold tests                               |
| D Sync outbox ordering          | P1       | VERIFIED (source mechanism)  | Fire-and-forget snapshot saves can complete out of order; flush cleanup may delete newer work      | SQLite outbox migration, serialized persistence, revision-safe cleanup, delayed-save tests        |
| E Delete/sync atomicity         | P1       | VERIFIED (source mechanism)  | Tombstone and dependent cleanup precede durable remote-delete intent                               | Shared transaction boundary for synced tombstones, cleanup, and outbox intent                     |
| F Calories partial success      | P2       | VERIFIED (source mechanism)  | Primary entry commits before saved-meal maintenance and reports a false failure                    | Ledger-authoritative cache contract, affected-row checks, fault/retry tests                       |
| G Workout integrity             | P2       | VERIFIED (source mechanism)  | Parent/child active checks and stale updates rely on callers                                       | Transactional active-parent validation; preserve historical log rows                              |
| H Zero-row mutations            | P2       | VERIFIED (audit)             | Several updates enqueue or mutate secondary state without affected-row checks                      | Cross-layer affected-row behavior and explicit no-op tests                                        |
| I Supabase reproducibility      | P3       | UNVERIFIED                   | Remote schema/policies may exceed checked-in migrations                                            | Repository-owned inspectable schema/RLS contract and validator                                    |
| J AI auth/abuse control         | P3       | VERIFIED (source mechanism)  | CORS/gateway assumptions are the only visible trust boundary; no durable quota                     | Function-level auth before provider call, atomic per-user quota, 429 tests                        |
| K Native cloud coverage         | P3       | UNVERIFIED                   | Reusable EAS workflow may omit current reminder/Insights flows                                     | Inventory and add stable semantic flows; classify unavailable execution                           |
| L app_meta runtime validation   | P3       | VERIFIED (source mechanism)  | Generic JSON typing accepts malformed-but-parseable settings                                       | Runtime normalizers and malformed/legacy tests                                                    |
| M React lint/effects            | P4       | VERIFIED (warning inventory) | Existing set-state-in-effect/refresh warnings remain under budget                                  | Resolve safe warnings without architecture/performance regression                                 |
| N day rollover polling          | P4       | VERIFIED (source mechanism)  | Permanent one-second polling detects a midnight event inefficiently                                | Boundary scheduler with foreground/timezone/DST/clock-change tests                                |

## Root-Cause Hypotheses

- The current data-layer architecture assumes `syncEngine.enqueue` can be
  decoupled from the local mutation; that assumption is unsafe for tombstones
  and process death.
- Linked-action execution rows currently act as both a claim and a receipt,
  but a claim cannot prove that a non-idempotent effect committed.
- Feature mutation APIs use convenient follow-up reads and caller sequencing
  where SQLite can provide a stronger mutation-level result.
- CI and developer guidance were updated at different times from dependency
  constraints, creating a stale Node 20 contract and fragile install cache.
- Settings, Supabase, and native workflow contracts have accumulated through
  incremental features and require explicit repository-owned validation rather
  than inferred behavior.

## Progress

- [x] Capture Git topology and verify clean canonical `main`.
- [x] Read required repository guides, workflow docs, QA docs, and relevant
      completed-plan/OpenSpec context.
- [x] Read applicable database, feature-module, and Expo skills.
- [x] Create this Plan-Version 2 ExecPlan.
- [x] Validate this plan immediately.
- [x] Complete current-code audit and reproduce/disprove the A–N findings at
      the source/mechanism level.
- [x] Implement P0 runtime/CI contract and prove stable installation/tests.
- [x] Implement the core P1 linked-action, habit, outbox, and delete atomicity
      wave; remaining concurrent-create and full-suite proof are pending.
- [x] Implement the core P2 calorie/workout mutation wave; remaining broad
      stale/no-op audit and full-suite proof are pending.
- [x] Implement P3 Supabase/AI contract and security hardening.
- [x] Implement P3 native workflow coverage and classify execution limits.
- [x] Implement P3/P4 runtime settings validation, lint architecture, and
      rollover scheduler.
- [x] Complete static trust-boundary and dependency security sweeps.
- [x] Update OpenSpec/specifications and repository docs as needed.
- [x] Run focused, integration, full, web, simulation, timezone, native, and
      repository validation according to impact; native execution is explicitly
      classified as environment-blocked.
- [x] Commit coherent changes and push the first validated campaign wave to `origin/main`; a follow-up worker-topology fix remains to commit/push.
- [x] Inspect the first post-push GitHub CI and resolve its repository-caused shared-OPFS project-parallelism failure locally.
- [x] Push the worker-topology fix and inspect the second post-push GitHub CI; linked-action and simulation failures are resolved, with one habit selector synchronization defect remaining.
- [ ] Push the scoped habit persistence regression fix, inspect final GitHub CI, then complete Outcomes & Retrospective and validate all ExecPlans.

## Surprises & Discoveries

- 2026-08-14 — The repository is already on Node `v22.23.2`, but no
  `package.json` engine contract exists; the lockfile exposes the mismatch
  directly (`better-sqlite3 >=22`, `lint-staged >=22.22.1`).
- 2026-08-14 — `production-correctness-hardening` is a completed skip-spec
  umbrella from an earlier campaign; it is not safe to treat its completed
  task count as proof for the current B–N findings.
- 2026-08-14 — A real SQLite outbox table is a better shared boundary than
  serializing app_meta snapshots: the same transaction can now commit a
  synced mutation and its remote intent, while revision-conditional removal
  protects a newer enqueue during an in-flight push.
- 2026-08-14 — `RETURNING` is available in the real SQLite harness and returns
  the post-increment count from the mutating statement, eliminating the
  threshold race without a per-habit process-global lock.
- 2026-08-14 — Prepared sync revisions can complete in a different order from
  allocation; durable SQL conditional upsert alone was insufficient because
  the in-memory queue could still regress. Queue replacement now ignores an
  older revision, with a direct regression test.
- 2026-08-14 — Workout configuration children are tombstoned with their parent,
  but historical `workout_logs` intentionally survive parent deletion.
- 2026-08-14 — The Supabase backend had a manually maintained disposable
  schema and only a dashboard-era remote baseline. Additive repository-managed
  migrations now define the sync tables and private AI quota RPC; live remote
  policy/type comparison remains credential-dependent.
- 2026-08-14 — GitHub run `31740558470` quality passed under Node `22.23.2`,
  but its main E2E job used two top-level workers across projects that all
  reset/read the same localhost OPFS database. The run failed three unrelated
  tests (habit schedule reload, fresh linked-action identity, and simulation
  report schema); the downloaded report/logs provide the exact assertions.
  Per-project worker limits did not protect the shared origin. The safe fix is
  a global `workers: 1` for every standard invocation, with a serial
  CI-shaped rerun passing all 16 targeted tests.
- 2026-08-14 — GitHub run `31744190344` confirmed the global worker fix: the
  quality job passed and all prior linked-action/simulation failures disappeared.
  The sole E2E failure was the habit schedule reload assertion. Its downloaded
  snapshot showed the app in habit edit mode with no schedule text after reload;
  the earlier assertion had been satisfied by the editor's `Weekdays` option.
  Scoping the assertion to the active habit card and leaving edit mode makes the
  test wait on the actual refreshed row; five repeated focused runs and the
  complete habits spec pass locally.
- 2026-08-14 — GitHub run `31747362847` confirmed the habit-card correction and
  exposed the last two deterministic interaction races: a journey toggle could
  issue a second click before the first todo refresh had committed, and the
  simulation ring action could run against a still-mounted inactive section.
  The shell's inline style has a top-level active-container signature; using it
  rather than any nested pointer-events View, waiting for the requested section
  heading, and polling the live checkbox/ring state removes both ambiguities.
  The focused linked-action journeys pass, and the complete `4.4` scenario,
  seeded, and repro lane passes locally.

## Decision Log

- 2026-08-14 — Preserve the single clean `main` checkout and work in place;
  the current repository explicitly has one canonical worktree and no unknown
  local changes to protect.
- 2026-08-14 — Treat the requested campaign as one coordinated durability
  effort, but implement in priority waves so P0/P1 invariants stabilize before
  lower-priority cleanup.
- 2026-08-14 — Use real SQLite integration/fault-injection tests for recovery,
  concurrency, and outbox boundaries wherever the current test harness permits;
  mocked tests alone cannot prove process-death safety.
- 2026-08-14 — Treat calorie entries as the authoritative ledger and saved
  meals as a best-effort local convenience index; cache failure is logged and
  does not report a committed ledger write as failed.
- 2026-08-14 — Use an exclusive SQLite transaction on native where Expo
  exposes it, with the regular transaction surface for web and the real
  integration harness; unit doubles retain a narrow direct-call fallback.
- 2026-08-14 — Keep Supabase function JWT gateway verification enabled and add
  explicit function-level Auth REST verification plus service-role quota RPC;
  gateway settings alone are not treated as the security invariant.

## Validation Ledger

- 2026-08-14 — Git topology capture (`status`, branches, remotes, worktrees,
  log, fetch/prune, SHA/ref inventory) — PASS — one clean `main` worktree;
  local `main`, `HEAD`, and `origin/main` all `45fecf6`.
- 2026-08-14 — `node --version`; `npm --version` — PASS — Node `v22.23.2`,
  npm `10.9.8`.
- 2026-08-14 — lockfile engine inspection — PASS/FOUND — current lock resolves
  `better-sqlite3@13.0.2` (`>=22`) and `lint-staged@17.3.0` (`>=22.22.1`).
- 2026-08-14 — required instruction/skill reads — PASS — repository guide,
  plan protocol, architecture/rules, QA/workflow context, and applicable
  skills loaded.
- 2026-08-14 — `npx openspec status/list` — PASS — prior hardening change is
  complete; only user-simulation platform remains historical in-progress.
- 2026-08-14 — `npm run agent:plan:validate -- --plan .agent/execplans/repository-correctness-durability-hardening.md` — PASS — initial plan validator run after creation.
- 2026-08-14 — Complete current-code reads — PASS — CI/install, DB/migrations,
  linked actions/effects, sync persistence/adapter, synced feature data layers,
  AI functions, native workflow, app metadata, and rollover sources inspected.
- 2026-08-14 — `npm ci` — PASS — clean lockfile install completed under Node
  `v22.23.2`; postinstall patches and hooks completed; npm reported 16
  vulnerabilities for the later dependency-security phase.
- 2026-08-14 — `npm run typecheck` — PASS — baseline and current transaction/data
  wave typecheck.
- 2026-08-14 — `npm run lint` — PASS — baseline 19 warnings, no errors; warning
  reduction remains a P4 task.
- 2026-08-14 — `npm test` — PASS — 741 tests across 70 files under Node
  `v22.23.2`; the broad suite will be rerun after all campaign changes.
- 2026-08-14 — focused P1/P2 Vitest and integration commands — PASS — migration
  22; sync 14; linked recovery 9; habit concurrency 3; effect idempotency 4;
  delete atomicity 5; calories 3; workout integrity 1; feature unit data
  layers 29.
- 2026-08-14 — `npx vitest run tests/aiSecurity.test.ts tests/sync.engine.test.ts tests/integration/habitConcurrency.test.ts tests/integration/linkedActions.test.ts` — PASS — 32 tests, including auth rejection, quota rejection, provider suppression, parallel quota decisions, out-of-order revisions, concurrent thresholds, and linked-action recovery.
- 2026-08-14 — `npm run supabase:schema:validate` — PASS — 3 migration files, 4 sync tables, RLS/policy markers, private quota RPC, and explicit function JWT settings.
- 2026-08-14 — `deno check supabase/functions/parse-ai-command/index.js supabase/functions/user-ai-ask/index.js` — PASS.
- 2026-08-14 — `npm run typecheck` after Supabase/AI changes — PASS.
- 2026-08-14 — provider-context split plus navigation effect cleanup — PASS —
  `npm run typecheck` and `npm run lint`; ESLint now reports 0 errors and 0
  warnings.
- 2026-08-14 — native preflight — `ENVIRONMENT` — Android has no booted target
  and this Windows host has no Xcode/iOS simulator; reports were written under
  `simulation-output/native/`. Workflow/flow syntax and semantic selectors were
  inspected; cloud execution remains available through EAS.
- 2026-08-14 — static trust sweep — PASS with documented residuals — no
  committed provider credentials, raw user-controlled SQL interpolation,
  unescaped SQLite LIKE search, unbounded important fetch, eval, or dangerous
  HTML found. Internal migration identifiers are now regex-validated. Edge
  Function `@ts-nocheck` remains intentional JS/Deno boundary debt.
- 2026-08-14 — `npm audit` and `npm audit --omit=dev` — FAIL/CLASSIFIED — 16
  framework-owned advisories (6 moderate, 10 high), principally Metro's
  `image-size` and Expo config's `uuid`; the available fixes require an Expo
  53/React Native downgrade. No force fix was run; these remain build/toolchain
  risk rather than bundled app runtime code.
- 2026-08-14 — first post-wave `npm test` — FAIL/PRODUCT+TEST REGRESSIONS —
  caught nested SQLite transactions in recurring expansion, a todo SQL bind
  mismatch, a stale workout soft-delete expectation, a schema-version fixture,
  and an incomplete calorie-domain mock.
- 2026-08-14 — corrected focused rerun — PASS — 25 affected tests; transaction
  calls are serialized per database connection, workout configuration children
  are explicitly tombstoned, and all affected mocks/expectations are aligned.
- 2026-08-14 — corrected `npm test` — PASS — 780 tests across 78 files.
- 2026-08-14 — `npm ci` final reproducibility run — PASS — 1,138 packages
  installed from the lockfile and all postinstall patches applied under Node
  `v22.23.2`.
- 2026-08-14 — three repeated focused durability runs — PASS — each run passed
  17 real-SQLite tests covering concurrency, replay, restart, outbox ordering,
  atomic delete fault injection, calorie partial success, and workout integrity.
- 2026-08-14 — `npm run qa:fast` — PASS — typecheck, lint, and 690 unit tests.
- 2026-08-14 — `npm run qa:integration` — PASS — 90 integration tests across
  17 files, including sync/restore and migration gates.
- 2026-08-14 — `npm run validate:themes` — PASS — all 140 contrast checks.
- 2026-08-14 — `npm run openspec:validate` — PASS — 22/22 artifacts.
- 2026-08-14 — `npm run agent:plan:validate:all` — PASS — all active and
  completed ExecPlans validate.
- 2026-08-14 — `npm run qa:impact:validate` and `npm run qa:affected` — PASS —
  impact map validates and all 12 affected rules are selected.
- 2026-08-14 — `npm run qa:timezones` — PASS — Asia/Manila, UTC,
  America/New_York, Pacific/Honolulu, and Pacific/Kiritimati; 42 tests per
  zone.
- 2026-08-14 — `npm run build:web` — PASS — static Expo web export completed.
- 2026-08-14 — `npm run e2e:full` — PASS — 153 passed and 17 documented skips
  across 170 Chromium/journey/simulation tests; existing J8 ceilings held.
- 2026-08-14 — `npx expo-doctor` — PASS — 19/19 checks.
- 2026-08-14 — `npm run supabase:schema:validate` and Deno checks — PASS —
  repository contract and both Edge Function entrypoints validate.
- 2026-08-14 — `npm audit` and `npm audit --omit=dev` — FAIL/CLASSIFIED —
  each reports the same 16 framework-owned transitive advisories; no force fix
  was run because it would downgrade Expo/React Native.
- 2026-08-14 — `npx supabase status` — ENVIRONMENT — Docker/Podman is absent;
  no local disposable Supabase execution was claimed.
- 2026-08-14 — native smoke preflights — ENVIRONMENT — no Android target and no
  Windows iOS simulator/Xcode; EAS cloud execution remains credential-dependent.
- 2026-08-14 — `npm run sim:validate` — PASS — 17 scenarios validated and
  API-leg guards are clean.
- 2026-08-14 — focused E2E regression lanes — PASS — habit threshold, fresh
  past-midnight, commute/outbox, bad-backend, three-month performance, and
  simulation self-test lanes passed with documented skips only.
- 2026-08-14 — `npx playwright test --project=chromium` — PASS — 88 passed,
  7 documented skips, 95 discovered tests.
- 2026-08-14 — `npx playwright test --project=journeys` — PASS — 62 passed,
  10 documented skips, 72 discovered tests; J8 performance remained below its
  existing threshold.
- 2026-08-14 — first full deterministic simulation run — FAIL/TEST_BUG — all
  scenarios except J1 passed; the runner used an unscoped Calories control and
  did not verify the controlled input. The product path was already covered by
  passing web/unit tests.
- 2026-08-14 — simulation runner correction plus targeted J1 rerun — PASS —
  scoped active-section controls, input-state polling, and rendered-entry
  oracle made all 12 J1 steps deterministic.
- 2026-08-14 — `npm run qa:simulation -- --all --mode deterministic` — PASS —
  all 17 scenarios passed after the runner correction.
- 2026-08-14 — GitHub Actions REST/app inspection for run `31740558470` —
  QUALITY PASS / E2E FAIL — quality completed successfully under Node
  `22.23.2`; the E2E report/logs identified three cross-project shared-OPFS
  failures and a secondary missing `dist-sync/` artifact after the failed
  lane. The artifact was downloaded and inspected; the job was not dismissed
  as an opaque infrastructure failure.
- 2026-08-14 — CI-shaped serial Playwright rerun after `workers: 1` change —
  PASS — Chromium habits (11), linked-action journey (3), and simulation
  self-test (2), 16/16 passed in one worker.
- 2026-08-14 — GitHub Actions inspection for run `31744190344` — QUALITY PASS /
  E2E FAIL — Node `22.23.2` and serial execution were correct; one habit
  schedule assertion remained. The downloaded snapshot showed that the
  pre-reload global text match could be satisfied by the editor, while the
  post-reload screen was still in edit mode and had no schedule label. The
  correction scopes the check to the active habit card and exits edit mode.
- 2026-08-14 — focused habit persistence regression — PASS — the schedule
  reload case passed 5/5 repetitions; the complete `e2e/habits.spec.ts` passed
  11/11 tests using the static web build.
- 2026-08-14 — GitHub Actions inspection for run `31747362847` — QUALITY PASS /
  E2E FAIL — 151 tests passed and 17 documented skips; the remaining failures
  were the habit-linked replay step and simulation self-test `4.4`. The
  downloaded simulation report showed the first `tickHabit` action ran before
  the active Habits section/ring was settled; the journey screenshot showed the
  todo mutation had committed while the dynamic checkbox locator still read a
  stale false node. These were classified as TEST_BUG synchronization defects,
  not product data failures.
- 2026-08-14 — focused post-CI correction — PASS — the habit-increment linked
  action journey passed 3/3 steps, the generic chain-reaction journey passed
  4/4 steps, and simulation self-test `4.4` passed all scenario/seeded/repro
  reports after active-section and live-state synchronization fixes.

## Changed Files / Areas

- `.agent/execplans/repository-correctness-durability-hardening.md` — durable
  campaign state, finding matrix, evidence ledger, and recovery instructions.
- `core/db/transactions.ts`, `core/sync/syncedMutation.ts`,
  `core/sync/syncPersistence.ts`, `core/sync/sync.engine.ts`, and migration 14
  — transaction-owned outbox durability.
- `core/linked-actions/*`, `features/habits/habits.data.ts`, and linked-action
  integration tests — recoverable execution claims and exactly-once habit
  receipt.
- `features/todos/todos.data.ts`, `features/calories/calories.data.ts`, and
  `features/workout/workout.data.ts` plus integration tests — atomic synced
  mutations, stale-row checks, cache semantics, and active-parent integrity.
- CI/docs/runtime files — explicit Node 22 contract and hermetic `npm ci`.
- Supabase contract/security — `supabase/migrations/`, `supabase/README.md`,
  `supabase/config.toml`, both AI functions, shared security helper, static
  validator, AI security tests, and disposable schema/drift documentation.
- E2E/simulation durability — `e2e/helpers/clock.ts`,
  `e2e/helpers/oracles.ts`, the commute/bad-backend/three-month and
  chain-reaction journey specs, and `simulation/runner/actions.ts` now exercise
  the SQLite outbox and clock rollover contract through scoped, state-verified
  controls. The habit reload regression in `e2e/habits.spec.ts` scopes schedule
  assertions to the committed card instead of an editor label; the latest
  navigation/action correction shares the exact active-container selector and
  waits for committed live control state.
- Native workflow and runtime/UI hardening — `.eas/workflows/native-e2e.yml`,
  provider context modules, settings normalizers, and the boundary-driven day
  rollover scheduler.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan, and the relevant OpenSpec
   artifacts.
2. Run `git status --short`, `git diff --stat`, `git diff --name-only`,
   `git branch -vv`, `git worktree list`, and `npm run agent:resume -- --plan
.agent/execplans/repository-correctness-durability-hardening.md`.
3. Reconcile the Current Checkpoint with Git; Git wins over stale narrative.
4. Run `npm run qa:affected` after source changes and follow the impacted
   gates in `docs/testing/autonomous-qa.md`.
5. Continue only from the plan's `Exact next action`; update it before every
   major implementation or validation milestone.
6. Before completion, fetch `origin`, inspect any new remote commits, run
   `git diff --check`, commit intentionally, push normally, inspect GitHub CI,
   and validate this plan plus all versioned plans.

## Outcomes & Retrospective

- Status: Active; implementation is in progress.
- Summary: P0 and the core local durability/data-integrity waves are now
  implemented with real SQLite recovery/concurrency/fault evidence. The
  remaining campaign is primarily Supabase/AI contract/security, native cloud
  coverage, settings validation, lint architecture, rollover efficiency, and
  final full/post-push QA.
- Remaining work: Resolve or classify every A–N finding, preserve all durable
  evidence, push the completed validated work, and record final readiness.
