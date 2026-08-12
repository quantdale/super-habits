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
  next.
- Completed: Recovered branches/worktrees/logs/remotes; verified integrated
  tip `aa63cb3`; confirmed `main` is unchanged and recovery worktrees remain;
  read repository startup, architecture, QA, feature, RN, database/sync,
  OpenSpec, and ExecPlan instructions; created this campaign branch.
- In progress: Inspect the major product/data/sync/accessibility/tooling areas,
  classify inherited gaps, and build the ranked audit queue before product
  implementation.
- Important modified files: none yet on this branch beyond this ExecPlan.
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
- [ ] Perform source-driven whole-repository audit and rank actionable queue.
- [ ] Resolve any higher-severity correctness/security blocker found by audit.
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

Populate after the baseline and source inspection. Rank findings with:

`Severity × user impact × likelihood × fix confidence × regression-testability ÷ implementation risk`.

Initial hypotheses to verify, not assume:

1. D14/CG-4 host-sensitive performance state and missing quiet-host repeat.
2. Habit Progress Insights V1 as the highest-value user capability if no P0/P1
   correctness/security issue appears.
3. Restore/sync fail-closed behavior for malformed or partial remote payloads.
4. Habit schedule/target-history edge cases not covered by current tests.
5. Core workflow accessibility semantics and icon-only controls.
6. Safe lint/type/JSON-validation issues with concrete defect potential.
7. Simulation/test-runtime or cross-platform script reliability gaps.
8. Documentation drift about current schema, test inventory, and native status.

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
- 2026-08-12 — Fresh campaign baseline — NOT RUN; exact next action.
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

## Changed Files / Areas

- `.agent/execplans/post-integration-expansion.md` — durable campaign state,
  queue, evidence, and recovery instructions.

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
- Summary: Campaign branch and durable state created; baseline, audit,
  implementation, and final validation remain.
- Follow-up: Complete the ranked queue and update this section before any
  final merge recommendation.
