# SuperHabits Gym — OpenGym-Inspired Integration Master Plan

**Branch:** `feat/opengym-inspired-gym`  
**Target:** SuperHabits Gym / Workout domain  
**Reference product:** `arvids-unavailable/openGym`  
**Reference revision inspected:** OpenGym `main` around `c42ba6b98e3776af5981f20c05ba392238799670`  
**Status:** Phase 0 design slice committed; production migration intentionally not merged into `main` yet.

---

## 1. Objective

Turn SuperHabits' existing Workout feature into a first-class **Gym** product area with the training-first clarity, information architecture, guided-session ergonomics, exercise discovery, progression visibility, planning, and analytics depth demonstrated by OpenGym — while preserving SuperHabits' own architecture, offline-first SQLite persistence, sync semantics, UI system, accessibility conventions, command-center integration, and testing standards.

This is **not** a source-code port. OpenGym is a product/design/behavior reference. SuperHabits should independently implement the concepts in its own TypeScript/React Native architecture.

The desired end state is a Gym area that can stand on its own as a serious workout tracker while still feeling like one coherent module inside SuperHabits.

### Success definition

A user should be able to:

1. Open Gym and immediately understand today's intended training.
2. Start or resume a workout in one tap.
3. Build reusable routines and assign them to a weekly plan.
4. Reschedule one day without corrupting the underlying weekly plan.
5. Search a substantial exercise library by name, target/body part, and equipment.
6. Configure exercises for reps, timed work, bodyweight, unilateral work, or cardio where applicable.
7. Run a guided workout with previous-performance context, prescribed targets, set completion, rest timing, and resumable progress.
8. Create supersets and have rest behavior respect the group.
9. Track meaningful progression and expose why a target changed.
10. Review history, volume, streaks, exercise progress, estimated strength, and muscle balance.
11. Keep all of the above robust offline and sync safely through SuperHabits' existing data model.

---

## 2. License / clean-room guardrail

OpenGym declares **AGPL-3.0-or-later** in `frontend/package.json` and the repository README/license. Therefore:

- Do **not** paste or mechanically translate OpenGym implementation source into SuperHabits.
- Do **not** copy its CSS, SVG/path data, icon implementation, tests, exercise dataset bundle, or proprietary-looking text wholesale.
- Do **not** vendor OpenGym files.
- Treat OpenGym as a behavioral and UX research specimen: inspect what the product does, then implement equivalent behavior independently in SuperHabits.
- Any third-party exercise dataset considered for SuperHabits must receive a separate license review. OpenGym currently references the `hasaneyldrm/exercises-dataset`; its use by OpenGym does not automatically make it appropriate for SuperHabits.
- Keep this document's feature matrix as the requirements boundary. Implementation agents should work from these requirements and SuperHabits conventions, not by line-by-line comparison with OpenGym code.

This rule applies to every future phase on this branch.

---

## 3. Source audit: OpenGym

### 3.1 Technology and topology

OpenGym's frontend is React 19 + Vite + React Router + Zustand, with Capacitor support for a standalone mobile build. The app routes include:

- `/home`
- `/plan`
- `/plan/r/:id`
- `/workout`
- `/stats`
- `/history`
- `/library`
- `/settings`
- `/admin`

The frontend shell also mounts global workout-adjacent surfaces outside the active route, notably the tab bar, rest timer, modal/sheet system, and toast system. The wake lock follows the active workout rather than the current route.

OpenGym's self-hosted mode uses a small Node API, JSON-file persistence, WebAuthn/passkeys, and a web/nginx layer. Its standalone mobile variant can run without that backend. SuperHabits must **not** reproduce that backend topology; its existing SQLite + sync layer is the stronger fit for this project.

### 3.2 Product information architecture

OpenGym deliberately separates concerns:

- **Home:** "what should I do now?" + quick glance.
- **Plan:** weekly schedule and routine management.
- **Workout:** start chooser or active session.
- **Exercises/Library:** search/filter exercise discovery.
- **Stats:** deep analytics.
- **History:** chronological session history.
- **Settings:** preferences/import/export/profile behavior.

This separation is one of the strongest ideas to adopt. SuperHabits currently places routine creation, start/resume, yearly activity, weekly volume, recent sessions, and history entry points into `features/workout/WorkoutScreen.tsx`. That is functional, but it creates a long mixed-purpose page. The target Gym experience should keep the landing surface action-oriented and progressively disclose planning/library/analytics.

### 3.3 Home / "today" model

Observed in `frontend/src/views/Home.jsx`:

- Seven-day week strip with completed/planned/rest/today states.
- Current week navigation.
- "Today" row directly below the strip.
- If a session is active, the row becomes **Resume**.
- If today's routine exists, it becomes **Start**.
- If today is a rest day, it can still be overridden.
- One-day overrides are distinct from the recurring weekly schedule.
- A starter PPL plan is available to empty-state users.
- Bodyweight logging/goal sits alongside training.
- Workout streak + this-week progress are summarized without turning Home into a full analytics page.

**Adoption principle:** Gym should answer "what now?" before presenting configuration or charts.

### 3.4 Weekly planning

Observed in `frontend/src/views/Plan.jsx` and `RoutineEdit.jsx`:

- Each weekday maps to a routine or Rest.
- Routines are reusable entities independent of weekdays.
- A day can be reassigned without editing the routine.
- Routine editor supports a name/icon, exercise list, exercise ordering, exercise configuration, progression policy, and supersets.
- Superset grouping is represented by linking adjacent exercises.
- A routine-level progression rule can be overridden per exercise.
- Routine editing previews muscle coverage.
- Starter Push/Pull/Legs plan reduces empty-state friction.
- Plan sharing is treated as configuration-only data rather than history export.

**Adoption principle:** Separate *routine definition*, *recurring weekly assignment*, and *date-specific override*. They are three different domain concepts.

### 3.5 Exercise library

Observed in `frontend/src/views/Library.jsx` and supporting exercise modules:

- Search by name and exercise metadata.
- Primary body-part filter.
- Secondary equipment filter.
- Equipment options adapt to the already-filtered result set, preventing dead-end combinations.
- Incremental list expansion instead of rendering the entire catalog at once.
- Exercise rows expose target/body part, equipment, and an existing best value when available.
- Add-to-plan action is available directly from the library.
- Custom exercises are first-class and remain usable throughout the app.
- Media/animation is presented when available, but custom exercises can function without it.

**Adoption principle:** Search and filter behavior matters more than raw catalog size. The library must remain fast and navigable on a phone.

### 3.6 Active workout

Observed in `frontend/src/views/Workout.jsx`:

- When no workout is active, the screen acts as a start chooser.
- Today's planned routine receives priority.
- Other routines remain one-tap alternatives.
- Freestyle workout is allowed.
- Active session shows elapsed time independently so the entire screen does not re-render every second.
- Each exercise block shows previous performance and best value.
- The set table adapts to exercise mode.
- Reps mode supports weight/reps and optional effort.
- Timed mode has a work timer rather than treating time as a manually typed rep surrogate.
- Cardio uses duration + speed.
- Bodyweight exercises can omit the load column; added external load can bring it back.
- Unilateral work exposes "per side" semantics while storing an unambiguous total.
- RIR/RPE is optional and does not silently become zero when absent.
- Sets may be added/removed during the session.
- Completion triggers rest behavior.
- Supersets are treated as execution units, with rest after the group rather than after each linked exercise.
- Screen wake lock is tied to the active workout lifecycle.
- The workout can survive route changes.
- Progression targets are computed before/during session construction and a human-readable reason is shown.

**Adoption principle:** The set row is the core interaction. It must be fast, thumb-friendly, resilient to interruption, and explicit about units and meaning.

### 3.7 Progression

OpenGym exposes multiple progression concepts in `frontend/src/lib/progression.js` and the README:

- Linear progression.
- Greyskull-style behavior.
- Double progression through rep ranges.
- Time progression.
- Routine-level defaults with exercise-level override.
- Misses should not advance load.
- Stalls can cause deload/reset behavior.
- Bodyweight exercises may progress reps instead of weight.
- The UI tells the user *why* the next target changed.

**Adoption principle:** Progression should be pure-domain logic with deterministic tests. Never bury it in component event handlers.

### 3.8 Statistics and feedback

Observed in `frontend/src/views/Stats.jsx` and the README:

- Total workouts and recent-period totals.
- Activity heatmap.
- Bodyweight chart and goal.
- Exercise-specific top-set history.
- Estimated 1RM series.
- Effort analytics when RIR/RPE exists.
- Muscle-balance visualization and "not trained" groups.
- Training volume and effort are treated as related but distinct signals.
- Deep analytics are intentionally outside the workout flow.

**Adoption principle:** Analytics should answer a question, not merely render charts. Each chart needs a decision/use case.

### 3.9 Other relevant OpenGym decisions

From the README and inspected source:

- Rest notifications can survive backgrounding in supported environments.
- Workout-day reminders are opt-in.
- Light/dark themes and accent choices are profile settings.
- No telemetry is a deliberate product choice.
- JSON import/export exists.
- Imports from other workout trackers are supported.
- Plan-sharing excludes personal workout history.
- Localization is broad and exercise instruction payloads may load on demand.
- The app supports guest/offline-like modes.
- Tests are concentrated around pure training/history/progression functions.

---

## 4. Current SuperHabits baseline

SuperHabits is not starting from zero. The current repository already has a meaningful workout subsystem.

### 4.1 Stack

`package.json` confirms:

- Expo 55 / React Native 0.83 / React 19.
- Expo Router.
- NativeWind.
- Expo SQLite.
- AsyncStorage.
- Supabase sync support.
- React Native Gesture Handler/Reanimated.
- Gifted Charts.
- Vitest, Playwright and native QA tooling.

This should remain the implementation substrate. Do not introduce a second state-management framework or a web-only gym island.

### 4.2 Existing workout files

Current `features/workout/` includes:

- `WorkoutScreen.tsx`
- `WorkoutSessionScreen.tsx`
- `RoutineDetailScreen.tsx`
- `WorkoutHistoryDetail.tsx`
- `WeeklyVolumeChart.tsx`
- `workout.data.ts`
- `workout.domain.ts`
- `restTimerPreferences.ts`
- `types.ts`

The existing landing screen already supports:

- create/delete/duplicate routine,
- routine detail,
- starting a session,
- persisted draft + resume/discard,
- recent session history,
- workout-day count,
- streak,
- weekly set-volume chart,
- 52-week heatmap,
- quick completion,
- per-routine last-performed information.

This is valuable functionality and should be retained.

### 4.3 Data architecture

`workout.data.ts` already uses:

- SQLite through `getDatabase()`;
- synced mutations for configuration entities;
- backup mutations for workout history;
- tombstone semantics rather than destructive deletion for synced configuration;
- historical logs that intentionally survive routine deletion;
- timezone-safe date-range queries;
- draft/session metadata;
- explicit `duration_seconds` derivation where start/end timestamps exist.

This is stronger than OpenGym's JSON-file model for SuperHabits' requirements. The migration must extend it rather than bypass it.

### 4.4 Key gaps against the target Gym product

1. No dedicated Gym internal information architecture; most surfaces are stacked in one long `WorkoutScreen`.
2. No weekly routine assignment model equivalent to OpenGym's weekday plan.
3. No date-specific workout-plan override model.
4. No large searchable exercise catalog surfaced as a dedicated Gym library.
5. No explicit custom-exercise creation flow confirmed in the current Gym surface.
6. No clear freestyle-workout entry surfaced on the landing page.
7. Superset semantics need parity review against current session domain.
8. Exercise modes need parity review: weighted reps, bodyweight, unilateral, timed, cardio.
9. Progression policies and human-readable prescriptions are not yet at OpenGym depth.
10. No body/muscle coverage preview on routine construction.
11. No per-exercise strength curve / e1RM hub at OpenGym depth.
12. Current workout charts are useful but do not yet form a focused analytics hierarchy.
13. Gym onboarding/starter-plan flow is weak compared with OpenGym's immediate PPL path.

---

## 5. Target Gym information architecture

Do not force every item into the global SuperHabits navigation. Build an internal Gym navigator/segmented surface.

### 5.1 Recommended primary Gym destinations

1. **Today**
   - current week strip;
   - today routine/rest/override;
   - Start/Resume CTA;
   - quick alternatives;
   - compact streak/training summary.

2. **Plan**
   - weekday assignments;
   - routines;
   - starter plans;
   - routine editor;
   - date-specific reschedule/override.

3. **Exercises**
   - search;
   - body part;
   - equipment;
   - custom exercises;
   - exercise detail;
   - add to routine.

4. **Progress**
   - history;
   - heatmap;
   - weekly volume;
   - per-exercise progression;
   - e1RM where valid;
   - muscle balance when the muscle model exists;
   - optional bodyweight linkage if desired later.

The active workout itself is a dedicated full-focus state and should suppress unrelated command-launch surfaces just as the current implementation does.

---

## 6. Feature parity matrix

| OpenGym concept | SuperHabits decision | Phase | Notes |
|---|---|---:|---|
| Today-first home | **Adopt** | 1 | Replace analytics-first stacking with action-first hierarchy. |
| Week strip | **Adopt** | 2 | Backed by recurring plan + date override. |
| Weekly weekday plan | **Adopt** | 2 | New persistence entities required. |
| One-day reschedule override | **Adopt** | 2 | Must not mutate recurring schedule. |
| Routine entities | **Keep + extend** | 1–3 | Existing domain already sound. |
| PPL starter plan | **Adapt** | 2 | Implement original seed content. Do not copy OpenGym routine definitions verbatim. |
| Freestyle workout | **Adopt** | 3 | Session without saved routine; optionally save afterward. |
| Exercise search | **Adopt** | 3 | Dedicated Gym library. |
| Body-part filter | **Adopt** | 3 | Use normalized taxonomy. |
| Dynamic equipment filter | **Adopt** | 3 | Only expose options that produce results. |
| Custom exercise | **Adopt** | 3 | Local-first, syncable. |
| Exercise animations | **Defer / license review** | 6 | Dataset/media licensing must be explicit. |
| Previous set context | **Adopt** | 4 | Show prior comparable session inline. |
| Best weight marker | **Adopt** | 4 | Extend toward PR/e1RM model. |
| Add/remove set in session | **Keep/verify** | 4 | Existing session supports entered set values; parity test required. |
| Rest timer | **Keep + extend** | 4 | Background notification behavior later. |
| Work timer for timed sets | **Adopt** | 4 | Separate work vs rest semantics. |
| Supersets | **Adopt** | 4 | Explicit group model preferred over UI-only adjacency. |
| Cardio time + speed | **Adapt** | 4 | Model extensibly for future distance/pace. |
| Bodyweight mode | **Adopt** | 4 | Avoid meaningless 0 kg field. |
| Added load for bodyweight | **Adopt** | 4 | Positive external load separate from body mass. |
| Per-side semantics | **Adopt** | 4 | Store canonical total or explicit per-side value consistently. |
| RIR/RPE | **Adopt, opt-in** | 5 | Nullable; never conflate missing with zero. |
| Linear progression | **Adopt** | 5 | Pure tested policy engine. |
| Greyskull-like policy | **Adapt** | 5 | Implement from documented behavior, not copied code. |
| Double progression | **Adopt** | 5 | Rep-range based. |
| Time progression | **Adopt** | 5 | Timed mode. |
| "Why this target" explanation | **Adopt** | 5 | Required acceptance criterion. |
| Estimated 1RM | **Adopt** | 5 | Only eligible rep ranges; formula documented. |
| Muscle map | **Adapt** | 6 | Original SVG/data implementation required. |
| Muscle coverage preview | **Adopt** | 6 | Can launch as text/bars before body illustration. |
| Bodyweight tracking | **Integrate, not duplicate** | 6 | Reuse whichever SuperHabits body/health domain owns weight. |
| Plan share/import | **Defer** | 7 | Structured schema with versioning. |
| Workout-history importers | **Defer** | 7 | FitNotes/Strong/Hevy later. |
| JSON backup | **Use SuperHabits backup architecture** | 7 | No parallel backup system. |
| Passkeys/admin/self-host backend | **Exclude** | — | Not relevant to Gym module. |
| OpenGym theme/icon system | **Exclude as implementation** | — | Use SuperHabits tokens/components. |

---

## 7. Domain model evolution

### 7.1 Keep existing entities

Retain current routine, routine-exercise, routine-set/configuration, workout-log, session-exercise, session-set, and draft concepts unless a migration proves necessary.

### 7.2 Add planning entities

Proposed schema (names are provisional until existing migration conventions are checked):

#### `workout_week_assignments`

- `id`
- `weekday` (0–6 canonical convention documented once)
- `routine_id` nullable for explicit rest
- `created_at`
- `updated_at`
- `deleted_at`

Unique active assignment per weekday.

#### `workout_day_overrides`

- `id`
- `date_key` (`YYYY-MM-DD` in local-date semantics)
- `routine_id` nullable for forced rest
- `kind` (`routine` / `rest`)
- `created_at`
- `updated_at`
- `deleted_at`

A date override shadows but never rewrites the recurring week assignment.

### 7.3 Exercise catalog entity

Prefer a normalized local catalog with a source marker:

- `id`
- `name`
- `body_part`
- `target`
- `equipment`
- `mode` (`reps`, `time`, `cardio` initially)
- `is_bodyweight`
- `is_unilateral`
- `description`
- `media_ref` nullable
- `source` (`builtin`, `custom`, future importer)
- sync timestamps/tombstone for custom records only where appropriate.

Static built-in catalog data does not need to sync row-by-row if it is versioned with the app. User-created exercises do.

### 7.4 Session set semantics

A workout set should have explicit mode-compatible fields rather than ambiguous generic numbers:

- common: `completed`, `completed_at`, optional note;
- reps: `load`, `reps`;
- timed: `duration_seconds`, optional `load`;
- cardio: `duration_seconds`, `speed` initially, future `distance`/`pace`;
- effort: nullable `effort_value` + `effort_scale`;
- PR/progression metadata may be derived unless audit/history requirements demand persisted snapshots.

Persist the **prescription snapshot** used by a completed session when needed so later policy changes do not rewrite history.

### 7.5 Supersets

Do not encode supersets purely as UI adjacency. Prefer a stable optional `superset_group_id` on routine exercises or a normalized group table. Execution order must be deterministic. Rest policy belongs to the group boundary.

---

## 8. State machine for active workout

Implement and test a small explicit state machine.

### Top-level states

- `idle`
- `starting`
- `active`
- `paused/backgrounded` (lifecycle condition, not necessarily a visible pause button)
- `finishing`
- `completed`
- `discarded`
- `recovery-required` (draft exists after process death/crash)

### Active session invariants

- Exactly one active draft per local profile/user.
- Every mutation that changes meaningful workout progress persists the draft atomically enough to survive termination.
- Elapsed time is based on timestamps plus explicit adjustments, not an incrementing counter that drifts in background.
- Rest timer and timed-work timer are distinct domains.
- Completing a set is idempotent.
- Rest should not start between two exercises in the same superset execution unit.
- Finishing a workout writes one immutable workout-log history record and clears the draft only after the history write succeeds.
- Discard requires confirmation and removes draft state without fabricating a completed workout.

---

## 9. Progression engine

Create a new pure module, e.g. `features/workout/progression/`, not component-local calculations.

### Interface

A policy receives:

- exercise mode/config;
- previous prescription;
- recent completed comparable sets;
- optional stall/reset metadata;
- unit preferences;
- bodyweight/load semantics.

It returns:

- target sets/reps/load/time;
- policy identifier/version;
- machine-readable reason code;
- display-ready reason parameters;
- optional deload/reset flag.

### Initial policies

1. `off`
2. `linear`
3. `double_progression`
4. `time_progression`
5. `greyskull_style`

### Required tests

- successful completion advances when policy says it should;
- failed target does not advance;
- stall threshold triggers reset exactly once;
- bodyweight mode progresses reps instead of external load when configured;
- unit conversion never changes canonical progression state;
- nullable effort cannot influence progression unless a future policy explicitly opts into it;
- identical history produces identical prescription.

---

## 10. UI/UX blueprint

### 10.1 Today screen

Order:

1. Header: Gym + date/context.
2. Week strip.
3. Today's routine card / rest state / active-session resume card.
4. Quick-start alternative routines.
5. Three compact metrics maximum.
6. Optional small recent-session card.

Do **not** put routine creation forms, a 52-week heatmap, full weekly-volume chart, and history list above the primary training action.

### 10.2 Plan screen

- Weekday rows first.
- Routine list second.
- `New routine` action.
- Empty state offers original SuperHabits starter plans.
- Routine editor opens as full screen on mobile, not a cramped nested card.
- Reordering should use the repo's existing draggable-list capability where practical.

### 10.3 Routine editor

Each exercise row:

- recognizable name;
- target/equipment/mode summary;
- set prescription summary;
- reorder affordance;
- superset link/group affordance;
- edit/remove action.

Editor-level controls:

- name;
- description/icon if retained;
- default progression policy;
- Add exercise;
- muscle-coverage summary once implemented;
- duplicate/share later;
- destructive delete at bottom.

### 10.4 Exercise library

- Sticky-ish search entry at top where platform permits.
- Horizontal body-part chips.
- Equipment chips derived from current result set.
- Virtualized list (FlashList is already installed).
- Exercise card with name, target/body part, equipment, optional best metric.
- Exercise detail owns instructions/media/history.
- Custom exercise entry is always discoverable.

### 10.5 Active workout

Prioritize one-hand operation:

- persistent top status: routine, elapsed, finished sets/total;
- one exercise block at a time or clearly separated stacked blocks;
- previous-session context immediately above set rows;
- minimum 44–48 px practical touch targets;
- numeric input + stepper behavior must not fight the keyboard;
- completed row gets unmistakable but accessible state;
- rest timer visible without obscuring set controls;
- quick add/remove set;
- exercise options: replace/add/reorder as later phase;
- finish button protected against accidental tap;
- cancellation preserves or explicitly discards a draft.

### 10.6 Progress

Organize by questions:

- **Am I training consistently?** heatmap, streak, sessions/week.
- **Am I doing more work?** weekly sets/volume/time.
- **Am I getting stronger?** per-exercise top set/e1RM.
- **Am I training evenly?** muscle balance.
- **How hard am I training?** RIR/RPE distribution, only when sufficient data exists.

No chart should render a misleading zero for missing data.

---

## 11. Phase plan

### Phase 0 — research + isolated design slice **(this branch now)**

Deliverables:

- this master plan;
- `OpenGymInspiredGymPrototype.tsx`;
- Expo Router prototype route `/gym-prototype`;
- no changes to `main`;
- representative mocked UI only, clearly labeled.

Purpose: establish information architecture and visual density before altering production navigation/data.

### Phase 1 — Gym shell and Today migration

- Introduce Gym internal destination state (`today | plan | exercises | progress`).
- Move current Start/Resume behavior to Today.
- Reuse current real routine list, draft, logs, streak and volume data.
- Remove duplicated sections from legacy landing only after parity tests exist.
- Preserve `useCommandLauncherSuppressed` during active workout.

### Phase 2 — weekly plan + day overrides

- Add migrations.
- Add typed data accessors.
- Add pure `effectiveRoutineForDate()` resolver.
- Add Plan UI.
- Add current-week strip.
- Add day-override sheet/modal.
- Add starter-plan seed transaction.
- Add sync records and conflict semantics.

### Phase 3 — exercise catalog + freestyle

- Select/license an exercise metadata source or author a smaller built-in catalog.
- Add catalog search index strategy.
- Add body-part/equipment filters.
- Add custom exercises.
- Connect routine editor to library.
- Add freestyle session that can optionally be saved as a routine.

### Phase 4 — session-mode hardening

- Normalize reps/time/cardio/bodyweight/unilateral behaviors.
- Add explicit work timer.
- Harden rest timer across app lifecycle.
- Add previous-session row context.
- Add best/PR indications.
- Add supersets with tested rest boundaries.
- Add wake-lock behavior if Expo/platform support meets requirements.

### Phase 5 — progression + strength analytics

- Pure policy engine.
- Policy configuration UI.
- Explanation/reason strings.
- e1RM calculation with conservative eligibility cutoff.
- Exercise progress screen.
- Optional RIR/RPE logging and analytics.

### Phase 6 — muscle model + richer media

- Independently define exercise-to-muscle contribution data.
- Start with ranked bars/chips.
- Add original body illustration only after accessibility and asset licensing review.
- Add routine coverage preview.
- Add exercise animation/media only after dataset/media license and app-size strategy are approved.

### Phase 7 — portability and polish

- plan import/export schema;
- external tracker importers;
- richer reminders;
- localization extraction;
- performance profiling on low/mid Android hardware;
- final migration from prototype route into canonical Gym section.

---

## 12. Exact proposed file plan

### Existing files to evolve

- `features/workout/WorkoutScreen.tsx`
  - become Gym shell or delegate to one;
  - stop owning every subsection directly.

- `features/workout/WorkoutSessionScreen.tsx`
  - preserve working draft/session flow;
  - add mode-specific set editors and superset execution semantics.

- `features/workout/RoutineDetailScreen.tsx`
  - evolve toward full routine editor or split editor from detail view.

- `features/workout/WorkoutHistoryDetail.tsx`
  - extend per-set metadata carefully.

- `features/workout/workout.data.ts`
  - add week assignments, day overrides, exercise/custom exercise operations, session snapshots.

- `features/workout/workout.domain.ts`
  - keep pure date/activity/stat helpers;
  - extract planning/progression/session subdomains as complexity grows.

- `features/workout/restTimerPreferences.ts`
  - keep as preference boundary; add notification integration elsewhere.

### New files/directories recommended

```text
features/workout/
  GymShell.tsx
  today/
    GymTodayScreen.tsx
    GymWeekStrip.tsx
    TodayWorkoutCard.tsx
  plan/
    WorkoutPlanScreen.tsx
    WeekAssignmentList.tsx
    DayOverrideSheet.tsx
    RoutineEditorScreen.tsx
  exercises/
    ExerciseLibraryScreen.tsx
    ExerciseDetailScreen.tsx
    ExerciseFilters.tsx
    exerciseCatalog.ts
    exerciseCatalog.types.ts
  session/
    ActiveWorkoutHeader.tsx
    ExerciseBlock.tsx
    SetRow.tsx
    RestTimerOverlay.tsx
    WorkTimerOverlay.tsx
  progress/
    GymProgressScreen.tsx
    ExerciseProgressScreen.tsx
    StrengthChart.tsx
    MuscleBalanceCard.tsx
  progression/
    progression.types.ts
    progression.engine.ts
    policies/
      off.ts
      linear.ts
      doubleProgression.ts
      timeProgression.ts
      greyskullStyle.ts
  planning/
    planning.data.ts
    planning.domain.ts
    planning.types.ts
```

Do not create all of these mechanically in one commit. Create them when responsibility genuinely moves out of existing files.

---

## 13. Persistence and sync requirements

Every new synced entity must follow SuperHabits' existing conventions:

- stable IDs;
- `created_at`, `updated_at`, `deleted_at` where required;
- tombstone-compatible delete behavior;
- owner/profile semantics identical to surrounding tables;
- queued sync records through existing mutation wrappers;
- remote conflict handling documented;
- old app versions must not corrupt new records;
- migrations must be deterministic and idempotent in the repository's migration model.

Workout history is user content. A routine deletion must not erase historical sessions. If an exercise definition later changes, old history must remain interpretable through stored snapshots or stable catalog IDs.

---

## 14. Offline and lifecycle behavior

Gym is a high-interruption environment. Required behaviors:

- starting, logging and finishing a workout works without network;
- app background/foreground does not reset elapsed or rest time;
- process death restores draft;
- daylight-saving/timezone changes do not duplicate or lose daily plan assignments;
- local date determines today's plan, while timestamps remain absolute UTC/ISO where appropriate;
- if sync conflict occurs while a session is active, local in-progress work must not be silently overwritten;
- notifications are enhancements, never the source of truth for timer state.

---

## 15. Accessibility

Minimum acceptance criteria:

- all icon-only actions have accessibility labels;
- set-completion state is conveyed semantically, not by color alone;
- chips expose selected state;
- dynamic timers do not spam screen readers every second;
- focus order follows visual order;
- text remains usable under increased font scale;
- set inputs expose units in labels;
- min touch targets meet mobile accessibility norms;
- light/dark theme contrast continues to pass the repo's theme validation.

---

## 16. Performance requirements

- Avoid rerendering the entire active workout every second; isolate elapsed/rest clocks.
- Exercise library uses FlashList/virtualization.
- Do not bundle hundreds of megabytes of animation media into the core app without an explicit delivery/cache plan.
- Search should remain responsive with 1k+ exercises.
- Derived analytics should be pure and memoizable; large history calculations may move behind query aggregation as history grows.
- Run Android mid-range profiling before production rollout.

---

## 17. Test strategy

### Unit/domain

Add tests for:

- effective routine for date;
- date override precedence;
- weekday mapping and timezone boundaries;
- progression policies;
- superset execution units;
- rest boundaries;
- bodyweight/unilateral normalization;
- e1RM eligibility and formula;
- RIR/RPE conversions if implemented;
- muscle-load aggregation;
- exercise filtering including adaptive equipment options.

### Data/integration

- create/update/delete weekly assignment;
- override sync/tombstone behavior;
- routine deletion keeps history;
- session finish is atomic enough to avoid a log+draft double state;
- custom exercise sync;
- migration forward from current production schema.

### UI/component

- Today card switches Start → Resume when draft exists;
- Rest day state;
- plan assignment interactions;
- filter chips;
- set-row mode variants;
- finish/discard confirmations;
- empty/loading/error states.

### E2E

At minimum:

1. Fresh profile → load starter plan → see today's assignment.
2. Build custom routine → add exercises → assign weekday.
3. Start workout → log partial sets → kill/reload app → resume.
4. Complete workout → appears in history/heatmap/volume.
5. Superset → no rest between linked exercises, rest after group.
6. Timed set → work timer records actual duration.
7. Bodyweight exercise → no meaningless weight field.
8. Search library → body-part + equipment filters never produce a stale invalid equipment selection.
9. Date override → next week still follows recurring plan.
10. Offline session → later sync succeeds without duplicating history.

Use existing Vitest/Playwright/native QA infrastructure rather than adding a second test stack.

---

## 18. Empty, loading and failure states

Every destination needs explicit states.

### Today

- no routines: starter plan / build routine;
- routines but no schedule: pick one / configure week;
- rest day;
- active draft;
- failed data refresh: keep last local data and show non-blocking error.

### Plan

- no routines;
- no weekday assignments;
- deleted routine referenced by stale override: treat as unresolved and offer repair, do not crash.

### Exercises

- initial loading only if catalog truly loads asynchronously;
- no search matches;
- invalid media unavailable → metadata still works;
- custom exercise exists without media.

### Progress

- no history;
- insufficient data for a metric;
- missing effort values should suppress effort analytics rather than render zeros.

---

## 19. Privacy and product boundaries

- Do not introduce analytics/telemetry merely because OpenGym has a stats product; those are local user analytics, not product telemetry.
- Workout history and body data are sensitive personal data; reuse SuperHabits' existing privacy/export/delete conventions.
- Do not send exercise/session history to third-party APIs for convenience.
- AI features, if ever connected to Gym, must be advisory and must not silently alter workout history or progression targets.

---

## 20. Phase-0 prototype on this branch

Files:

- `features/workout/OpenGymInspiredGymPrototype.tsx`
- `app/gym-prototype.tsx`

The prototype deliberately demonstrates, in SuperHabits' component/theme language:

- today-first active workout card;
- seven-day planning strip;
- compact training metrics;
- quick-start routines;
- weekly plan concept;
- searchable/filterable exercise-library visual model;
- guided set-table visual model with previous performance/prescription context;
- rest timer placement;
- progress and muscle-balance hierarchy.

The prototype uses representative data and no copied OpenGym source. It exists to validate structure and visual direction before production persistence work.

It should **not** be mistaken for a completed implementation. The production Gym tab remains the current `WorkoutScreen` until Phase 1 deliberately moves real behavior into the new information architecture.

---

## 21. Recommended implementation sequence for the next coding agent

1. Read this file fully.
2. Read `features/workout/WorkoutScreen.tsx`, `WorkoutSessionScreen.tsx`, `RoutineDetailScreen.tsx`, `workout.data.ts`, `workout.domain.ts`, current DB types/migrations, sync mutation wrappers, and theme/UI primitives.
3. Open `/gym-prototype` on web and Android and compare information density against the current Workout tab.
4. Do not copy any OpenGym implementation code.
5. Convert the prototype's **Today** section to real SuperHabits data first.
6. Add internal Gym navigation while keeping the legacy sections reachable until parity is proven.
7. Commit a working checkpoint.
8. Implement week assignment + override domain/migrations with unit tests before building the Plan UI.
9. Commit a working checkpoint.
10. Build Plan UI and starter-plan transaction.
11. Commit a working checkpoint.
12. Implement Exercise Library only after catalog/license decision is documented.
13. Continue phase-by-phase; never combine schema, progression engine, catalog, session rewrite and analytics rewrite into one unreviewable change.

---

## 22. Definition of done for the full campaign

The OpenGym-inspired Gym campaign is complete only when all of the following are true:

- Gym has a dedicated, coherent Today/Plan/Exercises/Progress information architecture.
- The default Gym landing view is useful in under two seconds: today's state and Start/Resume are obvious.
- Weekly plans and date overrides are persisted, synced and tested.
- Routine editing is faster and clearer than the current form/list combination.
- Exercise library search/filter/custom-exercise flows are production-ready and legally sourced.
- Active workout survives interruption and supports the required exercise modes.
- Supersets and timers have deterministic tested semantics.
- Progression engine is pure, versionable and explains its decisions.
- History remains immutable and interpretable after configuration changes.
- Progress surfaces distinguish consistency, volume, strength, balance and effort.
- Android native, web export, typecheck, lint, unit/integration tests, relevant Playwright journeys and native smoke checks pass.
- Accessibility regressions are addressed.
- No OpenGym AGPL source has been copied into SuperHabits.
- `main` remains untouched until this branch is deliberately reviewed and merged.
