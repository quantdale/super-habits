# 01_APP_ROUTING.md

## Scope

Expo Router file-based routes under `app/`: root layout, index redirect, `(tabs)` layout (custom sidebar + `expo-router/ui` tabs), and five tab route wrappers. Related: `package.json` `main`, `app.json` router plugin (headers listed in [05_QA_AND_TOOLING.md](./05_QA_AND_TOOLING.md)).

---

## Purpose

Defines URL ↔ screen mapping (web) and navigation shell (native). Feature UI lives in `features/*`; `app/` stays thin.

---

## Entry points

| Entry | File | Behavior |
|-------|------|----------|
| **npm `main`** | `package.json` → `"expo-router/entry"` | Expo Router bootstraps `app/` tree. |
| **Root layout** | `app/_layout.tsx` | Imports `@/global.css`; wraps tree in `AppProviders`; `StatusBar style="dark"`; `Stack` with `headerShown: false`; single child `(tabs)`. |
| **Index** | `app/index.tsx` | `<Redirect href="/(tabs)/todos" />` — `/` → todos tab. |
| **Tabs layout** | `app/(tabs)/_layout.tsx` | Custom `Tabs` + `TabList` + `TabTrigger` ×5 + `TabSlot` (see below). |
| **Tab routes** | `app/(tabs)/{todos,habits,pomodoro,workout,calories}.tsx` | Each default export renders one `*Screen` from `features/`. |

**Legacy (not in `main` chain):** Root `App.tsx` / `index.ts` may exist as Expo template leftovers — the active app uses `expo-router/entry` only.

---

## `app/_layout.tsx`

| Export | Signature | Behavior |
|--------|-----------|----------|
| `default` | `function RootLayout()` | Renders `AppProviders` → `StatusBar` → `Stack` with one screen `(tabs)`, headers hidden. |

**Imports:** `@/global.css`, `expo-router` `Stack`, `expo-status-bar` `StatusBar`, `@/core/providers/AppProviders`.

**Callers:** Expo Router (entry). **Callees:** `AppProviders`, `Stack.Screen`.

---

## `app/index.tsx`

| Export | Behavior |
|--------|----------|
| `default` | Redirects to `/(tabs)/todos`. |

---

## `app/(tabs)/_layout.tsx` — sidebar and navigation

### Constants

| Name | Value | Role |
|------|-------|------|
| `NAV_ITEMS` | Array of 5 objects | Each: `name` (route name for `TabTrigger`), `href`, `label`, `shortLabel`. |
| `BURGER_STRIP_WIDTH` | `56` | Fixed width of the menu icon column (px). |
| `SIDEBAR_PANEL_WIDTH` | `144` | Width of label panel when expanded (px). |

### `NAV_ITEMS` contents (exact)

| `name` | `href` | `label` | `shortLabel` |
|--------|--------|---------|--------------|
| `todos` | `"/(tabs)/todos"` | To Do | T |
| `habits` | `"/(tabs)/habits"` | Habits | H |
| `pomodoro` | `"/(tabs)/pomodoro"` | Focus | F |
| `workout` | `"/(tabs)/workout"` | Workout | W |
| `calories` | `"/(tabs)/calories"` | Calories | C |

`href` uses `as const` for typed routes (Expo experiments: `typedRoutes` in `app.json`).

### `NavItem` (inner component)

**Props (`NavItemProps`):** `isFocused?`, `onPress?`, `onLongPress?`, `label`, `shortLabel`, `collapsed`, `style?`, plus `Record<string, unknown>` rest spread onto `Pressable`.

| Prop | Effect |
|------|--------|
| `collapsed` | If true: `justify-center` on row; label text shows `shortLabel` instead of `label`. |
| `isFocused` | If true: `bg-brand-500` and white text; else transparent bg and slate text. |

**Styling:** NativeWind `className` for layout; `StyleSheet.flatten(style)` when `style` passed (from `TabTrigger`).

### Layout state

| State | Type | Initial | Updates |
|-------|------|---------|---------|
| `sidebarCollapsed` | `boolean` | `false` | Toggled at **two** places: (1) burger `Pressable` in top strip, (2) bottom `Pressable` with `«` chevron (`mt-auto`). Both: `setSidebarCollapsed((c) => !c)`. |

### Width math

- `panelWidth = sidebarCollapsed ? 0 : SIDEBAR_PANEL_WIDTH`
- `TabList` `style.width` / `minWidth` / `maxWidth` = `BURGER_STRIP_WIDTH + panelWidth`  
  When collapsed: sidebar shows only the 56px strip (labels hidden); expanded: 56 + 144.

### `TabTrigger` / `TabSlot`

- Imports: `Tabs`, `TabList`, `TabTrigger`, `TabSlot` from `expo-router/ui`.
- Each `NAV_ITEMS` entry: `<TabTrigger key={item.name} name={item.name} href={item.href} asChild>` wrapping `<NavItem ... collapsed={sidebarCollapsed} />`.
- `<TabSlot className="flex-1" />` renders the active tab’s screen content.

### Outer structure

- `<Tabs className="flex-1 flex-row">` — row: sidebar + content.
- `TabList`: column, border-r, white bg, padding; `flexDirection: "column"`, `overflow: "hidden"`.

---

## Tab route files (thin wrappers)

Each file: import `*Screen` from `@/features/...`; default export returns `<XxxScreen />` only.

| File | Screen component |
|------|------------------|
| `todos.tsx` | `TodosScreen` |
| `habits.tsx` | `HabitsScreen` |
| `pomodoro.tsx` | `PomodoroScreen` |
| `workout.tsx` | `WorkoutScreen` |
| `calories.tsx` | `CaloriesScreen` |

**No local state, no data hooks** — routing only.

---

## Client navigation surface (in-app)

| Path | Screen |
|------|--------|
| `/` | Redirect → `/(tabs)/todos` |
| `/(tabs)/todos` | Todos |
| `/(tabs)/habits` | Habits |
| `/(tabs)/pomodoro` | Pomodoro |
| `/(tabs)/workout` | Workout |
| `/(tabs)/calories` | Calories |

---

## HTTP / server API

**Not found** — `app/` defines no API routes.

---

## Tech stack (this layer)

| Source | Usage |
|--------|--------|
| `expo-router` | Layouts, `Redirect`, `Stack` |
| `expo-router/ui` | `Tabs`, `TabList`, `TabTrigger`, `TabSlot` |
| `react-native` | `Pressable`, `View`, `Text`, `StyleSheet` |
| `@expo/vector-icons` | `MaterialIcons` (menu icon) |
| NativeWind | `className` on layout |

---

## Known quirks

| Topic | Detail |
|-------|--------|
| **Sidebar vs mobile patterns** | Layout is optimized for a persistent side rail; small screens inherit same structure (no separate bottom tab bar). |
| **Typed routes** | `experiments.typedRoutes: true` in `app.json` — hrefs should match generated route types. |
