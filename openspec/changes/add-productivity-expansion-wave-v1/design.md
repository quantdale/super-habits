# Design: Productivity Expansion Implementation Wave V1

## 1. Design intent

This wave adds a planning/organization layer above the existing six trackers without replacing their domain logic.

Architectural direction:

> existing authoritative local domain state + new local planning entities → Planning Hub / Quick Capture / derived Progress and Timeline surfaces

The run is intentionally implementation-heavy and validation-light. The hardening campaign that follows owns production-grade proof.

## 2. Existing architecture to preserve

- Six primary sections remain Overview, Todos, Habits, Focus, Workout, Calories.
- SQLite remains local source of truth.
- Existing canonical feature APIs remain authoritative for Todo/Habit/Calorie mutations.
- Weekly Review remains a separate guided modal and historical review store.
- Command Center remains a separate global overlay.
- Account owner binding remains the authority for populated-device safety.
- Existing Backup/Restore/Portable contracts are not broadened during this wave.

## 3. New feature modules

Preferred structure:

```text
features/projects/
  projects.types.ts
  projects.domain.ts
  projects.data.ts
  ProjectListView.tsx
  ProjectDetailView.tsx

features/goals/
  goals.types.ts
  goals.domain.ts
  goals.data.ts
  GoalListView.tsx
  GoalDetailView.tsx

features/daily-plan/
  dailyPlan.types.ts
  dailyPlan.domain.ts
  dailyPlan.data.ts
  DailyPlanView.tsx

features/planning-hub/
  PlanningHubScreen.tsx
  PlanningHubTabs.tsx

features/quick-capture/
  QuickCaptureOverlay.tsx
  quickCapture.domain.ts

features/activity/
  activityTimeline.types.ts
  activityTimeline.data.ts
  activityTimeline.domain.ts
  ActivityTimelineView.tsx

features/progress/
  progress.types.ts
  progress.summary.ts
  progress.domain.ts
  ProgressInsightsView.tsx
```

Exact decomposition may vary to match current repository conventions. Keep DB access out of pure domain files.

## 4. Local schema

The implementation agent must inspect the actual highest applied migration in `core/db/client.ts` and append the next version.

### projects

Suggested local schema:

```text
projects
  id TEXT PRIMARY KEY
  name TEXT NOT NULL
  description TEXT
  color TEXT NOT NULL
  status TEXT NOT NULL
  target_date TEXT
  sort_order INTEGER NOT NULL DEFAULT 0
  created_at TEXT NOT NULL
  updated_at TEXT NOT NULL
  deleted_at TEXT
```

Indexes:

- active/status ordering as useful;
- target date if query design needs it.

### goals

```text
goals
  id TEXT PRIMARY KEY
  project_id TEXT
  title TEXT NOT NULL
  description TEXT
  horizon TEXT NOT NULL
  target_date TEXT
  status TEXT NOT NULL
  progress_percent INTEGER NOT NULL DEFAULT 0
  created_at TEXT NOT NULL
  updated_at TEXT NOT NULL
  deleted_at TEXT
```

V1 progress is user-controlled 0–100. Display linked Todo/Habit counts separately.

### daily_plans

```text
daily_plans
  id TEXT PRIMARY KEY
  date_key TEXT NOT NULL UNIQUE
  intention TEXT NOT NULL DEFAULT ''
  top_todo_ids TEXT NOT NULL DEFAULT '[]'
  focus_target_minutes INTEGER NOT NULL DEFAULT 0
  notes TEXT NOT NULL DEFAULT ''
  reflection TEXT NOT NULL DEFAULT ''
  energy_score INTEGER
  status TEXT NOT NULL DEFAULT 'draft'
  created_at TEXT NOT NULL
  updated_at TEXT NOT NULL
  deleted_at TEXT
```

Use repository local-date helpers. `date_key` is `YYYY-MM-DD` local calendar semantics.

### Todo/Habit organization links

Add nullable columns where practical:

```text
todos.project_id
todos.goal_id
habits.project_id
habits.goal_id
```

No destructive backfill. Existing records remain null.

## 5. Local ownership safety

Add `projects`, `goals`, and `daily_plans` to `ACCOUNT_USER_TABLES` or the actual current equivalent.

A device with any of these rows is populated for account-switch/recovery safety.

Do not create a second emptiness definition.

## 6. Projects behavior

### Create/edit

Fields:

- name required, bounded;
- description optional;
- color from existing theme-safe palette or simple validated string;
- status;
- target date optional.

### Project list

Show:

- active/paused/completed grouping or filter;
- Todo pending/completed counts;
- Habit count;
- Goal count;
- target date when present.

### Project detail

Show associated:

- Goals;
- Todos;
- Habits.

Allow basic reassignment/remove-association actions.

Project completion does not automatically complete children.

## 7. Goals behavior

Fields:

- title required;
- optional Project;
- horizon;
- optional target date;
- manual progress 0–100;
- status.

Goal detail shows linked Todos/Habits and manual progress.

Completing a Goal does not automatically mutate linked items.

## 8. Daily Plan behavior

One plan per local date.

### Today view

Show:

- local date;
- intention;
- candidate pending Todos ranked using existing priority/due semantics;
- up to three selected top priorities;
- scheduled Habits summary;
- focus-minute target;
- notes.

### End-of-day section

Allow:

- reflection;
- energy score 1–5;
- mark plan completed.

Completing a Daily Plan does not complete selected Todos automatically.

### Historical dates

V1 may show recent plans read-only or lightly editable if straightforward. Today is the primary interaction.

## 9. Planning Hub shell

Add navigation-provider state for a new modal/drawer, not a seventh top tab.

Recommended API:

```ts
openPlanningHub(initialView?: 'today' | 'projects' | 'goals' | 'progress' | 'timeline')
closePlanningHub()
```

Internal segmented/tab control switches views without app-section navigation.

Overview header/hero should expose compact entry points such as:

- Plan Today;
- Progress;
- Weekly Review remains available.

Avoid overcrowding the Overview cards.

## 10. Quick Capture shell

Add a global launcher that remains available across the primary sections, positioned so it does not obstruct tab navigation or platform safe areas.

Modes:

### Todo

Reuse canonical Todo create path. Minimum fields:

- title;
- optional due date;
- priority;
- optional Project/Goal.

### Habit

Reuse canonical Habit create path. Minimum fields:

- name;
- target;
- category;
- optional Project/Goal.

### Calorie

Reuse canonical calorie log path with the existing required numeric fields and meal type.

### Project / Goal

Use the new local data-layer APIs.

### Focus

Close overlay and navigate to existing Focus section. Do not duplicate timer state.

## 11. Activity Timeline

Build from bounded queries rather than writing an event-sourcing system.

Normalized view model:

```ts
type ActivityTimelineItem = {
  id: string;
  occurredAt: string;
  dateKey: string;
  category: 'productivity' | 'health' | 'planning';
  source: 'todo' | 'habit' | 'focus' | 'workout' | 'calories' | 'weekly_review' | 'daily_plan' | 'project' | 'goal';
  title: string;
  subtitle?: string;
  icon: string;
};
```

Guidelines:

- completed Todos use a reliable completion/update timestamp available in current schema; if no exact completion timestamp exists, represent conservatively and document approximation for hardening;
- Habit completions use their authoritative date/time facts;
- Focus sessions use ended/started timestamps;
- Workout logs use completed timestamp;
- Calories should aggregate by meal/day if individual entries overwhelm the feed;
- planning items include Weekly Review/Daily Plan completion;
- Projects/Goals may show creation/completion based on available timestamps.

Do not fabricate precision not present in the schema.

## 12. Progress summary

Default comparison:

- current local 7-day inclusive window;
- immediately preceding 7-day window.

Cards:

- Todo completions/count;
- Habit scheduled/completed or consistency facts using current Habit domain semantics;
- Focus minutes/sessions;
- Workout sessions;
- days with calorie logging and current calorie goal context;
- Weekly Review completion state;
- active Projects;
- active Goals and average/manual progress context.

Avoid a single opaque score.

Use bounded range queries where existing data APIs permit. If an existing API requires a wider scan, implement the simplest working version tonight and record the performance debt for hardening.

## 13. Overview integration

Keep existing cards intact as much as possible.

Add a compact planning action row/header entry:

- Plan Today;
- Progress;
- Quick Capture may have its own global launcher;
- Weekly Review remains present.

Today's selected top priorities may appear in a compact Overview card/section if implementation remains straightforward.

## 14. Existing Todo/Habit screens

Where practical without redesigning entire forms:

- show Project/Goal badges/labels;
- allow filtering by Project;
- expose association selectors in create/edit surfaces.

If some association UI becomes a blocker, prioritize full association editing in Planning Hub and record the legacy-form polish for hardening rather than stopping the entire wave.

## 15. Validation and input bounds

Implement sensible runtime/domain bounds even in the implementation wave:

- Project/Goal names/titles non-empty and bounded;
- descriptions/notes/reflections bounded;
- progress 0–100;
- focus target >= 0 with a generous max;
- top priorities max 3 unique IDs;
- energy score null or integer 1–5;
- statuses/horizons validated from closed unions.

Do not add arbitrary JSON execution or SQL construction.

## 16. Backup/sync/portable boundary for this wave

This is a deliberate temporary architecture boundary.

### Must do tonight

- local SQLite persistence;
- local user-data ownership/emptiness inventory;
- normal local UI/domain functionality.

### Must NOT do tonight

- add `projects`, `goals`, or `daily_plans` to `BACKUP_ENTITIES`;
- create/deploy Supabase tables;
- enqueue them into remote sync;
- extend Restore V2;
- extend Portable Backup;
- claim cloud completeness for them.

The next hardening campaign owns all of those together.

## 17. Implementation-run validation policy

No baseline validation before coding.

Do not run these during the wave unless a specific blocker requires them:

- `npm test`;
- `npm run qa:fast`;
- `npm run qa:integration`;
- `npm run e2e:*`;
- `npm run qa:simulation`;
- native QA;
- full web builds;
- Supabase deployment/advisors.

At the end only, run the minimal gates:

```bash
npm run typecheck
npm run lint
npm run openspec:validate
npm run agent:plan:validate:all
git diff --check
```

If time remains, run tiny focused tests for newly introduced pure-domain utilities only. Do not start a broad regression cycle.

## 18. Commit/push strategy

Prefer coherent implementation commits locally but **push once near the end** to avoid repeatedly triggering long GitHub CI during the overnight coding run.

Do not wait for GitHub Actions to finish. Record the run URL/status if immediately available, then stop.

The next hardening campaign will inspect GitHub CI and repair all regressions.

## 19. Hardening handoff requirements

The final implementation report must list:

- exact files/modules implemented;
- local schema version/migration added;
- feature slices completed/partial;
- any shortcuts/known debt;
- any compile/lint issues remaining;
- whether CI was pending/red/green when observed;
- explicit unvalidated areas: backup, portable, Supabase, E2E, simulation, native, migration torture, accessibility, performance.

The report must end with:

`PRODUCTIVITY EXPANSION WAVE V1: IMPLEMENTATION COMPLETE — HARDENING REQUIRED`

unless a major implementation blocker prevented meaningful completion.
