# Super Habits UI/UX Master Plan

**Status:** implementation planning only  
**Research date:** 2026-08-21  
**Base branch audited:** `main`  
**Scope:** visual design, interaction design, information architecture, motion, engagement, accessibility, and migration planning  
**Explicit non-goal:** this branch must not change application code, data models, business logic, tests, or runtime behavior.

---

## 1. Executive direction

Super Habits already has the hard part that many redesigns lack: real product depth. It includes tasks, habits, focus/Pomodoro, workouts, calorie tracking, planning, review, progress, goals, projects, quick capture, settings, and a reusable theme/UI layer. The UI overhaul therefore should **not** be a cosmetic reskin and should **not** be a rewrite. The objective is to make these existing capabilities feel like one deliberate product.

The recommended design direction is **Warm Momentum**:

> A calm, friendly productivity-and-wellness system in which progress feels alive, every important action is easy to find, completion feels tactile, and all modules share the same visual and behavioral grammar.

The inspiration apps should be treated as pattern libraries, not templates:

- **Avocation:** friendly illustration, habit growth, low-friction daily check-ins, approachable emotional tone.
- **Forest:** turning abstract focus time into a living visual artifact and making accumulated effort visible.
- **Macro Sync:** extremely fast high-frequency logging, clear daily targets, useful progress summaries.
- **Todoist:** clarity, quick capture, progressive disclosure, strong hierarchy without visual noise.
- **TickTick:** one coherent shell spanning tasks, habits, calendars, and focus tools.
- **Hevy:** focused workout-session UX, previous performance in context, automatic rest timing, progress feedback.

The product should borrow **principles**, never exact screen layouts, illustrations, branding, wording, trade dress, or proprietary assets.

---

## 2. Product north star

A user opening Super Habits should be able to answer three questions within a few seconds:

1. **What matters now?**
2. **How am I doing today?**
3. **What is the easiest useful action I can take next?**

The UI should reduce the feeling that Super Habits is a collection of six or more separate tools. It should instead feel like one personal operating system for doing the right things repeatedly.

### Primary experience goals

| Goal     | Desired user perception                    | Design response                                                                       |
| -------- | ------------------------------------------ | ------------------------------------------------------------------------------------- |
| Clarity  | “I immediately know what to do.”           | One dominant action per state; strong hierarchy; progressive disclosure.              |
| Warmth   | “This feels encouraging, not clinical.”    | Soft surfaces, restrained illustration, human copy, gentle motion.                    |
| Momentum | “My effort is visibly accumulating.”       | Living progress artifacts, streak context, weekly trends, completion feedback.        |
| Speed    | “Logging takes almost no effort.”          | Quick capture, defaults, recent items, inline completion, minimal modal depth.        |
| Cohesion | “Every screen belongs to the same app.”    | Shared tokens, shapes, components, motion grammar, state patterns.                    |
| Trust    | “The app does not manipulate or shame me.” | Transparent metrics, recoverable states, no false urgency, no punitive dark patterns. |

---

## 3. Design DNA: the non-negotiables

Every feature must follow the same underlying grammar even when it has its own accent color.

### 3.1 Calm foundation, expressive accents

The global app shell, typography, spacing, card geometry, navigation, dialogs, sheets, forms, charts, and feedback patterns remain consistent. Feature colors are accents, **not separate mini-brands**.

Existing section identity can remain recognizable:

- To Do — blue
- Habits — green
- Focus — purple
- Workout — orange
- Calories — amber

Use these colors for selection, progress, small emphasis, key icons, and occasional hero moments. Do not flood whole screens with section color.

### 3.2 Progress should feel alive

Numbers and charts are useful, but the highest-retention products make progress emotionally legible. Super Habits should pair data with a subtle visual metaphor: growth, a path, a constellation, a garden, or a collection that evolves from completed behavior.

The metaphor should be **cross-product**, not a separate gimmick per screen. For example, the same “Momentum Garden” could receive growth from habits, focus, tasks, workouts, and nutrition consistency while each module retains its own detailed analytics.

### 3.3 Completion is tactile

A successful action should produce immediate feedback:

- control state changes instantly;
- the item settles into its completed state;
- a brief motion/haptic reinforces success;
- meaningful milestones receive a larger but still short celebration;
- the user never waits for animation before continuing.

### 3.4 One obvious next action

Dense capability is acceptable; dense decision-making is not. Every primary screen should have a clear first action and a clear current state. Secondary actions should be progressively disclosed through menus, sheets, long press, swipe, or detail screens.

### 3.5 Data explains; it does not decorate

Every graph must answer a user question. Avoid decorative chart walls. Use explicit annotations such as “3 more workouts than last week” or “Your most consistent habit is Reading” rather than forcing users to interpret a chart alone.

### 3.6 Reward consistency, never punish absence

Use streaks and milestones to recognize continuity, but avoid guilt mechanics:

- do not shame missed days;
- do not use alarming red for ordinary misses;
- let users recover from imperfect weeks;
- celebrate returning after a gap;
- avoid artificial urgency, countdown pressure, and endless reward loops.

---

## 4. Current repository reality to preserve

This plan is specifically designed around the existing Super Habits architecture.

### Existing primary shell

`app/index.tsx` currently exposes six primary sections:

1. Overview
2. To Do
3. Habits
4. Focus
5. Workout
6. Calories

It also hosts Settings, Weekly Review, Planning Hub, and Quick Capture overlays. Horizontal gestures switch among the primary sections, and screens remain mounted to preserve state/performance.

### Existing feature boundaries

The repository already separates UI/domain/data work into feature directories such as:

- `features/overview`
- `features/todos`
- `features/habits`
- `features/pomodoro`
- `features/workout`
- `features/calories`
- `features/planning-hub`
- `features/weekly-review`
- `features/quick-capture`
- `features/progress`
- `features/goals`
- `features/projects`
- `features/activity`
- `features/settings`

This modularity should be retained.

### Existing design foundation

The repository already has:

- a theme context and semantic color-token system;
- light/dark/system mode support;
- per-section accent colors;
- reusable `core/ui` primitives including cards, buttons, badges, modal/sheet patterns, fields, segmented controls, headers, notices, swipe actions, and empty states;
- an existing `docs/multi-theme-system-design.md` design document.

The redesign should extend this system rather than create a parallel component library.

---

## 5. Recommended information architecture direction

The current six-tab top rail gives every module equal global weight. That is straightforward but becomes visually dense on phones and makes the app feel module-first rather than day-first.

### Recommended long-term model

Use a **Today-first hierarchy**:

- **Today** — unified daily command center
- **Plan** — tasks, goals, projects, planning hub
- **Focus** — Pomodoro / focused work
- **Health** — workout + calories/nutrition
- **Progress** — habits, trends, milestones, reviews

This is a strategic direction, not an immediate mandate. Navigation has large behavioral and test impact, so it should be validated before implementation.

### Lower-risk migration model

If navigation restructuring is deferred, retain the six existing sections but redesign the shell so it feels less cramped:

- use a compact bottom navigation on phone or a horizontally scrollable rail;
- keep section identity through icon + accent, not large colored areas;
- preserve swipe navigation where it does not conflict with system gestures;
- make Overview the emotional and informational center of the product.

The redesign can succeed without changing routes first. The highest-value work is the shared design system and high-frequency flows.

---

## 6. Proposed cross-feature experience model

### 6.1 Today layer

Overview evolves into a day-oriented dashboard with the following priority order:

1. greeting / day state;
2. one **Next Best Action**;
3. compact “Today progress” summary;
4. upcoming tasks/habits/focus/workout/nutrition state;
5. optional customizable cards;
6. review / insight surfaces.

The current customizable-card system should remain, but the most important daily orientation should not be completely removable.

### 6.2 Quick Capture layer

Quick Capture becomes the universal low-friction entry point. It should be reachable from every primary screen and support context-aware destinations. The first interaction is capture; classification comes second.

### 6.3 Session layer

Some features deserve a temporary **session mode** that reduces chrome:

- Focus timer
- Active workout
- Guided weekly review

In session mode, navigation recedes, the immediate state becomes dominant, and secondary analytics disappear until completion.

### 6.4 Reflection layer

Progress, Weekly Review, and completion summaries should translate raw history into understandable narrative:

- what improved;
- what slipped;
- what is unusually consistent;
- what is worth changing next week.

---

## 7. Engagement framework

The goal is not “addiction” in the dark-pattern sense. The goal is **voluntary re-engagement because the app is useful, pleasant, and rewarding**.

### Engagement loop

**Cue → tiny action → immediate feedback → visible accumulation → meaningful reflection**

Examples:

- Habit check-in → ring fills → subtle haptic → garden/weekly pattern updates.
- Focus session → visual object grows → completion adds it to history → weekly focus pattern appears.
- Workout set → set row confirms → rest timer starts → PR appears only when earned.
- Food log → macro totals update instantly → remaining target becomes clearer.
- Task completion → row resolves → Today gets visibly lighter.

### Healthy mechanics allowed

- streaks with grace/recovery semantics;
- collections and visual unlocks;
- milestone badges;
- weekly personal bests;
- optional quests tied to the user's own goals;
- “welcome back” recovery flows;
- progress visualizations;
- opt-in reminders;
- celebration for meaningful milestones.

### Mechanics to avoid

- fake scarcity;
- punitive streak-loss messaging;
- repeated nagging after a user declines;
- infinite reward feeds;
- variable-ratio mystery rewards designed to encourage compulsive checking;
- social pressure by default;
- red “failure” treatment for ordinary human inconsistency;
- opaque scores that imply judgment without explaining calculation.

---

## 8. Delivery strategy

Do not perform a big-bang redesign. Migrate in vertical slices while preserving business logic.

### Phase order

1. **Foundation:** token taxonomy, interaction states, shared components, motion grammar.
2. **Shell:** navigation, page headers, global quick capture, modal/sheet conventions.
3. **High-frequency loops:** Habits, Todos, Focus, Workout, Calories.
4. **Today:** unified Overview and cross-feature summary surfaces.
5. **Reflection:** Progress, Weekly Review, goals/projects insights.
6. **Polish:** accessibility, reduced motion, responsive behavior, animation tuning, empty/error/loading states.

Each phase must be independently shippable.

---

## 9. Documentation map

This directory is the implementation source of truth for the UI overhaul:

- [`01-current-state-audit.md`](./01-current-state-audit.md) — repository-specific UI audit and risks.
- [`02-design-dna.md`](./02-design-dna.md) — visual system, token architecture, components, motion, accessibility, and interaction rules.
- [`03-feature-blueprints.md`](./03-feature-blueprints.md) — screen-by-screen and feature-by-feature UX proposals.
- [`04-roadmap-and-acceptance.md`](./04-roadmap-and-acceptance.md) — phased migration, work packages, acceptance criteria, and implementation guardrails.
- [`05-inspiration-research.md`](./05-inspiration-research.md) — source research and what should/should not be transferred from Avocation, Forest, Macro Sync, Todoist, TickTick, Hevy, and platform guidance.
- [`06-warm-momentum-2.md`](./06-warm-momentum-2.md) — Warm Momentum 2.0 behavioral interaction contract.
- [`07-information-architecture.md`](./07-information-architecture.md) — Today-first IA and navigation model.
- [`08-warm-momentum-2-1.md`](./08-warm-momentum-2-1.md) — Warm Momentum 2.1 visual-system contract (tokens, primitives, states, one global Add).
- [`09-warm-momentum-2-2.md`](./09-warm-momentum-2-2.md) — Warm Momentum 2.2 interaction-primitives/tablet-density/accessibility-order contract.
- [`2026-09-01-friction-inventory.md`](./2026-09-01-friction-inventory.md) — baseline per-surface friction inventory for the 2.0 campaign.
- [`2026-09-01-feature-disposition-ledger.md`](./2026-09-01-feature-disposition-ledger.md) — disposition of each feature surface across campaigns.
- [`2026-09-01-mobbin-pattern-ledger.md`](./2026-09-01-mobbin-pattern-ledger.md) — transferable reference UI patterns (principles, not trade dress).
- [`2026-09-02-warm-momentum-2-1-visual-friction-matrix.md`](./2026-09-02-warm-momentum-2-1-visual-friction-matrix.md) — 2.1 friction matrix, screenshot manifest, and verification evidence.

---

## 10. Definition of success

The overhaul is successful when:

- a new user can identify the main action on every primary screen without instruction;
- the app feels visually coherent even with section-specific accent colors;
- every repeated action has consistent pressed, loading, success, disabled, and error states;
- high-frequency logging is faster than before;
- users can understand daily state without opening every module;
- motion feels responsive rather than ornamental;
- dark/light themes preserve hierarchy and contrast;
- reduced-motion users receive equivalent feedback;
- ordinary misses never feel like punishment;
- no feature requires a rewrite of its domain/data layer simply to adopt the new visual language;
- the redesign can be rolled out incrementally without destabilizing existing functionality.

The governing rule for every implementation decision is:

> **Make the next useful action obvious, make completion satisfying, and make accumulated progress visible — using one consistent design language everywhere.**
