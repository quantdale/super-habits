# ExecPlan: Post-parallel integration and autonomous continuation

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Integrate the completed Habit Reminder Interactions V2 work with the completed
`parallel/headless-hardening` workstream, prove the result as one coherent
SuperHabits product, and continue through the highest-value remaining work
before handing off. Success means both source histories remain recoverable, the
integration branch is validated across static, web/headless, performance,
dependency, and serialized native lanes, and any remaining gaps are classified
with evidence rather than hidden.

## Context

- Repository: SuperHabits, Expo SDK 55 / React Native 0.83 / SQLite-first PWA
  and native app.
- Main and common ancestor: `15a1a92` (`Plans`).
- Reminder source branch: `codex/add-schedule-aware-habit-reminders`, stable
  feature tip `2d8223e` (`feat: complete schedule-aware habit reminder
actions`). It contains the completed `add-schedule-aware-habit-reminders`
  (28/28 tasks) and `add-habit-reminder-actions` (16/16 tasks) artifacts and
  implementation, including migration 13 and native probes.
- Headless source branch: `parallel/headless-hardening`, tip `bd46856`
  (`docs: record dummy sync validation`), with its clean sibling worktree at
  `C:\Users\Michael Roy\Documents\super-habits-headless`.
- Integration branch/worktree: `integration/reminder-actions-headless` at
  `C:\Users\Michael Roy\Documents\super-habits-integrated`.
- The original feature worktree still retains its separate dependency/
  configuration edits. After inspection, the integration branch deliberately
  incorporated the SDK-55-compatible subset as `12be240`, covering
  `package.json`, `package-lock.json`, ESLint configuration, and versioned
  patch filenames; the unrelated dependency ExecPlan remains outside this
  branch.
- Runtime schema truth is `core/db/client.ts` bootstrap plus append-only
  migrations. `schema.sql` is reference-only. Migration 13 is the durable
  processed-notification-action store.

## Scope

- Merge both completed workstreams without wholesale `ours`/`theirs`
  conflict resolution.
- Verify sync metadata hydration, repeat soft-delete guards, journey fixture
  contracts, reminder routing/actions/idempotency/snooze/Linked Actions,
  migration ordering, and Pomodoro isolation.
- Run the affected static, OpenSpec, integration, web/headless, performance,
  dependency, and serialized Android QA required by current evidence.
- Reassess D14/CG-4 under a controlled environment and fix only a reproduced
  root cause.
- Attempt the remaining real Android notification-shade and direct cold-start
  proofs honestly, then continue with the highest-value current-tree work.
- Create a new OpenSpec for Habit Progress Insights V1 only after stabilization
  proves no higher-priority correctness, security, reliability, or performance
  issue remains.

## Non-Goals

- Do not mutate `main` before the integrated branch is clean and all required
  evidence is reviewed.
- Do not delete or rewrite either source branch, weaken tests, raise thresholds,
  reduce fixtures, or use retry roulette.
- Do not run competing emulator/Maestro sessions or use remote Supabase
  mutation without explicit product need and safe verification.
- Do not include the preserved dependency/configuration worktree edits merely
  because they are available; assess them as a separate evidence-backed phase.
- Do not expand Habit Progress Insights into AI, social, gamification, backend
  analytics, or prediction features.

## Current Checkpoint

- Current milestone: Integration and continuation are complete on the
  preserved integration history plus the campaign branch. Web/headless,
  sync/restore, timezone, simulation, dependency, and serialized Android
  evidence are recorded; D14 remains an explicit host-sensitive exception.
- Completed: Read repository startup/architecture/QA/ExecPlan instructions;
  located the actual Reminder worktree and OpenSpec history; verified the
  headless branch/worktree and common ancestor; staged only task-owned Reminder
  V2 plus its schedule-aware prerequisite; committed feature tip `2d8223e`;
  created `integration/reminder-actions-headless` from that tip.
- In progress: None — the remaining D14, dependency-audit, iOS, and
  current-source Android toolchain items are external or explicitly deferred
  follow-ups, not unrecorded integration work.
- Important modified files: `package.json`, `package-lock.json`,
  `eslint.config.mjs`, versioned `patches/`, and the earlier merged
  `core/sync/syncPersistence.ts`, the todos/calories/
  workout soft-delete data layers, `e2e/helpers/journey.ts`, their regression
  tests, the merged headless ExecPlan/guidance files, and the Reminder V2 areas
  from feature tip `2d8223e`.
- Last successful validation: The campaign’s final `npm ci` passed with the
  SDK-aligned lockfile; Expo Doctor 19/19 and `expo install --check` passed;
  final typecheck, lint (0 errors/19 warnings), `npm test` (740/70), rebuilt
  web and sync exports, Chromium feature coverage, and the isolated
  dummy-boundary sync journey passed (19/19). The final deterministic
  simulation is 17/17 and the timezone matrix is 42/42 in each of five zones.
  Serialized Android persistence and lifecycle lanes passed 10/10 and 5/5 on
  the installed integration APK.
- Current failures: Final audit reports 16 vulnerabilities (6 moderate, 10
  high), including transitive Expo/Metro/image-size, config, and uuid edges;
  forced repair proposes framework-breaking Expo 53 or React Native 0.72
  paths and was not run. Controlled D14 remains host-sensitive at 3/10
  passes (minimum 765 ms, median 830.5 ms, P90 916 ms, maximum 965 ms) with
  the unchanged 800 ms contract; the preserved control also missed it.
  Current-source Android build is blocked by the local CMake/libc++ toolchain.
- Relevant quarantines: Native iOS is unavailable on Windows; Android remains
  one-emulator/one-Maestro-lane and current-source native UI claims are
  limited by the toolchain; remote Supabase mutation remains out of scope.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — integration and the safe continuation work are
  complete; use `post-integration-expansion.md` for the current handoff
  evidence.
- Remaining definition of done: No remaining work in the safe in-scope
  integration campaign; semantic merge preserved both histories; migration
  ordering is valid; Reminder/headless regressions and required static,
  OpenSpec, impact, integration, timezone, simulation, web, sync, build, and
  serialized Android gates were run and classified; D14/CG-4 is classified;
  dependency and Expo health are understood; continuation work is complete;
  final plan validation and handoff evidence are recorded.

## Progress

- [x] Read repository instructions, skills, and authoritative OpenSpec context.
- [x] Identify source branches, tips, worktrees, and common ancestor.
- [x] Commit task-owned Reminder V2 work as `2d8223e` without absorbing
      unrelated dependency/configuration edits.
- [x] Create integration branch/worktree from the Reminder V2 tip.
- [x] Create this durable Plan-Version 2 integration/continuation plan.
- [x] Merge `parallel/headless-hardening` semantically and commit merge
      `b4f7372`.
- [x] Verify the merged headless changes through unit and real-SQLite tests.
- [x] Verify migration ordering and focused Reminder/headless invariants.
- [x] Reconcile safe SDK 55 dependency/patch drift and re-run the required
      clean install, diagnostics, typecheck, lint, unit suite, and web build.
- [x] Run isolated focused and broad Chromium E2E on port 8091.
- [x] Run isolated P0 and full journey E2E on port 8091.
- [x] Run dummy-Supabase sync build and boundary journeys; `build:sync` and
      `e2e:sync` passed (19/19).
- [x] Collect ten controlled HEAVY D14 repetitions and calculate
      min/median/P90/max/pass count; 8/10 passed, min 748 ms, median 761 ms,
      P90 866 ms, max 1202 ms.
- [x] Run static, integration, OpenSpec, impact, timezone, simulation, web,
      sync, and build QA appropriate to the merged diff; all recorded gates
      are green except the documented dependency audit findings.
- [x] Re-establish D14/CG-4 under controlled conditions and resolve or classify;
      current evidence is intermittent (seven consecutive 748–779 ms passes,
      then isolated 1202 ms and 866 ms misses), not a reliable pass or a
      reproducible over-threshold regression.
- [x] Audit dependency/Expo/lint/format health without unsafe upgrades or
      broad formatting churn.
- [x] Serialize Android native lanes and attempt remaining actionable-reminder
      system proofs; preserve environment/known-gap evidence.
- [x] Audit the stabilized current tree and complete the highest-value safe
      continuation work.
- [x] Inspect final diff/history, validate the plan, and decide whether the
      branch is READY TO MERGE to `main`.

## Surprises & Discoveries

- The Reminder V2 implementation was not present as a hidden Git commit or
  branch; it existed as a dirty feature worktree. It is now preserved in
  `2d8223e`.
- The current source worktree also contains a separate dependency/configuration
  effort. Its files remain uncommitted and outside the integration branch so
  they cannot be mistaken for Reminder V2 ownership.
- OpenSpec reports both schedule-aware reminders and actionable reminder
  changes complete, while their completed artifacts still describe the older
  runtime schema in generated context text; runtime migration inspection must
  be authoritative.

## Decision Log

- 2026-08-12 — Use `codex/add-schedule-aware-habit-reminders` as the Reminder
  source because Git topology and the complete OpenSpec artifacts identify it
  as the actual worktree containing the implementation; no other feature tip
  exists.
- 2026-08-12 — Commit only task-owned Reminder/schedule-aware files before
  integration; preserve dependency/configuration edits in their original dirty
  worktree rather than silently merging unrelated work.
- 2026-08-12 — Start the integration branch at `2d8223e` and merge
  `parallel/headless-hardening` with `--no-ff` so both histories remain visible
  and conflicts can be reviewed by intent.
- 2026-08-12 — The merge produced no textual conflicts. Review the actual
  headless diff rather than treating that as proof of correctness; the
  non-overlapping fixes remain intact and the merged commit is
  `b4f7372`.
- 2026-08-12 — Keep `main` unchanged until the final evidence review.

## Validation Ledger

- 2026-08-12 — Repository startup inventory (`git status`, branches,
  worktrees, logs, remotes) — PASS; common ancestor `15a1a92`, Reminder source
  worktree identified, headless tip `bd46856` identified.
- 2026-08-12 — `openspec status/instructions --change
add-habit-reminder-actions` — PASS; planning complete, 16/16 tasks done.
- 2026-08-12 — `openspec status/instructions --change
add-schedule-aware-habit-reminders` — PASS; planning complete, 28/28 tasks
  done.
- 2026-08-12 — `git diff --cached --check` and feature commit hook — PASS;
  Reminder source commit `2d8223e` created with staged-file formatting/lint.
- 2026-08-12 — `git merge --no-ff parallel/headless-hardening` — PASS; merge
  commit `b4f7372`, no textual conflicts, headless changes reviewed in sync,
  data, journey, and regression-test areas.
- 2026-08-12 — Integrated-tree gates — initially NOT RUN; the subsequent
  post-reconciliation matrix is recorded below.
- 2026-08-12 — `npm ci` — PASS; 1111 packages installed, baseline patches
  applied; 24 audit advisories remain and `simple-git-hooks` cannot create
  hooks through a worktree `.git` file.
- 2026-08-12 — `npm run typecheck` — PASS; no TypeScript errors.
- 2026-08-12 — `npm run lint` — PASS; 0 errors and 19 warnings within the
  25-warning budget; warnings preserved for later safe triage.
- 2026-08-12 — `npm test` — PASS; 727 tests across 68 files.
- 2026-08-12 — `npm run qa:integration` — PASS; 67 real-SQLite tests across
  10 integration files, including headless soft-delete/sync and Reminder V2
  action/restart coverage.
- 2026-08-12 — `npm run openspec:validate` — PASS; 20/20 items valid.
- 2026-08-12 — `npm run qa:impact:validate` — PASS; 12 impact rules valid.
- 2026-08-12 — `npm run agent:plan:validate:all` — PASS; all versioned plans
  valid.
- 2026-08-12 — `npx expo-doctor` — FAIL/DEPENDENCY_DRIFT; Expo Doctor 18/19,
  with SDK 55-compatible package drift and the existing watcher option warning;
  no unsafe repair applied.
- 2026-08-12 — Migration audit (`core/db/client.ts`, `schema.sql`, migration
  tests) — PASS; append-only blocks 2–13, no duplicate number, migration 13
  table/index, schema version 13, and real-SQLite latest-schema assertions are
  consistent. `schema.sql` remains an explicitly reference-only through-v12
  snapshot.
- 2026-08-12 — Focused unit reminder/headless set — PASS; 63 tests across six
  files.
- 2026-08-12 — Focused real-SQLite set — PASS; 32 tests across four files.
- 2026-08-12 — Baseline `npm run build:web` — PASS; static export completed.
- 2026-08-12 — `npm run qa:timezones` — PASS; Asia/Manila, UTC,
  America/New_York, Pacific/Honolulu, and Pacific/Kiritimati each passed 42
  checks.
- 2026-08-12 — `npm run qa:simulation` — PASS; rebuilt web export, simulation
  model validation (17 scenarios) and deterministic P0 smoke passed.
- 2026-08-12 — SDK reconciliation (`package.json`, lockfile, ESLint config,
  versioned patches) — PASS; applied only SDK-55-compatible versions, added
  documented direct/runtime dependencies, and did not run forced audit repair.
- 2026-08-12 — post-reconciliation `npm ci` — PASS; 1137 packages installed,
  both versioned patches applied; 21 npm install-time audit findings reported.
- 2026-08-12 — `npx expo-doctor` — PASS; 19/19 checks.
- 2026-08-12 — `npx expo install --check` — PASS; dependencies up to date.
- 2026-08-12 — `npm audit --omit=dev` — FAIL/KNOWN DEPENDENCY AUDIT; 19
  transitive/platform/build findings remain; `--force` would downgrade Expo
  to 53, so no mutation was applied.
- 2026-08-12 — post-reconciliation `npm run typecheck` — PASS.
- 2026-08-12 — post-reconciliation `npm run lint` — PASS; 0 errors/19
  warnings.
- 2026-08-12 — post-reconciliation `npm test` — PASS; 727 tests across 68
  files.
- 2026-08-12 — post-reconciliation `npm run build:web` — PASS; static export
  completed with the aligned packages and gradient runtime peer.
- 2026-08-12 — `E2E_PORT=8091 npx playwright test --project=chromium
e2e/habits.spec.ts` — PASS; 10/10 focused Habit tests.
- 2026-08-12 — `E2E_PORT=8091 npx playwright test --project=chromium` — PASS;
  87 passed, 7 expected internal-mode skips, 0 failed (94 total) in 8.1
  minutes.
- 2026-08-12 — `E2E_PORT=8091 npx playwright test --project=journeys --grep
'@p0'` — PASS; 16/16 P0 journeys in 1.1 minutes.
- 2026-08-12 — `E2E_PORT=8091 npx playwright test --project=journeys` — PASS;
  62 passed, 10 expected remote-boundary skips, 0 failed (72 total) in 3.6
  minutes. Canonical HEAVY J8 timing: coldOverview 727ms, maxSwitch 736ms
  (overview→todos 736ms; all six switches within 800ms), diarySearch 395ms,
  pickerSearch 80ms.
- 2026-08-12 — `npm run build:sync` — PASS; isolated `dist-sync` export
  completed with the dummy Supabase boundary configuration and no real remote
  credentials.
- 2026-08-12 — `npm run e2e:sync` — PASS; 19/19 journeys-sync checks passed
  against the dummy boundary, including malformed/503/timeout/partial-sync,
  restore, offline outbox, and reconnect behavior.
- 2026-08-12 — Ten serial canonical HEAVY J8 repetitions on fresh `dist` at
  isolated port 8091 — INTERMITTENT/UNRESOLVED; max-switch values were
  771, 779, 753, 764, 755, 748, 758, 1202, 755, and 866 ms. Min 748 ms,
  median 761 ms, nearest-rank P90 866 ms, max 1202 ms, pass count 8/10.
  Runs 1–7 were consecutive passes; run 8 failed at `overview→todos` 1202 ms
  with a retained screenshot/trace, run 9 passed, and run 10 failed at
  `overview→todos` 866 ms. The threshold and HEAVY fixture were unchanged.
- 2026-08-12 — D14 artifact inspection — SUPPORTS HOST-SENSITIVE HYPOTHESIS;
  the retained screenshot shows the expected rendered Todos screen with no
  product error, and `measureSwitch` uses wall-clock time around a browser
  click plus a DOM-wide opacity poll. The known Nitro emulator was still
  running during this first sample; its QEMU process consumed about 1.3 CPU
  seconds during a five-second idle observation, so that sample is retained
  but not treated as a genuinely quiet-host baseline.

## Changed Files / Areas

- `app/`, `core/notifications/`, `core/db/`, `core/providers/`,
  `core/sync/` — Reminder response lifecycle, bootstrap/navigation readiness,
  durable action migration, and restore/reconciliation integration.
- `features/habits/`, `lib/notifications.ts`, `lib/notificationConstants.ts`
  — Schedule-aware planning, notification actions, canonical completion,
  snooze, and native wrapper behavior.
- `tests/`, `e2e/`, `simulation/`, `.maestro/`, `scripts/` — unit,
  real-SQLite, journey, simulation, and Android probe coverage.
- `openspec/changes/add-habit-reminder-actions/` and
  `openspec/changes/add-schedule-aware-habit-reminders/` — normative artifacts
  and completed implementation plans.
- `parallel/headless-hardening` source areas — merged and reviewed for sync
  metadata validation, soft-delete guards, test fixture handling, lint, and
  current repository guidance; broad QA remains.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `docs/PROJECT_STRUCTURE_MAP.md`,
   `docs/codex-workflow.md`, `.cursorrules`, `.cursor/rules/superhabits-rules.mdc`,
   and `.agent/PLANS.md`.
2. Read this plan completely.
3. From the integration worktree run `git status --short`, `git diff --stat`,
   `git diff --name-only`, and `npm run agent:resume -- --plan
.agent/execplans/post-parallel-integration.md`.
4. Reconcile Git with this checkpoint, inspect recent QA artifacts, and run
   `npm run qa:affected` when implementation changes are present.
5. Continue only from `Exact next action`, updating this plan after every
   meaningful merge, decision, failure, fix, delegation boundary, and QA
   milestone.

## Outcomes & Retrospective

- Status: Completed.
- Summary: Source preservation, durable planning, the semantic two-parent
  integration merge, SDK-55-compatible dependency alignment, web/headless
  journeys, dummy sync boundary, controlled performance classification,
  serialized native proof, and high-value continuation work are complete. The
  campaign branch contains the current implementation and remains separate
  from `main`.
- Follow-up: Revisit D14 on a controlled low-contention host and repair the
  current-source Android CMake/libc++ environment when external toolchain
  support is available; no threshold, fixture, or framework-breaking
  dependency change was used to close the plan.
