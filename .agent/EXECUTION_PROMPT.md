# SuperHabits — Canonical Next-Campaign Execution Prompt

**Authoritative change:** `harden-async-orchestration-lifecycle-v1`  
**Mode:** closure-first hardening, not a new feature campaign  
**Planner re-audit date:** 2026-08-27

Pull the latest `main`, then execute:

`openspec/changes/harden-async-orchestration-lifecycle-v1/IMPLEMENTATION_PROMPT.md`

Also read:

- `openspec/changes/harden-async-orchestration-lifecycle-v1/planner-reaudit-2026-08-27.md`
- `openspec/changes/harden-async-orchestration-lifecycle-v1/proposal.md`
- `openspec/changes/harden-async-orchestration-lifecycle-v1/design.md`
- `openspec/changes/harden-async-orchestration-lifecycle-v1/tasks.md`
- `openspec/changes/harden-async-orchestration-lifecycle-v1/execplan.md`

## Why this is the next campaign

Exact-HEAD GitHub Actions is red. Run #495 on `79bf468` passes quality,
ordinary full browser E2E, and full deterministic simulation but fails the
`journeys-sync` remote-boundary lane on two repeatable correctness contracts:

1. P5 partial success leaves both `habits` and `todos` in the durable outbox
   instead of retaining only the failed `habits` record.
2. Recoverable Account V1 never reaches visible restore eligibility `Allowed`
   after recovering the existing owner on an empty device.

Run #491 on `7a49647` passed this same remote-boundary lane, so there is a
real green-to-red regression window. Do not classify the current failures as
environment-only without new independent proof.

The current OpenSpec also remains ACTIVE with partial M7/M8/M10 and incomplete
M11, per-surface AsyncStorage precedence still explicitly listed as follow-up,
and a stale audit ledger/task-state mismatch.

## Short executor instruction

> Read repository instructions and the complete active OpenSpec. Reproduce and
> bisect CI #495 from green baseline #491, fix the two remote-boundary
> correctness regressions without weakening tests, finish the outstanding
> hydration/lifecycle/race proof, enforce lint zero durably, reconcile every
> tracked file/skip/task, run full exact-tree browser/sync/simulation/native
> qualification where available, push, and do not mark the change COMPLETED
> until the exact pushed SHA has green authoritative CI. Then and only then
> decide whether a successor OpenSpec campaign is justified.

Target a long autonomous execution window (about 12 hours if the work actually
requires it), but stop when the evidence-based definition of done is fully met;
do not manufacture work to consume time.
