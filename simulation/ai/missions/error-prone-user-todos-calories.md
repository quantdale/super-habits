# Mission: Error-Prone User explores Todos + Calories

AI exploratory lane mission (`add-user-simulation-platform` task 7.2). A
mission is an **open objective**, never a script: the agent behaves as the
persona and stops at the budget. Any surprise is recorded as an
`anomaly-report.json` and triaged per [the RUNBOOK](../RUNBOOK.md).

- **Mission ID:** `error-prone-user-todos-calories`
- **Persona:** P4 — Sam, the Error-Prone User. Types quickly and mistypes,
  double-taps submit buttons, abandons forms halfway, and occasionally cancels
  a delete a beat too late. Works from a phone-sized viewport. Expects the app
  to forgive and recover from these mistakes, never to lose data silently.
- **Objective:** Use **Todos** and **Calories** for ~20 minutes the way this
  persona would, and report every workflow break, unexpected state, usability
  friction, console error, or cross-surface data inconsistency you encounter —
  including ones caused by the persona's own errors. The app must degrade
  gracefully when the user is sloppy: no half-written rows, no stuck dialogs,
  no counts that disagree with the lists.
- **Fixture:** `TYPICAL` (12 todos, 5 habits, ~40 calorie entries, ~14 days of
  history) via `seedFixture(page, 'TYPICAL')` from `e2e/helpers/seed.ts`, on a
  fresh origin (reset first). Start on the Overview.
- **Budget:** **20 minutes** of active exploration in one session, one browser
  context (OPFS: one writer per origin). Do not spend more than a couple of
  minutes on any single problem — file it and move on.
- **Anomaly rubric (what is reportable):** any of —
  - **Workflow break** — an intended action cannot be completed through the UI
    (submit that never lands, a save whose result is invisible, a delete that
    neither applies nor cancels).
  - **Unexpected state** — the app ends up somewhere it should not: stuck
    modal, blank section, duplicate row, a row the user cancelled still
    appearing elsewhere.
  - **Usability friction** — phrasing and controls that punish the persona's
    mistakes (no confirmation on a destructive action, an edit that is lost
    with no undo, a typo'd entry that is unrecoverable).
  - **Console error** — any unhandled error/warning in the browser console
    during normal use, quoted verbatim in the report.
  - **Data inconsistency across surfaces** — Todo counts, calorie totals, or
    Overview aggregates that disagree with the lists they summarise at the same
    moment.
  - Anything else that would genuinely surprise n human user. A "nothing
    found" run is recorded as such per the runbook — never padded.
- **Interaction vocabulary (sanctioned, not a script):** the six-section
  single-page shell is driven through tab taps, the Settings modal, and the
  Command Center overlay — there are no URLs to navigate. Todos and Calories
  both offer Form and list/diary interactions; try each surface in both
  directions and across a reload. Prefer realistic mistake shapes (typo +
  correct, double-tap, cancel mid-form) over deliberate vandalism. Do not use
  `data-testid` selectors; interact the way a human would (label text, buttons).

This mission pairs with the deterministic journey J7 (`fat-fingers.spec.ts`):
anything that reproduces cleanly is triaged as a candidate
`deterministic-scenario` there rather than re-explored.
