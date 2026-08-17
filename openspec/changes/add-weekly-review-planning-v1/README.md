# Weekly Review & Planning V1 — Implementation Entry Point

This OpenSpec change is intended to be executed by a fresh autonomous implementation session.

Authoritative files:

1. `proposal.md` — product problem, goals, scope, safety boundaries, and definition of done.
2. `design.md` — architecture, persistence, exactly-once execution, backup/portable integration, UI, security, and validation design.
3. `specs/weekly-review-planning/spec.md` — normative requirements and acceptance scenarios.
4. `tasks.md` — ordered implementation checklist. Work through it systematically and keep task state accurate.
5. `.agent/execplans/weekly-review-planning-v1.md` — durable execution state, decisions, discoveries, validation ledger, and final Git/CI requirements.

Implementation rules:

- Start from freshly fetched `origin/main`.
- Read all five authoritative artifacts before editing source.
- Execute the tasks in order unless repository evidence requires a documented dependency-safe reorder.
- Update the ExecPlan continuously so a fresh session can resume from repository state alone.
- Keep all user-facing output and implementation-session prose in English.
- Use existing canonical domain APIs; do not bypass Todo recurrence, Linked Actions, owner binding, Backup V2, or Portable V1 safety contracts.
- Completed Weekly Reviews are authoritative recoverable user state and must ship with cloud backup + portable backup support in this same change.
- Do not declare completion while final GitHub CI is pending or red.
- Final validated work must be committed/pushed to `main`, local `main` must equal `origin/main`, working tree must be clean, and only remote `main` may remain.
