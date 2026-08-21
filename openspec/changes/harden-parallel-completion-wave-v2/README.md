# Parallel Completion Wave V2 Hardening

This change is the authoritative hardening campaign for the massive parallel implementation wave completed at `4b9b8ccf0dee7ce9ed9b1c6b8b6a10e3c7732051`.

Read in order:

1. `AGENTS.md`
2. `.agent/PLANS.md`
3. `openspec/changes/complete-product-roadmap-parallel-wave-v2/HARDENING_HANDOFF.md`
4. this change's `proposal.md`
5. `design.md`
6. `specs/parallel-wave-v2-hardening/spec.md`
7. `tasks.md`
8. `execplan.md`

The implementation wave intentionally used minimal validation. This campaign owns correctness, durability, recovery, remote-boundary integration, browser/native behavior, performance sanity, and exact-head CI closure.

Important correction from the prior handoff: the authoritative SQLite migration chain is already through migration 19. The old handoff's statements that schema was frozen at v15 and that the next block would be v16 are stale. Any new local migration must use the next free version after the actual current head (expected v20 if main has not advanced).

This is hardening, not another feature-expansion wave. Do not add unrelated product capabilities.

The primary agent owns shared schema/backup/sync integration and the ExecPlan. Sub-agents may be used for parallel audits/tests or non-overlapping feature repairs, but they must not concurrently mutate shared migration/backup/sync hotspots.
