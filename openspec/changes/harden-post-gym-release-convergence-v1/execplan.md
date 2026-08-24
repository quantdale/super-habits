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

- Current milestone: native flow hardening is complete for the current
  checkpoint and the last pre-certification source changes are being validated
  before the final exact-source APK build.
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
- In progress: source `762a9e3` was rebuilt and installed on the clean
  `emulator-5556` API-36 x86_64 `CRBABot_API_36` target. Isolated direct replay
  now passes the repaired Gym V2, legacy Workout, Calories, habit, schedule,
  reminder persistence, reminder disable, permission-denied, and reminder
  isolation flows. The remaining active-session replay requires the final
  source changes below in a rebuilt APK before runner certification.
- Important modified files: current docs/agent maps, `package.json`,
  `scripts/qa-native-provision.mjs`, `scripts/qa-native.mjs`,
  `scripts/native-qa-utils.mjs`, `tests/qaNativeProvision.test.ts`,
  `.maestro/flows/workout-gym-v2-*.yaml`, the targeted persistence flows,
  `.eas/workflows/native-e2e.yml`, `features/habits/HabitsScreen.tsx`,
  `core/ui/NumberStepperField.tsx`, `features/workout/WorkoutSessionScreen.tsx`,
  and the two Workout exercise-toggle components. Generated `android/` and
  native reports remain ignored.
- Last successful validation: source `762a9e3` was rebuilt in 7m11s, installed
  on `emulator-5556` (`CRBABot_API_36`, API 36, x86_64), and provenance-verified
  with package `com.dale16.superhabits` 1.0.0 / versionCode 1 and APK SHA-256
  `BD8F14CD...2E33306825A29C0AC`. The prior exact-source aggregate smoke
  lane passed 2/2 on `emulator-5554`; report:
  `simulation-output/native/native-android-smoke-2026-08-24T093033141Z.json`.
- Current failures: first smoke replay findings are classified `TEST_BUG`:
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
  `ENVIRONMENT`; no native result is claimed until executed. The original
  smoke findings are `TEST_BUG`, not product failures. No arbitrary waits,
  coordinate-only app taps, production credentials, or historical Scope-6
  rewrites were introduced.
- Relevant quarantines: none; the corrected flows retain the original review,
  persistence, and lifecycle assertions. The runner now requests
  `--reinstall-driver` per lane and section markers use state-based waits; no
  assertion has been removed. The smoke report is
  `simulation-output/native/native-android-all-2026-08-24T091755013Z.json`.
- Exact-source targeted runner report
  `simulation-output/native/native-android-persistence-2026-08-24T113235793Z.json`
  recorded four flow passes before the emulator exited during cleanup and
  seven failures. The report is retained as `ENVIRONMENT` evidence for the
  lost `emulator-5554` target, while isolated replays on the clean
  `emulator-5556` target reproduced the app-state/selector failures as
  `TEST_BUG` and closed them without weakening persistence assertions.
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
  weight; a distinct accessibility label is now in the source and awaits the
  final rebuilt APK.
- Blockers: none known for local implementation; Android target/toolchain,
  Supabase remote access, iOS/EAS access, and exact-head CI remain to be
  determined by their respective commands.
- Condition required to unblock: none.
- Exact resume action after unblock: run formatting/typecheck/native helper
  checks, commit the final native hardening checkpoint, provision the exact
  new SHA on one verified API-36 x86_64 target, then run the required smoke,
  targeted, lifecycle, and focused Gym session lanes.
- Exact next action: validate and commit the current flow/semantic-label/
  runner changes, rebuild/install/provenance-verify that exact commit on
  `emulator-5556`, then run `npm run qa:native:android -- --serial
emulator-5556`, `npm run qa:native:targeted -- --serial emulator-5556`,
  `npm run qa:native:lifecycle -- --serial emulator-5556`, and the focused
  `workout-gym-v2-session-lifecycle.yaml` replay.
- Remaining definition of done: focused recovery tests; current-source Android
  provisioning and native smoke/targeted/lifecycle/Gym execution or precise
  classifications; timing investigation; affected and broad gates; exact
  final SHA pushed and CI status inspected; working tree clean.

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
      persistence replay passes, with exact-runner certification pending the
      rebuilt checkpoint.
- [ ] Close the corrected targeted persistence lane on the exact rebuilt APK.
- [ ] Investigate timing-sensitive gates without weakening assertions.
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
  accessibility label and updated the flow; exact rebuilt APK replay remains
  pending.

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
