# Account Recovery Dist-Sync Determinism Closure — Implementation Entry Point

This is the authoritative repository handoff for the next fresh autonomous implementation session.

## Why this change exists

Weekly Review & Planning V1 is substantively implemented, but the exact final `main` SHA is not fully green. GitHub Actions run `32024054019` passes quality, full main E2E, and deterministic scenarios, then fails the `journeys-sync` remote-boundary lane.

Independent review traced the failure to stale deterministic Supabase mocks in the account/recovery journeys. They recognize only four historical V1 backup tables while production account safety now probes the complete `BACKUP_ENTITIES + BACKUP_SYNTHETIC_ENTITIES` surface. Known production backup probes therefore receive test-generated 404s and production correctly fails closed.

This is not accepted as a flake.

## Authoritative files

Read all of these before source edits:

1. `proposal.md` — root cause, goals, safety boundaries, and definition of done.
2. `design.md` — shared backup-aware E2E boundary architecture and validation strategy.
3. `specs/account-recovery-ci/spec.md` — normative requirements and acceptance scenarios.
4. `tasks.md` — ordered closure checklist.
5. `.agent/execplans/account-recovery-dist-sync-determinism.md` — durable implementation state and final exact-SHA completion gate.

Also read:

- `AGENTS.md`
- `.agent/PLANS.md`
- `.agent/execplans/weekly-review-planning-v1.md`
- the completed Recoverable Account / Portable V1 closure specs and plans referenced by the source/tests.

## Execution rules

- Start from freshly fetched `origin/main`; never assume the SHA in these docs is still current.
- Reproduce the current dist-sync failure before changing the harness.
- Fix the stale test boundary, not production fail-closed ownership semantics.
- Do not solve this with longer timeouts, retries, skips, fixmes, quarantine, or weaker assertions.
- Keep unknown Supabase endpoints strict.
- Derive the test backup scope from production constants or enforce exact drift detection.
- Reconcile the Weekly Review ExecPlan's inaccurate exact-SHA-green statement.
- Keep this change's tasks and ExecPlan current throughout the session.
- All user-facing text, documentation, progress reports, commit messages, and final reports must be English only.
- Final work must be committed and pushed to `main`; working tree clean; local `main == origin/main`; remote main only.
- Do not declare completion while the exact final SHA's GitHub Actions are pending or red.
- Completion requires `quality = PASS` and `e2e = PASS`, including the dist-sync remote-boundary step.
