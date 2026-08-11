## Context

SuperHabits stores implementation state in task-scoped Markdown ExecPlans.
OpenSpec defines requirements, Git defines actual files, and the autonomous-QA
impact map defines test escalation. The first durable-memory change documented
these boundaries but intentionally did not add helper commands. This change
adds only deterministic, read-only repository tooling around that protocol.

## Design

### Versioned Markdown contract

New plans declare `Plan-Version: 2` and a top-level `Status: ACTIVE`,
`Status: BLOCKED`, or `Status: COMPLETED`. The canonical section names remain
those in `.agent/PLANS.md`. The validator recognizes small heading aliases and
Markdown-wrapped field values, but it does not attempt to understand arbitrary
prose semantically.

Plans without the version marker remain discoverable as legacy plans and are
not included in the CI validation set. This preserves historical plans while
making adoption and completion enforcement explicit for new work.

### One CLI, three read-only operations

`scripts/agent-execplan.mjs` has three subcommands:

- `validate --plan <path>` checks required sections, checkpoint fields,
  lifecycle-specific requirements, and unresolved placeholders.
- `list` discovers `openspec/changes/*/execplan.md` and
  `.agent/execplans/*.md`, then emits each independent plan's lifecycle,
  milestone, and next action.
- `resume --plan <path>` extracts orientation fields, reads Git status and
  changed paths, calls the shared QA impact planner, and prints discrepancy
  warnings. It never writes the plan or worktree.

An internal `--root` option makes deterministic fixture tests possible and
supports repository relocation. An `--all` validation mode checks only
versioned plans and is the CI integration point.

### Git reconciliation

The tool collects unstaged, staged, and untracked paths using the same Git
reality that recovery requires. It compares normalized repository-relative
paths against code-spanned paths in `Changed Files / Areas`. The report says
"working-tree change not represented in this ExecPlan" when ownership cannot be
proven, and separately reports plan-listed files with no current modification.
The plan itself is excluded from this comparison.

### QA impact reuse

`scripts/qa-impact.mjs` retains its command-line behavior and exports the map
validation, Git path collection, and impact-plan functions. Resume imports those
functions rather than implementing a second pattern matcher or gate map. The
report includes gates, focused tests, journeys, and broad-regression status.

### Completion and operational loop

ACTIVE plans require a resumable checkpoint and exact next action. BLOCKED plans
must preserve completed work, the external condition required to unblock, and
the exact post-unblock action. COMPLETED plans require final validation,
finished progress, a completed definition of done, a non-placeholder outcome,
and a no-op implementation next action.

The docs codify the loop as checkpoint → smallest coherent change → affected
QA → preserve/classify/fix/retest on failure → advance milestone → broader QA
when impact requires it. Failure labels remain the existing six-value QA
taxonomy.

## Alternatives Rejected

- A SQLite/JSON task store or daemon: duplicates Markdown authority and adds
  synchronization state.
- A global current-task file: breaks independent plans and parallel worktrees.
- A new QA dependency graph: duplicates `qa/impact-map.json` and can drift.
- Full Markdown semantic analysis: would be brittle and overstate what a
  structural validator can prove.

## Compatibility and CI

The existing `qa:impact` output and map schema stay compatible. Historical
plans remain outside CI until they opt into `Plan-Version: 2`; new versioned
plans are validated by a fast quality step before tests. The validator does not
claim that commands ran; the Validation Ledger remains agent-maintained
evidence.
