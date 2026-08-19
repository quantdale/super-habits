# Fresh-session implementation prompt

Work on `quantdale/super-habits` from a freshly fetched/pruned `origin/main`.

Read `AGENTS.md`, `.agent/PLANS.md`, and every authoritative file in `openspec/changes/fix-account-recovery-dist-sync-closure-audit/`, especially `execplan.md`. Also read the prior dist-sync closure artifacts it references.

Execute this remediation autonomously end-to-end. Reproduce and fix the shared account Supabase mock defect where production-shape `HEAD ...?select=user_id&user_id=eq.<uid>` footprint probes ignore configured non-zero counts. Add owner-scoped count modeling and a real `journeys-sync` negative safety scenario proving temporary account T with remote `weekly_reviews` state blocks imported-owner recovery without touching local imported data.

Do not weaken production account fail-closed behavior. Do not solve with timeout/retry/skip/fixme/quarantine. Reconcile the prior closure checklist/ExecPlan and actually run the previously unchecked QA gates.

Finish only when all required QA passes, `e2e:sync` is fully green including the new negative scenario, all work is committed/pushed to `main`, local `main == origin/main`, the working tree is clean, only remote `main` remains, and GitHub Actions `quality` + `e2e` are green for the exact final pushed SHA. Do not create another bookkeeping commit after that green final run; report its SHA and run ID externally.
