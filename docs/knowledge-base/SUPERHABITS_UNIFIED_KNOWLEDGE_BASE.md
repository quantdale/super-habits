# SuperHabits — Unified Knowledge Base

> Generated from: `00_INDEX.md`, `01_APP_ROUTING.md`, `01_ARCHITECTURE.md`,
> `02_CORE_INFRA.md`, `02_DATABASE.md`, `03_LIB_SHARED.md`, `03_FEATURES.md`,
> `04_FEATURES.md`, `04_UI_DESIGN_SYSTEM.md`, `05_QA_AND_TOOLING.md`,
> `05_TESTING.md`, `06_CURSOR_WORKFLOW.md`, `06_EDITOR_AND_DOCS.md`,
> `07_INVARIANTS_AND_CONSTRAINTS.md`, `08_FEATURE_ROADMAP.md`, `KNOWLEDGE_BASE.md`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Repository Identity & Directory Structure](#2-repository-identity--directory-structure)
3. [Tech Stack & Dependencies](#3-tech-stack--dependencies)
4. [Routing & Navigation](#4-routing--navigation)
5. [Database](#5-database)
6. [Core Infrastructure](#6-core-infrastructure)
7. [Shared Libraries](#7-shared-libraries)
8. [Features](#8-features)
9. [UI Design System](#9-ui-design-system)
10. [Testing](#10-testing)
11. [Cursor Workflow](#11-cursor-workflow)
12. [Invariants & Constraints](#12-invariants--constraints)
13. [Feature Roadmap & Design Decisions](#13-feature-roadmap--design-decisions)
14. [Glossary](#14-glossary)

---

## 1. Executive Summary

**SuperHabits** is an **offline-first** **React Native** app (**Expo 55**, **TypeScript 5.9**, **expo-router**) targeting **web (PWA)**, **iOS**, and **Android**. Five MVP areas: **todos**, **habits** (daily completion counts per local date key), **Pomodoro** (focus timer with session log), **workout** routines + session logs, **calories** (macro-derived kcal).

**Persistence:** SQLite via `expo-sqlite` (`superhabits.db`), singleton `getDatabase()`. DDL from `bootstrapStatements` in `core/db/client.ts` plus versioned migrations. Schema stored version: **9**. Next migration: `if (version < 10)`.

**Sync:** `syncEngine.enqueue` after writes on todos, habits, calorie_entries, workout_routines. `flush()` runs on interval/visibility/NetInfo **only if** `isRemoteEnabled()` (`lib/supabase.ts`); default **disabled** — queue grows in memory with `NoopSyncAdapter` until remote enabled.

**UI:** NativeWind + `core/ui` primitives; custom top tab bar in `app/(tabs)/_layout.tsx`.

**Quality:** **141** Vitest tests (domain + lib + validation). CI: typecheck then test on Node 20.

### Cross-cutting concerns

| Concern | Where | Behavior |
|---------|-------|----------|
| Navigation | `app/_layout.tsx`, `app/(tabs)/_layout.tsx` | Stack → `AppProviders`; `Tabs` + `TabTrigger` + `TabSlot` |
| Database | `core/db/client.ts` | Bootstrap DDL + migrations; `getDatabase` / `initializeDatabase` |
| Types | `core/db/types.ts` | Entity TypeScript shapes |
| IDs & time | `lib/id.ts`, `lib/time.ts` | `createId`, `nowIso`, `toDateKey` (local calendar) |
| Sync | `core/sync/sync.engine.ts` | In-memory queue; `flush` → adapter.push; noop default |
| Bootstrap | `core/providers/AppProviders.tsx` | DB init, SW register, guest profile; second effect flushes sync when remote on |
| PWA | `registerServiceWorker.ts`, `public/sw.js` | Workbox registration; cache-first GET handler |
| Styling | `tailwind.config.js`, `global.css` | Section palette + brand scale; NativeWind |

---

## 2. Repository Identity & Directory Structure

### Repository identity

| Attribute | Value |
|-----------|-------|
| Name | `superhabits` (npm package, private) |
| Purpose | Offline-first Expo + React Native client; five modules |
| Entry | `package.json` → `"main": "expo-router/entry"` |
| Schema version (stored) | **9** (`app_meta.db_schema_version`) |
| Next migration | `10` (new `if (version < 10)` block in `runMigrations`) |
| Unit tests | **141** passing (Vitest) |
| E2E tests | **~59** Playwright tests (Chromium), `workers: 1` |

### Top-level directory map

| Path | Role |
|------|------|
| `app/` | Expo Router routes: root layout, index redirect, `(tabs)` layout + thin tab route files |
| `assets/` | Icons, splash, favicon (referenced from `app.json`) |
| `constants/` | Shared design tokens (section colors) |
| `core/` | DB singleton, types, sync engine, guest profile, `AppProviders`, PWA registration, shared `ui/` |
| `features/` | Feature modules: `{name}.data.ts`, `{name}Screen.tsx`, optional `{name}.domain.ts`, `types.ts` re-exports |
| `lib/` | Pure utilities: `id`, `time`, `validation`, `notifications`, `supabase` (remote stub), `horizontalScrollViewportStyle` |
| `public/` | Web static assets; `sw.js` service worker |
| `tests/` | Vitest unit tests (domain-focused; one skipped data stub) |
| `e2e/` | Playwright specs + helpers |
| `patches/` | `patch-package` overrides for `node_modules` |
| `.github/workflows/` | CI (`ci.yml`) |
| `.devcontainer/` | VS Code Dev Container (Node image, port 8081) |
| `.cursor/` | Rules, agents, commands, skills |
| `docs/knowledge-base/` | This documentation set |

**Not present:** Backend API server, Docker deploy config, monorepo workspaces.

### Complete file inventory

#### `app/` (8 files)

| File | Role |
|------|------|
| `_layout.tsx` | Root stack; `AppProviders`, `StatusBar`, hides header |
| `index.tsx` | Redirect to `/(tabs)/todos` |
| `(tabs)/_layout.tsx` | Top tab bar, `TabList` / `TabTrigger` / `TabSlot` |
| `(tabs)/todos.tsx` | Renders `TodosScreen` |
| `(tabs)/habits.tsx` | Renders `HabitsScreen` |
| `(tabs)/pomodoro.tsx` | Renders `PomodoroScreen` |
| `(tabs)/workout.tsx` | Renders `WorkoutScreen` |
| `(tabs)/calories.tsx` | Renders `CaloriesScreen` |

#### `features/` (unique source files)

**todos:** `TodosScreen.tsx`, `TodoItem.tsx`, `DueDateBadge.tsx`, `PriorityBadge.tsx`, `todos.data.ts`, `todos.domain.ts`, `types.ts`

**habits:** `HabitsScreen.tsx`, `HabitCircle.tsx`, `HabitHeatmap.tsx`, `HabitsOverviewGrid.tsx`, `ProgressRing.tsx`, `habitPresets.ts`, `habits.data.ts`, `habits.domain.ts`, `types.ts`

**calories:** `CaloriesScreen.tsx`, `MacroDonutChart.tsx`, `WeeklyCalorieChart.tsx`, `CalorieGoalSheet.tsx`, `SavedMealChips.tsx`, `SavedMealSearchSheet.tsx`, `calories.data.ts`, `calories.domain.ts`, `types.ts`

**pomodoro:** `PomodoroScreen.tsx`, `FocusSprout.tsx`, `GardenGrid.tsx`, `BackgroundWarning.tsx`, `PomodoroSettingsInline.tsx`, `pomodoro.data.ts`, `pomodoro.domain.ts`, `types.ts`

**workout:** `WorkoutScreen.tsx`, `RoutineDetailScreen.tsx`, `WorkoutSessionScreen.tsx`, `workout.data.ts`, `workout.domain.ts`, `types.ts`

**shared:** `GitHubHeatmap.tsx`, `ActivityPreviewStrip.tsx`

#### `core/` (21 logical paths)

| Path | Role |
|------|------|
| `db/client.ts` | Singleton DB, bootstrap DDL, `runMigrations` |
| `db/types.ts` | Entity TypeScript types |
| `db/schema.sql` | Reference only (not executed at runtime) |
| `db/migrations/001_initial_supabase.sql` | Reference / future Supabase |
| `sync/sync.engine.ts` | `SyncRecord`, `SyncAdapter`, `NoopSyncAdapter`, `SyncEngine`, `syncEngine` singleton |
| `auth/guestProfile.ts` | `ensureGuestProfile` → `app_meta.guest_profile` |
| `providers/AppProviders.tsx` | DB init, SW, guest profile, React Query, NetInfo/interval sync flush |
| `pwa/registerServiceWorker.ts` | Workbox `/sw.js` on web |
| `ui/Card.tsx` | Card shell + optional left accent strip |
| `ui/Screen.tsx` | `SafeAreaView` + scroll/fill |
| `ui/Button.tsx` | Primary / ghost / danger |
| `ui/TextField.tsx` | Labeled input; optional unsigned integer |
| `ui/PillChip.tsx` | Pill selector |
| `ui/ValidationError.tsx` | Inline error banner |
| `ui/SectionTitle.tsx` | Title + subtitle |
| `ui/NumberStepperField.tsx` | Numeric stepper + text field |
| `ui/SwipeRightActions.tsx` | Edit/Delete swipe actions |
| `ui/HorizontalScrollArea.tsx` | Horizontal scroll; web div vs native `ScrollView`; `scrollToEnd` ref |

#### `lib/` (8 paths)

| File | Role |
|------|------|
| `time.ts` | `nowIso`, `toDateKey`, date range builders |
| `id.ts` | `createId(prefix)` |
| `validation.ts` | Form validation pure functions |
| `supabase.ts` | `RemoteMode`, `isRemoteEnabled` stub |
| `notifications.ts` | Expo notifications for Pomodoro |
| `horizontalScrollViewportStyle.ts` | RN horizontal scroll layout constants |

#### `constants/`

| File | Role |
|------|------|
| `sectionColors.ts` | `SECTION_COLORS`, `SECTION_COLORS_LIGHT`, `SectionKey` |

#### `tests/` (8 files)

| File | Role |
|------|------|
| `time.test.ts` | `lib/time` |
| `validation.test.ts` | `lib/validation` |
| `todos.domain.test.ts` | `todos.domain` |
| `habits.domain.test.ts` | `habits.domain` |
| `calories.domain.test.ts` | `calories.domain` |
| `calories.data.STUB.test.ts` | Skipped placeholder |
| `workout.domain.test.ts` | `workout.domain` |
| `pomodoro.domain.test.ts` | `pomodoro.domain` |

#### `e2e/` (16 files)

| File | Role |
|------|------|
| `todos.spec.ts` | Todos flows |
| `habits.spec.ts` | Habits flows |
| `calories.spec.ts` | Calories flows |
| `pomodoro.spec.ts` | Pomodoro flows |
| `workout.spec.ts` | Workout flows |
| `infrastructure.spec.ts` | COEP/COOP, SW, OPFS, DB |
| `boundary.spec.ts` | Stress / boundary cases |
| `global.setup.ts` | `crossOriginIsolated` gate |
| `global.teardown.ts` | No-op placeholder |
| `helpers/navigation.ts` | `goToTab`, `hardReload`, `waitForDb` |
| `helpers/db.ts` | `clearDatabase` (OPFS) |
| `helpers/forms.ts` | `fillRoutineName`, `fillCaloriesMacros` |
| `helpers/gestures.ts` | Swipe helpers for RN Web |
| `README.md` | E2E notes |

### Layering rules (strict)

#### Allowed dependency direction

1. **`app/`** → `core/providers`, `features/*Screen`, expo-router only in layouts
2. **`features/*Screen.tsx`** → `features/*.data.ts`, `features/*.domain.ts`, `core/ui`, `constants`, `lib` (validation, time where needed), `features/shared` for cross-feature UI types/components
3. **`features/*.data.ts`** → `core/db/client`, `core/db/types`, `core/sync/sync.engine`, `lib/id`, `lib/time`, `lib/validation` (workout sets), and **may import domain pure functions** (e.g. `calories.data` → `kcalFromMacros`; `todos.data` → `getTomorrowDateKey`)
4. **`features/*.domain.ts`** → **no** `getDatabase`, **no** React; may import `lib/time`, `constants/sectionColors`, `features/shared` **types** and other domain-friendly modules
5. **`core/ui`** → React Native, NativeWind; may import `lib/horizontalScrollViewportStyle`
6. **`core/db/client`** → expo-sqlite, Platform; no feature imports
7. **`lib/`** → no feature imports, no DB

#### Violations (do not do)

- Import `getDatabase` inside `*Screen.tsx` or `*.domain.ts`
- Call `syncEngine.enqueue` from UI components instead of data layer
- Use `DELETE FROM` on main entity tables from screens

#### Import graph (high level)

```
app → AppProviders → core/db, sync, auth, lib/supabase
app/(tabs)/* → features/*Screen
features/*Screen → features/*.data, *.domain, core/ui, constants, lib/validation
features/*.data → core/db, core/sync, lib/id, lib/time, (optional) features/*.domain
features/*.domain → lib/time, constants, features/shared (types/components as needed)
core/ui → react-native, nativewind, lib/horizontalScrollViewportStyle
```

### Module boundaries

| Area | Contents | Rationale |
|------|----------|-----------|
| `core/` | DB singleton, sync engine, shared UI primitives, PWA hook, guest profile | Cross-cutting infrastructure |
| `features/` | Product modules with clear data/domain/UI split | Scalable MVP boundaries |
| `lib/` | Small pure or platform helpers used everywhere | Reuse without circular deps |
| `constants/` | Visual / marketing color semantics | Single source for section identity |

### Naming conventions

| Kind | Pattern | Examples |
|------|---------|----------|
| Source utilities | camelCase | `todos.data.ts`, `guestProfile.ts` |
| React components | PascalCase | `TodosScreen.tsx`, `GitHubHeatmap.tsx` |
| Screens | `{Feature}Screen.tsx` | `CaloriesScreen.tsx` |
| Data layer | `{feature}.data.ts` | `workout.data.ts` |
| Domain layer | `{feature}.domain.ts` | `pomodoro.domain.ts` |
| Feature types barrel | `types.ts` | Re-exports + narrow aliases |
| Tests | `{area}.test.ts` or `{feature}.domain.test.ts` | `habits.domain.test.ts` |
| Functions | verb phrases | `listTodos`, `buildTimerSequence` |
| Types | PascalCase | `Todo`, `PomodoroSettings`, `HeatmapDay` |

### Cross-feature interaction map

#### `toDateKey()` (`lib/time.ts`)

| Consumer | Call pattern | Column / effect |
|----------|--------------|-----------------|
| `features/habits/habits.data.ts` | Default arg on `incrementHabit`, `decrementHabit`, `getHabitCountByDate` | `habit_completions.date_key` |
| `features/calories/calories.data.ts` | Default on `listCalorieEntries`; `addCalorieEntry` uses `input.consumedOn ?? toDateKey()` | `calorie_entries.consumed_on` |

No other features call `toDateKey()` directly.

#### `syncEngine.enqueue()` usage

| File | Entity string | Operations | Notes |
|------|---------------|------------|-------|
| `features/todos/todos.data.ts` | `todos` | create, update, delete | After every mutating write |
| `features/habits/habits.data.ts` | `habits` | create, update, delete | Completions **not** enqueued |
| `features/calories/calories.data.ts` | `calorie_entries` | create, delete | |
| `features/workout/workout.data.ts` | `workout_routines` | create, delete; `markWorkoutRoutineUpdated` after nested changes | `completeRoutine` logs **not** enqueued |

**Intentionally not synced:** `pomodoro_sessions`, `workout_logs`, `habit_completions`, `saved_meals`, `workout_session_exercises`

#### `useFocusEffect` usage

| Screen | Purpose |
|--------|---------|
| `TodosScreen` | `listTodos` → `setItems` on tab focus |
| `HabitsScreen` | `refresh` (habits + completion map) |
| `WorkoutScreen` | `refresh` (routines + logs) |
| `CaloriesScreen` | `refresh` (entries for current date key) |

`PomodoroScreen` — not used; history loaded via `useEffect` on `historyVersion` only.

---

## 3. Tech Stack & Dependencies

### Core framework & runtime

| Package | Version | Purpose |
|---------|---------|---------|
| `expo` | ~55.0.5 | Expo SDK, tooling, native modules |
| `expo-router` | ^55.0.4 | File-based navigation, tabs, stacks |
| `react` | 19.2.0 | UI library |
| `react-dom` | 19.2.0 | Web rendering |
| `react-native` | 0.83.2 | Cross-platform UI primitives |
| `react-native-web` | ^0.21.0 | RN → DOM bridge |
| `expo-status-bar` | ~55.0.4 | Status bar styling |
| `@expo/metro-runtime` | ~55.0.6 (dev) | Metro web runtime |

### UI & styling

| Package | Version | Purpose |
|---------|---------|---------|
| `nativewind` | ^4.2.2 | Tailwind-style `className` on RN |
| `tailwindcss` | ^3.4.19 | Tailwind compiler |
| `@expo/vector-icons` | ^15.0.2 | Icons (MaterialIcons, etc.) |
| `expo-linear-gradient` | ~55.0.9 | Gradients (installed) |
| `react-native-safe-area-context` | ~5.6.2 | Safe areas |
| `react-native-screens` | ~4.23.0 | Native screen containers |
| `react-native-gesture-handler` | ^2.30.0 | Gestures, Swipeable |
| `react-native-reanimated` | 4.2.1 | Animations |
| `react-native-svg` | 15.15.3 | SVG (charts, sprout) |
| `@shopify/flash-list` | 2.0.2 | High-performance lists |
| `react-native-draggable-flatlist` | ^4.0.3 | Reorderable todo list |
| `react-native-gifted-charts` | ^1.4.76 | Bar/pie charts (calories) |
| `@react-native-community/datetimepicker` | ^9.1.0 | Native date picker (non-web todos) |

### Database & files

| Package | Version | Purpose |
|---------|---------|---------|
| `expo-sqlite` | ^55.0.10 | SQLite (native + WASM web, OPFS) |
| `expo-file-system` | ^55.0.10 | File APIs |

### Notifications & background

| Package | Version | Purpose |
|---------|---------|---------|
| `expo-notifications` | ^55.0.11 | Local notifications (Pomodoro; not web) |
| `expo-background-fetch` | ^55.0.9 | Installed; **intentionally unused** |
| `expo-task-manager` | ^55.0.9 | Installed; **intentionally unused** |

### Networking & sync prep

| Package | Version | Purpose |
|---------|---------|---------|
| `@react-native-community/netinfo` | 11.5.2 | Connectivity; triggers `syncEngine.flush` when remote enabled |

### State / data fetching (installed, dormant)

| Package | Version | Purpose |
|---------|---------|---------|
| `@tanstack/react-query` | ^5.90.21 | `QueryClient` in `AppProviders`; **no feature hooks** |
| `zustand` | ^5.0.11 | Reserved; **not wired** |
| `date-fns` | ^4.1.0 | Listed; **not imported** in app source |

### IDs & PWA

| Package | Version | Purpose |
|---------|---------|---------|
| `uuid` | ^13.0.0 | Installed; IDs use `createId()` in `lib/id.ts`, **not uuid** |
| `workbox-window` | ^7.4.0 | Service worker registration helper |

### Testing & tooling

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ~5.9.2 | Typecheck |
| `vitest` | ^3.2.4 | Unit tests |
| `@playwright/test` | ^1.58.2 | E2E (Chromium) |
| `babel-preset-expo` | ^55.0.10 | Babel |
| `cross-env` | ^10.1.0 | `EXPO_UNSTABLE_HEADLESS` for web script |
| `patch-package` | ^8.0.1 | Post-install patches |
| `wait-on` | ^9.0.4 | CI wait for Metro |

### MCP servers (developer environment, not npm)

| MCP | Package | Purpose |
|-----|---------|---------|
| playwright | `@playwright/mcp@latest` | Live browser inspection, E2E debugging |
| lighthouse | `@danielsogl/lighthouse-mcp@latest` | Performance audits, PWA checklist |
| fetch | `mcp-server-fetch` (pip) | HTTP response headers, endpoint inspection |
| github | PAT-based | CI, PR comments, Bugbot in deep pre-pr |
| context7 | Upstash | Up-to-date library docs |
| snyk | plugin | Dependency vulnerability scanning |
| cursor-ide-browser | — | Navigate/interact (separate from Playwright MCP) |

---

## 4. Routing & Navigation

### Entry points

| Entry | File | Behavior |
|-------|------|----------|
| npm `main` | `package.json` → `"expo-router/entry"` | Expo Router bootstraps `app/` tree |
| Root layout | `app/_layout.tsx` | Imports `@/global.css`; wraps tree in `AppProviders`; `StatusBar style="dark"`; `Stack` with `headerShown: false` |
| Index | `app/index.tsx` | `<Redirect href="/(tabs)/todos" />` — `/` → todos tab |
| Tabs layout | `app/(tabs)/_layout.tsx` | Custom top tab bar |
| Tab routes | `app/(tabs)/{todos,habits,pomodoro,workout,calories}.tsx` | Each renders one `*Screen` from `features/` |

### `app/_layout.tsx`

- Imports: `@/global.css`, `expo-router` `Stack`, `expo-status-bar` `StatusBar`, `@/core/providers/AppProviders`
- Renders: `AppProviders` → `StatusBar` → `Stack` with one screen `(tabs)`, headers hidden

### `app/(tabs)/_layout.tsx` — top tab bar

#### Constants

| Name | Value | Role |
|------|-------|------|
| `TAB_CONTENT_SURFACE` | `#f8f7ff` | Active tab + content background |
| `TAB_RAIL_BG` | `#eeecf8` | Inactive tab + rail background |
| `TAB_RAIL_BORDER` | `#d4d0ee` | Rail border color |

#### `NAV_ITEMS` (exact)

| `name` | `href` | `label` | `icon` | `color` |
|--------|--------|---------|--------|---------|
| `todos` | `"/(tabs)/todos"` | To Do | `check-circle-outline` | `SECTION_COLORS.todos` |
| `habits` | `"/(tabs)/habits"` | Habits | `loop` | `SECTION_COLORS.habits` |
| `pomodoro` | `"/(tabs)/pomodoro"` | Focus | `timer` | `SECTION_COLORS.focus` |
| `workout` | `"/(tabs)/workout"` | Workout | `fitness-center` | `SECTION_COLORS.workout` |
| `calories` | `"/(tabs)/calories"` | Calories | `restaurant-menu` | `SECTION_COLORS.calories` |

#### `TopTabItem` styles

**Active:** `backgroundColor TAB_CONTENT_SURFACE`, `borderBottomWidth 0`, `marginTop 0`, top radii `8`, `paddingVertical 10`, `paddingHorizontal 4`, `gap 5`, `flexDirection row`, icon `16px`, label `fontSize 12`, `fontWeight 600`, color = section color.

**Inactive:** `backgroundColor TAB_RAIL_BG`, `borderBottomWidth 1`, `borderColor TAB_RAIL_BORDER`, `marginTop 3`, icon/label `#94a3b8`, `fontWeight 400`.

**TabList:** `flexDirection row`, `width 100%`, `alignItems stretch`, rail bg/border, `paddingHorizontal 4`, `paddingTop 4`, `gap 2`, `zIndex 10`.

**TabSlot:** `flex 1`, `backgroundColor TAB_CONTENT_SURFACE`.

**Connected tab illusion:** Active tab shares same bg as content surface (`#f8f7ff`) while rail stays `#eeecf8`; active item loses bottom border and sits flush with content.

#### Tab route files (thin wrappers)

Each file: import `*Screen` from `@/features/...`; default export returns `<XxxScreen />` only. No local state, no data hooks — routing only.

### Client navigation surface

| Path | Screen |
|------|--------|
| `/` | Redirect → `/(tabs)/todos` |
| `/(tabs)/todos` | Todos |
| `/(tabs)/habits` | Habits |
| `/(tabs)/pomodoro` | Pomodoro |
| `/(tabs)/workout` | Workout |
| `/(tabs)/calories` | Calories |

---

## 5. Database

### Schema version

Current `app_meta.db_schema_version`: **9**. Next migration: `if (version < 10)` in `runMigrations()`.

### Bootstrap DDL (verbatim)

Executed via `openAndBootstrap()`. WAL pragma on native only (`Platform.OS !== "web"`).

#### `todos`
```sql
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
```

#### `habits`
```sql
CREATE TABLE IF NOT EXISTS habits (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  target_per_day INTEGER NOT NULL DEFAULT 1,
  reminder_time TEXT,
  category TEXT NOT NULL DEFAULT 'anytime',
  icon TEXT NOT NULL DEFAULT 'check-circle',
  color TEXT NOT NULL DEFAULT '#64748b',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
```

#### `habit_completions`
```sql
CREATE TABLE IF NOT EXISTS habit_completions (
  id TEXT PRIMARY KEY NOT NULL,
  habit_id TEXT NOT NULL,
  date_key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(habit_id, date_key)
);
```

#### `pomodoro_sessions`
```sql
CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  session_type TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

#### `workout_routines`
```sql
CREATE TABLE IF NOT EXISTS workout_routines (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
```

#### `workout_logs`
```sql
CREATE TABLE IF NOT EXISTS workout_logs (
  id TEXT PRIMARY KEY NOT NULL,
  routine_id TEXT NOT NULL,
  notes TEXT,
  completed_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

#### `calorie_entries`
```sql
CREATE TABLE IF NOT EXISTS calorie_entries (
  id TEXT PRIMARY KEY NOT NULL,
  food_name TEXT NOT NULL,
  calories INTEGER NOT NULL,
  protein REAL NOT NULL DEFAULT 0,
  carbs REAL NOT NULL DEFAULT 0,
  fats REAL NOT NULL DEFAULT 0,
  fiber REAL NOT NULL DEFAULT 0,
  meal_type TEXT NOT NULL,
  consumed_on TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
```

#### `app_meta`
```sql
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
```

Bootstrap does not create indexes except those inside migration blocks.

### Migration history (`runMigrations`)

Version is read via `SELECT value FROM app_meta WHERE key = 'db_schema_version'`. Missing row → version `0`.

#### version < 2
- `ALTER TABLE habits ADD COLUMN category TEXT NOT NULL DEFAULT 'anytime'` (try/catch)
- **Why:** Time-of-day grouping for habits
- Sets `db_schema_version` = `2`

#### version < 3
- `ALTER TABLE habits ADD COLUMN icon ...`, `ALTER TABLE habits ADD COLUMN color ...` (try/catch each)
- **Why:** Habit personalization
- Sets `db_schema_version` = `3`

#### version < 4
- `ALTER TABLE calorie_entries ADD COLUMN fiber REAL NOT NULL DEFAULT 0` (try/catch)
- **Why:** Track fiber macros
- Sets `db_schema_version` = `4`

#### version < 5
No DDL. Inserts metadata only:
```sql
INSERT OR REPLACE INTO app_meta (key, value) VALUES ('date_key_format', 'local')
INSERT OR REPLACE INTO app_meta (key, value) VALUES ('date_key_cutover', ?)  -- cutoverIso = new Date().toISOString()
INSERT OR REPLACE INTO app_meta (key, value) VALUES ('db_schema_version', '5')
```
- **Why:** Record UTC → local calendar `date_key` semantics. Rows before cutover may use UTC keys. No backfill.

#### version < 6
DDL (try/catch each):
- `ALTER TABLE todos ADD COLUMN due_date TEXT`
- `ALTER TABLE todos ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal'`
- `ALTER TABLE todos ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`

Data fix:
```sql
UPDATE todos SET sort_order = (
  SELECT COUNT(*) FROM todos t2
  WHERE t2.created_at <= todos.created_at
    AND t2.deleted_at IS NULL
) WHERE deleted_at IS NULL
```
Sets `db_schema_version` = `6`.

#### version < 7
Creates:
```sql
CREATE TABLE IF NOT EXISTS routine_exercises (
  id          TEXT PRIMARY KEY NOT NULL,
  routine_id  TEXT NOT NULL,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);

CREATE TABLE IF NOT EXISTS routine_exercise_sets (
  id              TEXT PRIMARY KEY NOT NULL,
  exercise_id     TEXT NOT NULL,
  set_number      INTEGER NOT NULL,
  active_seconds  INTEGER NOT NULL DEFAULT 40,
  rest_seconds    INTEGER NOT NULL DEFAULT 20,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  deleted_at      TEXT
);

CREATE TABLE IF NOT EXISTS workout_session_exercises (
  id              TEXT PRIMARY KEY NOT NULL,
  log_id          TEXT NOT NULL,
  exercise_name   TEXT NOT NULL,
  sets_completed  INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL
);
```
Sets `db_schema_version` = `7`.

#### version < 8
```sql
CREATE TABLE IF NOT EXISTS saved_meals (
  id          TEXT PRIMARY KEY NOT NULL,
  food_name   TEXT NOT NULL,
  calories    INTEGER NOT NULL,
  protein     REAL NOT NULL DEFAULT 0,
  carbs       REAL NOT NULL DEFAULT 0,
  fats        REAL NOT NULL DEFAULT 0,
  fiber       REAL NOT NULL DEFAULT 0,
  meal_type   TEXT NOT NULL DEFAULT 'breakfast',
  use_count   INTEGER NOT NULL DEFAULT 1,
  last_used_at TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_meals_food_name
ON saved_meals (food_name COLLATE NOCASE);
```
Sets `db_schema_version` = `8`.

#### version < 9
DDL (try/catch each):
- `ALTER TABLE todos ADD COLUMN recurrence TEXT`
- `ALTER TABLE todos ADD COLUMN recurrence_id TEXT`

Sets `db_schema_version` = `9`.

### `core/db/types.ts` — complete type definitions (verbatim)

```ts
export type BaseEntity = {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type TodoPriority = "urgent" | "normal" | "low";

export type TodoRecurrence = "daily" | null;

export type Todo = BaseEntity & {
  title: string;
  notes: string | null;
  completed: 0 | 1;
  due_date: string | null;
  priority: TodoPriority;
  sort_order: number;
  recurrence: TodoRecurrence;
  recurrence_id: string | null;
};

export type HabitCategory = "anytime" | "morning" | "afternoon" | "evening";

export type HabitIcon =
  | "check-circle"
  | "favorite"
  | "local-drink"
  | "menu-book"
  | "fitness-center"
  | "wb-sunny"
  | "bedtime"
  | "self-improvement"
  | "water-drop"
  | "coffee"
  | "psychology"
  | "spa";

export type Habit = BaseEntity & {
  name: string;
  target_per_day: number;
  reminder_time: string | null;
  category: HabitCategory;
  icon: HabitIcon;
  color: string;
};

export type HabitCompletion = {
  id: string;
  habit_id: string;
  date_key: string;
  count: number;
  created_at: string;
  updated_at: string;
};

export type PomodoroSession = {
  id: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  /** Legacy rows may use "break"; new logs use focus / short_break / long_break as needed */
  session_type: "focus" | "break" | "short_break" | "long_break";
  created_at: string;
};

export type WorkoutRoutine = BaseEntity & {
  name: string;
  description: string | null;
};

export type WorkoutLog = {
  id: string;
  routine_id: string;
  notes: string | null;
  completed_at: string;
  created_at: string;
};

export type RoutineExercise = BaseEntity & {
  routine_id: string;
  name: string;
  sort_order: number;
};

export type RoutineExerciseSet = BaseEntity & {
  exercise_id: string;
  set_number: number;
  active_seconds: number;
  rest_seconds: number;
};

export type WorkoutSessionExercise = {
  id: string;
  log_id: string;
  exercise_name: string;
  sets_completed: number;
  created_at: string;
};

export type CalorieEntry = BaseEntity & {
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  consumed_on: string;
};

export type SavedMeal = {
  id: string;
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  meal_type: string;
  use_count: number;
  last_used_at: string;
  created_at: string;
};
```

### `app_meta` keys registry

| Key | Written by | Value shape | Purpose |
|-----|------------|-------------|---------|
| `db_schema_version` | migrations | string integer | Schema version |
| `date_key_format` | migration 5 | `'local'` | Date keys are local calendar |
| `date_key_cutover` | migration 5 | ISO timestamp | When local format was recorded |
| `guest_profile` | `ensureGuestProfile` | JSON `{"id","createdAt"}` | Anonymous profile id |
| `calorie_goal` | `setCalorieGoal` | JSON `CalorieGoal` | Daily calorie + macro targets |
| `pomodoro_settings` | `savePomodoroSettings` | JSON `PomodoroSettings` | Timer durations |

### ID prefix registry

| Prefix | Entity |
|--------|--------|
| `todo` | `todos` |
| `habit` | `habits` |
| `hcmp` | `habit_completions` |
| `cal` | `calorie_entries` |
| `smeal` | `saved_meals` |
| `wrk` | `workout_routines` AND `workout_logs` AND `logWorkoutSession` log id |
| `ex` | `routine_exercises` |
| `eset` | `routine_exercise_sets` |
| `wsex` | `workout_session_exercises` |
| `pom` | `pomodoro_sessions` |
| `guest` | guest profile in `app_meta` |
| `rec` | `todos.recurrence_id` (daily recurrence series) |

`createId` implementation:
```ts
export function createId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${random}`;
}
```

**Properties:** Not cryptographically strong — `Math.random()` is predictable; acceptable for local-only row IDs. Collision risk extremely low for single-device ms + 8 chars.

### Soft delete pattern

**Tables with `deleted_at`:** `todos`, `habits`, `workout_routines`, `routine_exercises`, `routine_exercise_sets`, `calorie_entries`

**Query pattern:** `WHERE deleted_at IS NULL` on all reads and updates targeting active rows.

**Hard delete exceptions (documented):**
1. `habit_completions` — row DELETE when count goes to 0 (toggle-off semantics; not synced)
2. `saved_meals` — `deleteSavedMeal` uses `DELETE FROM saved_meals` (local-only cache)

**Tables without soft delete:** `pomodoro_sessions`, `workout_logs`, `workout_session_exercises`, `habit_completions`, `saved_meals`

---

## 6. Core Infrastructure

### `core/db/client.ts`

#### Module-level state

| Name | Type | Role |
|------|------|------|
| `dbPromise` | `Promise<SQLite.SQLiteDatabase> \| null` | Lazy singleton; reset to `null` on failed open |

#### `getDatabase(): Promise<SQLite.SQLiteDatabase>`

1. If `dbPromise` is null, set `dbPromise = openAndBootstrap().catch((err) => { dbPromise = null; throw err; })`
2. Return `dbPromise`

**Error behavior:** Failed open clears singleton so retry is possible.

#### `initializeDatabase(): Promise<void>`

- `await getDatabase()` — public "ensure ready" hook
- **Callers:** `AppProviders` (mount)

### `core/sync/sync.engine.ts`

#### `SyncRecord` (verbatim)
```ts
export type SyncRecord = {
  entity: string;
  id: string;
  updatedAt: string;
  operation: "create" | "update" | "delete";
};
```

#### `SyncAdapter`
```ts
export interface SyncAdapter {
  push(records: SyncRecord[]): Promise<void>;
  pull(since: string | null): Promise<SyncRecord[]>;
}
```

#### `NoopSyncAdapter`
- `push` — no-op resolve
- `pull` — returns `[]`

#### `SyncEngine`

| Member | Detail |
|--------|--------|
| `private queue: SyncRecord[]` | In-memory FIFO list |
| `constructor(adapter = new NoopSyncAdapter())` | Injectable adapter |

**`enqueue(record: SyncRecord): void`** — pushes `record` onto `this.queue`.

**`async flush(): Promise<void>`:**
1. If `queue.length === 0`, return
2. `snapshot = [...queue]`
3. `await this.adapter.push(snapshot)`
4. `this.queue = []`

**If `adapter.push` throws:** `queue` is NOT cleared — snapshot taken but step 4 not reached; records remain for later flush attempt.

#### Exported `syncEngine`
Singleton: `new SyncEngine()` — default noop adapter.

### `core/auth/guestProfile.ts`

**`ensureGuestProfile(): Promise<GuestProfile>`** (`GuestProfile`: `{ id: string; createdAt: string }`)

1. `getDatabase()`
2. `SELECT value FROM app_meta WHERE key = ?` with `["guest_profile"]`
3. If row exists → `JSON.parse` and return
4. Else: `id = createId("guest")`, `createdAt = new Date().toISOString()`, INSERT, return profile

**Error:** Callers use `.catch(() => undefined)` — swallows errors (silent guest failure).

### `core/providers/AppProviders.tsx`

**`queryClient`:** `new QueryClient()` — default options; no global error/retry customization.

**Effect 1 — bootstrap (deps: `[]`):**

| Order | Call | Error handling |
|-------|------|----------------|
| 1 | `initializeDatabase().catch(...)` | Log only |
| 2 | `registerServiceWorker()` | Fire-and-forget |
| 3 | `ensureGuestProfile().catch(() => undefined)` | Swallowed |

**Effect 2 — sync flush (deps: `[]`):**
1. If `!isRemoteEnabled()` → return early (no listeners)
2. Define `flush`: `void syncEngine.flush().catch(...)`
3. `setInterval(flush, 30_000)`
4. Web only: `visibilitychange` → when hidden, call `flush`
5. `NetInfo.addEventListener`: if connected, call `flush`
6. Cleanup: `clearInterval`, remove visibility listener, `unsubscribeNetInfo()`

**Remote default:** `remoteMode = "disabled"` — flush machinery is off until `setRemoteMode("enabled")` called.

**Tree:** `GestureHandlerRootView` → `QueryClientProvider` → `children`

### `core/pwa/registerServiceWorker.ts`

State: `let registered = false` — prevents double registration.

`registerServiceWorker()`:
1. If `registered` or `Platform.OS !== "web"` → return
2. If no `serviceWorker` in `navigator` → return
3. `new Workbox("/sw.js")`, `wb.register()`, `registered = true`

### `public/sw.js` (service worker)

**Cache name:** `superhabits-shell-v2`

**install:** `caches.open("superhabits-shell-v2")` → `cache.addAll(["/", "/index.html"])` (errors swallowed); `skipWaiting()`

**activate:** `event.waitUntil(self.clients.claim())`

**fetch (GET only):** Cache-first for GET, with network population on miss.

### `core/ui` components

#### `Screen.tsx`

| Prop | Type | Default | Effect |
|------|------|---------|--------|
| `children` | `ReactNode` | — | Content |
| `scroll` | `boolean` | `false` | Wraps in `ScrollView` with `keyboardShouldPersistTaps="always"`, `keyboardDismissMode="on-drag"`, `nestedScrollEnabled` |
| `padded` | `boolean` | `true` | If true: `px-4 py-3`; if false: `flex-1 bg-surface` only |

Outer: `SafeAreaView` with `flex-1 bg-surface`.

#### `Button.tsx`

```ts
type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  color?: string; // overrides primary bg when variant primary
};
```

| Variant | Container classes | Label classes |
|---------|-------------------|---------------|
| primary | `bg-brand-500` (or `color` override) | `text-white` |
| danger | `bg-rose-500` | `text-white` |
| ghost | `bg-slate-200` | `text-slate-900` |

Shared: `rounded-xl px-4 py-3`; disabled `opacity-40`.

#### `Card.tsx`

```ts
type CardProps = {
  children: ReactNode;
  accentColor?: string;
  className?: string;
};
```

- **Border:** `BORDER = "#e8e8f0"` — top/right/bottom: `1`; left: `4` if `accentColor`, else `1`; `borderLeftColor: accentColor ?? BORDER`
- **Shadow:** `shadowColor #000000`, `shadowOffset {0,2}`, `shadowOpacity 0.06`, `shadowRadius 8`, `elevation 2`
- **Inner padding:** `accentColor ? "py-3 pl-2 pr-4" : "px-4 py-3"`

#### `TextField.tsx`

```ts
type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "number-pad";
  unsignedInteger?: boolean;
};
```

`unsignedInteger: true` → `keyboardType = number-pad`; `onChangeText` receives `text.replace(/\D/g, "")`.

#### `SectionTitle.tsx`

```ts
type SectionTitleProps = { title: string; subtitle?: string };
```

#### `NumberStepperField.tsx`

```ts
type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;  // default 1
  max?: number;  // default 999
  placeholder?: string;  // default "1"
};
```

**Clamp logic:** `num = Number(value)`; `validNum = Number.isFinite(num) ? num : min`. Minus: `Math.max(min, validNum - 1)`; Plus: `Math.min(max, validNum + 1)`.

**No `onBlur`** — raw string persists until ± tap. Direct edits: `""` or `"abc"` → clamped to min on next ± press.

#### `PillChip.tsx`

```ts
type Props = {
  label: string;
  active: boolean;
  color: string;
  onPress: () => void;
  icon?: string;
};
```

**Active:** `backgroundColor = color`, text `#ffffff`, `fontWeight 600`. **Inactive:** bg `#f1f0f9`, text `#64748b`, `fontWeight 400`. `borderRadius 999`, `paddingHorizontal 14`, `paddingVertical 7`, `marginRight 8`, `borderWidth 1`, inactive border `#e0ddf0`, active border `color`.

**Uses:** Todo priority, calorie meal type, Pomodoro mode selector.

#### `ValidationError.tsx`

```ts
type Props = { message: string | null };
```

If `message` is null → returns null (hidden). Visual: `backgroundColor #fef2f2`, `borderRadius 8`, `paddingHorizontal 12`, `paddingVertical 8`, `marginBottom 8`, `borderWidth 1`, `borderColor #fecaca`, row with `⚠️` `fontSize 14` and message `fontSize 13` `color #dc2626` `flex 1`.

#### `SwipeRightActions`

- `DELETE_RED = "#ef4444"`
- Container: `flexDirection row`, `alignItems stretch`, `marginLeft 4`, `gap 4`
- Each action: `width 80`, full stretch height, `borderRadius 16`, `borderWidth 1`, white label `fontSize 13` `fontWeight 600`

#### `HorizontalScrollArea.tsx`

```ts
export type HorizontalScrollAreaHandle = {
  scrollToEnd: (options?: { animated?: boolean }) => void;
};
type Props = PropsWithChildren<{ footer?: ReactNode }>;
```

Web: `View` with `nativeID` + `overflow-x-auto`. Native: horizontal `ScrollView`.

---

## 7. Shared Libraries

### `lib/id.ts`

#### `createId(prefix: string): string`

```ts
const random = Math.random().toString(36).slice(2, 10);
return `${prefix}_${Date.now()}_${random}`;
```

**Algorithm:** `{prefix}_{Date.now() as ms}_{8 chars from base36 random}`

**Properties:** Not cryptographically strong — `Math.random()` is predictable; acceptable for local-only row IDs. Callers: all `*.data.ts` files, `core/auth/guestProfile.ts`.

---

### `lib/time.ts`

#### `nowIso(): string`

Returns `new Date().toISOString()` — UTC ISO 8601. Used for all `created_at` / `updated_at` / `deleted_at` writes.

#### `toDateKey(date = new Date()): string`

Returns **local** calendar `YYYY-MM-DD` via `getFullYear()`, `getMonth() + 1`, `getDate()` (padded).

**Migration 5 cutover:**
- **Before:** Some historical rows used UTC calendar dates from `toISOString().slice(0, 10)`
- **After:** Application uses `toDateKey()` for all new date keys
- **Implication:** Heatmaps spanning the cutover may show discontinuities; no automatic backfill
- **`app_meta` keys:** `date_key_format = 'local'`, `date_key_cutover` = ISO UTC time when migration ran

#### `buildDateRangeOldestFirst(days: number): string[]`

Index `0` = oldest in window, last = today. Used by domain files for heatmap data generation.

#### `buildDateRangeTodayFirst(days: number): string[]`

`buildDateRangeOldestFirst(days).reverse()`

#### `buildDateRange(days: number): string[]`

Alias for `buildDateRangeTodayFirst(days)`.

---

### `lib/notifications.ts`

**Import-time side effect:** `Notifications.setNotificationHandler(...)` — sets `shouldPlaySound: true`, `shouldSetBadge: false`, `shouldShowBanner: true`, `shouldShowList: true`.

#### `ensureNotificationPermission(): Promise<boolean>`

1. `getPermissionsAsync()` — if `granted`, return `true`
2. `requestPermissionsAsync()`
3. Android: `setNotificationChannelAsync("default", { name: "default", importance: HIGH })`
4. Return `request.status === "granted"`

#### `scheduleTimerEndNotification(seconds: number, title: string, body: string)`

1. `ensureNotificationPermission()`
2. If not allowed → return `null`
3. `scheduleNotificationAsync` with `trigger: { type: TIME_INTERVAL, seconds }`

**Returns:** `Promise` of notification id or `null`. **Callers:** `PomodoroScreen` on timer start.

---

### `lib/supabase.ts`

- `export type RemoteMode = "disabled" | "enabled"`
- `let remoteMode: RemoteMode = "disabled"`
- `setRemoteMode(mode: RemoteMode): void` — assigns module-level `remoteMode`
- `isRemoteEnabled(): boolean` — returns `remoteMode === "enabled"`

**Callers:** `AppProviders` (gates sync flush listeners). No Supabase client imports at KB time.

---

### `lib/validation.ts`

All validation functions return `string | null` — **null = valid**, non-null = user-facing message. **Hard rejection only** — no silent clamping.

| Function | Key Rules |
|----------|-----------|
| `validateTodo(title, notes)` | Title required, max 200 chars; notes max 500; optional due date must be valid YYYY-MM-DD |
| `validateHabit(name, targetPerDay)` | Name required, max 100; target 1–99, integer |
| `validateCalorieEntry(foodName, protein, carbs, fats, fiber)` | Food name required, max 100; each macro 0–999 |
| `validateCalorieComputedKcal(kcal)` | Must be > 0 and ≤ 9999 |
| `validateCalorieGoal(calories, protein, carbs, fats)` | Calories 500–6000; macros 0–999 |
| `validateRoutineName(name)` | Required, max 100 |
| `validateExerciseName(name)` | Required, max 100 |
| `validateSetTiming(activeSeconds, restSeconds)` | Active 5–3600s; rest 0–1800s |
| `validatePomodoroSettings(focus, shortBrk, longBrk, sessions)` | Focus 1–120 min; short break 1–60; long break 1–120; sessions 2–10; whole numbers only |

**UI pattern:** Show `<ValidationError message={error} />`; clear on successful submit and on field change.

---

## 8. Features

### Tab label mapping

"Focus" tab → route `pomodoro` → files `features/pomodoro/`

---

### 8.1 Todos

#### Data layer — `features/todos/todos.data.ts`

| Function | Signature | Behavior | `syncEngine` |
|----------|-----------|----------|--------------|
| `listTodos` | `(): Promise<Todo[]>` | Active todos, order `completed ASC, sort_order ASC, created_at DESC` | No |
| `addTodo` | `(input: { title, notes?, dueDate?, priority?, recurrence? }): Promise<void>` | Inserts; `recurrence_id` = `createId("rec")` if daily; `sort_order` = max incomplete + 1; default `dueDate` = `toDateKey()` if daily | Yes create |
| `createRecurringInstance` | `(input: { title, notes, priority, recurrenceId, dueDate }): Promise<void>` | Insert linked daily instance | Yes create |
| `getRecurringTodosByIds` | `(recurrenceIds: string[]): Promise<Todo[]>` | Latest row per `recurrence_id` | No |
| `listAllActiveTodosForRecurrence` | `(): Promise<Pick<...>[]>` | All non-deleted todos, subset columns for recurrence fill | No |
| `updateTodoOrder` | `(orderedIds: string[]): Promise<void>` | Sets `sort_order` 1..n per id | Yes update each |
| `updateTodo` | `(id, updates): Promise<void>` | Partial title/notes/due/priority | Yes update |
| `toggleTodo` | `(todo: Todo): Promise<void>` | Flips `completed`; if completing daily with `recurrence_id`, ensures tomorrow row exists | Yes update |
| `removeTodo` | `(id: string): Promise<void>` | Soft delete | Yes delete |

**Key SQL — `listTodos`:**
```sql
SELECT * FROM todos
 WHERE deleted_at IS NULL
 ORDER BY completed ASC, sort_order ASC, created_at DESC
```

**Key SQL — recurring tomorrow guard (`toggleTodo`):**
```sql
SELECT id FROM todos
 WHERE recurrence_id = ?
   AND due_date = ?
   AND deleted_at IS NULL
```

#### Domain layer — `features/todos/todos.domain.ts`

| Export | Signature | Purpose | Pure | Tests |
|--------|-----------|---------|------|-------|
| `getTomorrowDateKey` | `(): string` | Local YYYY-MM-DD tomorrow (inline, no `toDateKey` import) | Yes | Yes |
| `getTodayDateKey` | `(): string` | Local YYYY-MM-DD today (inline) | Yes | Yes |
| `findMissingRecurrenceIds` | `(activeTodos, todayKey): string[]` | Which `recurrence_id` lack today's instance | Yes | Yes |
| `isRecurring` | `(todo): boolean` | Returns `todo.recurrence === "daily"` | Yes | Yes |

#### Screen — `features/todos/TodosScreen.tsx`

**State:** `title`, `notes`, `dueDate`, `priority`, `showDatePicker`, `isRecurring`, `items`, `createExpanded`, `showCompleted`, `editingId`, `todoError`

**Flow:** `useFocusEffect` → `loadTodosOnFocus`: fill missing recurring instances via `findMissingRecurrenceIds` + `createRecurringInstance`, then `listTodos`. Create/edit card validates with `validateTodo`. Draggable list calls `updateTodoOrder` on drag end.

**Navigation:** Single tab screen. Web uses text field for due date; native uses `DateTimePicker`.

#### Subcomponents

| Component | Props | Renders |
|-----------|-------|---------|
| `TodoItem` | `todo`, `onLongPress`, `isActive`, `onToggle`, `onDelete`, `onEdit` | `Swipeable` + `Card` + checkbox row |
| `DueDateBadge` | `dueDate: string` | Today / overdue / formatted chip |
| `PriorityBadge` | `priority: TodoPriority` | Colored label |

#### Feature invariants
- Recurring daily todos share `recurrence_id`; completing creates next day if missing
- Sort order only considers incomplete todos for new insert max

---

### 8.2 Habits

#### Data layer — `features/habits/habits.data.ts`

| Function | Signature | `syncEngine` |
|----------|-----------|--------------|
| `listHabits` | `(): Promise<Habit[]>` | No |
| `addHabit` | `(name, targetPerDay, category?, icon?, color?): Promise<void>` | Yes create |
| `incrementHabit` | `(habitId, dateKey?): Promise<void>` | No |
| `decrementHabit` | `(habitId, dateKey?): Promise<void>` | No |
| `getHabitCountByDate` | `(habitId, dateKey?): Promise<number>` | No |
| `getAllHabitCompletionsForRange` | `(startDateKey, endDateKey): Promise<HabitCompletionRow[]>` | No |
| `getCompletionHistory` | `(habitId, days?): Promise<HabitCompletion[]>` | No |
| `updateHabit` | `(habitId, updates): Promise<void>` | Yes update |
| `deleteHabit` | `(habitId): Promise<void>` | Yes delete |

**`incrementHabit` / `decrementHabit`:** SELECT by `(habit_id, date_key)`; UPDATE count or INSERT new `hcmp` row; **DELETE row when count goes to 0**.

**`CATEGORY_ORDER`:** SQL `CASE` expression sorting habits: `anytime → morning → afternoon → evening → else`, then `created_at DESC` within group.

#### Domain layer — `features/habits/habits.domain.ts`

Exports: `calculateHabitProgress`, `buildDayCompletions`, `calculateCurrentStreak`, `calculateLongestStreak`, `getStreakLabel`, `buildGridDateHeaders`, `buildHabitGrid`, `calculateOverallConsistency`, `buildAggregatedHabitHeatmap`, `buildHabitActivityDays`

Types: `DayCompletion`, `HabitGridRow`, `DayCell`, `GridDateHeader`

**Streak:** Strict completion = `count >= targetPerDay`; current streak walks reversed days with one grace gap for "today not yet logged."

**Imports:** `lib/time`, `features/shared` types — **not** DB.

**`buildAggregatedHabitHeatmap`:** Drives single 52-week view; value 0–3 based on fraction of habits completed that day.

#### Screen — `features/habits/HabitsScreen.tsx`

**State:** `habits`, `completionMap`, `streakMap`, modal fields (`name`, `target`, `category`, `icon`, `color`), `habitHeatmapDays`, `consistencyPct`, `overallStreak`, `habitError`, `editMode`, `modalVisible`

**Flow:** `refresh` loads habits, per-habit today counts, 30-day streaks, 364-day grid → `buildAggregatedHabitHeatmap` for `HabitsOverviewGrid`. Increment/decrement call data then `refresh`.

**Layout:** Avocation-style — habits as horizontal rows per time group (`flexWrap: "wrap"`, `justifyContent: "center"`). All time groups always visible stacked vertically. Add button (56px dashed circle) at end of each row.

#### Subcomponents

| Component | Props | Notes |
|-----------|-------|-------|
| `HabitCircle` | `habit`, `todayCount`, `streak`, `showStreak?`, `showName?`, `size?`, `onIncrement`, `onDecrement` | Tap + long-press decrement; 56px default |
| `HabitHeatmap` | `dayCompletions`, `accentColor` | 6×5 grid; **not wired** in `HabitsScreen` currently |
| `HabitsOverviewGrid` | `consistencyPercent`, `heatmapDays` | Card + `GitHubHeatmap` (52 weeks) |
| `ProgressRing` | `size`, `strokeWidth`, `progress`, colors | SVG ring |

#### `habitPresets.ts`

`HABIT_ICONS` — readonly array of `HabitIcon` literals. `HABIT_COLORS` — readonly array of hex strings. `DEFAULT_HABIT_ICON`, `DEFAULT_HABIT_COLOR`.

---

### 8.3 Focus (Pomodoro)

#### Data layer — `features/pomodoro/pomodoro.data.ts`

| Function | Signature | `syncEngine` |
|----------|-----------|--------------|
| `getPomodoroSettings` | `(): Promise<PomodoroSettings>` | No |
| `savePomodoroSettings` | `(settings): Promise<void>` | No (`app_meta`) |
| `logPomodoroSession` | `(startedAt, endedAt, durationSeconds, type): Promise<void>` | No |
| `listPomodoroSessions` | `(limit?): Promise<PomodoroSession[]>` | No |
| `listPomodoroSessionsForDateRange` | `(startDateKey, endDateKey): Promise<PomodoroSession[]>` | No |

**Range query bounds:** `` `${startDateKey}T00:00:00` `` to `` `${endDateKey}T23:59:59.999` ``

#### Domain layer — `features/pomodoro/pomodoro.domain.ts`

Key exports:

| Export | Type | Notes |
|--------|------|-------|
| `PomodoroState` | `"idle" \| "running" \| "finished"` | From `nextPomodoroState` |
| `PomodoroMode` | `"focus" \| "short_break" \| "long_break"` | |
| `PomodoroSettings` | type | `focusMinutes`, `shortBreakMinutes`, `longBreakMinutes`, `sessionsBeforeLongBreak` |
| `DEFAULT_SETTINGS` | const | `{ focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, sessionsBeforeLongBreak: 4 }` |
| `FOCUS_SECONDS` | `25 * 60 = 1500` | Focus duration; session log duration |
| `getModeDuration` | `(mode, settings): number` | Duration in seconds |
| `getNextMode` | `(currentMode, completedFocusSessions, settings): PomodoroMode` | **Guard:** `completedFocusSessions > 0` before long break check (prevents `0 % N === 0` bug) |
| `getModeLabel` | `(mode): string` | "Focus" / "Short Break" / "Long Break" |
| `getModeColor` | `(mode): { bg, text, bar }` | focus=brand, short=emerald, long=violet |
| `parseMinutesSeconds` | `(input): { minutes, seconds } \| null` | |
| `nextPomodoroState` | `(remaining, isRunning): PomodoroState` | `"finished"` at 0; `"running"` if active |
| `calculateGrowthProgress` | `(remainingSeconds, totalSeconds): number` | 0–1 elapsed fraction |
| `PlantStage` | type | `"seed" \| "sprout" \| "seedling" \| "growing" \| "grown"` |
| `getPlantStage` | `(progress): PlantStage` | seed <10%, sprout <35%, seedling <65%, growing <90%, grown |
| `formatSessionTime` | `(startedAt): string` | "Today HH:MM" or "Mon DD HH:MM" |
| `buildPomodoroHeatmapDays` | `(sessions, days?): HeatmapDay[]` | Count sessions per day, intensity 0–3 |
| `computeFocusStreakFromHeatmapDays` | `(days): number` | Consecutive days with sessions |

#### Screen — `features/pomodoro/PomodoroScreen.tsx`

**State:** `settings`, `currentMode`, `completedFocus`, `showSettings`, `totalSeconds`, `remaining`, `isRunning`, `isPaused`, `startedAt`, `historyVersion`, `sessions`, `pomodoroHeatmapDays`, `showWarning`, interval ref + refs mirroring state for closure safety

**Flow:** `useEffect` interval counts down; on complete logs focus session (only for focus mode), advances mode via `getNextMode`, resets long-break cycle counter. `document.visibilitychange` sets warning when hidden during run.

**Controls:**
- Before session (not running, not paused, `remaining === totalSeconds`): Show **Start Focus** only
- Running: Show **Pause** + **Reset**
- Paused: Show **Resume** + **Reset**
- Completed (`remaining === 0`): Show **Start Focus**

**Stale closure fix:** `currentModeRef`, `completedFocusRef`, `settingsRef`, `totalSecondsRef`, `startedAtRef` updated every render.

#### Subcomponents

| Component | Props |
|-----------|-------|
| `FocusSprout` | `progress`, `stage`, `accentColor?` (default `SECTION_COLORS.focus`), `size?` (default 160) |
| `GardenGrid` | `sessions`, `accentColor?` |
| `BackgroundWarning` | `visible`, `onDismiss` |
| `PomodoroSettingsInline` | `settings`, `onSave`, `onCancel` |

**`FocusSprout` stages:** seed bump → stem growing → leaves scaling (seedling/growing) → full crown (grown). SVG via `react-native-svg`.

---

### 8.4 Workout

#### Data layer — `features/workout/workout.data.ts`

**`markWorkoutRoutineUpdated`:** Updates `workout_routines.updated_at` and enqueues `entity: "workout_routines"` — used when nested exercises/sets change.

| Function | Signature | `syncEngine` |
|----------|-----------|--------------|
| `listRoutines` | `(): Promise<WorkoutRoutine[]>` | No |
| `addRoutine` | `(name, description): Promise<void>` | Yes create |
| `completeRoutine` | `(routineId, notes?): Promise<void>` | No (`workout_logs` insert) |
| `listWorkoutLogs` | `(limit?): Promise<WorkoutLog[]>` | No |
| `listWorkoutLogsForRange` | `(startDateKey, endDateKey): Promise<WorkoutLog[]>` | No |
| `deleteRoutine` | `(routineId): Promise<void>` | Yes delete |
| `addExercise` | `(input): Promise<string>` | Via `markWorkoutRoutineUpdated` |
| `listExercises` | `(routineId): Promise<RoutineExercise[]>` | No |
| `deleteExercise` | `(id): Promise<void>` | Soft delete exercise + sets; bump routine |
| `updateExerciseOrder` | `(orderedIds): Promise<void>` | Bump routine |
| `addSet` | `(input): Promise<string>` | Returns `""` if `validateSetTiming` fails |
| `listSets` | `(exerciseId): Promise<RoutineExerciseSet[]>` | No |
| `updateSet` | `(id, updates): Promise<void>` | No-op if timing invalid |
| `deleteSet` | `(id): Promise<void>` | Soft delete set |
| `addDefaultSet` | `(exerciseId): Promise<void>` | Default 40s active / 20s rest |
| `getRoutineWithExercises` | `(routineId): Promise<RoutineWithExercises \| null>` | Join tree |
| `logWorkoutSession` | `(input): Promise<void>` | Inserts log + `workout_session_exercises` | No |

#### Domain layer — `features/workout/workout.domain.ts`

Exports: `buildWorkoutActivityDays`, `buildWorkoutHeatmapDays`, `computeWorkoutStreakFromHeatmapDays`, `buildWorkoutFrequency`, `formatWorkoutTime`, `parseWorkoutTime`, `calculateSessionDuration`, `buildTimerSequence`, `summarizeCompletedSets`, type `TimerPhase`

**`buildTimerSequence`:** Omits rest phase after **last set of last exercise** only.

**`formatWorkoutTime(totalSeconds)`:** `M:SS` format (e.g. `1:30`, `0:45`).

**Coverage gap:** `computeWorkoutStreakFromHeatmapDays` has no dedicated `it()` in tests.

#### Screens

**`WorkoutScreen.tsx` — view stack:** `ViewState`: `list` | `detail` | `session`. Inline list with create form, swipe rows, history + heatmap. `completeRoutine` quick action from list.

**`RoutineDetailScreen.tsx`:** Exercises + per-set timers; add exercise, `addDefaultSet`, adjust seconds ±5 with validation. **Start workout** button when at least one exercise present.

**`WorkoutSessionScreen.tsx`:** Steps through `buildTimerSequence`; auto-advances between active/rest phases; on complete, `logWorkoutSession` with `summarizeCompletedSets(sequence, currentIndex)`. Active phase = blue, rest phase = amber.

---

### 8.5 Calories

#### Data layer — `features/calories/calories.data.ts`

| Function | Notes | `syncEngine` |
|----------|-------|--------------|
| `getCalorieSummaryByRange` | `GROUP BY consumed_on` | No |
| `getCalorieGoal` / `setCalorieGoal` | `app_meta` key `calorie_goal` | No |
| `listCalorieEntries` | Today default | No |
| `addCalorieEntry` | Then `upsertSavedMeal` | Yes create |
| `updateCalorieEntry` | Recomputes kcal via `kcalFromMacros` | Yes update |
| `deleteCalorieEntry` | Soft delete | Yes delete |
| `upsertSavedMeal` | Case-insensitive food name unique index; updates macros + `use_count++` on re-log | No |
| `listRecentSavedMeals(limit?)` | Order by `last_used_at DESC` | No |
| `searchSavedMeals(query)` | Empty query = all, ordered by `use_count DESC` | No |
| `deleteSavedMeal` | **Hard delete** | No |

**Types exported:** `DailySummary`, `CalorieGoal`, `DEFAULT_GOAL`

#### Domain layer — `features/calories/calories.domain.ts`

Exports: `kcalFromMacros`, `caloriesTotal`, `buildWeeklyTrend`, `buildMacroDonutData`, `calculateGoalProgress`, `filterSavedMeals`, `buildCalorieActivityDays`, `buildCalorieHeatmapDays`, type `MacroSlice`

**`kcalFromMacros`:** `digestibleCarbG = max(0, carbs - fiber)`; `round(max(0, protein*4 + digestibleCarb*4 + fiber*2 + fats*9))`

**`buildMacroDonutData`:** Returns 4 slices; rounding-adjusted so values sum to 100.

**Note:** `calories.data.ts` imports `kcalFromMacros` from domain — acceptable coupling to keep SQL calories consistent.

#### Screen — `features/calories/CaloriesScreen.tsx`

Macro fields → computed kcal; `validateCalorieEntry` + `validateCalorieComputedKcal`; meal `PillChip`s; swipe rows (edit + delete); weekly bar chart (52 weeks, scrolls to newest); 52-week heatmap; goal sheet + saved meal search.

#### Subcomponents

| Component | Props |
|-----------|-------|
| `MacroDonutChart` | `totalKcal`, `goalKcal`, `protein`, `carbs`, `fats`, `fiber`, `sectionColor` |
| `WeeklyCalorieChart` | `data`, `goalKcal?` |
| `CalorieGoalSheet` | `visible`, `currentGoal`, `onSave`, `onClose` |
| `SavedMealChips` | `meals`, `onSelect` |
| `SavedMealSearchSheet` | `visible`, `meals`, `onSelect`, `onClose`, `onDeleted` |

**`MacroDonutChart`:** Progress arc style — consumed vs goal. Empty portion = `#e2e8f0` (light gray). Over goal = `#ef4444` ring. Macros shown as stat chips below ring.

**Macro chip colors:** Protein `#3B82F6`, Carbs `#F59E0B`, Fats `#F97316`, Fiber `#10B981`

---

### 8.6 Shared (`features/shared/`)

#### `GitHubHeatmap.tsx`

```ts
type Props = {
  days: HeatmapDay[];      // ordered oldest first
  color: string;
  label?: string;
  weeks?: number;          // default 52
};

export type HeatmapDay = {
  dateKey: string;
  value: number;           // 0 = none, 1 = low, 2 = medium, 3 = high
};
```

| Constant | Value |
|----------|-------|
| `CELL` | `14` |
| `GAP` | `3` |
| `DAY_LABEL_COL_WIDTH` | `14` |
| `DEFAULT_WEEKS` | `52` |

**Intensity colors:**
- `0` → `#e2e8f0`
- `1` → `color + "55"` (hex + alpha suffix)
- `2` → `color + "99"`
- `3` → full `color`

**Month labels:** Shown when week's first day's `(year, month)` changes vs previous week.

**Day labels:** `["M","T","W","T","F","S","S"]` — only even indices render text (`i % 2 === 0`).

**Grid:** Monday-first padding via `(firstDate.getDay() + 6) % 7`.

**`weeks` prop:** Trims to last `weeks * 7` days via `days.slice(-maxDays)`.

#### `ActivityPreviewStrip.tsx`

```ts
type Props = {
  days: ActivityDay[];
  accentColor: string;
  statLabel: string;
  emptyLabel?: string;
  showLabel?: boolean;
};

export type ActivityDay = {
  dateKey: string;
  active: boolean;
  value?: number;  // 0–1 for intensity blending
};
```

| Constant | Value |
|----------|-------|
| `CELL` | `18` |
| `GAP` | `3` |

**`blendAccent`:** Parses `#RRGGBB`; blends toward neutral `#e2e8f0` with `t = 0.4 + value * 0.6`.

**Today marker:** First cell (`i === 0`) gets `borderWidth 1.5`, `borderColor accentColor`.

---

## 9. UI Design System

### Color system

#### `SECTION_COLORS` (verbatim) — `constants/sectionColors.ts`

```ts
export const SECTION_COLORS = {
  todos: "#3B82F6",    // Calm Blue — focus, clarity, orderly thinking
  habits: "#10B981",   // Fresh Green — growth, consistency, balance
  focus: "#8B5CF6",    // Deep Purple — concentration, calm, introspection
  workout: "#F97316",  // Red-Orange — physical energy, drive, power
  calories: "#F59E0B", // Warm Amber — warmth, nutrition, appetite awareness
} as const;
```

#### `SECTION_COLORS_LIGHT` (verbatim)

```ts
export const SECTION_COLORS_LIGHT = {
  todos: "#EFF6FF",    // blue-50
  habits: "#ECFDF5",   // emerald-50
  focus: "#F5F3FF",    // violet-50
  workout: "#FFF7ED",  // orange-50
  calories: "#FFFBEB", // amber-50
} as const;
```

#### `brand` scale (`tailwind.config.js`, verbatim hex)

| Token | Hex | Typical usage |
|-------|-----|---------------|
| `brand-50` | `#f8f7ff` | App background (`surface`) |
| `brand-500` | `#8B5CF6` | Default primary button (maps to focus purple) |

**`surface`:** `#f8f7ff` — app background token. Applied in `global.css`:
```css
body, #root { background-color: #f8f7ff; }
```

#### When to use section vs brand

- **Section colors:** Tab accents, feature cards (accentColor), pill chips for that module, heatmaps
- **Brand / `brand-500`:** Default primary button when no `color` override

### Typography

| Context | Pattern |
|---------|---------|
| Screen title | `SectionTitle`: `text-2xl font-bold text-slate-900` |
| Screen subtitle | `text-sm text-slate-600` |
| Field label | `text-sm font-medium text-slate-700` |
| Body in cards | `text-base text-slate-900`; notes `text-sm text-slate-500` |
| Muted / secondary | `text-slate-400`, `text-slate-500`, `#94a3b8` inline |
| Tab labels | `fontSize 12`, active `fontWeight 600` + section color, inactive `#94a3b8` / `400` |
| Danger | `text-rose-400`, `bg-rose-500` buttons |

### Layout patterns

#### Scroll-down reward

Primary stats + forms **above**; overview heatmaps / charts **below**. Todos invert: list center with create card at bottom when items exist.

#### Stat cards (shared pattern)

`flex-row gap-3` → two `flex-1` children → `Card className="mb-0"` with `accentColor` → centered emoji, `fontSize 20`, `fontWeight 700`, section color, caption `fontSize 12` `#94a3b8`.

#### Swipe actions (`core/ui/SwipeRightActions`)

- Edit button (section color, 80px) + Delete button (red `#ef4444`, 80px)
- Both: full stretch height, `borderRadius 16`, `borderWidth 1`, white label `fontSize 13` `fontWeight 600`
- Gap between buttons: `4`

#### Heatmap card wrapper

`Card accentColor={SECTION_COLORS.*}` + inner `w-full min-w-0 items-center` + subtitle "last 52 weeks".

### Feature-specific visuals

| Feature | Notable UI |
|---------|------------|
| Todos | Draggable handle `MaterialIcons` drag-indicator `#94a3b8`, recurring chip `border-todos bg-todos-light` |
| Habits | Dashed add circle `SECTION_COLORS.habits + "60"`, time group headers uppercase, `flexWrap wrap` circles |
| Pomodoro | `.text-5xl` timer, dot row for session progress, `FocusSprout` 160 default size |
| Workout | Session timer `text-7xl`, active pill `bg-workout`, rest `bg-amber-400`, ±5s steppers |
| Calories | Macro row fields, donut `PieChart` radius 80 inner 55, weekly bars `BAR_WIDTH 20` `SPACING 8` |

### `HabitHeatmap` (per-habit mini grid — currently unused in screen)

Cell `28×28`, `gap 1`, `borderRadius 4`; legend squares `10×10` `borderRadius 2`. Available but not wired in `HabitsScreen`.

### Root configs

#### `tailwind.config.js`

- `presets`: `nativewind/preset`
- `content`: `./app/**`, `./features/**`, `./core/**` — `*.{js,jsx,ts,tsx}`
- `theme.extend.colors`: section keys + brand scale + surface

#### `metro.config.js`

| Customization | Detail |
|---------------|--------|
| `withNativeWind(config, { input: "./global.css" })` | NativeWind CSS processing |
| `config.resolver.assetExts.push("wasm")` | SQLite WASM on web |
| `config.server.enhanceMiddleware` | Sets `Cross-Origin-Embedder-Policy: credentialless` + `Cross-Origin-Opener-Policy: same-origin` |

#### `app.json`

| Area | Notes |
|------|-------|
| `plugins` | `expo-router` with COOP/COEP headers; `expo-notifications`; `expo-sqlite`; `@react-native-community/datetimepicker` |
| `web` | `bundler: metro`, `output: static` |
| `experiments.typedRoutes` | `true` |

#### `tsconfig.json`

| Option | Value |
|--------|-------|
| `extends` | `expo/tsconfig.base` |
| `strict` | `true` |
| `baseUrl` | `.` |
| `paths` | `@/*` → `./*` |
| `types` | `vitest/globals` |

---

## 10. Testing

### Unit tests (Vitest)

**Command:** `npm test` (`vitest run`)
**Config:** `vitest.config.ts` — `environment: "node"`, `resolve.alias["@"]` → project root
**Latest run:** **141 tests passed**; **1 file skipped** (`tests/calories.data.STUB.test.ts`); **8 test files** total

#### `tests/time.test.ts`

| Suite | Tests |
|-------|-------|
| `buildDateRange / buildDateRangeTodayFirst` | returns today first then older days; `buildDateRange` matches `buildDateRangeTodayFirst` |
| `buildDateRangeOldestFirst` | returns oldest day first and today last |

#### `tests/validation.test.ts`

| Suite | Tests |
|-------|-------|
| `validateTodo` | rejects empty title; accepts valid; rejects >200; accepts 200; rejects bad due date; accepts valid due date |
| `validateCalorieEntry` | empty food; negative protein; protein >999; valid entry |
| `validateCalorieComputedKcal` | rejects zero; rejects >9999 |
| `validatePomodoroSettings` | focus 0; focus >121; sessions <2; valid |
| `validateHabit` | empty name; target 0; target 100; valid |
| `validateRoutineName` | empty; valid |
| `validateExerciseName` | empty |
| `validateSetTiming` | active <5; default-like OK |
| `validateCalorieGoal` | calories <500; valid |

#### `tests/todos.domain.test.ts`

- `getTodayDateKey`: YYYY-MM-DD format; matches local not UTC
- `getTomorrowDateKey`: one day after today
- `findMissingRecurrenceIds`: empty when none; returns id when missing today; empty when covered; multiple series
- `isRecurring`: daily=true; null=false

#### `tests/habits.domain.test.ts`

| Suite | Tests |
|-------|-------|
| `calculateHabitProgress` | cap at 1; partial |
| `buildDayCompletions` | length 30; strict complete; strict incomplete |
| `calculateCurrentStreak` | empty; consecutive with grace; break on miss; all zero |
| `calculateLongestStreak` | longest run; all incomplete |
| `getStreakLabel` | 0; 1 day; N days |
| `buildGridDateHeaders` | length 30; last is today; month label only on 1st |
| `buildHabitGrid` | rows; cells; completed; partial |
| `buildHabitActivityDays` | empty grid; fraction active |
| `buildAggregatedHabitHeatmap` | zeros; single habit full; <50%; 50% boundary; 2 of 3 habits |
| `calculateOverallConsistency` | empty grid; percentage past cells |

#### `tests/calories.domain.test.ts`

| Suite | Tests |
|-------|-------|
| `caloriesTotal` | sums |
| `kcalFromMacros` | formula cases |
| `buildWeeklyTrend` | length 7; zeros; maps today |
| `buildMacroDonutData` | empty; four slices sum 100; fiber≥carbs; drop zeros |
| `calculateGoalProgress` | zero goal; 50%; cap 100%; over flag; remaining 0 when over |
| `buildCalorieActivityDays` | empty; active + capped value |
| `buildCalorieHeatmapDays` | bucket vs goal |
| `filterSavedMeals` | empty query; case-insensitive; no match; single |

#### `tests/workout.domain.test.ts`

| Suite | Tests |
|-------|-------|
| `formatWorkoutTime` | 1:30; 0:45; 0:00; padding |
| `parseWorkoutTime` | MM:SS; plain seconds; invalid |
| `calculateSessionDuration` | sums; empty |
| `buildTimerSequence` | phase count; last active; first active |
| `buildWorkoutActivityDays` | today active from log |
| `buildWorkoutFrequency` | empty; double same day |
| `buildWorkoutHeatmapDays` | length 30; cap 3 |
| `summarizeCompletedSets` | counts first active phase |

**Coverage gap:** `computeWorkoutStreakFromHeatmapDays` has no dedicated `it()`.

#### `tests/pomodoro.domain.test.ts`

| Suite | Tests |
|-------|-------|
| `getModeColor` | focus, short, long |
| `nextPomodoroState` | finished at 0; running; idle |
| `calculateGrowthProgress` | start; end; halfway; clamp high; clamp negative |
| `getPlantStage` | seed, sprout, seedling, growing, grown |
| `formatSessionTime` | today; past pattern |
| `getModeDuration` | default modes; custom |
| `getNextMode` | long-break guard (0 sessions → short_break); custom N; all transitions |
| `getModeLabel` | three modes |
| `parseMinutesSeconds` | valid; invalid |
| `buildPomodoroHeatmapDays` | empty shape; bucket 3 sessions |
| `computeFocusStreakFromHeatmapDays` | consecutive; zero if today empty |

#### `tests/calories.data.STUB.test.ts`

`describe.skip` — 0 tests; placeholder for future DB mocking.

---

### E2E Tests (Playwright)

**Config file:** `playwright.config.ts`

| Setting | Value |
|---------|-------|
| `testDir` | `"./e2e"` |
| `fullyParallel` | `false` |
| `workers` | `1` (**WARNING: Do not run multiple DB-heavy specs in parallel** — shared OPFS SQLite lock) |
| `retries` | `process.env.CI ? 2 : 0` |
| `timeout` | `60_000` |
| `expect.timeout` | `5_000` |
| `forbidOnly` | `!!process.env.CI` |
| `reporter` | HTML → `.cursor/playwright-output/e2e-report/`, `open: "never"` + `list` |
| `use.baseURL` | `"http://localhost:8081"` |
| `headless` | `true` |
| `screenshot` | `"only-on-failure"` |
| `video` | `"off"` |
| `trace` | `"on-first-retry"` |
| `navigationTimeout` | `20_000` |
| `outputDir` | `.cursor/playwright-output/e2e-failures` |
| `projects` | Chromium Desktop Chrome |
| `globalSetup` | `"./e2e/global.setup.ts"` |
| `globalTeardown` | `"./e2e/global.teardown.ts"` |

#### `e2e/global.setup.ts`

Launches Chromium, navigates `http://localhost:8081`, asserts `window.crossOriginIsolated === true` or throws with COEP/COOP hint.

#### `e2e/helpers/`

**`db.ts` — `clearDatabase(page)`:** Removes OPFS `superhabits.db`, `-wal`, `-shm` via `navigator.storage.getDirectory()`, then `page.reload` `domcontentloaded` `60_000`.

**`navigation.ts`:**
- `TABS` map to `/(tabs)/...` paths
- `goToTab(page, tab)` — `goto` `domcontentloaded`, loose root wait
- `hardReload(page)` — `reload` `domcontentloaded`
- `waitForDb(page, timeout?)` — `waitForTimeout(500)`

**`forms.ts`:**
- `fillRoutineName(page, name)` — label-scoped input + `type` delay
- `fillCaloriesMacros(page, food, p, c, f, fiber)` — **macros first, food last** (food-last keeps React state correct)

**`gestures.ts`:**
- `swipeLeftToRevealRowActions(page, rowText)`
- `swipeLeftRevealWorkoutRoutineRow(page)` — anchor on "Complete workout"
- `clickSwipeDeleteAction(page)` — DOM click on Delete label parent
- Web vs native: Synthetic touch path preferred on web for Swipeable; mouse fallback

#### `e2e/todos.spec.ts`

**`beforeEach`:** `goToTab` todos → `clearDatabase` → `goToTab` todos

Tests:
1. shows empty state when no todos exist
2. does not add todo with empty title
3. adds a new todo
4. completes a todo
5. deletes a todo (swipe + Delete button)
6. todo persists after hard reload

#### `e2e/habits.spec.ts`

**`beforeEach`:** habits → clear → habits

Tests:
1. shows empty state when no habits exist
2. does not add habit with empty name
3. adds a new habit
4. increments habit completion
5. habit persists after reload
6. delete in edit mode: no confirmation on web (Alert.alert no-op), habit remains

#### `e2e/calories.spec.ts`

**`beforeEach`:** calories → clear → calories

Tests:
1. shows empty state on first load
2. does not add entry with empty food name
3. adds a calorie entry and updates daily total
4. selects different meal types
5. entry persists after reload

#### `e2e/pomodoro.spec.ts`

**`beforeEach`:** pomodoro → clear → pomodoro

Tests:
1. shows idle state on first load
2. shows empty session history on first load ("Complete a session to start your garden")
3. starts timer and shows running state
4. resets timer

#### `e2e/workout.spec.ts`

**`beforeEach`:** workout → clear → workout

Tests:
1. shows empty state when no routines exist
2. does not add routine with empty name
3. adds a new routine
4. completes a workout
5. routine persists after reload
6. swipe delete: no confirmation on web, routine remains

#### `e2e/infrastructure.spec.ts`

Tests:
1. crossOriginIsolated is true
2. SharedArrayBuffer is available
3. COEP header is require-corp
4. COOP header is same-origin
5. service worker registers and controls the page
6. SW cache name is superhabits-shell-v2
7. stale v1 cache is not present
8. localhost serves assets from network not SW cache
9. second tab gets OPFS lock error when first is open
10. no DB init error on clean load

#### `e2e/boundary.spec.ts`

**`beforeEach`:** `goToTab` todos → `hardReload` → `clearDatabase` → `hardReload`

**Todos:** empty title rejected; 200-char title saves; recurring todo completed 5 times creates valid chain; 30 todos don't crash list

**Habits:** target 1 shows correct progress; 10 habits across groups renders all groups; overview grid renders empty state

**Calories:** empty food name rejected; large calorie value doesn't break chart; 20 entries total correctly; goal smoke test

**Workout:** empty routine rejected; 10 exercises render without crash; tab stays stable

**Pomodoro:** 1 min focus works; "Up next" ≠ Long Break at 0 sessions; session dots smoke test

**Global (5 tabs):** Each tab checked for `NaN`, `undefined`, `Infinity`, `[object Object]` in rendered text

#### Failure classification (`/e2e-fix` — Type A–E)

| Type | Description | Fix scope | Approval required |
|------|-------------|-----------|------------------|
| A | Selector mismatch | `e2e/*.spec.ts` only | No (auto-fix if HIGH confidence) |
| B | Logic / data bug | `features/*.domain.ts` or `*.data.ts` | Yes |
| C | Infrastructure failure | `metro.config.js`, `app.json`, `public/sw.js`, `AppProviders.tsx` | Yes |
| D | Test flakiness | Timeouts / waits in specs | No (auto-fix) |
| E | Environment issue | Metro not running | N/A |

**Critical rule:** NEVER fix a test assertion to force a pass. If a test failure reveals a genuine app bug, fix the app — not the assertion. Changing `expect(x).toBe(147)` to `expect(x).toBe(0)` to force a pass is strictly forbidden.

#### Testing invariants

- `clearDatabase()` in `beforeEach` for all feature specs
- `global.setup` aborts suite if `crossOriginIsolated` is false
- Do not add `data-testid` to app components
- E2E requires running dev server — not a substitute for unit tests
- Do not run two DB-heavy spec files in parallel (shared OPFS)

---

### CI (`.github/workflows/ci.yml`)

| Job | Steps |
|-----|-------|
| `quality` | `actions/checkout@v4` → `actions/setup-node@v4` (Node 20, cache npm) → `npm ci` → `npm run typecheck` → `npm test` |
| `e2e` | needs `quality`; `npm run web &` → `wait-on http://127.0.0.1:8081` → `npm run e2e`; uploads HTML report artifact |

**CI Node:** 20. **Devcontainer Node:** 22 (intentional mismatch).

---

### Patches

**`@react-native+community-cli-plugin+0.83.2.patch`:** Injects `unstable_experiments: { enableStandaloneFuseboxShell: false }` into dev middleware.

**`metro-file-map+0.83.3.patch`:** `isIgnorableFileError` returns true for `EACCES` (in addition to `ENOENT`/`EPERM`). Reduces Metro watcher crashes on permission-denied paths on Windows.

---

## 11. Cursor Workflow

### Commands (`.cursor/commands/`)

#### `audit.md`

**Purpose:** Read-only pass over `features/`, `core/`, `lib/`, `app/`, `tests/` for invariant violations, missing migrations, domain purity issues, dead code. **No file modifications.**

Audits for: hard deletes, missing `syncEngine.enqueue`, wrong ID generation, timestamp issues, missing migrations, domain importing DB, screens importing DB directly, domain functions without tests, known bugs.

**Note:** Command's "Known bugs" list may be partially obsolete vs current code — treat as historical checklist.

---

#### `audit-performance.md`

**Purpose:** Performance + PWA audit via Fetch MCP (headers) and Lighthouse MCP.

**Phases:** (1) Fetch headers COEP/COOP, (2) Lighthouse mobile, (3) desktop, (4) PWA, (5) accessibility, (6) best practices + SEO. Screenshots/reports under `.cursor/playwright-output/`.

**Requires:** `npm run web` on `http://localhost:8081`.

---

#### `check.md`

**Purpose:** Run `npm run typecheck` and `npm test`; report pass/fail. Expected baselines: typecheck 0 errors; npm test 141 passing.

---

#### `commit.md`

**Purpose:** Run quality gates, analyze `git status`/diff, commit with structured message.

**Message format:**
```
{type}: {short description} ({test count} tests)

{optional body — 2-3 lines max}
```

**Types:** `feat`, `fix`, `chore`, `test`, `refactor`.

**Phases:** (1) Quality gate (typecheck + unit tests only — no E2E), (2) Detect what changed, (3) Generate message + wait for approval, (4) Commit + optional tag + optional push, (5) Report.

**Constraints:** Never commit if typecheck or unit tests fail; never force push; never amend pushed commits.

---

#### `e2e-fix.md`

**Purpose:** Run `npm run e2e`, inspect HTML report via Playwright MCP, classify failures A–E, plan fixes.

**Phases:** (1) Run E2E, (2) MCP report inspection, (3) Categorize A–E, (4) Fix plan + approval for app changes, (5+) Implement per plan.

**Requires:** Metro on `8081`, Playwright MCP.

**Critical rule:** NEVER fix a test assertion to force a pass. If a test failure reveals a genuine app bug, fix the app. Key signal: if removing or weakening the assertion would make the test pass, it is Type B — fix the app, not the test.

---

#### `fix.md`

**Purpose:** Route issues to data-agent vs feature-agent (or both, data first).

**Data-agent scope:** `*.data.ts`, `core/db/`, `sync.engine.ts`, `guestProfile.ts`, `lib/id.ts`, `lib/time.ts`

**Feature-agent scope:** `*Screen.tsx`, `*.domain.ts`, `core/ui/`, `app/`, `lib/notifications.ts`, `AppProviders.tsx`

**Workflow:** Classify → read files → root cause → plan → approval → implement → typecheck + test.

---

#### `new-feature.md`

**Purpose:** Scaffold feature: migration, types, data, domain, screen, route, tab, tests.

**Phases:** Intake (answer field/entity/table/sync/domain questions) → Plan (list every file) → Approval → Implement data then domain then UI → Report.

**Current version in command:** 9 → next 10.

---

#### `new-migration.md`

**Purpose:** Add only new `if (version < N)` block; never edit old migrations or bootstrap DDL; update `core/db/types.ts`.

**Current version:** 9 → next 10.

---

#### `pre-pr.md`

**Purpose:** Full pre-PR health: local gates + Playwright MCP inspection + GitHub MCP for CI on PR.

**Phase 1:** `npm run typecheck`, `npm test` (141 tests)

**Phase 2:** Playwright MCP: cross-origin isolation, SW cache name `superhabits-shell-v2`, screenshots per tab to `.cursor/playwright-output/pre-pr-*.png`, console error summary

**Deep mode:** Transfer size, `window.__dbReady`, per-tab body text, Lighthouse, headed mode, Bugbot comments via GitHub MCP

**Phases 4–6 (GitHub MCP):**
- Phase 4: Get branch → find open PR → fetch latest workflow run → report quality + e2e job status; no-PR message; 60s/15s polling if running
- Phase 5: If CI failed → fetch logs → triage → fix locally → verify → commit + push
- Phase 6: Confirm all green on latest run; final status bullets

**Requires:** `npm run web`, Playwright MCP, GitHub MCP for CI phases.

**Constraint:** E2E is NOT part of Phase 1 quality gate in pre-pr — it's handled via Playwright MCP separately.

---

#### `test.md`

**Purpose:** `npm test` then `npm run e2e`; combined report. **Requires:** Metro for E2E phase.

---

### Agent reference (`.cursor/agents/`)

#### `data-agent.md`

| Aspect | Content |
|--------|---------|
| Scope | `core/db/*`, `core/sync/sync.engine.ts`, `core/auth/guestProfile.ts`, `features/*/*.data.ts`, `lib/id.ts`, `lib/time.ts` |
| Out of scope | Screens, `app/`, `core/ui/` |
| Non-negotiables | Soft delete, enqueue pattern, `createId`, `nowIso`/`toDateKey`, append-only migrations, `habit_completions` exception |
| Workflow | Read → plan → approval → implement → typecheck + test → report |
| Schema | Current version **9**, next migration `version < 10` |

#### `feature-agent.md`

| Aspect | Content |
|--------|---------|
| Scope | `*Screen.tsx`, `*.domain.ts`, `core/ui/`, `app/`, `lib/notifications.ts`, `AppProviders.tsx` |
| Out of scope | `*.data.ts`, `core/db/*`, `lib/id.ts`, `lib/time.ts` |
| Non-negotiables | No DB in screen/domain, NativeWind, `<Screen>`, selector updates allowed in E2E but don't strip tests |

#### Routing rule

- Schema / SQL / sync enqueue / ID / migration → **data-agent**
- Screen / domain math / `core/ui` / notifications / providers → **feature-agent**
- Both → data first, then feature

---

### Skills (`.cursor/skills/`)

| Skill | Trigger | Provides |
|-------|---------|----------|
| `db-and-sync-invariants/SKILL.md` | DB, migrations, data layer | WAL, soft delete, enqueue list, ID format; **verify schema version against `client.ts`** (skill text lags — states version 7; actual is 9) |
| `feature-module-pattern/SKILL.md` | New features, module layout | Three-file pattern, route thin wrapper, import rules |
| `rn-expo-conventions/SKILL.md` | UI, Expo Router, RN | Routing, NativeWind, lists, notifications, platform |

---

### Prompt writing patterns

- **Phase structure:** Numbered phases with explicit stop conditions
- **Read-first:** All fix commands require reading target files completely before edits
- **Quality gate:** `/check only` (typecheck + unit tests) for phase prompts; E2E in separate batch runs
- **Report format:** Tables for checks; file paths for screenshots
- **Constraints section:** Listed explicitly at end of every prompt
- **Parallel execution:** For 2+ prompts, always provide wave notation showing file overlap

#### Wave notation format

```
Wave 1 (run simultaneously):
  - prompt-A → Session 1  [touches: fileX, fileY]
  - prompt-B → Session 2  [touches: fileZ]

Wave 2 (after Wave 1):
  - prompt-C → Session 1  [depends on: fileX from prompt-A]
```

Safe to parallel: prompts touching completely different files. Must serialize: same file touched, or B depends on A's output.

#### Commit convention

```
{type}: {short description} ({test count} tests)
```

Tag phase completions: `git tag phaseN-complete`

---

## 12. Invariants & Constraints

### Architectural invariants

| Rule | Why | Example violation |
|------|-----|-------------------|
| Soft delete on main entities | Recovery / sync | `DELETE FROM todos WHERE id = ?` |
| `syncEngine.enqueue` after synced writes | Future multi-device | Insert habit without enqueue |
| Single DB singleton before access | WAL / OPFS stability | Second `openDatabaseAsync` |
| IDs via `createId(prefix)` | Traceable entity type | `uuid()` or `Date.now()` alone |
| Date keys via `toDateKey()` | Consistent local calendar | Manual `toISOString().slice(0, 10)` for new rows |
| Migrations append-only | Deterministic upgrades | Editing `if (version < 5)` block |
| `habit_completions` uniqueness | One row per habit/day | Duplicate INSERT without SELECT |
| OPFS E2E single worker | SQLite lock | `workers: 2` in Playwright |
| Hard rejection validation | Data integrity | Silent clamping instead of error message |
| Tests never weakened | Code quality | Changing assertion to force pass |

### Sync invariants

- **Shape:** `SyncRecord { entity, id, updatedAt, operation }`
- **Enqueue after write** on: todos, habits, calorie_entries, workout_routines (including bump after nested workout structure changes)
- **No enqueue:** pomodoro_sessions, workout_logs, habit_completions, saved_meals
- **Remote off:** `NoopSyncAdapter`; `flush` only when `isRemoteEnabled()` — queue grows until then (documented tradeoff)

### Migration invariants

- Never change past `if (version < N)` blocks
- Use try/catch around `ALTER TABLE` for idempotent re-runs
- Update `db_schema_version` in same migration
- Next block: `version < (currentStored + 1)` — currently next is **10**

### Domain purity

- **No** `getDatabase` / `expo-sqlite` in `*.domain.ts`
- **No** React in domain
- **`import type`** from shared UI types is acceptable
- Acceptable exceptions: `habits.domain.ts` and others import `lib/time` and `constants` — pure functions, no I/O
- `calories.data.ts` imports `kcalFromMacros` from domain — data layer consuming pure helper (allowed)
- `todos.data.ts` imports `getTomorrowDateKey` from domain — thin date helper (allowed)

### Validation invariants

- Return `string | null` — **null = valid**, non-null = user-facing message
- **Hard rejection** only — no silent clamping
- Show `ValidationError`; clear on successful submit and on field change

### E2E / product invariants

- No `data-testid` in app components
- `clearDatabase` in `beforeEach` for feature specs
- `crossOriginIsolated` required in global setup

### Known technical debt & documentation drift

| Item | Detail | Suggested follow-up |
|------|--------|---------------------|
| `.cursor/skills/db-and-sync-invariants/SKILL.md` | States schema version **7** | Update to **9** + next **10** |
| `.cursor/commands/test.md`, `check.md` | Vitest "7 tests" baseline | Update to **141** |
| `.cursor/commands/audit.md` | Lists resolved/stale bugs | Refresh checklist |
| `tests/calories.data.STUB.test.ts` | No SQLite unit tests | Add mocked DB layer tests |
| `computeWorkoutStreakFromHeatmapDays` | No unit `it()` | Add test in `workout.domain.test.ts` |
| `HabitHeatmap.tsx` | Not used in `HabitsScreen` | Wire or remove if dead |
| `uuid` package | Unused for IDs | Remove or document future use |
| `schema.sql` | Out of date vs runtime | Regenerate or mark deprecated |
| Sync queue growth | Noop + remote off | Expected until Supabase adapter |
| `workout.data.ts` | `createId("wrk")` for both routines and logs | Document; prefix collision unlikely but IDs are namespaced by table |
| `core/db/client.ts` migration 5 comment | References `docs/knowledge-base/03_LIB_SHARED.md` — possibly stale path | Verify path after KB reorganization |

---

## 13. Feature Roadmap & Design Decisions

### Current state (verified)

| Area | Status |
|------|--------|
| Todos | List, priorities, due dates, drag reorder, daily recurrence, soft delete, swipe edit/delete |
| Habits | Categories, icons/colors, increment/decrement, aggregate 52-week heatmap, consistency %, Avocation-style layout |
| Focus | Pomodoro timer, 3 modes, classic sequence, custom durations, garden grid, yearly heatmap |
| Workout | Routines, exercises, sets, timed session flow, session logging, swipe edit/delete |
| Calories | Macro-based kcal, meal types, saved meals + search, goals, progress arc donut, 52-week heatmap |
| PWA / web | COOP/COEP require-corp, service worker v2, OPFS SQLite |
| Unit tests | **141** passing (Vitest) |
| E2E | **~59** Playwright tests (Chromium), `workers: 1` |
| Schema version | **9** |
| Cloud sync | Stub: `NoopSyncAdapter`, `isRemoteEnabled()` false by default |
| Validation | Hard rejection in all 5 screens via `lib/validation.ts` |
| Design system | Per-section colors, card accent strips, GitHub heatmaps, PillChips |

### Deferred / future

| Theme | What's missing | Notes |
|-------|----------------|-------|
| Supabase / remote sync | Real `SyncAdapter`, auth, conflict policy | `lib/supabase.ts` placeholder |
| Native background detection (7F) | Plant dies if user leaves app mid-focus | `expo-background-fetch` / `expo-task-manager` installed, unused — requires real device testing |
| Workout nested entities sync | Only routine row enqueued today | Comment in `workout.data.ts` — bump parent for remote refetch story |
| React Query | `QueryClientProvider` only | No cached queries in features |
| Zustand | Installed, unused | Global state deferred |
| `date-fns` | Unused | Could replace ad-hoc date formatting |
| Native `Alert` on web | No-op | E2E documents delete flows don't confirm on web |
| DB unit tests | STUB file skipped | No mocked `getDatabase` suite |

### Design decisions (evidence-based)

| Decision | Rationale |
|----------|-----------|
| Section colors (todos=blue, habits=green, focus=purple, workout=orange, calories=amber) | Color psychology for productivity — calm/focus/growth/energy/nutrition mapping |
| Strict habit completion | `count >= target_per_day` for "completed"; partial state for heatmap cells |
| Hard validation vs silent clamping | `lib/validation.ts` returns errors; user must fix invalid inputs |
| Scroll-down reward pattern | Stats + primary actions above fold; history/charts as reward for scrolling |
| Aggregate habit heatmap vs per-habit rows | `buildAggregatedHabitHeatmap` drives single 52-week view; per-habit `HabitHeatmap` component exists but unused |
| GitHub-style grid (weeks as columns) vs activity strip | Heatmap for year view; `ActivityPreviewStrip` available but being phased out in favor of `GitHubHeatmap` |
| Local `date_key` (migration 5) | `date_key_format: 'local'` + cutover without backfill |
| Soft delete everywhere | Recovery / sync compatibility |
| `habit_completions` hard delete at zero | Toggle-off semantics; high-churn; not synced |
| Avocation-style habits layout | Horizontal rows per time group, auto-wrap, always all groups visible |
| Classic Pomodoro sequence | 4× focus → long break; configurable via `sessionsBeforeLongBreak` |
| `getNextMode` guard (`completedFocusSessions > 0`) | Prevents `0 % N === 0` long-break-at-start bug |
| Swipe-left reveals Edit + Delete (not auto-action) | User must tap a button — no accidental deletes |
| Per-section color identity (no single brand color) | Each tab immediately identifiable by color; section color drives tab, cards, heatmap, chips |

---

## 14. Glossary

| Term | Meaning |
|------|---------|
| **app_meta** | Key/value SQLite table: `db_schema_version`, `guest_profile`, `calorie_goal`, `pomodoro_settings`, `date_key_format`, `date_key_cutover` |
| **BaseEntity** | `id`, `created_at`, `updated_at`, `deleted_at` |
| **CalorieEntryTotals** | Type in `features/calories/types.ts`: `{ calories: number }` — minimal shape for `caloriesTotal()` rollup |
| **CATEGORY_ORDER** | SQL `CASE` in `features/habits/habits.data.ts`: sorts by `anytime → morning → afternoon → evening → else`, then `created_at DESC` |
| **COOP / COEP** | Cross-origin policies — Metro middleware + `app.json` expo-router plugin; enables `SharedArrayBuffer` / SQLite WASM |
| **data-agent** | Cursor agent: DB, migrations, `*.data.ts`, `lib/id`, `lib/time` |
| **date_key** | `YYYY-MM-DD` string from `toDateKey()` (local calendar, post-migration 5) |
| **feature-agent** | Cursor agent: screens, domain, `core/ui`, `app/` |
| **FlashList** | `@shopify/flash-list` — high-performance virtualized list |
| **FOCUS_SECONDS** | Constant `25 * 60 = 1500` in `pomodoro.domain.ts` — focus duration in seconds |
| **guest** | `createId("guest")` profile JSON in `app_meta` |
| **hcmp** | ID prefix for `habit_completions` |
| **HABIT_COLORS** | Readonly array of hex strings in `habitPresets.ts` — palette for habit color dots |
| **HABIT_ICONS** | Readonly array of `HabitIcon` literals in `habitPresets.ts` — Material icon names |
| **HeatmapDay** | `{ dateKey: string; value: number }` — input type for `GitHubHeatmap` |
| **ActivityDay** | `{ dateKey: string; active: boolean; value?: number }` — input type for `ActivityPreviewStrip` |
| **MealType** | `"breakfast" \| "lunch" \| "dinner" \| "snack"` — alias from `CalorieEntry["meal_type"]` |
| **MEAL_OPTIONS** | Constant in `CaloriesScreen.tsx`: four `{ value, label }` pairs for meal-type `PillChip` |
| **NoopSyncAdapter** | Default sync adapter — no-op push/pull; queue grows until remote enabled |
| **PomodoroState** | `"idle" \| "running" \| "finished"` from `nextPomodoroState` |
| **PomodoroMode** | `"focus" \| "short_break" \| "long_break"` |
| **SectionKey** | `keyof typeof SECTION_COLORS` — `"todos" \| "habits" \| "focus" \| "workout" \| "calories"` |
| **Soft delete** | `deleted_at` set to timestamp; filter `deleted_at IS NULL` on reads |
| **SuperHabits** | App name; DB file `superhabits.db` |
| **SyncRecord** | Queue payload: `entity`, `id`, `updatedAt`, `operation` |
| **TabTrigger / TabSlot** | `expo-router/ui` custom tab UI primitives |
| **TimerPhase** | `{ exerciseName, exerciseIndex, setNumber, totalSets, phase: "active" \| "rest", durationSeconds }` |
| **WAL** | SQLite write-ahead log — native bootstrap only (not web) |
| **Workbox** | Registers `/sw.js` on web via `core/pwa/registerServiceWorker.ts` |
| **wrk** | Prefix for **both** `workout_routines` and `workout_logs` IDs |

### Acronyms

| Acronym | Expansion |
|---------|-----------|
| **CI** | Continuous integration |
| **COEP** | Cross-Origin-Embedder-Policy |
| **COOP** | Cross-Origin-Opener-Policy |
| **DDL** | Data definition language |
| **MVP** | Minimum viable product |
| **OPFS** | Origin Private File System (web SQLite storage) |
| **PWA** | Progressive web app |
| **RN** | React Native |
| **SQL** | SQLite (dialect via expo-sqlite) |
| **SW** | Service Worker (`/sw.js` on web) |
| **TS** | TypeScript |
| **UTC** | Coordinated Universal Time |
| **WAL** | Write-ahead logging (SQLite) |

---

## Maintenance Notes

When the codebase changes, update:
- **Test count** in `.cursor/rules/superhabits-rules.mdc`, `.cursor/agents/data-agent.md`, `.cursor/agents/feature-agent.md`
- **Schema version** in same files + `.cursor/skills/db-and-sync-invariants/SKILL.md` + `.cursor/commands/new-migration.md`
- **Known technical debt table** in section 12 when items are resolved
- **Deferred features table** in section 13 when items are implemented

### Documentation drift warnings

- `.cursor/skills/db-and-sync-invariants/SKILL.md` states schema version **7** — actual is **9**
- `.cursor/commands/test.md` and `check.md` state **7 tests** — actual is **141**
- `schema.sql` — not runtime authority; lags bootstrap DDL
- `HabitHeatmap.tsx` — exists but unused in `HabitsScreen`
- `audit.md` Known bugs list — partially obsolete; verify against runtime before acting
