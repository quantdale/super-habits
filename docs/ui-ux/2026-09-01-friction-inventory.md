# SuperHabits friction inventory — 2026-09-01

## Method and evidence

This inventory records the pre-change product surface on the clean `main` baseline
`570aac2538ac9b0550a56effaea881abe6a311ab`.

- Web: `npm run build:web`, then the static export at `http://localhost:8081`
  in Chromium at 1440×1000. Accessibility snapshots and screenshots were taken
  for Overview, To Do, Habits, Focus, Workout, Calories, Quick Capture,
  Command Center, and Settings.
- Android: Mobile Next device `Nitro_API_36` (Android 16/API 36, x86_64,
  package `com.dale16.superhabits`, serial `emulator-5564`). The same six
  sections plus Settings were inspected through the accessibility hierarchy and
  screenshots. Saved evidence is in the local temp directory:
  `superhabits-baseline-today.png`, `superhabits-baseline-todos.png`,
  `superhabits-baseline-habits.png`, `superhabits-baseline-focus.png`,
  `superhabits-baseline-workout.png`, `superhabits-baseline-calories.png`,
  `superhabits-baseline-settings.png`.
- Browser screenshots: `C:\Users\palac\AppData\Local\Temp\omp-sshots-156db97fb5b93979.webp`
  (Overview), `omp-sshots-156db9bbfb39397b.webp` (Quick Capture),
  `omp-sshots-156db9a41cb9397a.webp` (Command Center),
  `omp-sshots-156db9ce10b9397c.webp` (Settings),
  `omp-sshots-156dba9962b9397d.webp` (To Do), and
  `omp-sshots-156dbaa79f79397e.webp` (Habits).

The Android build used for baseline evidence was provenance-verified before
this campaign: source SHA `570aac2538ac9b0550a56effaea881abe6a311ab`, clean
source tree, APK SHA256
`52198EEA578510E465113A81B3DA0CA4755F2F90BFC4A8A945A5E157DB79D568`.

## Journey-level findings

### 1. Orient and choose what to do today — P0

- **Observed:** the shell presents six equal-width tabs. At the Android text
  scale in use, Overview renders as `Over...`, Workout as `Work...`, and
  Calories as `Calor...`; all six accessibility labels remain present, but the
  visual labels are truncated.
- **Observed:** Overview is already the best daily orientation surface, but the
  page begins with greeting/actions, a progress strip, Momentum Garden, Today’s
  Plan, To-Do, and additional feature cards. Empty and seeded states both create
  a long scan before the user reaches the action they need.
- **Observed:** the Today header exposes Customize, Settings, and Plan as equal
  visual actions. Customize is useful for power users but competes with the
  daily decision.
- **Risk:** hidden/truncated navigation and a high decision count delay the
  first useful action; no persistence/data risk if the shell is simplified at
  the presentation seam.
- **Target measure:** every primary tab label is fully readable at the tested
  Android text scale; one primary daily action is visible without scrolling;
  first useful action requires at most one deliberate choice.

### 2. Capture a task or small record — P0

- **Observed:** the web surface has an inline To Do `Quick add` plus an Add task
  button, a screen-level Add task FAB, a global Quick capture FAB, and a global
  Command FAB. On Android To Do, the inline input and three stacked bottom
  actions are all visible in the same empty state.
- **Observed:** Quick Capture opens a modal with six destination chips (Task,
  Habit, Calorie, Project, Goal, Focus), a duplicate `Quick Capture` heading,
  priority controls, and a Capture/Done pair. This is capable but asks users to
  choose a model before writing the thing down.
- **Observed:** the Command Center is a separate global drawer with Ask/Create/
  Auto modes and the placeholder `Add a todo to call mom tomorrow`. The web
  Quick capture and Command launcher overlap spatially; a DOM click on the
  Quick capture button can hit the command launcher.
- **Risk:** duplicate entry points create ambiguity and can route a tap to the
  wrong surface. Existing command parsing and quick-capture persistence are
  valuable backend/behavior contracts and must remain behind the presentation
  seam.
- **Target measure:** one visible primary Add action on Android and web; Task is
  the default capture; advanced destination types and natural language are
  progressive disclosures; no floating control obscures content or another
  control.

### 3. Complete a habit check-in — P0

- **Observed:** Android Habits puts a large Today’s rhythm card (ring, Best
  streak, Consistency, Today) before the check-in groups. Filters Active/
  Paused/Archived/All, sort chips, and the seven-day strip follow before the
  first group. On an empty device, no habit check-in is available in the first
  viewport even though the empty state and Add groups are below.
- **Observed:** the screen has one useful daily rhythm but three secondary
  control clusters before the core action.
- **Risk:** daily completion is the highest-frequency habit action; moving or
  hiding metrics must not change completion counts, date keys, or hard-delete
  exception behavior for `habit_completions`.
- **Target measure:** today’s scheduled habits or the first Add habit action
  appears before filters/history; management controls remain reachable but do
  not lead the flow.

### 4. Start a focus session — P0

- **Observed:** Android Focus is labelled `Pomodoro` in the page header and
  renders five stat cards before Timer. `Start focus` is below the fold at
  approximately y=2183, while the global Add and Command controls occupy the
  lower-right content area. In the screenshot the timer is visible but the
  primary start control is not.
- **Observed:** the timer has the right live progression model, but the first
  action is visually subordinate to historical metrics.
- **Risk:** reordering presentation must preserve durable active-timer state,
  notification scheduling, pause/resume/reset, and session logging.
- **Target measure:** the timer and Start focus control are in the first viewport
  on the target Android device; stats/history remain available after the core
  action.

### 5. Log a workout — P1

- **Observed:** Workout opens with a resume routine card, Complete workout,
  Recent sessions, Training totals, Progress, exercise history, and body-area
  distribution. The screen is useful for an established user but reads as a
  report before the next workout decision.
- **Observed:** in the seeded Android state, `Native Gym V2 resume routine` and
  Complete workout are prominent; advanced progress content extends below the
  first viewport. In the empty state, the routine creation path competes with
  the same reporting scaffolding.
- **Risk:** the routine/session nested tables and sync enqueue behavior must stay
  untouched while the start/resume hierarchy changes.
- **Target measure:** one canonical Start/Resume workout action; recent/history
  and analytics are secondary sections.

### 6. Log food — P1

- **Observed:** Calories begins with Form/Diary mode selection, two rolling
  statistics cards, then a Today summary. The Android first viewport shows no
  food input; `Log food to start tracking` is an empty prompt and the actual
  form continues below the large macro/donut presentation.
- **Observed:** Form and Diary are understandable concepts and the selected view
  persists, but the manual log is not the first action in Form mode.
- **Risk:** preserve `Form`/`Diary` state persistence, meal type, calorie/macro
  validation, saved meals, and date-key behavior.
- **Target measure:** Form mode exposes the fastest calorie entry before
  year-level stats; Diary mode keeps date navigation and grouped records.

### 7. Review, plan, and maintain — P1

- **Observed:** Overview Plan opens Planning Hub; Planning Hub contains Today,
  Projects, Goals, Progress, and Timeline. Weekly Review is another modal. This
  is a strong domain model but the product vocabulary is split across Plan,
  Planning Hub, Weekly Review, Projects, Goals, and Progress.
- **Observed:** Settings is a drawer with an outer modal title and an inner
  Settings header plus Back. On Android the duplicate headers consume the first
  viewport before Appearance starts. The page is a long flat list of Appearance,
  Accessibility, Backup, Portable, Command, Notifications, Focus, Calories,
  and Developer sections.
- **Risk:** a presentation-only hierarchy change must preserve all backup/restore
  disclosures, account ownership guards, portable import/export, notification
  defaults, and command rollout controls.
- **Target measure:** ordinary settings are grouped by user intent, advanced/
  internal controls remain discoverable but visually demoted, and the modal has
  one clear title/close action.

## Cross-cutting diagnosis

1. **Decision density is too high at the top of high-frequency screens.** Metrics,
   history, customization, filters, and advanced controls precede the action.
2. **The action model is fragmented.** Inline add, screen FAB, Quick capture, and
   Command Center each claim the same bottom-right territory.
3. **The shell is visually legible on desktop but not resilient to Android text
   scaling.** Fixed equal tab widths plus single-line labels cause truncation.
4. **The data/read model is not the problem.** The mature screens already load
   correct cross-feature summaries and persistence contracts; changes should
   deepen the presentation modules and avoid DB/domain rewrites.
5. **Warm Momentum needs product-level enforcement.** Existing tokens, cards,
   garden, and empty states provide visual foundations; the missing rules are
   action priority, progressive disclosure, plain-language entry points, and
   first-viewport guarantees.

## Baseline acceptance gates for the redesign

- Six current sections remain reachable through the single-page shell.
- Android labels do not truncate at the tested large-text setting.
- One primary Add/Capture action is visually dominant and does not overlap
  content; Command remains available as an advanced path.
- Today, habit check-in, focus start, workout start/resume, and Form calorie
  logging each expose their primary action in the first viewport where the
  platform can show it.
- Settings retains all current controls and conservative backup/account copy.
- No data-layer invariant, sync contract, route contract, or existing behavioral
  assertion is weakened to achieve the visual result.
