# Super Habits UI/UX Current-State Audit

**Audit target:** `quantdale/super-habits`  
**Baseline:** `main` as inspected on 2026-08-21  
**Purpose:** identify the existing UI architecture, strengths, inconsistencies, and migration constraints before visual implementation.

---

## 1. Audit summary

Super Habits is not starting from a blank design system. It already has a meaningful foundation: semantic theme colors, section accents, shared UI primitives, modular features, responsive React Native/Expo infrastructure, swipe navigation, charts, and centralized shells for modal experiences.

The central UI problem is therefore **not the absence of components**. It is that the application has grown broad enough that visual and interaction consistency now needs a stronger governing system.

The redesign should solve five structural problems:

1. **Module fragmentation:** To Do, Habits, Focus, Workout, and Calories have strong identities but risk feeling like adjacent apps rather than parts of one system.
2. **Navigation density:** six equal-weight tabs compete for scarce phone width.
3. **Incomplete tokenization:** color is well centralized, while spacing, typography, radii, elevation, motion, component sizing, and responsive layout rules are still comparatively implicit.
4. **Feature-local complexity:** large screen files and specialized feature components make it easy for local styling decisions to drift.
5. **Weak cross-feature narrative:** the product has many useful metrics but needs a stronger “Today → action → feedback → progress → review” experience spanning modules.

---

## 2. Current global shell

### `app/index.tsx`

The current root screen establishes the main interaction model.

Primary sections:

| Section | User label | Accent namespace | Main screen |
|---|---|---|---|
| Overview | Overview | neutral | `features/overview/OverviewScreen.tsx` |
| Todos | To Do | `todos` | `features/todos/TodosScreen.tsx` |
| Habits | Habits | `habits` | `features/habits/HabitsScreen.tsx` |
| Pomodoro | Focus | `focus` | `features/pomodoro/PomodoroScreen.tsx` |
| Workout | Workout | `workout` | `features/workout/WorkoutScreen.tsx` |
| Calories | Calories | `calories` | `features/calories/CaloriesScreen.tsx` |

Secondary experiences mounted from the shell include:

- Settings
- Weekly Review
- Planning Hub
- Quick Capture

The shell also preserves mounted screen state and supports horizontal swipe navigation.

### Strengths

- Primary destinations are always visible.
- Feature state can survive tab switches.
- Horizontal swiping makes switching fast for repeat users.
- Section color is already a formal concept rather than ad-hoc styling.
- Settings/review/planning/capture are treated as secondary workflows rather than primary tabs.

### Problems and opportunities

#### Six tabs are visually expensive

A six-way icon-and-label rail at phone width produces small labels, compressed hit regions, and equal prominence for features that do not always have equal daily importance. This becomes worse with larger accessibility text sizes and localization.

**Recommendation:** do not immediately replace navigation. First define the new shell grammar, then prototype both:

- a phone bottom bar with fewer primary destinations; and
- a compact/scrollable six-section rail that preserves the current information architecture.

Validate discoverability and task completion before committing to a route model.

#### The shell carries visual decisions directly

`TopTabItem` currently defines shape, radius, spacing, selected state, icon size, and text weight in the shell. These decisions belong in a reusable navigation primitive/token layer.

**Migration implication:** extract style behavior later without changing navigation state semantics.

#### Horizontal swipe needs accessibility alternatives

Swipe is a convenience, never the only route. All destinations must remain reachable by explicit controls. Web/desktop users also need a visible keyboard focus model.

---

## 3. Existing theme architecture

### `core/providers/themeContext.ts`

Theme context already exposes:

- `mode`
- `resolvedTheme`
- `themeId`
- `theme`
- `tokens`
- `sectionAccents`

This is a strong seam for a redesign.

### `core/theme/tokens.ts`

The current token system centralizes semantic colors across:

- brand and interaction;
- surfaces;
- structure;
- content;
- semantic danger/warning/success states;
- platform chrome.

This is the correct philosophy: components consume semantic tokens rather than checking individual theme identities.

### `constants/sectionColors.ts`

Section identity is formalized as:

- blue — Todos;
- green — Habits;
- purple — Focus;
- orange — Workout;
- amber — Calories.

The implementation already distinguishes fill, text, and tint variants and adapts section accents to appearance.

### Strengths

- Theme identity is not hard-coded in individual features.
- Section accents have semantic meaning.
- Contrast considerations already exist.
- Multiple themes can coexist without a rewrite.

### Gap: tokens stop mostly at color

The UI overhaul should add a second token family for **non-color design decisions** instead of forcing these into feature files.

Recommended additions:

- spacing scale;
- typography roles and line heights;
- radius scale;
- border widths;
- elevation/shadow levels;
- component heights;
- icon sizes;
- content widths;
- responsive breakpoints/layout modes;
- motion durations;
- easing/spring presets;
- opacity states;
- z/layer roles;
- feedback/haptic semantics.

Do this in a way that complements `docs/multi-theme-system-design.md`. Do not replace the current theme architecture.

---

## 4. Existing shared UI layer

`core/ui` already contains a useful component vocabulary, including at least:

- `Badge`
- `Button`
- `Card`
- `ConnectivityIndicator`
- `EmptyStateCard`
- `FeatureStatCard`
- `HorizontalScrollArea`
- `IconButton`
- `InAppNoticeBanner`
- `Modal`
- `NumberStepperField`
- `PageHeader`
- `PillChip`
- `Screen`
- `ScreenSection`
- `SegmentedControl`
- `StatBlock`
- `SwipeableCard`
- `SwipeRightActions`
- `TextField`
- `ThemePreviewCard`
- `ValidationError`

The correct redesign strategy is to **harden and standardize this layer** rather than introduce another `components/ui-v2` tree.

### `core/ui/Card.tsx`

The current card already implements:

- a consistent `rounded-2xl` silhouette;
- surface/border styling through theme tokens;
- subtle elevation/shadow;
- standard/header/stat variants;
- optional section accent strip/tint.

This is close to the desired design direction.

#### Recommended evolution

Turn `Card` into an explicitly documented component contract with a small set of semantic variants:

- `surface`
- `interactive`
- `metric`
- `section`
- `hero`
- `inset`

Avoid arbitrary new card treatments in feature code. Section accents should remain optional and restrained.

### `core/ui/Button.tsx`

The current button provides primary/ghost/danger variants and uses a 48px minimum height, which is a good mobile baseline.

#### Recommended evolution

Define shared states:

- default;
- hover where applicable;
- pressed;
- focused;
- disabled;
- loading;
- success acknowledgement when useful.

Add semantic sizes only if real use cases require them. The app should avoid a proliferation of nearly identical button variants.

---

## 5. Feature inventory and UX implications

### 5.1 Overview

Relevant files include:

- `features/overview/OverviewScreen.tsx`
- `features/overview/CustomizeCardsPanel.tsx`
- `features/overview/cards/*`
- `features/overview/overviewCards.ts`
- `features/overview/overview.domain.ts`

The dashboard is already customizable, which is valuable for a broad product.

#### Risk

When every card is optional or equal, Overview can become a collection of widgets rather than a coherent daily story.

#### Direction

Keep card customization, but introduce a **non-removable or strongly defaulted Today orientation layer** containing:

- current day state;
- one next useful action;
- cross-feature daily progress;
- urgent/upcoming exceptions.

Customization should control secondary content, not erase basic orientation.

---

### 5.2 Habits

Relevant files include:

- `HabitCircle.tsx`
- `HabitDetailModal.tsx`
- `HabitProgressInsightsModal.tsx`
- `HabitsOverviewGrid.tsx`
- `HabitsScreen.tsx`
- `ProgressRing.tsx`
- reminder, lifecycle, preset, data, and domain modules.

`HabitsScreen.tsx` is a large screen implementation, which increases the chance of mixed responsibilities and one-off styling.

#### Existing product potential

Habits is the strongest candidate for Super Habits' emotional identity. It can carry the Avocation-inspired “growth” idea without requiring a change to habit logic.

#### Direction

- Preserve the existing rules/history/reminder engine.
- Introduce a consistent habit-card anatomy.
- Make completion state visually unmistakable.
- Use a shared living-progress metaphor sparingly.
- Keep analytics one layer below daily check-in.
- Treat streaks as context, not as the only reward.

---

### 5.3 Todos

Relevant area: `features/todos/*` plus shared swipe/bulk UI.

The task experience should optimize for throughput rather than decoration.

#### Direction

- fastest possible task capture;
- Today/inbox/upcoming hierarchy;
- compact rows with generous hit targets;
- progressive disclosure of metadata;
- consistent swipe actions with visible alternatives;
- bulk mode that is clearly distinct from normal mode;
- completion feedback that resolves quickly and does not interrupt flow.

Todoist and TickTick are the principal interaction references here.

---

### 5.4 Focus / Pomodoro

Relevant area: `features/pomodoro/*`.

Focus is a session experience, so it should deliberately look calmer than planning screens.

#### Direction

- reduce navigation/chrome while a session is active;
- make time/state readable at a glance;
- use a Forest-inspired growing visual object or scene as optional emotional feedback;
- do not make interruptions feel catastrophic;
- completion should produce an artifact/history update;
- pause/reset/abandon actions should be deliberate and understandable.

---

### 5.5 Workout

Relevant files include:

- `WorkoutScreen.tsx`
- `WorkoutSessionScreen.tsx`
- `RoutineDetailScreen.tsx`
- `WorkoutHistoryDetail.tsx`
- `WeeklyVolumeChart.tsx`
- rest-timer preferences and workout domain/data modules.

The existence of a dedicated session screen is ideal for a Hevy-inspired high-throughput layout.

#### Direction

During an active session:

- previous performance belongs beside the current inputs;
- completed sets should become visually settled;
- the next set/action should remain near thumb reach;
- rest timer should start automatically where expected and remain visible without blocking logging;
- personal records should be celebrated briefly;
- secondary analytics should stay out of the session path.

---

### 5.6 Calories

Relevant area: `features/calories/*`.

Nutrition logging is a high-frequency data-entry workflow. The design must prefer speed and clarity over gamification.

#### Direction

- daily target/remaining state is the top visual summary;
- meal groups provide structure;
- recent/frequent foods and quick add reduce repeated work;
- progress bars/rings update immediately after logging;
- exceeding a target is neutral information, not a failure state;
- historical trends should be distinct from today's logging surface.

Macro Sync is the main inspiration reference.

---

### 5.7 Planning Hub, Goals, Projects, Daily Plan

Relevant areas:

- `features/planning-hub`
- `features/goals`
- `features/projects`
- `features/daily-plan`

These features should share a consistent planning language instead of each inventing its own hierarchy.

#### Direction

Use the same concepts across planning surfaces:

- objective;
- next action;
- schedule/time context;
- status;
- progress;
- review.

Planning is where the product should reduce cognitive load, not display every available metric at once.

---

### 5.8 Weekly Review and Progress

Relevant areas:

- `features/weekly-review`
- `features/progress`
- `features/activity`

These are reflection surfaces and should be more narrative than operational.

#### Direction

A weekly review should answer:

1. What did I complete?
2. What pattern stands out?
3. What deserves adjustment?
4. What should I carry forward?

Raw charts can support those answers but should not be the answers themselves.

---

### 5.9 Quick Capture

Relevant area: `features/quick-capture`.

Quick Capture is strategically important because Super Habits spans several information types.

#### Direction

- launch quickly from anywhere;
- focus the text/input field immediately;
- infer or choose destination with lightweight chips;
- remember sensible recent defaults;
- save first, enrich second;
- never force users through a large form just to capture an idea/task.

---

### 5.10 Settings

Relevant area: `features/settings` plus theme infrastructure.

Settings should be visually quiet. Theme personalization can be attractive, but operational and account/data controls must remain easy to find.

Use consistent grouped rows with:

- label;
- optional description;
- current value/status;
- control or disclosure indicator.

Avoid using cards inside cards for every settings group.

---

## 6. Cross-feature inconsistencies to eliminate

The implementation phase should specifically inventory and eliminate the following classes of drift.

### Geometry drift

- different radii for equivalent surfaces;
- inconsistent horizontal page padding;
- varying vertical gaps between headers and content;
- different button heights for equivalent priority;
- inconsistent icon sizes.

### Typography drift

- arbitrary font sizes in feature files;
- inconsistent use of semibold/bold;
- labels that visually compete with values;
- line heights that do not scale with accessibility text.

### State drift

Equivalent states should look equivalent across modules:

- loading;
- empty;
- success;
- warning;
- destructive confirmation;
- offline;
- disabled;
- selected;
- completed;
- snoozed/skipped;
- overdue/missed.

### Motion drift

Avoid each feature inventing its own duration and spring behavior. Motion should communicate shared semantics.

### Copy drift

Use consistent verbs and tense:

- Add / Save / Done / Complete / Skip / Pause / Resume / Cancel / Delete.

Do not use multiple terms for the same concept without a domain reason.

---

## 7. Accessibility audit targets

The redesign should treat accessibility as a system requirement, not a final QA pass.

### Controls

- Aim for 44×44 logical-point touch areas on mobile for frequent controls.
- Never depend on tiny icon hitboxes.
- Keep sufficient spacing between adjacent controls.

### Color

- Do not use section color as the only status cue.
- Validate contrast for every theme and every semantic state.
- Keep chart legends/labels readable without color discrimination.

### Text

- Support system font scaling.
- Prevent essential labels from becoming unreadable at larger sizes.
- Prefer wrapping/reflow over clipping.

### Motion

- respect system Reduce Motion preferences;
- replace large translations/parallax with fades or direct state changes;
- do not require animation to understand success;
- avoid repeating ambient motion when reduced motion is enabled.

### Input

- keyboard navigation and visible focus for web/desktop;
- screen-reader labels for icon-only controls;
- accessible alternatives for swipe/drag actions;
- meaningful announcements for timer changes and completion when appropriate.

---

## 8. Performance constraints

An attractive UI that feels slower is a regression.

The redesign should preserve the existing performance intent in `app/index.tsx`, where inactive heavy screens remain mounted but are prevented from rebuilding unnecessarily.

### UI performance budget principles

- animate transforms/opacity rather than layout where possible;
- avoid continuous expensive decorative animation;
- do not animate every chart every time a tab becomes active;
- virtualize large lists;
- keep blurred/translucent surfaces limited on low-end Android devices;
- preload only critical illustration assets;
- provide static/reduced variants for living-progress scenes;
- keep completion feedback under the threshold where it delays the next tap.

---

## 9. Migration constraints

The UI project must protect proven product logic.

### Do not rewrite

- data persistence;
- domain rules;
- sync behavior;
- habit scheduling semantics;
- workout logging semantics;
- nutrition calculations;
- notification scheduling;
- existing theme identities;
- analytics/history calculations;
- navigation state simply for visual cleanup.

### Prefer adapters over replacement

When a screen needs a new visual component, adapt existing data to the new component interface rather than moving domain logic into UI.

### Keep testability

- preserve existing test IDs where semantics remain the same;
- add new stable semantic test IDs for new controls;
- do not make automated tests depend on animation timing;
- maintain visible labels for critical actions where possible.

---

## 10. Audit conclusion

Super Habits already has enough design infrastructure to support a high-quality overhaul without a rewrite. The next implementation phase should focus on **governance and consistency**, not raw component count.

The highest-leverage sequence is:

1. codify non-color tokens and interaction states;
2. harden existing `core/ui` primitives;
3. standardize screen anatomy and navigation chrome;
4. redesign the five highest-frequency loops;
5. unify them through Today and Progress;
6. add living progress and celebration only after the core actions are fast and clear.

The redesign should make the breadth of Super Habits feel like an advantage rather than complexity.
