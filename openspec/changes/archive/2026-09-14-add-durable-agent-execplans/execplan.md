# ExecPlan: Durable Agent Memory, ExecPlans, and Compaction Recovery

## Purpose / User Outcome

Create a repository-native continuity protocol so a zero-context Codex agent
can safely resume a substantial unfinished SuperHabits task from files, Git
state, OpenSpec, and QA evidence rather than conversation history. This task
must dogfood the protocol it introduces.

## Context

- Repository-wide stable instructions live in `AGENTS.md`; it already contains
  autonomous-QA guidance from pre-existing work and must not become a live task
  log.
- Codex-specific workflow guidance is in `docs/codex-workflow.md`; QA
  escalation is in `docs/testing/autonomous-qa.md`, with changed-file routing
  in `qa/impact-map.json` and `npm run qa:affected`.
- OpenSpec is repo-local and `openspec/config.yaml` uses the `spec-driven`
  schema. This change owns requirements/design/tasks plus this implementation
  state file.
- The worktree is intentionally dirty before this task. Existing `.mcp.json`,
  `.agents/`, native E2E/autonomous-QA files, and other user changes are
  preserved and are not evidence of this task's edits.

## Scope

- Define `.agent/PLANS.md` as the concise canonical ExecPlan/waypoint protocol.
- Integrate stable discovery and recovery rules into `AGENTS.md`.
- Create a task-specific OpenSpec change and this living ExecPlan.
- Optionally add one focused reusable `.agents/skills/` procedure or helper
  only if it fits existing conventions and materially improves reliability.
- Dogfood compaction recovery, fresh-session handoff, parallel safety, and
  completed-plan transition using repository artifacts.
- Run impact-aware validation and OpenSpec validation.

## Non-Goals

- Do not redesign SuperHabits product behavior or runtime data models.
- Do not replace or duplicate `docs/testing/autonomous-qa.md`.
- Do not create a global `CURRENT_TASK.md` or task-management application.
- Do not overwrite, normalize, delete, or reset unrelated `.agents/`, `.mcp.json`,
  or pre-existing working-tree changes.
- Do not claim that conversation or compaction memory is durable.

## Current Checkpoint

- Milestone: Complete — durable protocol integrated, dogfooded, validated, and
  reconciled against the working tree.
- Completed: Read `AGENTS.md`, inspected Git state, reviewed `.agents/`,
  `.codex/`, OpenSpec configuration and prior autonomous-QA/native-E2E changes,
  read Codex workflow and QA guidance, created the OpenSpec change scaffold,
  created `.agent/PLANS.md` plus this plan, and authored proposal, design,
  capability spec, and implementation tasks, then integrated concise stable
  ExecPlan discovery and recovery guidance into `AGENTS.md` without disturbing
  its existing QA additions.
- In progress: None. The task is complete; future agents should use this plan
  as the handoff example and `.agent/PLANS.md` as the reusable protocol.
- Important modified files: Existing user changes include `AGENTS.md`,
  `.mcp.json`, `.agents/`, `package.json`, QA/native E2E files, and related
  OpenSpec changes. Task-owned files currently are `.agent/PLANS.md`, this
  `execplan.md`, and the new OpenSpec change scaffold.
- Last successful validation: `git diff --check` passed; `openspec status` is
  4/4 complete; `qa:impact:validate` passed (11 rules), explicit
  `qa:affected` resolved conservative `qa:fast`/`qa:full` defaults for the
  unmapped documentation paths, `qa:fast` passed typecheck/lint/unit tests
  (589 unit tests, 18 existing lint warnings, 0 errors), all 14 OpenSpec items
  passed, task-owned Markdown passed Prettier, and the inserted AGENTS section
  matched Prettier output.
- Current failures: Whole-file `npx prettier --check AGENTS.md` still warns;
  committed `HEAD:AGENTS.md` passes and the task-owned inserted section passes
  a scoped comparison. The warning comes from pre-existing dirty AGENTS/QA
  content, which was intentionally not rewritten. `qa:full` was not run
  because this task changes documentation only and the impact map's broad
  default is conservative; this is recorded, not hidden.
- Relevant quarantines: Existing autonomous-QA known gaps remain owned by their
  existing documentation; none are introduced by this task.
- Blockers: None.
- Exact next action: None — task complete. For a future handoff, read this
  completed plan's Outcomes & Retrospective and start the next task from its
  own independent ExecPlan path.
- Remaining definition of done: None. Stable protocol, AGENTS integration,
  OpenSpec artifacts, dogfood evidence, and proportionate validation are all
  complete; known limitations are explicitly recorded below.

## Progress

- [x] 2026-08-09 — Read repository instructions and inspect pre-existing Git,
      agent, OpenSpec, and QA state.
- [x] 2026-08-09 — Scaffold `add-durable-agent-execplans` and create the first
      durable waypoint plus canonical protocol draft.
- [x] 2026-08-09 — Author proposal, design, capability spec, and implementation
      tasks and confirm the OpenSpec change is apply-ready.
- [x] 2026-08-09 — Integrate concise `AGENTS.md` discovery/recovery rules and
      decide that optional helper tooling/skill creation is not justified yet.
- [x] 2026-08-09 — Dogfood compaction recovery, fresh-session handoff,
      parallel plan isolation, and active-to-completed transition; fix only the
      temporary checker issues discovered during the simulations.
- [x] 2026-08-09 — Run impact-aware validation, formatting, and OpenSpec
      validation; record the conservative `qa:full` recommendation and the
      intentionally preserved AGENTS whole-file formatting warning.
- [x] 2026-08-09 — Reconcile final Git/OpenSpec state and complete this
      checkpoint and Outcomes & Retrospective.

## Surprises & Discoveries

- The worktree already contains an intentional autonomous-QA/native-E2E wave,
  including an `AGENTS.md` diff. Any integration must preserve those changes.
- There is no existing `.agent/` directory or global task-state convention, so
  `.agent/PLANS.md` and per-task `.agent/execplans/` are available without
  migrating an existing protocol.
- OpenSpec's repo-local `spec-driven` schema requires proposal, design, specs,
  and tasks before implementation is considered ready.
- `git diff --name-only` does not list untracked task files; the recovery
  sequence must retain `git status --short` as the source for discovering new
  plans before using diff output for tracked-file details.
- The first Windows fresh-session harness comparison failed on `\` versus `/`;
  repository examples remain portable Markdown paths, while verification code
  must normalize platform-specific command output before comparing paths.

## Decision Log

- 2026-08-09 — Use `openspec/changes/<slug>/execplan.md` for this task because
  it is OpenSpec-backed; reserve `.agent/execplans/<slug>.md` for substantial
  non-OpenSpec work. This supports parallel tasks without a global mutable
  state file.
- 2026-08-09 — Keep `.agent/PLANS.md` concise and protocol-focused; keep live
  state in task plans and stable QA escalation in existing docs.
- 2026-08-09 — No runtime dependency or task-management application unless
  inspection shows a tiny helper is clearly worth its maintenance cost.
- 2026-08-09 — Do not run the impact map's broad `qa:full` default for this
  documentation-only task; record it as not run because no runtime code or QA
  behavior changed, while still running `qa:fast`, OpenSpec, formatting, and
  impact-map validation.

## Validation Ledger

- 2026-08-09 — `git status --short` — PASS — confirmed pre-existing dirty work
  and no task-owned files before scaffold creation.
- 2026-08-09 — `openspec new change add-durable-agent-execplans` — PASS — local
  `spec-driven` change scaffold created.
- 2026-08-09 — Compaction-recovery dogfood using `AGENTS.md`,
  `.agent/PLANS.md`, this ExecPlan, Git status/diffs, and recorded evidence —
  PASS — recovered the goal, completed planning/integration work, task-owned
  files, last successful artifact status, and the exact next action without
  using conversation history.
- 2026-08-09 — Initial fresh-session discovery harness — FAIL — `TEST_BUG` in
  the ad hoc checker: Windows path separators were not normalized; no product
  or protocol content was changed because of this failure.
- 2026-08-09 — Normalized fresh-session discovery harness — PASS — discovered
  one task ExecPlan, verified all 12 required sections, and found all stable
  `AGENTS.md` recovery/location anchors.
- 2026-08-09 — Initial parallel-safety harness — FAIL — `TEST_BUG` in the ad
  hoc checker: a valid wrapped sentence was compared as one literal line; no
  protocol content was missing and no unrelated files changed.
- 2026-08-09 — Whitespace-tolerant parallel-safety harness — PASS — four
  distinct candidate task paths had zero collisions, no `CURRENT_TASK.md` was
  present, and all protocol location/ownership anchors were found.
- 2026-08-09 — Active-to-completed transition simulation — PASS — an in-memory
  completed snapshot retained a final-validation ledger slot, explicit
  complete status, and non-placeholder outcome summary without changing the
  active plan prematurely.
- 2026-08-09 — `npm run qa:impact:validate` — PASS — QA impact map valid with
  11 rules.
- 2026-08-09 — `npm run qa:affected -- --json --files ...` — PASS — task-owned
  documentation paths were unmapped, so the tool resolved conservative
  `qa:fast` and `qa:full` defaults with no focused tests or journeys.
- 2026-08-09 — `npm run qa:fast` — PASS — typecheck and lint completed with 0
  errors/18 existing warnings; 50 unit files and 589 tests passed.
- 2026-08-09 — `npm run openspec:validate` — PASS — all 14 repository OpenSpec
  items validated.
- 2026-08-09 — `npx prettier --check` on all task-owned Markdown — PASS — all
  task-owned files use Prettier style.
- 2026-08-09 — `npx prettier --check AGENTS.md` — KNOWN PRE-EXISTING WARNING —
  committed AGENTS passes; whole current file remains unformatted because
  unrelated user edits were preserved, while the inserted section matches
  Prettier exactly.
- 2026-08-09 — `git diff --check` — PASS — no whitespace errors in tracked
  changes; Git reported only existing LF/CRLF conversion notices.
- 2026-08-09 — `openspec status --change add-durable-agent-execplans` — PASS —
  proposal, design, specs, and tasks are all complete.
- 2026-08-09 — Final `npm run openspec:validate`, `git diff --check`, and
  status/diff reconciliation — PASS — all 14 OpenSpec items still pass, no
  tracked whitespace errors were found, and only the pre-existing dirty files
  plus this task's intended files are present.

## Changed Files / Areas

- `.agent/PLANS.md` — canonical reusable ExecPlan and waypoint protocol.
- `openspec/changes/add-durable-agent-execplans/` — requirements, design,
  tasks, and this living implementation plan.
- `AGENTS.md` — concise stable discovery and recovery integration; preserve
  existing autonomous-QA/native-E2E additions.
- `.agents/skills/` and `.mcp.json` — intentionally unchanged; existing
  user-owned content was inspected and preserved.

## Recovery / Resume Instructions

1. Read `AGENTS.md` and `.agent/PLANS.md` completely.
2. Read this `execplan.md` completely, then inspect `git status --short`,
   `git diff --stat`, and `git diff --name-only`.
3. Verify the checkpoint against the actual task-owned files and OpenSpec
   status; treat Git as authoritative for file state.
4. Read the new OpenSpec artifacts and continue from `Exact next action`.
5. Before each milestone, update this checkpoint; after meaningful decisions,
   failures, delegated work, and validation, update it again.

## Outcomes & Retrospective

- Status: Complete.
- Summary: Added a stable `.agent/PLANS.md` ExecPlan/waypoint protocol, a
  task-scoped OpenSpec change with a living `execplan.md`, and concise
  `AGENTS.md` discovery/recovery rules. No product runtime behavior changed.
- Proven: A zero-context agent can locate the plan, recover its checkpoint from
  repository files and Git, identify the exact next action, distinguish
  OpenSpec/Git/QA authority, and use independent plan paths for concurrent
  tasks. The protocol was dogfooded through compaction, fresh-session,
  parallel-safety, and completion-transition simulations.
- Validation: Impact map valid; `qa:fast` passed with 589 unit tests and 0
  errors; all 14 OpenSpec items passed; task-owned Markdown formatting passed;
  final Git/OpenSpec reconciliation passed.
- Remaining: No task-owned work remains. `qa:full` was intentionally not run
  for this documentation-only change. The whole dirty `AGENTS.md` still has a
  Prettier warning from unrelated pre-existing edits; the inserted section is
  individually formatted and unrelated content was not normalized.
- Follow-up: Future substantial tasks should create their own ExecPlan and
  update its checkpoint at the waypoint moments defined in `.agent/PLANS.md`.
