Fresh session, zero chat memory. Work on https://github.com/quantdale/super-habits.

Fetch/prune and reconcile to latest origin/main without discarding legitimate work.

Read AGENTS.md, .agent/PLANS.md, all docs/ui-ux/**, all openspec/changes/harden-parallel-completion-wave-v2/**, and every authoritative file in openspec/changes/harden-ui-ux-mass-implementation-wave-v1/.

Execute harden-ui-ux-mass-implementation-wave-v1 autonomously end-to-end. This is the dedicated hardening/testing campaign for the code-only Warm Momentum/UI-UX implementation wave. Reconcile and honestly close or carry forward the older still-ACTIVE harden-parallel-completion-wave-v2 plan as part of this work.

Important authoring facts: current source migration head is 21; do not reuse migrations 20/21. Live Supabase was independently observed still at migration 20260820010000, with repository migrations 20260821000000, 20260821010000, and 20260822000000 pending live. Treat live remote convergence as blocking if the current client contract requires those migrations.

Use sub-agents for disjoint audits/fixes if useful, but the orchestrator owns DB migration numbering, Backup/Restore/Portable, account/sync safety, live Supabase migration application, campaign plans, integration, and final CI closure.

Fix product bugs before changing tests. Update E2E selectors only for intentional UI contract drift; never skip, weaken, quarantine, or inflate timeouts instead of fixing root causes. No unrelated feature expansion. Preserve owner/RLS/fail-closed recovery, Backup Scope/Portable compatibility, Linked Action exactly-once semantics, canonical mutations, and Warm Momentum accessibility/healthy-engagement rules.

English only.

Finish only when all non-environment tasks are reconciled to evidence, full unit/integration/web/E2E/dist-sync/simulation/timezone QA passes, required live Supabase changes are applied and verified when authorized access exists, completed work is pushed to main, working tree is clean, local main == origin/main, remote main-only, and GitHub Actions quality + e2e are green for the exact final pushed SHA. Do not stop with CI pending or red.