# Short Implementation Prompt

Fresh session, zero chat memory. Work on https://github.com/quantdale/super-habits.

Fetch/prune and reconcile to latest origin/main without discarding legitimate work.

Read `AGENTS.md`, `.agent/PLANS.md`, `openspec/changes/complete-product-roadmap-parallel-wave-v2/HARDENING_HANDOFF.md`, and every authoritative file in `openspec/changes/harden-parallel-completion-wave-v2/`.

Execute `harden-parallel-completion-wave-v2` autonomously end-to-end. This is the dedicated production hardening campaign for the massive swarm implementation wave. The persisted proposal/design/spec/tasks/ExecPlan are the source of truth.

Important: the prior wave's schema-v15/v16 narrative is stale. Reconcile the actual migration head first; current source already contains migrations through 19, so new local migration numbering must use the actual next free version.

You may use sub-agents for parallel audits/focused feature repairs, but the primary agent owns shared DB/backup/portable/sync/Supabase migration integration and reviews every delegated result. Do not let sub-agents race on shared persistence hotspots.

Fix root causes; do not weaken ownership/RLS/Backup/Portable/restore/Linked-Action safety or meaningful tests. Promote user-domain state that should survive restore, close remote Command and notification integrations, harden batch/idempotency semantics, then run the full required QA/live verification from the spec.

English only.

Finish only when the ExecPlan/tasks honestly match evidence, all non-environment gates pass, completed work is committed/pushed to main, working tree is clean, local main == origin/main, remote main-only, required live Supabase/Edge Function changes are verified when accessible, and the exact final SHA has GitHub Actions quality PASS and e2e PASS. Do not stop with CI pending/red.
