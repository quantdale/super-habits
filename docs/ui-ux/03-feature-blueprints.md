# Super Habits Feature Blueprints

This document turns the shared design DNA into concrete feature-level UX direction. It deliberately avoids application code. Each blueprint is intended to become an implementation work package later.

---

# 1. Overview / Today

**Primary implementation anchor:** `features/overview/OverviewScreen.tsx`  
**Related:** `CustomizeCardsPanel.tsx`, `features/overview/cards/*`, `overviewCards.ts`

## Job to be done

When the user opens Super Habits, answer: **What should I do now, and how is today going?**

## Proposed hierarchy

### A. Today header

Compact, not oversized:

- contextual greeting/day/date;
- settings or profile access;
- optional weekly-review cue only when relevant.

### B. Next Best Action hero

One cross-feature action based on existing data, for example:

- next due task;
- next scheduled habit;
- resume focus session;
- start today's workout;
- log a meal if the user is actively using Calories.

This should be transparent. The UI may explain why it is surfaced (“Due soon”, “Planned for today”), not hide logic behind an opaque AI score.

### C. Today progress strip

A compact summary of the user's chosen active modules:

- tasks complete;
- habits complete;
- focus minutes;
- workout state;
- calorie/macro state.

Avoid five competing large cards. Use a horizontally readable summary or small metric group.

### D. Today timeline / actionable cards

Order by urgency and user intent, not fixed module order.

### E. Momentum visual

A small living-progress artifact may appear here. It should respond to meaningful completed actions across modules, but it must not replace concrete progress values.

### F. Customizable secondary cards

Preserve the existing dashboard-card customization system. Examples:

- weekly streaks;
- recent activity;
- calorie trend;
- workout volume;
- focus trend;
- project progress.

## Empty/new-user state

Do not show a dashboard of empty charts. Show a guided starter state:

1. choose one thing to improve;
2. create a first habit/task or use a preset;
3. explain that more dashboard insights appear naturally over time.

## Animation

- Today progress updates locally when returning from a completed action.
- Hero action changes with a short crossfade, not a carousel animation.
- Momentum visual receives a small growth update after meaningful completion.

---

# 2. Todos

**Primary anchor:** `features/todos/TodosScreen.tsx`  
**Related:** existing bulk, swipe, and shared list components.

## Job to be done

Capture, clarify, and complete tasks with minimal interaction cost.

## Inspiration to transfer

From Todoist and TickTick:

- fast capture;
- strong Today/upcoming hierarchy;
- progressive metadata;
- predictable row interaction;
- advanced functionality available without making every row dense.

## Proposed screen structure

### Header

- title or active list name;
- search/filter action;
- overflow for list-level actions.

### Smart context chips

Only when useful:

- Today;
- Inbox;
- Upcoming;
- Priority;
- project/list filter.

Avoid an always-visible wall of filters.

### Task rows

Recommended anatomy:

1. completion control;
2. task title;
3. one line of relevant metadata (time, project, priority, recurrence);
4. optional trailing affordance only if needed.

Completed tasks should visually settle and optionally move/collapse after a short delay, depending on current product behavior.

## Quick Add

Quick Add should be reachable without scrolling and should support:

- immediate text entry;
- optional due date/time;
- project/category;
- priority;
- recurrence;
- defaults inferred from current list/context.

The first screen should not require all fields.

## Swipe actions

Keep swipe for repeat-user speed, but always expose the same functions elsewhere.

Recommended semantic mapping:

- complete;
- schedule/reschedule;
- edit/details;
- delete only with appropriate confirmation/undo.

Do not overload both swipe directions with many tiny actions.

## Bulk mode

Bulk selection should make the state transition obvious:

- header changes;
- selected count is persistent;
- bulk actions are limited to high-value operations;
- exiting bulk mode is obvious.

## Feedback

Completion:

- check control responds instantly;
- row fades/settles in ~200ms;
- Today progress updates;
- no confetti for ordinary tasks.

Meaningful project completion may receive a larger acknowledgment.

---

# 3. Habits

**Primary anchor:** `features/habits/HabitsScreen.tsx`  
**Related:** `HabitCircle.tsx`, `HabitsOverviewGrid.tsx`, `ProgressRing.tsx`, `HabitDetailModal.tsx`, `HabitProgressInsightsModal.tsx`

## Job to be done

Make daily habit check-in satisfying enough to repeat, while showing long-term consistency without guilt.

## Core screen proposal

### A. Day/date control

Use a compact week strip or day selector with clear current-day state. Historical edits remain possible if supported, but “Today” stays visually anchored.

### B. Daily completion summary

One calm summary, for example:

- `4 of 6` scheduled habits complete;
- progress ring/bar;
- supportive status text.

### C. Habit list/grid

Each habit card/row should show only what is needed for daily check-in:

- icon/identity;
- name;
- target if quantitative;
- completion/progress control;
- optional schedule cue;
- lightweight continuity indicator.

Move deep analytics, reminders, history, and configuration to detail.

## Avocation-inspired growth treatment

Do not copy Avocation's plant. Build an original Super Habits growth system.

Possible model:

- each completed habit adds one leaf/light/segment to today's growth artifact;
- consistency changes the maturity or richness of the weekly artifact;
- the user can open a history/gallery view to see accumulated weeks.

This should remain optional or visually secondary for users who prefer a strict productivity UI.

## Streaks

Show streaks as positive continuity:

- current streak;
- best streak;
- weekly consistency percentage;
- recovery/grace semantics where product logic allows.

Avoid giant “streak broken” states.

## Habit detail

Recommended sections:

1. current habit state;
2. schedule/goal;
3. recent calendar/heatmap;
4. insight summary;
5. reminders;
6. edit/archive/destructive actions.

Do not show all analytics above the action the user came to perform.

## Quantitative habits

For water, reading pages, steps, etc.:

- quick increment buttons;
- direct numeric entry;
- progress toward target;
- clear completed state.

## Feedback

- single tap completion: short scale/fill motion + light haptic;
- quantitative progress: ring/bar interpolates;
- final habit of the day: slightly richer “day complete” treatment;
- milestone: rare growth animation.

---

# 4. Focus / Pomodoro

**Primary anchor:** `features/pomodoro/PomodoroScreen.tsx`

## Job to be done

Help the user enter, maintain, and exit a focused work interval with minimal distraction.

## Resting state

Show:

- duration/mode;
- linked task/project if applicable;
- clear Start button;
- recent/weekly focus summary as secondary content.

## Active session mode

When a timer is running, the interface should simplify dramatically.

Primary content:

- timer;
- current focus label/task;
- subtle progress visualization;
- pause/resume;
- controlled access to abandon/reset;
- optional ambient sound control.

Hide or de-emphasize charts, settings, and unrelated app content.

## Forest-inspired living timer

Use a proprietary Super Habits visual instead of a tree copy.

Examples:

- a small landscape fills in;
- a constellation forms;
- a path is drawn;
- a seed-like geometric form grows.

The animation should communicate elapsed progress and be subtle enough not to become a distraction.

## Interruption behavior

Do not make an interrupted session emotionally catastrophic.

Preferred states:

- Pause — intentional break;
- End early — record partial time if product rules support it;
- Abandon — clear consequence before confirmation;
- Resume — obvious when returning to the app.

Avoid punitive death/loss imagery.

## Session completion

Completion screen can show:

- focused minutes;
- linked task;
- today's total;
- small artifact added to Momentum history;
- Start break / Done.

It should encourage a natural stopping point rather than force another session.

---

# 5. Workout

**Primary anchors:** `WorkoutScreen.tsx`, `WorkoutSessionScreen.tsx`  
**Related:** `RoutineDetailScreen.tsx`, `WorkoutHistoryDetail.tsx`, `WeeklyVolumeChart.tsx`

## Job to be done

Log a workout with minimal cognitive overhead while making progressive overload and personal progress visible.

## Workout home

Priority:

1. Resume active workout if one exists.
2. Start planned/recent routine.
3. Routine library.
4. recent history.
5. progress summary.

Avoid beginning with charts when the likely intent is “start training.”

## Routine cards

Show:

- name;
- exercise count;
- estimated/recent duration if available;
- last performed;
- Start.

Secondary edit/reorder actions belong in detail/overflow.

## Active session screen

This should be one of the most utilitarian interfaces in the app.

### Exercise block anatomy

- exercise name;
- optional notes;
- previous-session reference;
- set rows;
- Add Set;
- exercise overflow actions.

### Set row anatomy

Columns/controls appropriate to the exercise:

- set number/type;
- previous value;
- weight;
- reps/time/distance;
- optional RPE if supported;
- complete checkbox/action.

Use large touch targets even if visual cells appear compact.

### Previous performance

Hevy's strongest transferable principle is **context at the point of entry**. Do not force users into history to remember last week's weight/reps.

### Set completion

When completed:

- row becomes visibly settled;
- values remain readable;
- rest timer starts where configured;
- next set remains obvious.

### Rest timer

Persistent but non-blocking:

- visible mini timer/sticky bar;
- `-15 / +15` or equivalent quick adjustment;
- skip/end control;
- configurable sound/haptic;
- survives reasonable navigation/session transitions.

## Personal records

A PR should feel meaningful because it is rare:

- compact badge/celebration near the affected set;
- session summary lists PRs;
- avoid huge full-screen interruption mid-workout.

## Finish workout

Summary:

- duration;
- sets/exercises;
- volume or other useful metric;
- PRs;
- short note option;
- Done.

No requirement to share socially.

---

# 6. Calories / Nutrition

**Primary anchor:** `features/calories/CaloriesScreen.tsx`

## Job to be done

Understand today's nutrition state and log food with as little friction as possible.

## Macro Sync-inspired hierarchy

### A. Daily summary

At the top:

- calories consumed / target or remaining;
- protein/carbs/fat progress;
- optional fiber/water if already supported and relevant.

Use readable bars/rings with textual values. Avoid turning every nutrient into a large gauge.

### B. Meals

Group entries by meal or logical time block.

Each meal:

- subtotal;
- food entries;
- Add Food;
- optional copy/repeat actions.

### C. Quick logging

Prioritize:

- recent foods;
- frequent foods;
- saved meals/recipes if present;
- quick-add calories/macros;
- barcode/search where supported.

## Over-target behavior

Going over a calorie/macro target is information, not an application error.

Do not switch the entire screen to danger red. Instead:

- show the actual value clearly;
- provide context/trend;
- avoid moralizing copy.

## Trends

Historical trends should live below or behind today's logging flow. Use simple comparisons:

- 7-day average;
- target adherence trend;
- weight/nutrition relationship only if the data is present and safe to interpret.

Avoid health claims that the product cannot substantiate.

---

# 7. Planning Hub / Daily Plan

**Primary anchors:** `features/planning-hub/*`, `features/daily-plan/*`

## Job to be done

Turn a broad set of goals/tasks/habits into an achievable day or week.

## Planning flow

Recommended guided sequence:

1. review carry-over;
2. see fixed commitments/due items;
3. choose priorities;
4. place focus/workout blocks if desired;
5. confirm a realistic plan.

The user should be able to skip steps and edit freely.

## Visual language

Use one planning hierarchy:

- **Outcome** — what matters;
- **Action** — what is done next;
- **When** — schedule/context;
- **Status** — planned/in-progress/done;
- **Progress** — only when meaningful.

Avoid mixing several unrelated card styles for todos, goals, and projects inside the same planner.

---

# 8. Goals and Projects

**Anchors:** `features/goals/*`, `features/projects/*`

## Job to be done

Connect long-term intent to concrete repeatable actions.

## Goal detail hierarchy

1. outcome/title;
2. current status/progress;
3. next action;
4. linked habits/tasks/projects;
5. milestones/history;
6. edit/archive.

## Project detail hierarchy

1. project status;
2. next actionable tasks;
3. sections/milestones;
4. progress/history;
5. configuration.

A goal without a next action should receive a gentle planning cue, not a warning state.

---

# 9. Progress / Activity

**Anchors:** `features/progress/*`, `features/activity/*`, shared heatmap components.

## Job to be done

Help users understand whether their system is working.

## Dashboard hierarchy

### Period selector

Week / month / longer range as justified.

### Narrative summary

Before charts, provide 2–4 meaningful observations derived from existing deterministic data, for example:

- “You completed 83% of scheduled habits this week.”
- “Focus time was highest on Tuesday.”
- “Workout volume increased from last week.”

Do not generate pseudo-insights without enough data.

### Cross-feature overview

Use consistent small metric cards, then allow drill-down by module.

### Heatmap

A contribution-style heatmap can show consistency, but it must include labels/summary for accessibility and should not imply every day has equal expected workload.

## Empty data

Explain how data will become useful after enough activity. Do not show zero-filled charts that look like failure.

---

# 10. Weekly Review

**Anchor:** `features/weekly-review/WeeklyReviewScreen.tsx`

## Job to be done

Close the week, learn from it, and create a realistic next one.

## Proposed guided flow

### Step 1 — Celebrate what happened

- meaningful completions;
- best consistency;
- workout/focus milestones;
- no inflated praise for trivial events.

### Step 2 — Notice patterns

- incomplete carry-over;
- repeated misses;
- overloaded days;
- modules that were inactive.

Tone remains neutral and curious.

### Step 3 — Decide

Prompts such as:

- Keep doing;
- Change;
- Pause/archive;
- Move to next week.

### Step 4 — Plan

Surface goals, important tasks, and recurring commitments for the next week.

### Step 5 — Close

A calm summary and clear Done action. The review should feel finite.

---

# 11. Quick Capture

**Anchor:** `features/quick-capture/QuickCaptureOverlay.tsx`

## Job to be done

Get an idea or action out of the user's head before it disappears.

## First-open state

- autofocus input;
- simple placeholder such as “What do you want to remember?”;
- recent/default destination visible but not intrusive;
- Save action keyboard- and thumb-friendly.

## Classification

Use lightweight chips or a small selector:

- Task;
- Habit idea;
- Note/project item where supported;
- other existing supported destinations.

Do not promise destinations that the current data model does not support.

## Principle

**Capture first; organize later.**

An advanced form defeats the purpose of Quick Capture.

---

# 12. Settings and personalization

**Anchor:** `features/settings/SettingsScreen.tsx`

## Job to be done

Make configuration understandable without becoming a showcase screen.

## Recommended grouping

- Appearance
- Notifications
- Habits / reminders defaults
- Focus defaults
- Workout defaults
- Nutrition preferences
- Data & sync
- Account
- Accessibility
- About / diagnostics where relevant

Theme previews can be visually rich, but settings rows remain simple and standardized.

---

# 13. Onboarding

If/when onboarding is redesigned, it should not be a generic feature tour.

## Goal

Get the user to one meaningful success quickly.

### Suggested sequence

1. What do you want help with? (habits, tasks, focus, fitness, nutrition — multi-select)
2. Choose a minimal starting setup.
3. Create or select the first actionable item.
4. Explain the Today screen.
5. Ask for notifications only in context, after explaining the benefit.

Do not demand configuration for every module at first launch.

---

# 14. Notifications

Notifications are an extension of the UI tone.

Principles:

- specific and actionable;
- opt-in by category;
- quiet by default;
- no guilt copy;
- batch non-urgent reminders when possible;
- respect focus/sleep hours and platform settings;
- tapping a notification opens the relevant action, not a generic dashboard.

---

# 15. Cross-feature consistency matrix

| Pattern | Todos | Habits | Focus | Workout | Calories |
|---|---|---|---|---|---|
| Primary accent | Blue | Green | Purple | Orange | Amber |
| Main everyday action | Complete/add | Check in | Start/resume | Start/log set | Log food |
| Immediate feedback | Row settles | Ring/check fills | Timer/scene starts | Set settles + rest | Totals update |
| Session mode | No | No | Yes | Yes | No |
| Daily summary | Tasks done | Habits done | Minutes | Workout state | Targets |
| Long-term reflection | Completion trend | Consistency | Focus trend | Volume/PR | Intake trend |
| Punitive styling for miss | Never | Never | Never | Never | Never |

The table is the core of the design-DNA requirement: feature content changes, but the interaction grammar does not.

---

# 16. Feature implementation priority

When implementation begins, prioritize by interaction frequency and cross-system leverage:

1. shared primitives + screen anatomy;
2. Habits;
3. Todos;
4. Focus;
5. Workout;
6. Calories;
7. Overview/Today integration;
8. Planning + Weekly Review;
9. Progress/Activity;
10. Goals/Projects/Settings polish.

Overview should be finalized after the first five feature loops have stable design contracts, otherwise the dashboard will be built against moving targets.
