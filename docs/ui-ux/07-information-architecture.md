# Information architecture decision — 2026-09-01

## Decision

Retain the six existing top-level sections and single-page state model. Make
**Overview behave as Today**, and use Plan/Health/Progress as mental groupings
inside the existing seams rather than introducing a new five-tab route model.

| User mental model | Existing entry point                                      | What it owns                                                                                                         |
| ----------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Today             | Overview                                                  | Date, next useful action, compact cross-feature status, Momentum Garden, today’s plan, previews.                     |
| Plan              | Plan action / Planning Hub / To Do / Habits               | Daily priorities, Todos, habit schedule/check-in, Projects, Goals, Timeline, Weekly Review.                          |
| Focus             | Focus tab                                                 | Start/pause/resume/reset the Pomodoro session, optional todo link, session reflection/history.                       |
| Health            | Workout and Calories tabs                                 | Start/resume training and log food; each remains a direct domain destination because the jobs and data are distinct. |
| Progress          | Momentum Garden / Planning Hub Progress / feature history | Reflection and trends after action, not a gate before action.                                                        |
| Settings          | Global Settings modal                                     | Appearance/accessibility, backup/restore, defaults, notifications, internal diagnostics.                             |

## Why not a new five-tab shell now

- The current shell has six stable `AppSection` keys, mounted-screen behavior,
  command contexts, linked-action targets, E2E selectors, and journey coverage.
- Existing journeys intentionally switch Overview → Habits → Todos → Calories →
  Pomodoro without route reloads; collapsing domains would add hidden state and
  navigation hops before evidence proves the benefit.
- Workout and Calories share a Health concept but not the same immediate task;
  combining them would force a second selector at the moment of logging.
- Todos and Habits both belong to Plan conceptually, but each has a different
  daily interaction (task completion versus scheduled check-in). Keeping direct
  entries protects discoverability and avoids a “More” drawer for core jobs.
- The Android evidence proves a responsive-label problem and action hierarchy
  problem, not that users cannot find the six destinations. Fix those seams
  first, then measure whether a future shell consolidation is warranted.

## Implementation consequences

1. Keep `AppSection` and all six `NAV_ITEMS` names/keys unchanged for the first
   wave. Improve compact-width layout so labels do not clip.
2. Treat the Overview screen as Today in copy and ordering: next action and daily
   status first; customization, stats, and long previews later.
3. Keep Planning Hub as the implementation component but use Plan as the primary
   user-facing action label. Preserve its Today/Projects/Goals/Progress/Timeline
   views and all persistence behavior.
4. Keep command context and linked-action navigation unchanged. The universal
   Add sheet is the ordinary entry point; command remains an advanced route.
5. Evaluate a future shell change only after measuring first-action completion,
   navigation errors, label readability, and user reachability across the six
   current journeys.

## Success signals

- A new user can orient on Today and reach a domain action without learning
  internal component names.
- A returning user can switch directly to each existing core job.
- Plan/Progress terminology is coherent across Today, Planning Hub, and Review.
- Android large-text inspection shows all six destinations and no action overlap.
- Existing cross-feature and persistence oracles remain green.
