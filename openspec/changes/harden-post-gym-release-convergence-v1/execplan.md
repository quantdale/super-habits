# ExecPlan: Post-Gym V2 Release Convergence and Native Certification

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Produce one canonical, reviewable post-Gym V2 release-candidate branch that
preserves current `main` governance and the complete Gym implementation,
truthfully documents schema v23 / migration slot 24 / Backup Scope 7 with
frozen Scope-6 compatibility, provisions Android native E2E from source,
qualifies platform-sensitive Gym persistence, re-proves recovery contracts,
and records exact-source local/remote certification.

## Context

- Repository: `C:\Users\Michael Roy\Documents\super-habits`.
- Convergence branch: `codex/post-gym-release-convergence-v1`, created from
  `origin/main` at `3e2c8aa0259ec01bce183049694928f0314c956f`.
- Gym source branch: `origin/codex/add-gym-training-system-v2` at
  `f5e9678b7f2346736e9d7326b4fc79b0cf7c53d4`.
- Merge base: `d0a9d84e7829efdf002f2ed6a8de3462b2e9bfbe`.
- The Gym branch is 10 commits ahead of `origin/main`; `origin/main` is one
  planner/handoff commit ahead of Gym. Neither historical branch will be
  rewritten.
- Runtime authority is `core/db/client.ts` plus executable backup/portable and
  Supabase validators. Current integrated expectations are schema 23, next
  append-only migration 24, Backup Scope 7, independently versioned backup
  schema, frozen Scope-6 compatibility, empty-device-only Restore V2, local
  owner binding, portable file import/export, and push-only Supabase backup.
- Required orientation was completed from repository files. The requested
  `.agent/PLANNER_HANDOFF.md` is absent from this checkout; no replacement
  file was invented. Existing `.agent/PLANS.md`, OpenSpec plans, Git, and QA
  artifacts are the recovery authorities.
- Native documentation records a working Windows/Nitro Android toolchain but
  the existing local runner does not build/install an absent E2E APK. Windows
  cannot claim local iOS/Xcode execution.

## Scope

- Git convergence and subsystem-preservation proof.
- Runtime-contract/documentation truth sweep with historical-vs-current scope
  classification.
- Android E2E build/install/identity provisioning and focused native Gym V2
  persistence/durable-session flows.
- Backup/portable/restore/Supabase revalidation, timing investigation, local
  regression ladder, exact-head push/CI inspection, and closure evidence.

## Non-Goals

- No migration 24 unless a real defect requires a schema change.
- No two-way sync, conflict-resolution model, new navigation architecture,
  social/AI/paywall/telemetry features, or unrelated Gym V3 breadth.
- No production secrets, destructive remote reset, copied external dataset, or
  user-specific absolute machine path.

## Current Checkpoint

- Current milestone: source integration and focused browser regressions are
  complete. Commit `4d3f466` fixes two deterministic Playwright test defects,
  and the valid full-journey P2 performance probe passed 70/70 steps across ten
  HEAVY repetitions without changing the 800 ms ceiling.
- Completed: Read `AGENTS.md`, `.agent/PLANS.md`, `.agent/PLANNER_HANDOFF.md`
  after integration, project/rule/Codex/QA/native guidance, DB/RN skills, Gym
  OpenSpec ExecPlans, and current Git/OpenSpec state. Fetched all refs. Created
  proposal, two normative specs, design, tasks, and this Plan-Version 2
  ExecPlan. Created the convergence branch from `origin/main` and merged the
  Gym branch with merge commit `336f59e` (parents `3e2c8aa` and `f5e9678`).
  Pushed planning milestone `62b789d`. Audited current schema/backup/portable/
  Supabase/native prose while preserving historical Scope-6 fixtures. Added
  `scripts/qa-native-provision.mjs`, pure native target parsers/tests, runner
  provenance checks, two focused Gym V2 Maestro flows, and semantic exercise
  configuration labels.
- Completed native checkpoint: source `d484c9e1a442c7bd72ad6882532f88cf5b464938`
  was provisioned and installed on the clean `emulator-5556` API-36 x86_64
  `CRBABot_API_36` target. Smoke passed 2/2; focused Gym V2 persistence and
  durable-session replays passed; the targeted aggregate passed 10/11 with
  only the legacy Workout aggregate miss; and the lifecycle aggregate passed
  5/6 with only the reminder replay missing. The legacy Workout and reminder
  flows each pass exact isolated replay, so those aggregate-only results remain
  `FLAKY_TEST`/`ENVIRONMENT` classifications.
- Completed browser hardening: `e2e/workout-gym-v2.spec.ts` now selects the
  current local weekday row and its semantically named routine button; the Gym
  V2 file passes 6/6. `e2e/journeys/a-tuesday.spec.ts` now uses the semantic
  pending-completion checkbox and waits for its disappearance after the
  TodoItem settle transition; P1 passes 8/8. Both fixes are committed in
  `4d3f466`.
- Completed timing investigation: the valid full P2 journey was run with
  `--repeat-each=10` (70 steps, one worker). All ten strict checks passed; the
  observed max section-switch values were 747, 773, 778, 782, 746, 769, 767,
  754, 747, and 750 ms. The earlier 811 ms full-suite observation is therefore
  classified `FLAKY_TEST`/host scheduling sensitivity, with the 800 ms contract
  preserved and no arbitrary wait or threshold change.
- In progress: run the broad source gates and sync lane against the committed
  test fixes; inspect iOS/EAS and remote Supabase/CI availability; close the
  OpenSpec/ExecPlan state; then provision/build/install the final source SHA on
  the verified Android target and rerun final smoke plus focused Gym evidence.
- Important modified files: current docs/agent maps, `package.json`,
  `scripts/qa-native-provision.mjs`, `scripts/qa-native.mjs`,
  `scripts/native-qa-utils.mjs`, `tests/qaNativeProvision.test.ts`,
  `.maestro/flows/workout-gym-v2-*.yaml`, the targeted persistence flows,
  `.eas/workflows/native-e2e.yml`, `features/habits/HabitsScreen.tsx`,
  `core/ui/NumberStepperField.tsx`, `features/workout/WorkoutSessionScreen.tsx`,
  and the two Workout exercise-toggle components, plus
  `e2e/workout-gym-v2.spec.ts` and `e2e/journeys/a-tuesday.spec.ts`. Generated
  `android/`, dist output, and native/browser reports remain ignored or
  excluded by repository policy.
- Last successful validation: the current committed source's focused browser
  evidence is Gym 6/6, P1 8/8, and P2 70/70. The d484 source APK was built in
  8m30s, installed on `emulator-5556` (`CRBABot_API_36`, API 36, x86_64), and
  provenance-verified with package `com.dale16.superhabits` 1.0.0 /
  versionCode 1 and APK SHA-256
  `FD0D0CBCE6A2C481C3D602C8929309E526CEB1940FF2187D61B73B1663BFFD31`.
  Its smoke runner passed 2/2; focused Gym V2 persistence and
  `workout-gym-v2-session-lifecycle.yaml` passed; aggregate-only misses and
  isolated replays are recorded in the validation ledger.
- Current failures: no product implementation failure is known. The final
  targeted aggregate report recorded only the legacy Workout aggregate miss;
  its exact isolated replay passes. The final lifecycle aggregate recorded
  only the missing reminder replay; its exact isolated replay passes. Those
  aggregate-only results are `FLAKY_TEST`/`ENVIRONMENT` evidence, not product
  failures. The Calories `hideKeyboard` launcher defect was a native test
  defect and is fixed with `pressKey: BACK`; the complete Calories flow passes.
  The earlier full Playwright failures were test defects fixed in `4d3f466`,
  and the complete P2 timing probe now passes.
  Aggregate
  targeted/lifecycle runner failures are classified `FLAKY_TEST`/`ENVIRONMENT`
  when the same exact flow passes in isolation and the failing flow changes
  between complete-file reruns. Preserved reports include
  `simulation-output/native/native-android-persistence-2026-08-24T135422955Z.json`,
  `...141542313Z.json`, and
  `simulation-output/native/native-android-lifecycle-2026-08-24T143039108Z.json`.
  First smoke
  replay findings are classified `TEST_BUG`:
  the Workout marker asserted pre-Gym onboarding copy, and Maestro lost
  characters while typing into the controlled command field. The direct
  replay reproduced the latter with malformed text while the product parser
  remained on its unsupported state. The corrected flow now selects an exact
  semantic supported-example button, and the stale marker is updated to the
  current user-visible Gym copy. The runner replay-command join bug is also
  corrected so failure artifacts contain executable commands. Static validation
  of the corrections passes. The first direct replay used the stale pre-fix
  APK and could not find the new semantic label; this is not a new product
  failure. The stale-build replay is superseded by the exact-source rebuild;
  no command-center product failure remains. Subsequent smoke attempts exposed
  `ENVIRONMENT`/driver instability: Maestro Android driver startup timed out on
  two retries, and a later reinstalled-driver run stopped while the UI was
  settling after opening Command center. The AVD was restarted from a clean
  boot; the corrected native smoke then passed all section/settings checks.
- Relevant classifications: the existing Windows/iOS limitation remains
  `ENVIRONMENT`; Android execution is recorded separately with exact APK
  provenance and aggregate-only `FLAKY_TEST`/`ENVIRONMENT` results. The
  original smoke findings are `TEST_BUG`, not product failures. No arbitrary waits,
  coordinate-only app taps, production credentials, or historical Scope-6
  rewrites were introduced.
- Relevant quarantines: none; the corrected flows retain the original review,
  persistence, and lifecycle assertions. The runner now requests
  `--reinstall-driver` per lane and section markers use state-based waits; no
  assertion has been removed. The smoke report is
  `simulation-output/native/native-android-all-2026-08-24T091755013Z.json`.
- Exact-source targeted runner report
  `simulation-output/native/native-android-persistence-2026-08-24T130219831Z.json`
  on exact source `386f2e2` recorded 7/11 passes. Its four failures were
  deterministic `TEST_BUG` flow issues: the Calories keyboard covered the
  below-Meal action, grouped reminder cards needed semantic Edit-mode scroll,
  and the nested schedule form needed a state-directed scroll before Create.
  The preceding `...113235793Z.json` report remains preserved as
  `ENVIRONMENT` evidence for the lost `emulator-5554` target.
- Direct native replay after those findings classified the flow defects as
  `TEST_BUG`: post-Gym Workout forms moved below the fold, native keyboards
  obscured sequential fields, the Diary row was below the summary, habit
  groups/forms reused scroll offsets, reminder assertions were outside the
  visible card viewport, grouped delete needed a per-habit label, the
  isolation flow asserted the opposite of its own no-inheritance contract,
  and the Pomodoro selector used a stale `Reset|Abandon` expression. The
  corrected direct flows pass those contracts. A separate Gboard Settings
  foreground during one optional `hideKeyboard` call remains
  `FLAKY_TEST`/`ENVIRONMENT` evidence; scrolling while the IME is present is
  used where safe. The active-session flow exposed a test-selector issue:
  the Reps label and Reps input shared a selector, causing `6` to append to
  weight; a distinct accessibility label is now in the source, and the exact
  d484 rebuilt APK flow passes.
- The four exact-APK targeted failures were then replayed independently and
  fixed as `TEST_BUG`: `calories-persistence` now hides the visible IME before
  tapping Add entry below Meal; reminder disable/isolation now use semantic
  `scrollUntilVisible` for Enter habit edit mode; and both the schedule form
  and the isolation form use a state-directed upward swipe before Create.
  Calories, disable, isolation, and schedule all pass after these fixes.
- Lifecycle flow triage found the same current-UI drift in the older reminder
  action/replay/delivery flows: they used generic `Edit`, coordinate-only row
  reveals, and assertions before the row was in the viewport. They now use
  per-habit `Edit <name>` labels, semantic scrolls, keyboard-safe Create
  reveals, and row-state scrolls; Pomodoro now targets `Reset (not logged)`.
  The four flows pass isolated exact-APK replay, including notification
  scheduling-path and durable action replay assertions.
- The final Calories replay showed Maestro's `hideKeyboard` returning to the
  Android launcher on this target, which made the below-Meal action impossible
  to locate. The flow now uses `pressKey: BACK`; the final exact APK replay
  passes the add/diary/kill/relaunch contract without weakening assertions.
- Blockers: none known for local implementation. Supabase remote state,
  iOS/EAS execution, and exact-head GitHub CI remain to be checked; any
  unavailable credentials or platform capabilities must be reported as
  `EXTERNAL BLOCKER`/`ENVIRONMENT`, not as a pass.
- Condition required to unblock: none.
- Exact resume action after unblock: run the affected and broad source gates,
  complete sync/iOS/remote checks, close and validate this plan, commit the
  final plan/evidence checkpoint, push it, and provision that exact final SHA
  before the last Android smoke/Gym replay.
- Exact next action: run `npm run qa:affected`, then the remaining required
  local gates and sync lane; update this checkpoint with every result before
  final plan closure.
- Remaining definition of done: focused recovery tests; current-source Android
  provisioning and native smoke/targeted/lifecycle/Gym execution or precise
  classifications; valid timing evidence; affected and broad gates; exact
  final SHA pushed and CI status inspected; OpenSpec/ExecPlan closure; working
  tree clean.

## Progress

- [x] Required orientation, Git fetch, branch/ref reconciliation.
- [x] Create convergence branch from current `origin/main`.
- [x] Create OpenSpec proposal, normative specs, design, and tasks.
- [x] Create this Plan-Version 2 ExecPlan.
- [x] Merge completed Gym branch and prove no subsystem loss.
- [x] Compare integrated paths/content and verify major Gym/governance
      subsystems.
- [x] Reconcile runtime truth, docs, QA map, and recovery/Supabase contracts.
- [x] Implement Android build/install/identity provisioning.
- [x] Add focused native Gym V2 flows and semantic hooks; direct Gym V2
      persistence and durable-session replays pass on the exact d484 APK.
- [x] Investigate timing-sensitive gates without weakening assertions; the
      valid ten-repeat P2 probe passes and the earlier full-suite miss is
      classified `FLAKY_TEST`.
- [ ] Rebuild the final committed source and close the targeted native lane on
      the exact final APK.
- [ ] Run affected and full regression ladders; classify all failures.
- [ ] Push final exact SHA, inspect CI, reconcile artifacts, and close plan.

## Surprises & Discoveries

- The working checkout started on the completed Gym branch rather than `main`;
  the fetched `origin/main` was the correct current base and was used directly.
- `.agent/PLANNER_HANDOFF.md` was absent on the Gym checkout but is present on
  current main and is now preserved in the convergence tree.
- The planning-time branch counts and SHAs match the fetched repository,
  including the one newer main commit and ten Gym commits.
- OpenSpec currently reports several unrelated historical changes as
  `in-progress`; they must not be rewritten unless their state is directly
  affected by this campaign.

## Decision Log

- 2026-08-24 — Create a new branch from `origin/main` and merge the Gym branch
  normally — preserves both histories and current planner/executor changes.
- 2026-08-24 — Treat source/validators as authority for schema/scope wording —
  prevents global replacement from corrupting frozen Scope-6 evidence.
- 2026-08-24 — Add only focused native Gym flows and provisioning — covers
  platform-sensitive risk without duplicating the web suite.
- 2026-08-24 — Auto-provision only the credential-free local Android
  `e2e-test` equivalent, and require API 36/x86_64 plus source/package
  provenance before Maestro runs — removes the recurring absent-APK blocker
  without introducing production credentials or machine-specific paths.
- 2026-08-24 — Use a custom catalog-backed weighted exercise for native Gym
  qualification and keep the guided flow small — proves identity, typed
  prescription, draft recovery, and explicit completion without duplicating the
  full web matrix.
- 2026-08-24 — Make the native runner pass `--no-ansi` and the explicit ADB
  serial to Maestro — keeps one-command diagnostics tied to the preflight-
  verified target and avoids terminal redraw ambiguity.
- 2026-08-24 — Add an optional distinct input accessibility label to
  `NumberStepperField` only where the active Workout flow has a duplicate
  visible `Reps` label — gives Maestro and assistive technology a stable
  target without changing the underlying value semantics.

## Validation Ledger

- 2026-08-24 — `git status --short` — PASS; initial Gym checkout clean.
- 2026-08-24 — `git fetch --all --prune` — PASS; fetched current `origin/main`
  and refs.
- 2026-08-24 — ref/merge-base inventory — PASS; expected `3e2c8aa`, `f5e9678`,
  and `d0a9d84` relationship confirmed.
- 2026-08-24 — `npm run agent:plans` — PASS; existing plans discovered.
- 2026-08-24 — `openspec list --json` — PASS; current change inventory read.
- 2026-08-24 — OpenSpec proposal/design/spec/tasks creation — PASS; planning
  artifacts exist and are ready for validation after status refresh.
- 2026-08-24 — `git merge --no-ff origin/codex/add-gym-training-system-v2` — PASS;
  clean merge commit `336f59e`, parents are current main and Gym HEAD.
- 2026-08-24 — `git diff --stat origin/codex/add-gym-training-system-v2..HEAD` —
  PASS; only five main-side planner/executor adapter files differ from Gym.
- 2026-08-24 — changed-path/subsystem audit — PASS; 109 Gym-changed paths are
  present, required source/spec/schema/test/native-governance paths are present,
  and no Gym file differs from the Gym tip.
- 2026-08-24 — native helper test/typecheck/help/diff validation — PASS;
  3/3 parser/selection tests, TypeScript, both CLI help paths, Maestro 2.8.0
  discovery, and `git diff --check` passed before APK execution.
- 2026-08-24 — first current-source provisioning attempt — `PRODUCT_BUG`
  found in the new provisioner: Gradle wrapper cwd was repository root;
  Expo clean prebuild passed and the failure report was preserved.
- 2026-08-24 — first Android smoke run — `TEST_BUG` findings; one selector was
  stale against current Gym V2 onboarding copy, and command-center text-entry
  was not deterministic under the native controlled input. The original
  assertions/artifacts are preserved; fixes use current text and a semantic
  supported-example action, not weaker review assertions.
- 2026-08-24 — targeted native replay — `TEST_BUG` fixes preserved all
  persistence/reminder assertions while replacing stale viewport assumptions
  with semantic scrolls and keyboard-safe progression. The exact Gym V2 flow
  passed after kill/relaunch; Calories and habit/reminder direct replays also
  passed. One Gboard Settings foreground during an already-hidden keyboard
  dismissal is retained as `FLAKY_TEST`/`ENVIRONMENT` evidence, not a product
  result.
- 2026-08-24 — habit edit/delete semantic hardening — added per-habit
  accessibility labels so native flows select the intended card in grouped
- edit mode. The exact `762a9e3` APK on `emulator-5556` then passed the
  repaired disable and isolation replays; the remaining active-session flow
  found a duplicate Reps selector and prompted a distinct input label.
- 2026-08-24 — native target recovery — the first exact targeted aggregate lost
  `emulator-5554` during Maestro cleanup. A clean `CRBABot_API_36` target came
  online as `emulator-5556`; it passed API 36/x86_64 and package provenance
  checks, so subsequent evidence uses the explicit serial rather than mixing
  two emulator instances.
- 2026-08-24 — exact-source provision on `emulator-5556` — PASS; clean Expo
  prebuild, Gradle release build in 7m11s, streamed APK install, package
  identity, source SHA, API/ABI, and E2E environment provenance all passed.
- 2026-08-24 — isolated direct native replays on `emulator-5556` — PASS for
  Gym V2 routine persistence, legacy Workout persistence, Calories, habit
  persistence/schedule, reminder persistence/disable/permission-denied/
  isolation, including Pomodoro background/resume. The targeted aggregate
  report remains a preserved `ENVIRONMENT` result because its emulator exited.
- 2026-08-24 — active-session replay — `TEST_BUG` found; the flow entered `6`
  into the Weight field because visible `Reps` text and the input shared a
  selector, producing `426`. Added an optional distinct `Reps input`
  accessibility label and updated the flow; the exact d484 rebuilt APK replay
  passes.

## Validation additions

- 2026-08-25: final d484 native checkpoint — PASS/`FLAKY_TEST`: smoke 2/2;
  Gym V2 persistence and durable-session isolated replays PASS; targeted
  aggregate 10/11 with only legacy Workout aggregate-only miss; lifecycle
  aggregate 5/6 with only reminder replay aggregate-only miss. Both aggregate
  misses pass exact isolated replay on `emulator-5556`.
- 2026-08-25: focused Playwright fixes — `TEST_BUG FIXED`; Gym V2 6/6 and
  P1 journey 8/8 pass after replacing weekday/DOM-sibling selectors with
  semantic current-day/routine and pending-checkbox selectors.
- 2026-08-25: valid P2 timing campaign — PASS; ten complete HEAVY journey
  repetitions (70/70 steps) passed the unchanged 800 ms ceiling with max
  switch values 747/773/778/782/746/769/767/754/747/750 ms. The prior 811 ms
  full-suite observation is classified `FLAKY_TEST`/host scheduling, not a
  product regression.

## Changed Files / Areas

- `openspec/changes/harden-post-gym-release-convergence-v1/proposal.md` — why,
  scope, capabilities, and impact.
- `openspec/changes/harden-post-gym-release-convergence-v1/specs/**` — release
  contract and native qualification requirements.
- `openspec/changes/harden-post-gym-release-convergence-v1/design.md` — merge,
  metadata, provisioning, native, timing, and remote-boundary approach.
- `openspec/changes/harden-post-gym-release-convergence-v1/tasks.md` — ordered
  implementation/validation checklist.
- `openspec/changes/harden-post-gym-release-convergence-v1/execplan.md` —
  resumable campaign state.
- `.maestro/flows/habit-reminder-actions*.yaml`,
  `.maestro/flows/habit-reminder-delivery.yaml`, and
  `.maestro/flows/pomodoro-lifecycle.yaml` — current semantic native lifecycle
  selectors and viewport-safe assertions.
- `.maestro/flows/calories-persistence.yaml` — Android `BACK` keyboard
  dismissal for a stable below-Meal action.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this ExecPlan, and the OpenSpec
   proposal/spec/design/tasks.
2. Run `git status --short`, `git diff --stat`, `git diff --name-only`, and
   `git branch -vv`; Git wins over stale checkpoint prose.
3. Run `npm run agent:resume -- --plan
openspec/changes/harden-post-gym-release-convergence-v1/execplan.md` and
   reconcile any discrepancy warnings.
4. Continue only from `Exact next action`, updating this checkpoint before a
   major command, failure, fix, or validation milestone.
5. Preserve original QA artifacts and classify failures with
   `PRODUCT_BUG`, `TEST_BUG`, `FLAKY_TEST`, `ENVIRONMENT`,
   `EXPECTED_KNOWN_GAP`, or `SPEC_AMBIGUITY`.

## Outcomes & Retrospective

- Status: Active; implementation and certification are in progress.
- Summary: Not yet complete.
- Proof: Final local gates, native evidence, remote state, and exact-head CI
  will be recorded here before marking the plan COMPLETED.
- Follow-up: None decided; do not invent new product scope after the defined
  release-candidate conditions are satisfied.
