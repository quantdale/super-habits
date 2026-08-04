# Mission: Daily Driver uses the app across a simulated midnight

AI exploratory lane mission (`add-user-simulation-platform` task 7.2). A
mission is an **open objective**, never a script: the agent behaves as the
persona and stops at the budget. Any surprise is recorded as an
`anomaly-report.json` and triaged per [the RUNBOOK](../RUNBOOK.md).

- **Mission ID:** `daily-driver-midnight-rollover`
- **Persona:** P1 — Maya, the Daily Driver. Opens the app several times a day,
  leaves it mounted between uses, ticks habits, logs meals, works her todo
  list. She edits a habit shortly after midnight and expects it to land on the
  **new** day; she expects every section she activates to show that day's
  truth, never yesterday's numbers labelled "Today".
- **Objective:** Use the app as this persona across a **simulated midnight**:
  engage several sections before the rollover, advance the page clock across
  the local day boundary (the harness's clock control — no wall-clock
  waiting), then keep using the app after it: tick a habit, log a meal, open a
  section that has been inactive since before the rollover, and compare every
  day-scoped number (day labels, streaks, counts, Overview aggregates) against
  the data the sections actually hold. Report every stale-day label, wrong-day
  write, or cross-surface disagreement.
- **Fixture:** `TYPICAL` (12 todos, 5 habits, ~40 calorie entries, ~14 days of
  history) via `seedFixture(page, 'TYPICAL')` from `e2e/helpers/seed.ts`, on a
  fresh origin (reset first). Use the clock helpers in `e2e/helpers/clock.ts`:
  `installClock(page, time)` to pin the start, then `advanceToNextDay(page)`
  (default: 00:01 local) to cross midnight with the app mounted.
- **Budget:** **15 minutes** of active exploration in one session, one browser
  context. Cross the midnight boundary **at least once with sections open and
  mounted**, and include one reload after the rollover to compare held-memory
  values against fresh reads.
- **Anomaly rubric (what is reportable):** any of —
  - **Workflow break** — an action that cannot complete after the rollover
    (completing a habit, saving a todo, switching a section) when the same
    action worked minutes earlier on the same day.
  - **Unexpected state** — a mounted surface rendering yesterday's data while
    labelled "Today"; a habit tick or meal landing on the wrong day key; a
    streak that reads incorrectly after the boundary; an aggregate frozen at
    the pre-midnight value after the day changed.
  - **Usability friction** — no visible signal that the day has rolled over
    for a mounted session, so the user cannot tell which day a screen is
    showing.
  - **Console error** — any unhandled error/warning caused by the clock
    advance, quoted verbatim.
  - **Data inconsistency across surfaces** — day-scoped counts that disagree
    between the owning section and the Overview at the same moment, or between
    a held-value render and a fresh read after reload.
  - Anything else that would genuinely surprise a human user. A "nothing
    found" run is recorded as such per the runbook — never padded.
- **Interaction vocabulary (sanctioned, not a script):** drive the single-page
  shell through tab taps and the Command Center overlay; there are no URLs.
  Day-scoped data lives in Habits (streaks, completions per `toDateKey()`),
  Calories (diary per day), and the Overview aggregates — compare across those.
  If the stale-"Today"-label behaviour you hit matches **CG-1** in
  `docs/testing/known-gaps.md`, record it with the CG-1 reference as the
  triage pointer (companion change `fix-day-rollover-refresh`) — do not
  re-file it.

This mission pairs with the deterministic journeys J2 (past-midnight writes /
freshness) and the human mission M2 in `docs/testing/exploratory-missions.md`:
a clean reproduction is triaged as a `deterministic-scenario` candidate there.
