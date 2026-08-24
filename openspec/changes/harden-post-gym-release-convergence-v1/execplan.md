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

- Current milestone: aggregate smoke is closed; targeted persistence flow
  repairs are complete and the exact-source targeted lane is next.
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
- In progress: source `e92277d` APK is installed and provenance-verified;
  command-center/native smoke pass 2/2 in the aggregate lane. Direct replay
  now passes the Gym V2, legacy Workout, Calories, habit, reminder-persistence,
  and permission-denied flows. The remaining reminder-disable and isolation
  checks require the committed per-habit accessibility labels in a rebuilt
  APK before the runner lane is certified.
- Important modified files: current docs/agent maps, `package.json`,
  `scripts/qa-native-provision.mjs`, `scripts/qa-native.mjs`,
  `scripts/native-qa-utils.mjs`, `tests/qaNativeProvision.test.ts`,
  `.maestro/flows/workout-gym-v2-*.yaml`, the targeted persistence flows,
  `.eas/workflows/native-e2e.yml`, `features/habits/HabitsScreen.tsx`, and the
  two Workout exercise-toggle components. Generated `android/` and native
  reports remain ignored.
- Last successful validation: the current-source Android APK was rebuilt in
  8m02s, installed on `emulator-5554`, and provenance-verified at source
  `e92277d` (API 36, x86_64, package `com.dale16.superhabits`, APK SHA-256
  `CECE14D5...E9CC2C4`). The aggregate smoke lane passed 2/2; report:
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
- Targeted persistence report
  `simulation-output/native/native-android-persistence-2026-08-24T094203528Z.json`
  recorded 3/11 passing and 8/11 failing. The failures were calories field
  discovery, habit form discovery/reminder denial state, and Workout routine
  form discovery. The first hypotheses are missing state-based waits after
  section navigation and selector drift; the underlying product assertions
  remain intact until direct replay determines the classification.
- Direct native replay after those findings classified the flow defects as
  `TEST_BUG`: post-Gym Workout forms moved below the fold, native keyboards
  obscured sequential fields, the Diary row was below the summary, habit
  groups/forms reused scroll offsets, and the disable flow contained a
  contradictory positive reminder wait. The corrected direct flows passed
  Gym V2 persistence, legacy Workout persistence, Calories persistence,
  habit persistence, reminder persistence, and permission-denied reminder
  behavior. A separate Gboard Settings foreground during one optional
  `hideKeyboard` call was classified `FLAKY_TEST`/`ENVIRONMENT`; scrolling
  while the IME is present is now used where safe. The final two reminder
  flows are pending the rebuilt APK containing the new per-habit labels.
- Blockers: none known for local implementation; Android target/toolchain,
  Supabase remote access, iOS/EAS access, and exact-head CI remain to be
  determined by their respective commands.
- Condition required to unblock: none.
- Exact resume action after unblock: commit the targeted flow/semantic-label
  checkpoint, provision the exact new SHA, then run the complete targeted
  persistence lane against that APK.
- Exact next action: run formatting/static checks, commit the targeted native
  hardening, rebuild/install and provenance-verify that exact commit, and run
  `npm run qa:native:targeted -- --serial emulator-5554`.
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
  edit mode. The installed e92277d APK predates this label, so final native
  classification waits for the exact rebuilt checkpoint.

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
