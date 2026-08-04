# Mission: Power User stress-tests linked actions

AI exploratory lane mission (`add-user-simulation-platform` task 7.2). A
mission is an **open objective**, never a script: the agent behaves as the
persona and stops at the budget. Any surprise is recorded as an
`anomaly-report.json` and triaged per [the RUNBOOK](../RUNBOOK.md).

- **Mission ID:** `power-user-linked-actions`
- **Persona:** P3 — Priya, the Power User. Fast, feels at home in the Command
  Center, sets up automation (linked actions) to save herself taps, and
  expects chains of completions to fire reliably every time. She edits her
  rules mid-flight, re-runs things, and notices when the Overview does not
  reflect what her chains did.
- **Objective:** Set up and exercise **linked actions**
  (`core/linked-actions/`) the way this persona would: build chains between
  todos and habits, complete the source entries and watch the effects, edit a
  rule while chains exist, trigger the same rule repeatedly, and reload to see
  what survives. Report every workflow break, unexpected state, console error,
  or data inconsistency — a chain that fires twice when it should fire once, a
  rule that stops applying after an unrelated edit, effects that the owning
  section shows but the Overview does not.
- **Fixture:** `TYPICAL` (12 todos, 5 habits, ~14 days of history) via
  `seedFixture(page, 'TYPICAL')` from `e2e/helpers/seed.ts`, on a fresh origin
  (reset first). The chains themselves are created through the linked-actions
  editor during the mission — that is part of the exploration.
- **Budget:** **25 minutes** of active exploration in one session, one browser
  context. Stop and file an anomaly after reproducing it twice at most; do not
  spend the budget diagnosing any single chain.
- **Anomaly rubric (what is reportable):** any of —
  - **Workflow break** — creating, editing, or removing a rule through the
    editor that does not land; a chain whose effect is invisible after the
    source action completes.
  - **Unexpected state** — a chain firing twice for one completion, firing for
    an already-deleted target, a self-loop or circular chain leaving the app in
    a stuck or flapping state, rules that resurrect after deletion (or vanish
    after a reload).
  - **Usability friction** — the editor offering no way to preview or undo a
    rule change, destructive edits with no confirmation, chains that are
    silently inactive with no signal.
  - **Console error** — any unhandled error/warning during chain execution,
    quoted verbatim.
  - **Data inconsistency across surfaces** — the Overview aggregate disagreeing
    with the section that fired the chain (e.g. a linked todo completion that
    the Todos list shows but Overview counts do not), at the same moment,
    across a reload.
  - Anything else that would genuinely surprise a human user. A "nothing
    found" run is recorded as such per the runbook — never padded.
- **Interaction vocabulary (sanctioned, not a script):** the single-page shell
  is driven through tab taps, the Settings modal, and the Command Center
  overlay — there are no URLs. Linked actions are configured through the
  editor surface that owns them (`core/linked-actions/`); exercise rule types
  you can reach from the UI, and do not call data-layer functions directly —
  the power user drives the UI. Do not use `data-testid` selectors; interact
  the way a human would.

This mission pairs with the deterministic journeys J7/J8 and the chain-reaction
spec (`e2e/journeys/chain-reaction.spec.ts`): a clean reproduction is triaged
as a `deterministic-scenario` candidate there rather than re-explored.
