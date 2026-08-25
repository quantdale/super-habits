# Super Habits UI/UX Implementation Roadmap and Acceptance Gates

**Important:** this document is a future implementation plan. The documentation branch containing it must remain code-free.

The migration is designed for incremental execution by human or AI development agents without destabilizing product behavior.

---

## 1. Operating rules for the future implementation branch

1. **No big-bang rewrite.** Migrate one shared foundation or vertical feature slice at a time.
2. **Preserve domain/data semantics.** UI work does not silently change habit rules, task logic, timers, workouts, nutrition calculations, persistence, sync, or notifications.
3. **Reuse `core/ui`.** Extend existing primitives rather than adding a parallel design system.
4. **Reuse the current theme system.** Extend token coverage; do not replace `ThemeContext`, theme definitions, or section accents without a separate architectural decision.
5. **Keep behavioral contracts.** Existing actions should retain meaning unless a product change is explicitly approved.
6. **Keep test selectors stable.** Preserve semantic test IDs/labels whenever the user-facing action remains equivalent.
7. **Ship vertical slices.** A partially migrated app must still look coherent enough to use.
8. **Measure performance.** Animation and visual polish may not materially degrade launch, navigation, list interaction, timer responsiveness, or workout logging.
9. **Accessibility is in scope for every phase.** Do not defer all accessibility to the final polish wave.
10. **Healthy engagement only.** No new dark-pattern mechanics are accepted under the banner of retention.

---

# Phase 0 — Baseline, inventory, and visual regression map

## Goal

Establish a reproducible picture of the current UI before changing it.

## Work packages

### 0.1 Screen inventory

Enumerate every meaningful screen/state under:

- `app/index.tsx`
- `features/overview`
- `features/todos`
- `features/habits`
- `features/pomodoro`
- `features/workout`
- `features/calories`
- `features/planning-hub`
- `features/weekly-review`
- `features/progress`
- `features/goals`
- `features/projects`
- `features/quick-capture`
- `features/settings`

For each, record:

- empty;
- populated;
- loading;
- error/offline where applicable;
- modal/detail states;
- destructive confirmation;
- dark/light appearance;
- compact phone;
- large text if supported by test harness.

### 0.2 Primitive usage inventory

Map one-off implementations that duplicate `core/ui` capabilities.

Look especially for:

- buttons;
- card shells;
- text fields;
- chips;
- headers;
- status badges;
- segmented controls;
- modals/sheets;
- notices;
- empty states;
- loading indicators.

### 0.3 Style-value inventory

Search for repeated hard-coded values:

- spacing;
- border radius;
- font size/weight;
- icon size;
- opacity;
- shadow/elevation;
- animation duration;
- colors bypassing semantic theme tokens.

## Deliverables

- UI inventory document or generated report;
- screenshot baseline;
- list of primitive duplication;
- proposed token-value map.

## Exit gate

- Every primary user journey has a documented current visual state.
- No implementation begins without knowing which existing primitive owns each common interaction.

---

# Phase 1 — Design-system foundation

## Goal

Create one reusable visual and interaction grammar before redesigning feature screens.

## Work package 1.1 — Non-color tokens

Add conceptual token groups for:

- typography;
- spacing;
- radii;
- borders;
- elevation;
- component sizing;
- layout/content widths;
- motion;
- opacity;
- layering.

### Acceptance criteria

- Equivalent components no longer rely on arbitrary local values for the above properties.
- Light/dark theme color behavior remains intact.
- Existing theme selection/persistence behavior remains unchanged.

## Work package 1.2 — Shared interaction states

Define default states for:

- Button;
- IconButton;
- TextField;
- NumberStepperField;
- Card/interactive card;
- PillChip;
- SegmentedControl;
- swipe actions;
- Modal/sheet;
- list row.

Required states where applicable:

- default;
- hover;
- focus;
- pressed;
- selected;
- loading;
- disabled;
- success;
- error;
- destructive.

### Acceptance criteria

- Pressed/focus/disabled behavior is consistent across features.
- Icon-only controls expose accessible labels.
- Keyboard focus is visible on web.
- Frequent mobile actions meet the project's 44×44 target guideline.

## Work package 1.3 — Motion primitives

Create reusable semantic motion presets rather than feature-specific constants.

Examples:

- press feedback;
- completion;
- insertion/removal;
- sheet/modal;
- milestone;
- reduced-motion replacement.

### Acceptance criteria

- Ordinary completion never blocks further interaction.
- Reduced Motion produces an equivalent understandable state.
- No feature introduces a separate arbitrary animation system.

## Work package 1.4 — State surfaces

Standardize:

- empty state;
- loading/skeleton;
- inline error;
- offline banner;
- toast/notice;
- undo confirmation;
- destructive dialog.

### Exit gate for Phase 1

A small showcase/development surface or representative screen demonstrates all shared primitives in light, dark, compact, large-text, pressed, disabled, focus, and reduced-motion states.

---

# Phase 2 — Global shell and navigation polish

## Goal

Make the app feel like one product before changing each feature in depth.

## Work package 2.1 — Screen anatomy

Standardize:

- safe-area behavior;
- horizontal page padding;
- headers;
- section spacing;
- sticky/floating actions;
- modal/sheet widths and paddings;
- scroll behavior.

## Work package 2.2 — Navigation prototypes

Prototype and compare:

### Option A — Refined current six-section model

- preserves six modules;
- more responsive rail;
- improved target size;
- better selected state;
- compact labels;
- keeps swipe behavior.

### Option B — Today-first primary navigation

Potential primary destinations:

- Today;
- Plan;
- Focus;
- Health;
- Progress.

Workout/Calories can remain separate internally while sharing a Health entry point.

### Decision criteria

Choose based on:

- number of taps to common actions;
- discoverability;
- large-text behavior;
- one-handed use;
- route/deep-link impact;
- E2E migration cost;
- ability to preserve existing user mental models.

Do **not** choose solely because a bottom nav looks more modern.

## Work package 2.3 — Universal Quick Capture

Ensure the global capture entry point has a consistent position and behavior across primary screens.

### Exit gate

- Navigation is fully operable without swiping.
- Active section is visually obvious in every theme.
- Global actions are placed consistently.
- No screen gets a unique page-shell implementation without a documented exception.

---

# Phase 3 — High-frequency feature vertical slices

Each slice should include component migration, states, motion, accessibility, and existing-behavior validation.

---

## Slice 3A — Habits

### Target files

Primary UI work is expected around:

- `features/habits/HabitsScreen.tsx`
- `HabitCircle.tsx`
- `HabitsOverviewGrid.tsx`
- `ProgressRing.tsx`
- `HabitDetailModal.tsx`
- `HabitProgressInsightsModal.tsx`

Avoid modifying domain/reminder/data behavior merely for presentation.

### Objectives

- simplify daily check-in;
- consistent habit-row/card anatomy;
- clear quantitative habit controls;
- growth/momentum visual prototype;
- non-punitive continuity feedback;
- streamlined detail/insight hierarchy.

### Acceptance criteria

- A scheduled habit can be completed with the same or fewer interactions than baseline.
- Completion state is clear without relying on color alone.
- Large text does not break the primary check-in flow.
- Missed/off-day/grace states remain semantically correct.
- Growth visuals can be disabled/reduced without losing information.

---

## Slice 3B — Todos

### Objectives

- fast add;
- cleaner row hierarchy;
- unified swipe/overflow actions;
- explicit bulk-mode design;
- clear Today/Inbox/upcoming context;
- consistent completion feedback.

### Acceptance criteria

- A basic task can be captured in one concise flow.
- Metadata does not visually overpower task title.
- Swipe actions have discoverable non-gesture equivalents.
- Bulk mode cannot be mistaken for normal mode.
- Task completion animation does not delay the next task interaction.

---

## Slice 3C — Focus

### Objectives

- quiet resting state;
- reduced-chrome active session;
- optional living progress visual;
- deliberate pause/end/reset behavior;
- meaningful session completion.

### Acceptance criteria

- Timer value remains readable at a glance.
- Active timer controls remain accessible with large text.
- Backgrounding/foregrounding behavior is unchanged by visual work.
- Reduced Motion eliminates nonessential growth movement.
- Ending a session does not imply moral failure.

---

## Slice 3D — Workout

### Target files

- `features/workout/WorkoutScreen.tsx`
- `WorkoutSessionScreen.tsx`
- `RoutineDetailScreen.tsx`
- `WorkoutHistoryDetail.tsx`
- `WeeklyVolumeChart.tsx`

### Objectives

- one-tap path to resume/start;
- previous performance inline;
- efficient set-entry rows;
- tactile set completion;
- persistent non-blocking rest timer;
- concise PR feedback;
- strong session summary.

### Acceptance criteria

- Logging a normal set requires no extra navigation versus baseline.
- Previous values are visible without opening history.
- Set controls remain comfortably tappable.
- Rest timer never blocks data entry.
- PR animation is brief and never interrupts the next set.

---

## Slice 3E — Calories

### Objectives

- daily target/remaining summary;
- meal structure;
- faster frequent/recent logging;
- immediate macro updates;
- neutral over-target behavior;
- trends separated from logging.

### Acceptance criteria

- The user can identify calories and primary macro state without scrolling.
- Repeated foods are quicker to log than a fresh search path where data permits.
- Over-target state remains readable without danger semantics.
- Progress indicators include textual values.

### Phase 3 exit gate

The five main modules share the same:

- page spacing;
- surface geometry;
- input/button states;
- feedback timing;
- empty/loading/error patterns;
- accessibility rules;
- tone of voice.

They still retain distinctive content and section accents.

---

# Phase 4 — Overview becomes Today

## Goal

Unify the redesigned feature loops into one coherent daily command center.

## Work packages

### 4.1 Next Best Action

Create a deterministic ranking based only on existing trustworthy state. Keep explanations visible and avoid opaque scoring.

### 4.2 Daily summary

Represent active modules compactly. Do not create five giant cards.

### 4.3 Custom-card migration

Preserve user customization while introducing a stable Today orientation layer.

### 4.4 Momentum artifact

Connect meaningful actions from the redesigned modules to the selected living-progress metaphor.

**Implementation status — shipped in Momentum Garden V1.** The artifact is a
derived local read model, not a score or event ledger. Today and bounded recent
history independently map active completed Todos, canonical scheduled Habit
completions, completed Focus sessions with positive duration, completed
Workout sessions, day-level Nutrition tracking, completed Daily Plans and
Weekly Reviews, and dated Goal/Project completions. Tasks and Habits cap at
three visual growth levels per day; Focus caps at two completed sessions;
Workout, Nutrition, Planning, and Review use one factual day-level signal.
Habit off-days and lifecycle-masked dates are neutral, calorie-target
adherence never damages the Garden, and all source explanations remain visible.
The compact Today Garden lives below the pinned Today Progress strip in
Overview; bounded seven/28-day history lives inside the existing Progress
Planning Hub view. It reconstructs offline from SQLite and adds no migration,
sync, backup, export, or Supabase entity.

### Acceptance criteria

- User can identify the next useful action within a few seconds.
- The dashboard remains useful if only one or two modules are active.
- Empty modules do not create dead dashboard weight.
- Customization cannot accidentally remove all daily orientation.
- Cross-feature progress never uses an unexplained opaque “health/productivity” score.

---

# Phase 5 — Planning, Goals, Projects, Weekly Review, Progress

## Goal

Turn accumulated data into planning and reflection rather than additional dashboard noise.

## Work package 5.1 — Planning grammar

Standardize objective/action/time/status/progress across Planning Hub, Goals, Projects, and Daily Plan.

## Work package 5.2 — Weekly Review

Implement the guided sequence:

- celebrate;
- notice;
- decide;
- plan;
- close.

## Work package 5.3 — Progress narratives

Add deterministic textual summaries next to charts.

### Acceptance criteria

- Every chart answers a defined question.
- Weekly Review has a clear beginning and end.
- Users can act on insights rather than only view metrics.
- Zero/insufficient-data states teach rather than shame.

---

# Phase 6 — Onboarding, personalization, and final polish

## Objectives

- personalized but short onboarding;
- contextual notification permission requests;
- theme/accessibility settings clarity;
- coherent illustrations;
- final transition tuning;
- web/tablet responsive pass;
- reduced-motion pass;
- semantic copy pass.

### Acceptance criteria

- New users can reach first useful action without configuring every module.
- Notification permission is requested only after its purpose is explained.
- Theme switching does not create contrast or hierarchy regressions.
- No critical action is motion-only, color-only, swipe-only, or icon-only without an accessible name.

---

# 2. Cross-phase quality gates

Every implementation PR/wave should pass the following design gates.

## Gate A — Functional parity

- Existing user action still performs the same underlying operation.
- No domain/state calculation moved casually into presentation code.
- Persistence and sync contracts remain intact.

## Gate B — Visual consistency

- shared spacing tokens;
- shared typography roles;
- shared radius/elevation rules;
- correct feature accent;
- no arbitrary new semantic colors.

## Gate C — Interaction states

Every new/modified interactive component has applicable:

- default;
- pressed;
- hover;
- focus;
- disabled;
- loading;
- error;
- selected/completed state.

## Gate D — Accessibility

- labels/roles/states exposed;
- large-text review;
- contrast validated;
- keyboard focus on web;
- gesture alternatives;
- reduced motion;
- touch target review.

## Gate E — Performance

- no visible dropped-frame regression in common interactions;
- no continuously animating expensive screen by default;
- list virtualization remains intact;
- charts and illustrations do not replay unnecessarily;
- low-end Android remains a supported performance target.

## Gate F — Healthy engagement

Reject the change if it introduces:

- shame;
- false urgency;
- forced repeat engagement;
- manipulative reward uncertainty;
- excessive notifications;
- punishment for normal missed activity.

---

# 3. Definition of Done for a redesigned screen

A screen is complete only when all applicable items are satisfied:

### Purpose and hierarchy

- [ ] The screen has a written primary job-to-be-done.
- [ ] The main action is visually obvious.
- [ ] Secondary actions use progressive disclosure where appropriate.
- [ ] Empty content does not leave meaningless blank cards/charts.

### Design system

- [ ] Typography uses semantic roles.
- [ ] Spacing uses shared tokens.
- [ ] Radius/elevation matches component role.
- [ ] Feature accent is restrained and semantically correct.
- [ ] Existing `core/ui` primitives are reused or deliberately extended.

### States

- [ ] Loading state exists.
- [ ] Empty state exists.
- [ ] Error/offline state exists where relevant.
- [ ] Disabled state is understandable.
- [ ] Pressed/selected/completed states are visible.
- [ ] Destructive actions have appropriate recovery/confirmation.

### Accessibility

- [ ] Screen-reader names/roles/states are meaningful.
- [ ] Color is not the only cue.
- [ ] Frequent mobile targets are approximately 44×44 logical points or larger.
- [ ] Keyboard focus is visible on web.
- [ ] Swipe/drag has an equivalent control.
- [ ] Large text does not clip critical content.
- [ ] Reduced Motion retains equivalent feedback.

### Motion

- [ ] Every animation has a purpose.
- [ ] Ordinary feedback is brief.
- [ ] Animation never blocks the next useful action.
- [ ] Repeated navigation does not replay decorative animation unnecessarily.

### Product tone

- [ ] Missed/incomplete states are neutral.
- [ ] Success copy is proportional to the achievement.
- [ ] No artificial urgency or manipulative prompt.

### Performance and regression

- [ ] Common list/session interactions remain responsive.
- [ ] Existing test IDs are preserved where semantics are unchanged.
- [ ] Core behavior tests still describe the same product semantics.

---

# 4. Agent execution guidance

For autonomous implementation agents, use this order for each work package:

1. Read this `docs/ui-ux` directory completely.
2. Read the affected feature screen plus its domain/data modules to understand invariants.
3. Read the relevant existing `core/ui` primitives.
4. Search the repository for equivalent patterns before adding a new component.
5. Write a narrow implementation plan with explicit owned files.
6. Change shared primitives before copying new styling into several features.
7. Implement one coherent vertical slice.
8. Validate visual states and existing behavior.
9. Record deviations from Design DNA in the PR/commit notes.
10. Do not opportunistically refactor unrelated domain logic.

### Parallel-agent boundary recommendation

Parallel UI work is safe only after Phase 1 contracts are stable.

Good parallel boundaries:

- Habits slice;
- Todos slice;
- Focus slice;
- Workout slice;
- Calories slice.

Shared ownership stays centralized:

- `core/ui/*`;
- theme/token files;
- app shell/navigation;
- shared motion utilities;
- shared illustration assets.

Do not let multiple agents independently edit shared primitives while feature slices are in flight.

---

# 5. Recommended milestone commits

When implementation starts, use durable checkpoints such as:

1. `ui: establish design tokens and shared states`
2. `ui: standardize shell and navigation anatomy`
3. `ui(habits): migrate daily habit experience`
4. `ui(todos): migrate task capture and completion`
5. `ui(focus): introduce calm session experience`
6. `ui(workout): optimize active workout logging`
7. `ui(calories): streamline daily nutrition logging`
8. `ui(overview): unify modules into Today dashboard`
9. `ui: migrate planning review and progress surfaces`
10. `ui: accessibility motion and responsive hardening`

Each checkpoint should remain independently buildable and reviewable.

---

# 6. Final success criteria

The redesign program is complete when a user can move from Todos → Habits → Focus → Workout → Calories and perceive one product, not five styles; when the Overview tells a coherent story of the day; and when the pleasure of using the app comes from clarity, responsiveness, visible growth, and meaningful progress rather than pressure.
