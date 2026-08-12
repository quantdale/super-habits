# ExecPlan: Post-integration autonomous expansion and hardening campaign

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Take the validated Reminder V2 + headless-hardening integration forward as a
single SuperHabits product: recover the real current state, establish a fresh
baseline, fix the highest-value evidence-backed defects, ship Habit Progress
Insights V1, improve correctness/accessibility/reliability where safe, and
leave a tested campaign branch with an honest final handoff.

## Context

- Repository: SuperHabits, offline-first Expo/React Native app with SQLite as
  the local source of truth, static web export, optional Supabase backup, and
  serialized Android Maestro validation.
- Starting branch: `integration/reminder-actions-headless`.
- Starting commit: `aa63cb3` (`docs: record controlled performance evidence`).
- Campaign branch/worktree: `campaign/post-integration-expansion` at
  `C:\Users\Michael Roy\Documents\super-habits-expansion`.
- `main` remains `15a1a92`; recovery branches
  `codex/add-schedule-aware-habit-reminders` and
  `parallel/headless-hardening` remain preserved in their worktrees.
- Prior integration commits include Reminder V2 (`2d8223e`), the semantic
  headless merge (`b4f7372`), SDK-55-compatible dependency alignment
  (`12be240`), and integration checkpoints (`6b54bbd`, `58a261d`, `aa63cb3`).
- The inherited integration plan is still ACTIVE. Its first ten-run D14
  sample recorded 8/10 passes (748 ms minimum, 761 ms median, 866 ms P90,
  1202 ms maximum) while the Nitro emulator was running; the emulator was
  subsequently stopped, but the quiet-host repeat was interrupted when this
  campaign began. Native reminder-shade/cold-start proof also remains to be
  recovered from actual current evidence.
- Runtime schema/migration truth must come from `core/db/client.ts` and
  migration tests, not stale `schema.sql` or older guidance that still names
  v12. Migrations are append-only.

## Scope

- Recover Git, ExecPlans, OpenSpec state, architecture, QA, and dependency
  health from the repository.
- Run the actual current baseline and classify failures before editing.
- Audit the product and rank a concrete queue by severity, user impact,
  likelihood, fix confidence, regression-testability, and risk.
- Unless a higher-severity issue blocks it, create and implement the focused
  `add-habit-progress-insights` OpenSpec with historically correct local
  metrics, accessible UI, bounded data loading, and unit/SQLite/web coverage.
- Complete evidence-backed correctness, sync/restore, accessibility, UX,
  performance, test-runtime, security/dependency, tooling, and documentation
  improvements that fit safely in the campaign.
- Re-run broad headless QA and serialized Android lanes where applicable,
  including Reminder V2 regressions and any materially affected Insights UI.

## Non-Goals

- Do not mutate `main` or remote Supabase merely because it is available.
- Do not delete recovery branches/worktrees or absorb unrelated dirty edits
  from the original feature worktree.
- Do not weaken assertions, raise performance thresholds, reduce fixtures,
  add blind retries, or use arbitrary sleeps to make QA green.
- Do not introduce full multi-device sync, AI coaching, social features,
  analytics warehouse, payments, calendar/watch integrations, or an Expo/RN
  major-version migration.
- Do not create a second habit-calculation model; Insights must reuse the
  existing effective-dated schedule/target and streak semantics.

## Current Checkpoint

- Current milestone: Fresh baseline is green, the audit is ranked, the
  complete Insights domain/data/UI slice is implemented, D14 has been
  compared against the preserved integrated control, serialized Android
  persistence/lifecycle evidence is recorded, and a task accessibility bug is
  fixed with focused web proof and checkpointed as `78ae6ea`; current-source
  sync, P0, and Chromium feature gates are green. Journey helpers were then
  updated to follow the new checkbox semantics after two selector regressions.
- Completed: Recovered branches/worktrees/logs/remotes; verified integrated
  tip `aa63cb3`; confirmed `main` is unchanged and recovery worktrees remain;
  read repository startup, architecture, QA, feature, RN, database/sync,
  OpenSpec, and ExecPlan instructions; created this campaign branch.
- Completed: Inspected the major product/data/sync/accessibility/tooling areas,
  classified inherited gaps, and ranked the queue below. Fixed and committed
  the habit repeat-soft-delete defect in `00c60cd` with a real-SQLite
  regression assertion.
- Completed: `npm run qa:native:targeted` passed 10/10 persistence flows and
  `npm run qa:native:lifecycle` passed 5/5 flows on the installed integration
  APK, including Reminder V2 actions/replay/delivery and Pomodoro lifecycle.
  The APK is older than this campaign tip, so this is strong native behavior
  evidence but not current-source Insights UI evidence.
- Completed: The focused Android-system attempt delivered a real habit
  notification after the app was killed. The expanded System UI hierarchy
  exposed `Mark complete` and `Snooze`; a device-specific, non-gating tap on
  `Mark complete` cold-started `MainActivity`, routed to the exact habit, and
  the list subsequently reported `1 of 1 today`. A second real delivery and
  `Snooze` tap resumed the app and created an Expo notification alarm about
  14m55s ahead, matching the fixed 15-minute replacement. This closes the
  direct Android shade/cold-start reminder evidence on the installed
  integration APK without changing production code or test thresholds.
- Completed: A focused task accessibility audit found that the web
  `RectButton` completion control exposed a checkbox role but did not respond
  to activation. The three layout variants now use React Native `Pressable`
  with task-specific labels and explicit checked state; Show completed and
  Repeat daily controls also expose semantic state. The weak title/glyph E2E
  selectors were replaced with named controls, and the focused Todos suite
  passes 8/8.
- Completed: The final journey run exposed two `TEST_BUG` failures in linked
  action helpers: their old first-`role=button` assumption clicked Edit after
  completion became a semantic checkbox. Both helpers now locate the nearest
  checkbox-bearing row and the focused linked-action journey set passes 7/7.
- In progress: Finish the campaign’s final static/web regression and audit
  checkpoint. The current-source local Android build is separately classified
  as a CMake/libc++ toolchain blocker; do not claim current-tree Insights
  native UI coverage from the older installed APK. Keep the D14 threshold,
  HEAVY fixture, and assertion unchanged.
- Important modified files: `features/habits/habitInsights.domain.ts`,
  `features/habits/HabitProgressInsightsModal.tsx`,
  `features/habits/habits.data.ts`, `features/habits/habits.domain.ts`,
  `features/habits/HabitsScreen.tsx`, and the focused habit E2E/integration
  tests contain the current Insights slice; `00c60cd` remains the committed
  habit-delete fix. The current task accessibility checkpoint covers
  `features/todos/TodoItem.tsx`, `features/todos/TodosScreen.tsx`,
  `e2e/todos.spec.ts`, and the journey comment in
  `e2e/journeys/a-tuesday.spec.ts`.
- Last successful validation: after the task fix, `qa:fast` passed typecheck,
  lint (0 errors/19 warnings), and 672 unit tests/59 files; `qa:integration`
  passed 68 real-SQLite tests/11 files; strict OpenSpec passed 21/21, impact
  validation passed 12/12, and all versioned plan validation passed. The
  focused Chromium task suite remains 8/8, and the rebuilt web export passes.
  The complete Vitest run also passes 740 tests across 70 files.
  The broader baseline uses `npm ci` with 1138 packages and Expo Doctor
  19/19.
- Current failures: the post-repair `npm audit` reports 16 advisories (6
  moderate, 10 high), all remaining through transitive Expo/Metro/image-size,
  config, and uuid edges; the force-fix path still proposes Expo 53 or React
  Native 0.72 and is deferred. D14 remains
  below its threshold on this host for most repetitions but fails in the
  preserved baseline too; it is classified ENVIRONMENT/HOST-SENSITIVE, not
  hidden or fixed by changing the contract. Native direct OS notification
  selection is now proven on Android’s real notification shade for the
  installed integration APK; current-source Insights native UI remains
  unavailable because the local Expo/RN CMake toolchain cannot produce an APK.
- Relevant quarantines: iOS native execution is unavailable on Windows;
  Android is one-emulator/one-Maestro-lane and must remain serialized;
  remote Supabase mutation is out of scope.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: Run the non-HEAVY journey set after the helper fix, then
  rerun current-source timezone/simulation gates and finish dependency and
  final audit reconciliation.
- Remaining definition of done: Baseline classified; prioritized queue
  addressed through multiple meaningful commits; Insights OpenSpec and
  implementation complete or safely deferred with evidence; relevant
  correctness/accessibility/sync/performance/test/tooling improvements
  regression-tested; web/headless and serialized native QA run/classified;
  dependencies/security understood; final branch audit clean of artifacts and
  secrets; this plan validated and completed only when no required campaign
  work remains.

## Progress

- [x] Recover actual Git topology, worktrees, source tips, and integrated tip.
- [x] Create campaign branch/worktree from the validated integrated tip.
- [x] Read required repository, architecture, QA, feature, RN, data, OpenSpec,
      and ExecPlan instructions.
- [x] Establish and record the fresh baseline matrix; static/unit/integration
      gates pass, with 19 lint warnings and 21 audit advisories classified as
      follow-up work.
- [x] Perform source-driven whole-repository audit and rank actionable queue.
- [x] Resolve the highest-confidence higher-severity correctness finding:
      repeated habit soft delete.
- [x] Propose and validate `add-habit-progress-insights` OpenSpec.
- [x] Implement Insights domain with historical semantics and bounded in-memory
      window/trend calculation.
- [x] Implement Insights data loading with historical semantics and bounded
      in-memory list derivation.
- [x] Implement Insights UI with historical semantics and bounded loading.
- [x] Add deterministic Insights domain unit coverage.
- [x] Run serialized Android persistence and lifecycle lanes; record the
      10/10 and 5/5 evidence and the installed-APK/current-source distinction.
- [x] Attempt real Android notification-shade Mark Complete and Snooze actions;
      record cold-start routing, exactly-once count evidence, and the 15-minute
      replacement alarm without making the device-specific tap a gate.
- [x] Add real-SQLite coverage for shared/history loading.
- [x] Add focused web and accessibility-equivalent tests.
- [x] Run the affected QA impact check and strict OpenSpec validation for the
      completed Insights slice.
- [x] Complete additional evidence-backed correctness/sync/restore/accessibility
      or UX work from the ranked queue; the Todo completion semantics and
      related toggle labels/states are now covered by a focused web regression.
- [x] Reassess D14/CG-4 and the current Insights performance impact against
      the preserved integrated baseline; classify the current host variance.
- [x] Capture current-tree J8 evidence: the canonical journey reproduced the
      D14 miss, while an isolated HEAVY downstream diagnostic measured CG-5
      diary/picker response under the unchanged 500 ms ceiling.
- [ ] Audit test runtime/simulation, security/dependencies, types/lint,
      cross-platform scripts, and current documentation.
- [ ] Run broad headless QA and serialized Android lanes; classify all gaps.
- [ ] Inspect final diff/history, validate all plans/OpenSpec, and decide
      whether the branch is READY TO MERGE to `main`.

## Audit Queue

Ranked after the baseline and source inspection with:

`Severity × user impact × likelihood × fix confidence × regression-testability ÷ implementation risk`.

1. **P1 data integrity — repeated habit soft delete (resolved).**
   `features/habits/habits.data.ts` previously rewrote an existing tombstone
   and re-enqueued/cleaned up downstream state on every repeat call, while
   Todos, Calories, and Workout already guarded `deleted_at IS NULL`. The
   fix is `00c60cd`; the integration test proves the second delete preserves
   the first tombstone and does not repeat the mutation path.
2. **P1 product value/correctness — schedule-aware Habit Progress Insights.**
   Existing `habits.domain.ts` already owns effective-dated schedule/target,
   streak, and neutral off-day semantics, while `HabitsScreen` has no useful
   per-habit historical detail surface. This is the next selected workstream:
   expose bounded, accessible metrics without creating a second calculation
   model.
3. **P2 performance — HabitsScreen completion loading is N+1.**
   `refresh()` calls `getHabitCountByDate` once per active habit and
   `getCompletionHistory` once per habit, in addition to the shared heatmap
   query. Insights will use one bounded/history query for the opened habit;
   the list path should also gain a batched completion read if the measured
   impact remains material after implementation.
4. **P2 accessibility — habit editor icon/color controls lack semantic names
   and selected state.** Existing `IconButton` supports both, but the
   habit-specific Pressables in `HabitsScreen` do not expose equivalent
   semantics. Fix alongside the Insights entry/modal so the core habit flow
   is usable by assistive technology.
5. **P2 performance evidence — D14/CG-4 needs a quiet-host repeat.** The
   inherited 10-run sample was 8/10 (748 min, 761 median, 866 P90, 1202 max)
   with `emulator-5554` running; the emulator was stopped and the controlled
   repeat was interrupted. Re-measure after product work in an isolated
   single-worker environment; do not alter the threshold or fixture.
6. **P2 dependency/security — current `npm audit` reports 21 transitive or
   build/tooling advisories.** A forced repair proposes an Expo 53 downgrade,
   so it is not acceptable. Inspect the normal dry-run and runtime omission
   view; apply only SDK-compatible safe patches, otherwise document the exact
   deferred chains.
7. **P2 sync/restore — local hardening is green, but remote round-trip and
   user-scoped Supabase/RLS validation are external capability gaps.** Current
   metadata validation, partial failure retention, and empty-device restore
   safety have focused tests and pass. Do not mutate remote Supabase; add
   local adversarial coverage only where a concrete gap appears.
8. **P3 test/runtime — current simulation and full web matrix need fresh
   campaign evidence.** Run the current lanes after implementation and profile
   only if a real slow or leaking scenario reproduces; do not remove scenarios
   or add retry-based speedups.
9. **P3 documentation — operational guidance still names schema v12 and old
   point-in-time test counts in canonical maps/skills.** Refresh current
   canonical docs after implementation, while preserving historical OpenSpec
   reports as historical evidence.
10. **P3 native capability — Android reminder shade/direct cold-start action
    selection remains unasserted and iOS is unavailable on Windows.** Attempt
    one serialized current-environment proof after headless stabilization;
    retain a precise `EXPECTED_KNOWN_GAP`/`ENVIRONMENT` classification if the
    OS interaction is not deterministic.

Deferred unless new evidence elevates them: broad UI redesign, full pull-based
multi-device sync, remote schema changes, Expo/RN major upgrades, and cosmetic
repository-wide formatting.

## Surprises & Discoveries

- The repository’s persisted state contradicts the new-session assumption that
  integration was fully finished: `post-parallel-integration.md` is ACTIVE and
  records an interrupted D14/native continuation. The campaign carries this
  forward as evidence instead of silently closing it.
- The integrated worktree is clean at `aa63cb3`; the original feature worktree
  has separate dependency/configuration edits and is not the campaign base.

## Decision Log

- 2026-08-12 — Branch from `aa63cb3`, not `main`, because Git and the
  persisted integration plan identify it as the latest validated integrated
  tree while `main` remains at `15a1a92`.
- 2026-08-12 — Preserve the inherited ACTIVE integration plan and include its
  unresolved D14/native evidence in this campaign rather than marking prior
  work complete without proof.
- 2026-08-12 — Keep Insights behind the baseline/audit gate; correctness or
  security findings take precedence over new product capability.

## Validation Ledger

- 2026-08-12 — Git recovery inventory — PASS; campaign base
  `integration/reminder-actions-headless@aa63cb3`, `main@15a1a92`, both source
  branches and all three worktrees preserved.
- 2026-08-12 — Required instruction/skill reads — PASS; repository maps,
  ExecPlan protocol, QA conventions, feature/RN/data invariants, and OpenSpec
  proposal workflow read before implementation.
- 2026-08-12 — Fresh campaign baseline — PASS/CLASSIFIED; exact commands and
  results are recorded below.
- 2026-08-12 — `npm ci` — PASS; 1137 packages installed and both SDK-55
  patches applied. Worktree hook creation reports ENOTDIR because `.git` is a
  worktree file; no product failure.
- 2026-08-12 — `npm run typecheck` — PASS; no TypeScript errors.
- 2026-08-12 — `npm run lint` — PASS; 0 errors and 19 warnings within the
  configured 25-warning budget.
- 2026-08-12 — `npm test` — PASS; 727 tests across 68 files.
- 2026-08-12 — `npm run qa:fast` — PASS; typecheck, lint, and 660 unit tests.
- 2026-08-12 — `npm run qa:integration` — PASS; 67 real-SQLite tests across
  10 integration files.
- 2026-08-12 — `npm run openspec:validate` — PASS; 20/20 artifacts valid.
- 2026-08-12 — `npm run qa:impact:validate` — PASS; 12 impact rules valid.
- 2026-08-12 — `npm run agent:plan:validate:all` — PASS; all versioned plans
  structurally valid, including both active plans.
- 2026-08-12 — `npx expo-doctor` — PASS; 19/19 checks.
- 2026-08-12 — `npm audit` — FAIL/KNOWN DEPENDENCY AUDIT; 21 advisories,
  with forced repair proposing an Expo 53 downgrade; no unsafe repair run.
- 2026-08-12 — Source-driven audit — PASS/CLASSIFIED; found the unguarded
  repeat habit tombstone, confirmed existing Todos/Calories/Workout guards,
  identified the HabitsScreen N+1 completion load, habit editor semantic gaps,
  inherited D14/native evidence gaps, dependency advisories, and canonical
  documentation drift. No higher-severity blocker than the fixed habit
  mutation was found.
- 2026-08-12 — `00c60cd fix: make habit soft delete idempotent` — PASS;
  targeted Vitest (15 tests/2 files), typecheck, and ESLint passed before the
  checkpoint.
- 2026-08-12 — `add-habit-progress-insights` OpenSpec — PASS; proposal,
  delta spec, design, and tasks created and `openspec validate ... --strict`
  passed. Apply instructions report 10 pending tasks.
- 2026-08-12 — Insights domain task 1 — PASS; 12 deterministic Vitest cases
  cover daily/M-W/F/weekdays/weekends, target and schedule history, creation
  and deletion boundaries, current-day grace, off-day neutrality, empty rates,
  trend evidence, >30 streaks, and leap/year boundaries. Typecheck, focused
  lint, and `git diff --check` pass.
- 2026-08-12 — Insights data task 2 — PASS; one ordered active-habit
  completion read replaced the Habits list’s per-habit full-history and
  today-count reads. Real SQLite coverage proves deleted habits are excluded,
  target-two completion is preserved, and opened history uses one query.
  Typecheck, focused unit/integration tests, focused lint, and diff check pass;
  the pre-existing pending-habit focus effect remains one lint warning.
- 2026-08-12 — Insights UI task 3 — PASS; active habits expose an exact-habit
  Progress control and a modal with accessible streak/rate/trend/history text,
  nullable empty-rate messaging, and target-vs-actual rows. Icon/color editor
  controls now expose names and selected state. Focused Playwright Chromium
  habits suite passed 11/11 on isolated port 8091 after a fresh web build;
  typecheck, focused lint, and diff check pass.
- 2026-08-12 — `npm run qa:affected` and strict OpenSpec validation — PASS;
  the clean tree matched the default `qa:fast → qa:full` impact path and all
  21 current OpenSpec artifacts validated.
- 2026-08-12 — `E2E_PORT=8091 npm run e2e:full` — PARTIAL / UNRESOLVED
  PERFORMANCE; the fresh web export and full 170-test Chromium/journeys/
  simulation matrix produced 148 passed, 17 expected skips, 4 continuity
  steps not run after the serial failure, and one failure. J8 measured the
  unchanged HEAVY `overview→todos` switch at 832 ms against the unchanged
  800 ms D14 ceiling; the retained artifact showed the expected Todos UI with
  no product error. This is evidence to investigate, not yet a product-bug or
  host-noise classification; comparison with the preserved control is
  required before assigning product causality.
- 2026-08-12 — Ten sequential current-tree J8 HEAVY repetitions on isolated
  port 8091 with no emulator or competing listener — ENVIRONMENT /
  HOST-SENSITIVE; all 10 serial journeys failed the first measured
  `overview→todos` switch at 945, 840, 811, 874, 813, 889, 849, 826, 816,
  and 822 ms. Min 811 ms, median 833 ms, nearest-rank P90 889 ms, max 945 ms,
  pass count 0/10. The strict threshold, HEAVY fixture, worker count, and
  assertion were unchanged. The preserved control fails under the same host
  conditions, so this does not support an Insights-caused regression. The
  strict contract remains unchanged and the campaign records the variance
  rather than weakening the assertion.
- 2026-08-12 — Ten sequential preserved-`aa63cb3` control J8 HEAVY
  repetitions on isolated port 8092 with a fresh control export and no
  emulator or competing listener — CONTROL COMPARISON / ENVIRONMENT; nine
  runs failed the first `overview→todos` measurement at 970, 922, 853, 808,
  1126, 883, 886, 811, and 825 ms, while one complete run passed with
  maxSwitch 797 ms. Across the observed first-switch/failing values: min
  797 ms, median 868 ms, nearest-rank P90 970 ms, max 1126 ms, pass count
  1/10. The control fails under the same host conditions, while the campaign
  tree's observed values are lower in median and maximum; this does not
  support an Insights-caused regression. The D14 contract remains strict and
  unresolved on this host, classified ENVIRONMENT/HOST-SENSITIVE rather than
  fixed by threshold or fixture changes.
- 2026-08-12 — `npm test -- --reporter=dot` — PASS; 740 tests across 70 test
  files (672 unit and 68 integration), including the new Insights and habit
  soft-delete coverage.
- 2026-08-12 — `npx playwright test --list` — PASS; 189 tests across 19
  configured project/spec groups, including 95 Chromium tests across 14
  feature specs. The current broad execution result remains separately
  recorded as partial because of the host-sensitive J8 threshold miss.
- 2026-08-12 — Active operational guidance refresh — PASS; current schema
  version 13 / next migration 14 and migration-13 notification-action state
  are now recorded in AGENTS, project maps, working rules, database skills,
  migration command guidance, and the unified knowledge base. Historical audit
  reports and dated ExecPlans were intentionally left unchanged.
- 2026-08-12 — Current dependency audit — CLASSIFIED; `npm audit --omit=dev`
  initially reported 19 runtime advisories and full `npm audit` reported 21.
  The non-force compatible repair updated Babel/brace-expansion/js-yaml and
  reduced runtime findings to 16; scoped overrides also aligned
  `patch-package -> tmp` to 0.2.7 and `minimatch@3.1.5 -> brace-expansion`
  to 1.1.18, reducing the full audit to 16 (6 moderate, 10 high). Expo 55
  (`~55.0.28`) and React Native 0.83.10 were preserved. Remaining image-size,
  Metro, Expo config, uuid, and CLI findings require a framework-breaking
  downgrade according to npm and are documented as deferred.
- 2026-08-12 — Dependency checkpoint validation — PASS; `npm ci` installed
  1138 packages and reapplied both repository patches; typecheck, lint (0
  errors/19 existing warnings), full Vitest (740/740), Expo Doctor (19/19),
  and `npm run build:web` all passed. Worktree hook setup still reports the
  known ENOTDIR warning because this is a linked worktree.
- 2026-08-12 — `E2E_PORT=8091 npm run qa:simulation -- --all --mode
deterministic` — PASS; the validator checked all 17 scenarios and the
  deterministic runner completed all 17/17, including J8, in 375.6 seconds.
  The previous historical >300-second observation is therefore classified as
  an insufficient command budget, not an infinite-loop or scenario-loss bug.
- 2026-08-12 — `npm run qa:timezones` — PASS; the 42-test date/reminder
  matrix passed in Asia/Manila, UTC, America/New_York, Pacific/Honolulu, and
  Pacific/Kiritimati. No timezone or local-date regression was observed.
- 2026-08-12 — `npm run qa:affected` after compaction recovery — PASS;
  clean-tree impact resolution selected the default `qa:fast → qa:full` path;
  no implementation changes were present to trigger a narrower rule.
- 2026-08-12 — `npm run build:sync` — PASS; rebuilt `dist-sync/` from a
  clean output directory and verified the non-routable dummy Supabase URL was
  baked into the export, with no real credentials used.
- 2026-08-12 — `npm run e2e:sync` — PASS; all 19/19 tagged journeys passed on
  one worker, covering malformed/503/timeout/partial sync failures, backoff,
  restore lifecycle and safety, offline outbox persistence/deduplication, and
  reconnect delivery.
- 2026-08-12 — `E2E_PORT=8091 npm run e2e:journeys:p0` — PASS; all 16/16
  prioritized journey steps passed, including focus continuity and both
  past-midnight freshness/write paths.
- 2026-08-12 — `E2E_PORT=8091 npm run e2e:journeys` — PARTIAL / KNOWN
  ENVIRONMENT PERFORMANCE; 57 steps passed, 10 expected continuity skips and
  4 later steps did not run after the canonical HEAVY D14 step measured the
  unchanged `overview→todos` switch at 833 ms (>800 ms). This reproduces the
  controlled host-sensitive D14 evidence; no functional assertion failed.
- 2026-08-12 — isolated temporary HEAVY CG-5 diagnostic on port 8091 — PASS;
  the unchanged diary search measured 273 ms and the saved-meal picker 106 ms,
  both below the unchanged 500 ms ceiling. The diagnostic was deleted after
  measurement and is not part of the committed suite.
- 2026-08-12 — serialized Android preflight — PASS/ENVIRONMENT READY; the
  preserved `Nitro_API_36` AVD booted as `emulator-5554` on API 36/x86_64 and
  the existing `com.dale16.superhabits` APK was installed. The first smoke
  lane failed at the existing return-swipe assertion (`Start focus` remained
  absent while Workout was selected). The installed APK reported an earlier
  update timestamp than the campaign tip, so current-tree build parity must be
  established before assigning PRODUCT_BUG or TEST_BUG.
- 2026-08-12 — `npx expo run:android --device Nitro_API_36 --no-bundler
--no-install` — ENVIRONMENT / NATIVE TOOLCHAIN BLOCKER; Expo prebuild
  generated only ignored native output, then Gradle/CMake failed before APK
  installation with unresolved C++ runtime symbols in
  `react-native-worklets` and `react-native-screens` under the local
  Expo-55/RN-0.83/NDK-27.1 setup. A narrow temporary CMake argument test and
  the available CMake 3.30.5 did not resolve the broader module-wide failure;
  no dependency or product patch was committed.
- 2026-08-12 — `npm run qa:native:targeted` — PASS on the installed
  integration APK; all 10/10 persistence flows passed, including habit,
  schedule, reminder persistence/disable/isolation/permission, settings,
  todo, calories, and workout coverage.
- 2026-08-13 — Focused Todo accessibility E2E — PRODUCT_BUG reproduced; the
  initial semantic `RectButton` controls exposed `role=checkbox` and
  `aria-checked` but a web click did not complete the Todo, so the test could
  not observe the resulting state. This failure was preserved as root-cause
  evidence rather than weakening the selector or assertion.
- 2026-08-13 — Todo accessibility checkpoint — PASS; replaced the three web
  completion controls with `Pressable`, retained the visual/icon behavior,
  added task-specific reorder labels and explicit state aliases for completion,
  Show completed, and Repeat daily, and replaced brittle E2E selectors. The
  focused Chromium Todos suite passed 8/8; typecheck, focused ESLint,
  Prettier, build:web, and diff-check passed.
- 2026-08-13 — `78ae6ea a11y: make todo completion controls actionable` —
  PASS; the accessibility source, focused regression, and durable checkpoint
  were committed together and the worktree is clean.
- 2026-08-13 — `npm run qa:fast` — PASS; typecheck, lint (0 errors/19
  warnings), and 672 unit tests across 59 files passed.
- 2026-08-13 — `npm run qa:integration` — PASS; 68 real-SQLite tests across
  11 integration files passed, including migrations, soft-delete guards,
  schedule history, Insights loading, restore safety, linked actions, and
  Reminder V2 actions.
- 2026-08-13 — strict OpenSpec, impact-map, and all-plan validation — PASS;
  21/21 OpenSpec items, 12/12 impact rules, and all versioned plans passed.
- 2026-08-13 — `npm test -- --reporter=dot` — PASS; 740 tests across 70 files
  passed, including 672 unit and 68 real-SQLite integration tests. The only
  stderr was the existing unsupported-legacy-linked-action diagnostic.
- 2026-08-13 — `npm run build:sync` and dummy-endpoint inspection — PASS;
  rebuilt `dist-sync` from the final source with the non-routable
  `https://dummy.supabase.co` and no real credentials.
- 2026-08-13 — `npm run e2e:sync` — PASS; all 19/19 sync/restore boundary
  journeys passed on one worker.
- 2026-08-13 — `E2E_PORT=8091 npm run e2e:journeys:p0` — PASS; all 16/16
  prioritized journeys passed, including focus continuity and midnight
  freshness/write coverage.
- 2026-08-13 — `E2E_PORT=8091 npx playwright test --project=chromium` —
  PASS; 88 tests passed and 7 contractually skipped internal-mode cases out
  of 95 collected, including the new Insights and semantic task-control
  coverage.
- 2026-08-13 — `E2E_PORT=8091 npm run e2e:journeys` — PARTIAL with two
  `TEST_BUG` selector failures and one known performance failure; before the
  helper fix, 52 steps passed, 10 expected skips, and 7 later steps did not
  run. The two linked-action failures clicked the Edit action because the
  semantic checkbox no longer occupied the old first-button position. The
  HEAVY D14 switch measured 990 ms against the unchanged 800 ms ceiling.
- 2026-08-13 — focused linked-action journey rerun after selector fix — PASS;
  7/7 steps passed across habit-increment and todo-chain scenarios, including
  exactly-once execution and deleted-target guards.

## Changed Files / Areas

- `.agent/execplans/post-integration-expansion.md` — durable campaign state,
  queue, evidence, and recovery instructions.
- `features/habits/habits.data.ts` — idempotent habit tombstone mutation,
  committed as `00c60cd`.
- `tests/integration/softDelete.test.ts` — real-SQLite repeat-delete
  regression coverage, committed as `00c60cd`.
- `openspec/changes/add-habit-progress-insights/` — validated product contract,
  design, and apply task list.
- `features/habits/habitInsights.domain.ts` — canonical metric/window/trend
  calculator.
- `tests/habitInsights.domain.test.ts` — deterministic domain matrix.
- `tests/integration/habitInsights.test.ts` — real-SQLite shared/history query
  and deleted-habit coverage.
- `features/habits/HabitProgressInsightsModal.tsx` — accessible local progress
  detail surface.
- `e2e/habits.spec.ts` — exact-habit progress accessibility-equivalent journey.
- `features/todos/TodoItem.tsx` — actionable semantic completion control in
  grid/list/content layouts.
- `features/todos/TodosScreen.tsx` — expanded/checked state for Todo toggles.
- `e2e/todos.spec.ts` and `e2e/journeys/a-tuesday.spec.ts` — semantic Todo
  completion coverage and selector documentation.
- `e2e/journeys/chain-reaction.spec.ts` and
  `e2e/journeys/chain-reaction-habit-increment.spec.ts` — linked-action
  journey helpers aligned with semantic checkbox controls.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `docs/PROJECT_STRUCTURE_MAP.md`,
   `docs/codex-workflow.md`, `.agent/PLANS.md`, and this plan completely.
2. Run `git status --short`, `git diff --stat`, `git diff --name-only`, recent
   log, and `npm run agent:resume -- --plan
.agent/execplans/post-integration-expansion.md`.
3. Reconcile Git with this checkpoint; Git is authoritative for files,
   OpenSpec for required behavior, and this plan for campaign state.
4. Run `npm run qa:affected` when implementation changes exist, then continue
   only from `Exact next action`.
5. Keep all changes on `campaign/post-integration-expansion` and serialize any
   Android/emulator work.

## Outcomes & Retrospective

- Status: Active.
- Summary: Campaign branch has completed the baseline, dependency
  classification, Insights implementation, deterministic simulation, timezone
  matrix, D14 control comparison, serialized native evidence, real Android
  notification-shade proof, and a focused Todo accessibility fix. The final
  static/web matrix and repository audit remain.
- Follow-up: Run the final matrix, preserve any classifications, validate the
  plan, and leave the branch clean without mutating main.
