# Productivity Expansion Implementation Wave V1 — Entry Point

This is an **implementation-only overnight wave**. It deliberately maximizes shipped product surface now and defers exhaustive hardening to the immediately following campaign.

Authoritative files:

1. `proposal.md` — scope, implementation-mode policy, and intentional hardening debt.
2. `design.md` — local architecture and feature behavior.
3. `specs/productivity-expansion/spec.md` — normative requirements.
4. `tasks.md` — implementation checklist.
5. `execplan.md` — ACTIVE durable task state and resume point.
6. `IMPLEMENTATION_PROMPT.md` — short fresh-session handoff.

Fresh-session rules:

- Fetch/prune latest `origin/main` first.
- Read `AGENTS.md`, `.agent/PLANS.md`, and every file in this change.
- The independently verified green implementation baseline before this spec is `6f18cce75459e21d11c29a2b82330a402336d9f4` with Actions run `32269563521` (`quality` + `e2e` PASS), but actual current `origin/main` wins.
- First reconcile the completed account-recovery closure plan using that already-verified evidence; do **not** rerun its exhaustive QA.
- Do **not** run baseline tests before implementation.
- Implement as many independent slices as possible. If one slice is blocked, record it and continue with the next slice.
- Projects/Goals/Daily Plans are local-only in this wave. Do not add/deploy Supabase tables or remote Backup/Portable support yet.
- Preserve account local-data ownership safety by adding new authoritative tables to the local user-data inventory.
- Minimal end gate only: typecheck, lint, OpenSpec validator, ExecPlan validator, `git diff --check`.
- Do not run full Vitest/E2E/simulation/native/live-Supabase validation unless needed to resolve an immediate compilation blocker.
- Commit coherently and push once near the end.
- Do not wait for or chase GitHub Actions. The next hardening campaign owns broad CI/regression repair.
- English only.
- Final status must distinguish implementation completion from production readiness.
