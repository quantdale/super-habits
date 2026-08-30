# Short CLI Implementation Prompt

Use the following prompt in a brand-new autonomous coding session after this spec package has landed on `origin/main`:

```text
You are in a brand-new session with zero conversational memory. Work on https://github.com/quantdale/super-habits.

First fetch/prune and reconcile to the latest origin/main without discarding legitimate work. Then read AGENTS.md, .agent/PLANS.md, openspec/changes/add-weekly-review-planning-v1/README.md and every authoritative file it references, especially .agent/execplans/weekly-review-planning-v1.md.

Execute the OpenSpec change add-weekly-review-planning-v1 autonomously from start to finish. Treat the repository-persisted proposal, design, normative spec, tasks, and ExecPlan as the source of truth. Keep the ExecPlan and task checkboxes current as you work, validate thoroughly, fix issues rather than only reporting them, and preserve all existing invariants.

All progress output, documentation, commit messages, user-facing text, and the final report must be English only.

Before finishing: complete the OpenSpec tasks, mark the ExecPlan COMPLETED only when valid, run the full repository-required QA, commit all completed work to main, fetch/reconcile origin/main, push main without force, leave a clean working tree and only remote main, and verify the exact final SHA has GitHub Actions quality PASS and e2e PASS. Do not stop with CI pending or red.
```
