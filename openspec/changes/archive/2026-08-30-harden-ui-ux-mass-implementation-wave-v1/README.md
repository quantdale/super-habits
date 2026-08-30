# Harden UI/UX Mass Implementation Wave V1

This OpenSpec change is the dedicated hardening campaign for the code-only UI/UX implementation wave ending at `6dd41bbd51f091aed44f4918ca8f336ec5c421c9`.

Read in this order:

1. `AGENTS.md`
2. `.agent/PLANS.md`
3. all `docs/ui-ux/**`
4. all `openspec/changes/harden-parallel-completion-wave-v2/**`
5. `proposal.md`
6. `design.md`
7. `specs/ui-ux-mass-wave-hardening/spec.md`
8. `tasks.md`
9. `execplan.md`

Key facts at authoring:

- remote main only;
- local source migration head = 21;
- live Supabase migration ledger still ends at `20260820010000`;
- repository migrations `20260821000000`, `20260821010000`, and `20260822000000` are pending live;
- the preceding implementation wave intentionally deferred broad tests;
- the older parallel-wave hardening plan remains ACTIVE and must be reconciled rather than ignored.

Do not add unrelated features. This campaign is complete only after root-cause fixes, full validation, live remote convergence when authorized, clean main-only Git, and exact-final-SHA GitHub `quality` + `e2e` PASS.
