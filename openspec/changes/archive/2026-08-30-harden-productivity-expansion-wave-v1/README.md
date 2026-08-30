# Productivity Expansion Wave V1 Hardening — Implementation Entry Point

This is the dedicated hardening campaign for the completed implementation-only Productivity Expansion Wave V1.

The previous wave intentionally maximized feature throughput and explicitly deferred broad correctness, migration, backup/portable, Supabase, E2E, simulation, and native validation. Do not start another feature wave until this hardening change is complete.

## Authoritative files

Read all of these before editing:

1. `proposal.md` — independently audited defects, goals, scope, and definition of done.
2. `design.md` — required local semantics, migration model, association rules, backup/portable versioning, Supabase/RLS design, and validation strategy.
3. `specs/productivity-expansion-hardening/spec.md` — normative requirements and acceptance scenarios.
4. `tasks.md` — ordered evidence checklist.
5. `execplan.md` — ACTIVE durable execution state and exact resume point.
6. `IMPLEMENTATION_PROMPT.md` — compact fresh-session handoff.

Also read:

- `AGENTS.md`
- `.agent/PLANS.md`
- `openspec/changes/add-productivity-expansion-wave-v1/`
- durable Backup Completeness V2, Portable Backup V1, Recoverable Account V1, Weekly Review, and account-recovery closure artifacts referenced from the design/ExecPlan.

## Core rules

- English only.
- Freshly fetch/prune `origin/main` and inspect legitimate concurrent changes before editing.
- Run full baseline QA first; this is NOT another implementation-only wave.
- Reproduce audited defects before fixing them where practical.
- Fix product semantics, not just tests.
- No timeout inflation, retries, skips, quarantine, or weakened assertions as substitutes for fixes.
- Do not weaken Recoverable Account, owner binding, RLS, Backup manifest integrity, Restore validation, Portable integrity, or empty-device import guards.
- Projects, Goals, and Daily Plans must become complete recoverable owner-scoped state by the end of this campaign.
- Preserve known historical backup/portable contracts explicitly; do not accept arbitrary missing entity groups as empty.
- Use additive local/Supabase migrations only; do not rewrite applied production migration history.
- Do not add unrelated new product features.
- Commit/push completed work to `main`, no force push, no temporary remote branches.
- Final working tree must be clean, local `main == origin/main`, remote main-only.
- Do not report READY until the exact final pushed SHA has GitHub Actions `quality` PASS and `e2e` PASS including dist-sync.
- Do not create a post-green bookkeeping commit just to store the workflow run ID; report it externally.

## Final outcome

The only acceptable repository-level success state is:

**PRODUCTIVITY EXPANSION WAVE V1: HARDENED — READY**

If a genuine external environment limitation remains after all repository work is complete, report that specific gate separately rather than masking repository defects.
