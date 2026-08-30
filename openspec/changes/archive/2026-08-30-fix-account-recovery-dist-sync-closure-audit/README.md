# Account Recovery Dist-Sync Closure Audit Remediation — Implementation Entry Point

This OpenSpec change is a focused post-closure remediation. It must be executed by a fresh autonomous implementation session before any new product feature begins.

Authoritative files:

1. `proposal.md` — verified audit findings, goals, scope, and definition of done.
2. `design.md` — required helper semantics, negative E2E proof, QA reconciliation, and exact-final-SHA completion protocol.
3. `specs/account-recovery-ci/spec.md` — normative requirements and acceptance scenarios.
4. `tasks.md` — ordered checklist; keep it synchronized with real evidence.
5. `execplan.md` — ACTIVE durable execution state and resume point.

Also read the historical closure being remediated:

- `openspec/changes/fix-account-recovery-dist-sync-determinism/`
- `.agent/execplans/account-recovery-dist-sync-determinism.md`

Implementation rules:

- Freshly fetch/prune `origin/main` and verify the actual SHA before editing.
- Read `AGENTS.md`, `.agent/PLANS.md`, and repository QA guidance first.
- Reproduce the missed configured-nonzero footprint contract before fixing it.
- Expected production account source change is NONE; fix the deterministic test boundary unless repository evidence proves a product bug.
- Add a real dist-sync negative safety scenario where temporary account T owns remote `weekly_reviews` state and imported-owner recovery is blocked.
- Preserve complete backup-scope drift protection, strict unknown endpoint behavior, matching-account recovery, wrong-account blocking, and fail-closed production semantics.
- Actually execute/reconcile the previously unchecked full-QA tasks.
- Update historical plan/tasks honestly; do not erase or rewrite valid prior evidence.
- No timeout/retry/skip/fixme/quarantine band-aid.
- English only.
- Completed validated work must land on `main`, no force push, no temporary remote branches.
- Do not report READY until the exact final pushed SHA has GitHub Actions `quality` and `e2e` green, including dist-sync.
- Do not create a post-green bookkeeping commit merely to record the run ID; put the exact final SHA/run evidence in the final report.
