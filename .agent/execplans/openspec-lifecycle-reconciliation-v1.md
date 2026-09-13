# ExecPlan: OpenSpec Lifecycle Reconciliation V1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

The repository's OpenSpec lifecycle has drifted: 34 changes whose ExecPlans are
COMPLETED (or whose work is delivered) were never archived, so their delta
specs were never synced into `openspec/specs/`. The authoritative spec set is
therefore missing the behavior the app actually ships — e.g.
`weekly-review-cadence`, `backup-completeness-v2`, the Pop `ui-ux-*`
capabilities, and the local reward layer — and `openspec/config.yaml` still
describes schema version 24 while the runtime is at 25.

Observable success: every completed change is archived with its deliverable
specs present under `openspec/specs/`; `openspec validate --all` passes;
`openspec/config.yaml` matches the runtime schema; the three living docs that
reference moved change paths point at their archive locations; the archive
operations are committed and pushed.

## Context

- Baseline: `main == 2c1594b` (post UI-type, native-flow, and journey-repair
  campaigns). `openspec validate --all` currently reports 52/52 passed — the
  artifacts are valid, they just have not been applied/archived.
- 18 capabilities exist under `openspec/specs/`; ~30 capability names exist
  only as change deltas.
- `openspec list` (2026-09-13) shows 34 unarchived changes; all but three are
  `✓ Complete`; `complete-repository-depth-v1` (27/28, CI blocked),
  `harden-production-persistence-recovery-v1` (24/25),
  `add-user-simulation-platform` (57/59, 2 externally blocked), and
  `polish-warm-momentum-2-2-interaction-density-a11y-v1` (0/30 checkboxes with
  a COMPLETED ExecPlan and independent-verification PASS).
- 2-2 artifacts verified 2026-09-13: `core/ui/SegmentedControl.tsx`,
  `tests/segmented-control.model.test.ts`, six adopters
  (`features/calories/CaloriesScreen.tsx`, `MacroTrendChart.tsx`,
  `features/habits/HabitsScreen.tsx`, `features/planning-hub/PlanningHubScreen.tsx`,
  `features/pomodoro/PomodoroScreen.tsx`, `features/todos/TodosScreen.tsx`),
  `docs/ui-ux/09-warm-momentum-2-2.md`, and 19 files under
  `docs/ui-ux/warm-momentum-2-2-screenshots/`.
- `openspec archive <change> -y` updates the main specs from the deltas and
  moves the change to `openspec/changes/archive/<date>-<name>/`.
- Dependency: `add-backup-completeness-v2` (creates `backup-completeness-v2`)
  must be archived before `fix-backup-v2-closure-defects` (modifies it).
  Three changes modify the existing `user-simulation-testing` capability
  (`add-native-real-user-e2e`, `close-cg4-cg5-performance-gaps`,
  `secure-supabase-backup-row-ownership`).
- Living docs referencing change paths: `docs/development/parallel-agent-commit-protocol.md`
  (complete-product-roadmap-parallel-wave-v2),
  `docs/ui-ux/10-warm-momentum-2-3.md`,
  `docs/ui-ux/11-warm-momentum-2-4.md`.

## Scope

1. Fix the stale OpenSpec project context (`config.yaml`) to the runtime schema
   (25 stored, next block 26) and confirm the other stated invariants.
2. Reconcile the 2-2 task checkboxes against the verified artifacts, with an
   explicit reconciliation note (the campaign's work shipped; the boxes were
   never ticked).
3. Archive the 34 changes in dependency order with `openspec archive -y`,
   running `openspec validate --all` after each and inspecting `git status` so
   every spec sync is visible and attributable.
4. Update the three living docs to the archive paths.
5. Final gates: `openspec:validate`, `agent:plan:validate:all`,
   `format:check` on changed files; commit and push.

## Non-Goals

- No rewriting of archived change content beyond the 2-2 checkbox
  reconciliation.
- No edits to historical ExecPlans or evidence records that reference
  pre-archive paths (they are point-in-time records).
- No change to application code, tests, or specs' normative content: the
  archive operation applies the deltas exactly as authored and validated.
- No deletion of changes whose tasks remain genuinely blocked externally; they
  are archived with their blocked tasks intact and documented.

## Current Checkpoint

- Current milestone: COMPLETE — all 34 completed changes archived; both
  repair deltas refreshed; specs synced; docs updated; closure commit pending.
- Completed: config.yaml corrected; 2-2 tasks reconciled (30 boxes + note);
  32 archives on the first pass; `fix-backup-v2-closure-defects` delta
  refreshed (preserved the "Corrupted backup is blocked" and "Cross-user
  isolation holds" scenarios and the full normative text) then archived;
  `add-recoverable-account-v1`'s stray MODIFIED section moved under ADDED and
  archived; `openspec validate --all` 57/57; no unarchived changes remain.
- In progress: closure commit/push.
- Important modified files: `openspec/config.yaml`,
  `openspec/specs/**` (57 capabilities), `openspec/changes/archive/**`,
  `openspec/changes/polish-warm-momentum-2-2-.../tasks.md`, the three living
  docs, this plan.
- Last successful validation: `openspec validate --all` → 57 passed / 0
  failed; `agent:plan:validate:all` → all PASS.
- Current failures: none.
- Relevant quarantines: known-gap 15; CI billing blocker (external).
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: none for this plan.
- Remaining definition of done: none for this plan.

## Progress

- [x] WS1 — config.yaml corrected; 2-2 tasks reconciled
- [x] WS2 — all 34 completed changes archived with synced specs (57 specs)
- [x] WS3 — living docs updated to archive paths
- [x] WS4 — final validations green (`openspec validate --all` 57/57;
      `agent:plan:validate:all` all PASS); closure commit/push next

## Surprises & Discoveries

- 2026-09-13 — `openspec validate --all` passes at baseline, so lifecycle
  drift is purely unapplied deltas, not invalid artifacts.
- 2026-09-13 — the 2-2 change's work is verifiably delivered (primitive,
  unit test, six adopters, docs, 19 screenshots) while all 30 boxes are
  unticked: a closure-bookkeeping defect, not missing work.

## Decision Log

- 2026-09-13 — archive the externally-blocked changes too: their ExecPlans are
  COMPLETED and the blocked tasks are annotations about CI/live infrastructure,
  which the archive records faithfully.
- 2026-09-13 — validate after every archive so a bad delta application is
  caught at the change that caused it rather than at the end.
- 2026-09-13 — update only living docs, never historical plans/evidence.

## Validation Ledger

- 2026-09-13 — `openspec validate --all` → 52 passed, 0 failed (baseline).
- 2026-09-13 — 2-2 artifact scan: primitive, test, six adopters, doc, 19
  screenshot files present.
- 2026-09-14 — `openspec validate --all` → 57 passed, 0 failed after all
  archives; `openspec list` shows no unarchived changes; `openspec/specs` has
  57 capabilities and `openspec/changes/archive` has 54 entries.
- 2026-09-14 — `npm run agent:plan:validate:all` → all plans PASS.

## Changed Files / Areas

- `openspec/config.yaml` — schema context.
- `openspec/changes/*` → `openspec/changes/archive/*` — 34 archives.
- `openspec/specs/**` — synced capabilities.
- `openspec/changes/polish-warm-momentum-2-2-.../tasks.md` — reconciliation.
- `docs/development/parallel-agent-commit-protocol.md`,
  `docs/ui-ux/10-warm-momentum-2-3.md`, `docs/ui-ux/11-warm-momentum-2-4.md`.
- `.agent/execplans/openspec-lifecycle-reconciliation-v1.md` — this plan.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan.
2. `git status --short`; `openspec list`; reconcile which changes remain.
3. Continue the ordered archive list from the first entry still under
   `openspec/changes/`.
4. Re-run `openspec validate --all` before any commit.

## Outcomes & Retrospective

- Status: Completed (2026-09-14).
- Summary: the OpenSpec lifecycle is reconciled — 34 changes moved to the
  archive with their delta specs applied, growing `openspec/specs` from 18 to
  57 capabilities while validation stays green (57/57), the project context
  matches the runtime schema, and the living docs point at archive paths. Two
  deltas needed genuine repair to apply: `fix-backup-v2-closure-defects` had
  dropped two existing scenarios (and described the change instead of stating
  the final requirement) and `add-recoverable-account-v1` used a MODIFIED
  section inside a brand-new capability.
- Proof: 34/34 archived (`openspec list` empty of active changes);
  `openspec validate --all` 57/57; `agent:plan:validate:all` PASS; archive
  directory 54 entries; specs directory 57 entries; the three living docs
  updated.
- Follow-up: none required. Historical ExecPlans/evidence that reference
  pre-archive paths remain point-in-time records by design.
