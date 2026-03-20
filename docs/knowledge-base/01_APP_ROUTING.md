# 01_APP_ROUTING.md

## Scope

This document covers the **`app/`** directory (Expo Router file-based routes), **`package.json`** `main` entry, and legacy root files **`App.tsx`** and **`index.ts`** that relate to application bootstrap. It does not deep-dive into `core/providers` implementation (see `02_CORE_INFRA.md`).

---

## Purpose

**What it does:** Defines the client-side navigation tree: a root stack with a single child group `(tabs)`, a default redirect from `/` to the todos tab, and five tab routes that each render one feature screen component.

**Problem it solves:** Centralizes routing and layout so feature code in `features/*` stays screen-focused while URLs (web) and navigation state (native) follow a consistent structure.

---

## Tech stack

| Source | Evidence |
|--------|----------|
| **expo-router** | `package.json` dependency `expo-router`; `import` from `expo-router` and `expo-router/ui` in `app/` |
| **React / React Native** | Tab layout uses `react-native` `Pressable`, `View`, `Text`, `StyleSheet`; routes render feature screens |
| **expo-status-bar** | `StatusBar` in `app/_layout.tsx` |
| **@expo/vector-icons** | `MaterialIcons` in `app/(tabs)/_layout.tsx` |
| **NativeWind / Tailwind** | `className` on components in `(tabs)/_layout.tsx`; root imports `@/global.css` |
| **TypeScript** | `.tsx` files, typed `href` with `as const` on `NAV_ITEMS` |

---

## Architecture pattern

**Single-page application (Expo Router) with file-based routing:** one root **Stack** layout wrapping a **Tabs** layout (from `expo-router/ui`), with each tab file acting as a thin **route → screen** adapter. **Not** a backend, microservice, or REST API layer.

---

## Entry points

| Entry | Role |
|-------|------|
| **`package.json` → `"main": "expo-router/entry"`** | **Active** bootstrap for the app: Expo Router resolves routes under `app/`. |
| **`app/_layout.tsx`** | Root layout: global CSS, `AppProviders`, `Stack` with `(tabs)` screen, hidden headers. |
| **`app/index.tsx`** | Initial route `/`: `<Redirect href="/(tabs)/todos" />`. |
| **`app/(tabs)/_layout.tsx`** | Tab shell: `Tabs` / `TabList` / `TabTrigger` / `TabSlot` from `expo-router/ui`, custom sidebar nav. |
| **`app/(tabs)/{todos,habits,pomodoro,workout,calories}.tsx`** | Each exports a default component that renders the matching `*Screen` from `features/*`. |
| **`index.ts` (repo root)** | Calls `registerRootComponent(App)` from `./App`. **Not** referenced by `package.json` `main`. |
| **`App.tsx` (repo root)** | Default Expo template UI (“Open up App.tsx…”). **Not** used when `main` is `expo-router/entry`. |

---

## Folder structure

| Path | Contents / role |
|------|------------------|
| `app/_layout.tsx` | Root stack + providers + status bar + global styles import. |
| `app/index.tsx` | Redirect to default tab. |
| `app/(tabs)/_layout.tsx` | Tab navigation UI (collapsible sidebar labels, five triggers, `TabSlot` for content). |
| `app/(tabs)/todos.tsx` | Renders `TodosScreen`. |
| `app/(tabs)/habits.tsx` | Renders `HabitsScreen`. |
| `app/(tabs)/pomodoro.tsx` | Renders `PomodoroScreen`. |
| `app/(tabs)/workout.tsx` | Renders `WorkoutScreen`. |
| `app/(tabs)/calories.tsx` | Renders `CaloriesScreen`. |

---

## API surface (HTTP / RPC)

**Not found** — `app/` defines no server routes, lambdas, or HTTP handlers.

### Client navigation surface (in-app routes)

These are the **Expo Router** paths implied by the file tree and `NAV_ITEMS` / redirect (not HTTP methods).

| Path / href | Default export | Notes |
|-------------|----------------|-------|
| `/` | `app/index.tsx` | Redirects to `/(tabs)/todos`. |
| `/(tabs)/todos` | `TodosRoute` → `TodosScreen` | |
| `/(tabs)/habits` | `HabitsRoute` → `HabitsScreen` | |
| `/(tabs)/pomodoro` | `PomodoroRoute` → `PomodoroScreen` | |
| `/(tabs)/workout` | `WorkoutRoute` → `WorkoutScreen` | |
| `/(tabs)/calories` | `CaloriesRoute` → `CaloriesScreen` | |

---

## Data models

**Not found** in `app/` — no schemas, ORM models, or shared types defined here; types come from `core/db/types` and features.

---

## Config & environment variables

| Item | Location | Content (observed) |
|------|----------|---------------------|
| Expo Router plugin headers | `app.json` → `expo.plugins` → `expo-router` | `Cross-Origin-Embedder-Policy: credentialless`, `Cross-Origin-Opener-Policy: same-origin` |
| Typed routes | `app.json` → `expo.experiments` | `typedRoutes: true` |
| `.env` / `.env.local` in `app/` | — | **Not found** |

Other env usage (e.g. `EXPO_UNSTABLE_HEADLESS` in `npm run web`) lives in **`package.json` scripts**, not in `app/`.

---

## Inter-service communication

**Not found** — no HTTP clients, queues, or SDK calls in `app/` files.

---

## Auth & authorization

**Not implemented in `app/`** — access control is not expressed in route files. The root layout wraps children in **`AppProviders`** (`core/providers/AppProviders.tsx`); any auth/guest behavior is defined there or in `core/auth/`, not in this group.

---

## Key business logic

| Unit | Behavior |
|------|----------|
| **`app/index.tsx`** | Unconditional redirect to todos tab. |
| **`app/(tabs)/_layout.tsx`** | Maintains `sidebarCollapsed` state; toggles width of label panel; maps `NAV_ITEMS` to `TabTrigger` + `NavItem`; renders `TabSlot` for active tab content. |
| **Tab route files** | Pass-through: default export only mounts the corresponding feature screen. |

No domain calculations (habits, calories, etc.) live in `app/`.

---

## Background jobs / scheduled tasks

**Not found** in `app/`.

---

## Error handling

**Not found** in `app/` — no `ErrorBoundary`, try/catch, or logging in the files read; failures would propagate to React/runtime defaults unless handled in providers or feature screens.

---

## Testing

| Item | Finding |
|------|---------|
| Test files under `tests/` importing `app/` | **Not found** (grep: no matches). |
| Framework | Vitest is used project-wide (`vitest.config.ts`); **no** Vitest/RTL tests targeting `app/` were found. |

---

## Deployment

**Not specific to `app/`** — no Dockerfile or IaC in this folder. Expo static web output and native builds are driven by **`app.json`** and Expo CLI (`package.json` scripts), documented at project level.

---

## Quirks

1. **Two bootstrap stories:** `package.json` uses **`expo-router/entry`**, while **`index.ts`** still registers **`App.tsx`** via `registerRootComponent`. With the current `main`, **`App.tsx` / `index.ts` are unused** for normal `expo start` unless tooling overrides `main`.
2. **`App.tsx`** remains the default Expo placeholder UI and does not integrate Router or providers.
3. **Tab UI** uses **`expo-router/ui`** (`Tabs`, `TabTrigger`, `TabSlot`) rather than only the classic `Tabs` from `expo-router` — a more composable / headless pattern.
4. **Sidebar UX:** Collapse is available from a top burger strip and a bottom `«` control; both toggle the same `sidebarCollapsed` state.
5. **Redirect target:** `/` always goes to **todos**, not the last visited tab.

---

## Open questions

1. Whether **`index.ts` / `App.tsx`** are kept intentionally for tests, EAS profiles, or legacy tooling, or are safe to remove — **not stated in code** (only inferable from `main` mismatch).
2. **COOP/COEP** headers in `app.json` — interaction with embedding (e.g. iframes) or WASM on web is **not documented in-repo** in files reviewed for this section.
