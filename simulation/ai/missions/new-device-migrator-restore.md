# Mission: New Device Migrator attempts restore without instructions

AI exploratory lane mission (`add-user-simulation-platform` task 7.2). A
mission is an **open objective**, never a script: the agent behaves as the
persona and stops at the budget. Any surprise is recorded as an
`anomaly-report.json` and triaged per [the RUNBOOK](../RUNBOOK.md).

- **Mission ID:** `new-device-migrator-restore`
- **Persona:** P6 — Jordan, the New Device Migrator. A brand-new user on a
  fresh origin who has **not read the documentation**. They tap through
  dialogs, answer prompts based on the button text alone, and assume "my data
  just comes back". They add a couple of todos while exploring, and they do not
  understand the difference between local data and a backup.
- **Objective:** On a fresh origin, attempt the restore flow the way this
  persona would: open the app, react to whatever the first-run experience
  offers, dismiss or accept each prompt based only on its wording, add local
  data, and discover what did — and did not — come back. Report every workflow
  break, unexpected state, usability friction, console error, or disclosure
  that is genuinely misleading about what a restore returns.
- **Fixture:** **Fresh origin, no local data** (`resetAll(page)`, no seed).
  The standard `dist/` build runs with injected fakes and no reachable backup,
  so the mission covers the **empty-backup branch**: no remote backup means the
  restore prompt should not appear, restore is blocked, and the Settings
  eligibility states are what there is to explore. If the runner environment
  provides a genuinely reachable backup (see the runbook's disposable-backend
  note), exercise the accept-and-import branch instead and verify imported
  counts versus what the user was promised. **Never fabricate a backup** —
  record whether one was present.
- **Budget:** **15 minutes** of active exploration in one session, one browser
  context. Include at least one reload and one add-data-then-leave cycle so
  the local-data-present states are reached.
- **Anomaly rubric (what is reportable):** any of —
  - **Workflow break** — a prompt that cannot be answered, a restore that
    hangs or lands on a blank section, a dismiss that has no effect.
  - **Unexpected state** — restore presented to a device that already holds
    local data (eligibility lied), or restore **hidden** on an empty device
    when the UI implies it exists; a discarded prompt re-appearing or never
    appearing again without explanation.
  - **Usability friction** — wording that promises more than a restore
    delivers (restore v1 brings back `todos`, `habits`, `calorie_entries`
    only); no way to understand what "restore" would overwrite; a
    local-data-present message that does not explain _why_ restore is blocked.
  - **Console error** — any unhandled error/warning during the flow, quoted
    verbatim.
  - **Data inconsistency across surfaces** — after any import, counts that
    disagree between Overview, the owning section, and the disclosure text.
  - Anything else that would genuinely surprise a human user. A "nothing
    found" run is recorded as such per the runbook — never padded.
- **Interaction vocabulary (sanctioned, not a script):** drive the single-page
  shell through tab taps and the Settings modal (Backup / Restore bucket);
  there are no URLs. Answer every prompt using only its visible text, as the
  persona would. If the behaviour you hit matches **CG-2** (restore emptiness
  must count deleted rows) or any entry in `docs/testing/known-gaps.md`, record
  it with that reference as the triage pointer — do not re-file it.

This mission pairs with the deterministic journey J5 (`new-phone.spec.ts`) and
the human mission M10 in `docs/testing/exploratory-missions.md`: a clean
reproduction is triaged as a `deterministic-scenario` candidate there.
