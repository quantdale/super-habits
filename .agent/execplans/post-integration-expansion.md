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

- Current milestone: Fresh baseline is green for static, unit, integration,
  OpenSpec, impact, plan, and Expo diagnostics; source-driven audit/ranking is
  now complete and the first integrity fix is checkpointed.
- Completed: Recovered branches/worktrees/logs/remotes; verified integrated
  tip `aa63cb3`; confirmed `main` is unchanged and recovery worktrees remain;
  read repository startup, architecture, QA, feature, RN, database/sync,
  OpenSpec, and ExecPlan instructions; created this campaign branch.
- Completed: Inspected the major product/data/sync/accessibility/tooling areas,
  classified inherited gaps, and ranked the queue below. Fixed and committed
  the habit repeat-soft-delete defect in `00c60cd` with a real-SQLite
  regression assertion.
- In progress: Propose the focused Insights OpenSpec, then implement it against
  the existing Habit Engine V2 domain semantics.
- Important modified files: `features/habits/habits.data.ts` and
  `tests/integration/softDelete.test.ts` were changed and committed in
  `00c60cd`; the campaign plan remains the only uncommitted area between
  checkpoints.
- Last successful validation: `npm ci` installed 1137 packages; typecheck,
  `qa:fast`, `npm test` (727 tests/68 files), `qa:integration` (67 tests/10
  files), OpenSpec (20/20), impact validation (12/12), all versioned plan
  validation, and Expo Doctor (19/19) pass. Lint has 0 errors/19 warnings.
- Current failures: `npm audit` reports 21 advisories (1 low, 7 moderate,
  13 high), mainly transitive build/tooling packages; safe fixes and the
  framework-breaking Expo 53 path still need classification. Inherited D14 is
  not conclusively closed; native direct OS notification selection is partial.
- Relevant quarantines: iOS native execution is unavailable on Windows;
  Android is one-emulator/one-Maestro-lane and must remain serialized;
  remote Supabase mutation is out of scope.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: Audit the current source and tests across Habits,
  Overview, Todos, Calories, Workout, Pomodoro, Settings, command/linked
  actions, sync/restore, navigation/lifecycle, accessibility, simulation,
  scripts, and migration documentation; record a ranked queue with concrete
  evidence before creating the Insights OpenSpec.
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
- [ ] Propose and validate `add-habit-progress-insights` OpenSpec.
- [ ] Implement Insights domain/data/UI with historical semantics and bounded
      loading.
- [ ] Add unit, real-SQLite, focused web, and accessibility-equivalent tests.
- [ ] Complete additional evidence-backed correctness/sync/restore/accessibility
      or UX work from the ranked queue.
- [ ] Reassess D14/CG-4, CG-5, J8, and any Insights performance impact.
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

## Changed Files / Areas

- `.agent/execplans/post-integration-expansion.md` — durable campaign state,
  queue, evidence, and recovery instructions.
- `features/habits/habits.data.ts` — idempotent habit tombstone mutation,
  committed as `00c60cd`.
- `tests/integration/softDelete.test.ts` — real-SQLite repeat-delete
  regression coverage, committed as `00c60cd`.

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
- Summary: Campaign branch and durable state created; baseline is green, the
  audit is ranked, and the first correctness defect is fixed. Insights is the
  next implementation milestone.
- Follow-up: Create/validate the Insights OpenSpec, implement it with focused
  domain/data/UI tests, then continue through the remaining ranked queue.
