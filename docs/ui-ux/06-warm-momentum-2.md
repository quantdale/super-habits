# Warm Momentum 2.0 — product interaction contract

Warm Momentum 2.0 is the behavioral and visual contract for making SuperHabits
feel calm, capable, and immediately useful. It is stricter than a color/style
guide: a surface fails if it looks polished but makes the next useful action
hard to find.

## 1. Hierarchy

- **One primary action per surface.** The action answers the screen's dominant
  job: orient on Today, check in on Habits, start on Focus, start/resume on
  Workout, log on Calories, capture on Add.
- **Primary before proof.** Put the action and its minimum context before stats,
  history, customization, filters, and management controls.
- **One primary global action.** Add/Capture is the only visually dominant global
  floating action. Advanced natural-language command entry is available from
  that flow and Settings, not as a competing default.
- **No occlusion.** Floating actions never cover a primary button, input, modal
  close control, or essential content. A screenshot at phone dimensions is a
  required check.

## 2. Decision density and progressive disclosure

- The first viewport should present one clear next step and no more than three
  supporting choices for a high-frequency job.
- Power-user controls remain reachable, but filters, sort, customization,
  parser modes, historical stats, and developer controls are secondary.
- “Advanced” means less frequent or more complex, not less important. Do not
  delete capability to achieve calmness.
- A collapsed/secondary control must have a semantic label that explains what
  becomes available; no unlabeled icon-only mystery controls.

## 3. Language

- Use the user's job language: Add, Task, Habit, Log food, Start focus, Start
  workout, Plan, Review, Settings.
- Do not lead with implementation terms such as parser, rollout, command mode,
  outbox, or sync engine. Safety/diagnostic surfaces may explain them when
  needed.
- Keep copy factual and supportive. Never imply a score, failure, streak debt,
  or urgency when the data only says “not started”.

## 4. Navigation and information architecture

- Today is the orientation home: date, next useful action, compact cross-feature
  status, and the day's plan.
- The six current section keys remain reachable because each domain has a
  distinct high-frequency job. The navigation rail adapts to width/text scale;
  it does not rely on clipped labels.
- Plan is the mental model for Todos, Habits planning, Projects, Goals, Timeline,
  Progress, and Weekly Review even when the current single-page shell retains
  their existing section/modal seams.
- Focus means starting and completing a session, not browsing statistics.
- Health means Workout and Calories as related but separate logging jobs; their
  existing tabs remain direct destinations.

## 5. States

- Empty: explain what is absent, offer one next action, and avoid fake metrics.
- Loading: reserve space and communicate that data is loading; do not show a
  confident empty state while reads are pending.
- Error: identify the failed surface, preserve user data, and offer retry or a
  safe next step.
- Success: confirm the completed action briefly, then return attention to the
  next useful action. Undo is available where the existing flow supports it.
- Dense: keep the primary action anchored and let lists scroll; do not add more
  summary cards to compensate for data volume.

## 6. Accessibility and responsive reality

- Every interactive target is at least 48dp where the platform permits.
- Every icon-only control has a unique purpose/result accessibility label.
- Labels are full strings at the tested Android text scale; truncation is not an
  acceptable navigation strategy.
- Contrast follows Android guidance: at least 4.5:1 for ordinary text and 3:1
  for large/bold text where applicable.
- Test keyboard focus on web, screen-reader-oriented hierarchy on Android,
  long labels, empty/dense data, light/dark themes, keyboard-open sheets, and
  safe-area insets.

## 7. Persistence and trust

- Visual simplification never bypasses feature data functions or domain rules.
- Every existing write retains its sync enqueue, soft-delete, ID, date-key,
  singleton, notification, and account-ownership behavior.
- Settings and backup/restore remain conservative: one-way push backup plus
  completeness/restore and portable backup; no claim of two-way sync.

## 8. Measurement gates

A redesign wave is accepted only when:

1. first-use and repeat-use screenshots show the primary action before secondary
   content on the target phone;
2. the accessibility hierarchy exposes the same action with a purposeful label;
3. the existing behavior/persistence tests pass;
4. no meaningful interaction requires an extra navigation hop without evidence;
5. the affected surface has no new visual overlap, clipping, or uncontrolled
   width/height growth.
