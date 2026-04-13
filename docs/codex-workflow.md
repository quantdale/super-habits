# Codex Workflow for SuperHabits

## Purpose
This is a lightweight Codex runbook for day-to-day execution. It does not replace the canonical repo docs; it points to them.

## Canonical Read Order
Read these first, in order:
1. `AGENTS.md`
2. `docs/PROJECT_STRUCTURE_MAP.md`
3. `docs/working-rules.md`
4. `docs/master-context.md`

Cursor rule files (for example `.cursorrules` and `.cursor/rules/superhabits-rules.mdc`) are secondary references only, not Codex first-read documents.

## Repo State
- Treat the repository as recovered and clean unless the current task shows otherwise.
- Start each task from updated `main`.
- Create a dedicated branch for the task.
- Use a dedicated worktree for that branch when the task may run in parallel with other active work.

## Branch and Worktree Workflow
- Use branch-per-task. Do not stack unrelated work on the same branch.
- Use worktree-per-task when multiple tasks are active at the same time.
- Keep each worktree scoped to its assigned task so diffs stay reviewable and merge conflicts stay local.
- If a task needs changes already in progress elsewhere, finish or merge that earlier task before starting the dependent task's wave.

## Wave-Based Execution
- Organize concurrent work into waves.
- A wave may contain multiple tasks only when they are parallel-safe.
- Start the next wave only after the current wave is complete and its results are understood.
- If any task in a wave changes shared assumptions, re-evaluate the remaining queued work before starting the next wave.

## Parallel-Safe vs Overlapping
- Parallel-safe tasks touch different files or clearly isolated docs/modules and do not depend on each other's output.
- Overlapping tasks touch the same files, the same logical contract, or any shared context where one task can invalidate the other's assumptions.
- Shared file ownership is enough to treat tasks as overlapping, even when the intended edits look small.
- When unsure, serialize the tasks into separate waves.

## Task Routing
- UI / feature tasks: read target `*Screen.tsx`, then matching `*.domain.ts`, then matching `*.data.ts`.
- Data / DB / sync tasks: read target `*.data.ts`, then `core/db/client.ts`, `core/db/types.ts`, relevant sync engine files if affected (for example `core/sync/sync.engine.ts`, `core/sync/supabase.adapter.ts`), then `lib/id.ts` and `lib/time.ts`.

## Working Rules
- Read full touched files before editing.
- Prefer the smallest correct change.
- Preserve layer boundaries.
- Preserve sync, soft-delete, ID, date, and migration invariants.
- If docs conflict with current code, trust code and call out the conflict.

## Validation Policy
- Always: `npm test`.
- For business logic changes: `npm test`; run targeted tests if relevant.
- For web/UI changes: `npm run build:web`; run impacted Playwright specs; run full `npm run e2e` when web infra or cross-cutting UI behavior changed.
- For pre-PR validation: `npm test`, `npm run build:web`, `npm run e2e`, `npm run typecheck`.
- Temporary note: until the repo-level typecheck config issue is fixed, `npm run typecheck` is informational if it fails only with the known config issue. Any new or different type errors are blockers.

## Reporting Expectations
For each task, report:
- root cause
- touched files
- commands run
- pass/fail results
- skipped checks and why
- remaining risks or assumptions

## Scope Notes
This file is Codex-facing only. It does not replace or modify Cursor workflows. Keep it short and link to canonical docs instead of copying large rule blocks.
