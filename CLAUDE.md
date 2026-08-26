# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SuperHabits is an offline-first productivity app built as a single-page experience: six sections (Overview, Todos, Habits, Pomodoro, Workout, Calories) rendered in `app/index.tsx` behind a `NavigationContext.activeSection` state, with Settings as a full-screen modal and the Command Center as a global overlay. One Expo + React Native codebase ships to web (PWA), iOS, and Android. Local **SQLite is the source of truth**; writes are optionally pushed to Supabase as backup (push-only, plus restore v1 onto empty devices — **not** two-way sync).

Stack: Expo SDK 55, React Native 0.83.4, React 19, TypeScript 5.9 (strict), Expo Router (file-based), NativeWind 4 + Tailwind 3, `expo-sqlite` (WAL native / SQLite WASM + OPFS on web), Supabase (anonymous auth), Vitest (unit), Playwright (E2E).

## Authoritative docs

`AGENTS.md` is the primary, most detailed guide — read it first. Deeper references:

- `docs/PROJECT_STRUCTURE_MAP.md` — architecture map
- `.cursor/rules/superhabits-rules.mdc` — invariants and conventions (mirrors much of AGENTS.md)
- `docs/knowledge-base/SUPERHABITS_UNIFIED_KNOWLEDGE_BASE.md`
- `.cursor/agents/data-agent.md` (DB/sync/migration work), `.cursor/agents/feature-agent.md` (UI/domain/routing)

If this file conflicts with those, follow the more specific one.

## Commands

```bash
npm run typecheck            # tsc --noEmit
npm run lint                 # eslint . --max-warnings 25  (warnings allowed under the cap)
npm run lint:fix
npm run format               # prettier --write .
npm test                     # vitest run
npm run test:watch

# Single unit test
npx vitest run tests/todos.domain.test.ts
npx vitest run -t "test name substring"

npm run build:web            # expo export -p web → dist/  (REQUIRED before E2E when web bundle changed)
npm run e2e                  # playwright test (serves dist/ via scripts/serve-e2e.js on :8081)
npm run e2e:headed | :debug | :report
npx playwright test e2e/todos.spec.ts   # single spec

npm run validate:themes      # node scripts/validate-theme-contrast.mjs
npx expo start               # dev server (also: npm run android | ios | web)
```

E2E note: Playwright does **not** build the app. Run `npm run build:web` yourself after changing React/web code, then `npm run e2e`. `workers: 1` locally is mandatory (OPFS holds one SQLite lock per origin); do not increase.

## Layering (strict — enforced per feature)

```
features/{name}/
  {name}.data.ts    ← ALL SQLite CRUD; soft delete; syncEngine.enqueue; createId/toDateKey. No React, no UI imports.
  {name}.domain.ts  ← pure logic only. No DB, no React, no side effects. Unit-tested in tests/.
  {Name}Screen.tsx  ← UI/orchestration. Imports .data + .domain. NEVER imports getDatabase/expo-sqlite.
app/index.tsx  ← section rendered behind NavigationContext.activeSection (no per-feature route file)
```

`app/` = Expo Router only. `core/` = cross-cutting infra (DB client+migrations in `core/db/client.ts`, entity types in `core/db/types.ts`, `app_meta` key registry in `core/db/appMeta.ts`, sync in `core/sync/`, linked actions, in-app notices in `core/notifications/` + `core/providers/InAppNoticeProvider.tsx` + `core/ui/InAppNoticeBanner.tsx`, themes in `core/theme/`, `AppProviders`, shared `core/ui/` primitives). `lib/` = no DB, no feature imports — but not all pure (`supabase.ts` has auth side effects, `notifications.ts` registers a module-scope handler, `useForegroundRefresh.ts` is React hooks). Path alias `@/` → project root.

Any component calling a `*.data.ts` function must be a descendant of `AppProviders`, which bootstraps in order: GestureHandler → `initializeDatabase()` → service worker (web) → `ensureAnonymousSession()` (when Supabase env set) → sync engine hydrate → restore prompt check.

## Non-negotiable invariants (violating these silently corrupts data)

1. **Soft delete only** on main entity tables — `UPDATE ... SET deleted_at = datetime('now')` and always `WHERE deleted_at IS NULL`. Never `DELETE FROM` synced tables.
2. **Enqueue on every write** — every recoverable `BACKUP_ENTITIES` write, including `pomodoro_sessions`, `workout_logs`, `habit_completions`, `saved_meals`, `linked_action_rules`, nested workout tables, planning entities, and Gym V2 metadata, goes through the durable outbox. Only `linked_action_events`, `linked_action_executions`, and `processed_notification_actions` are local operational state.
3. **DB singleton** — `getDatabase()` in `core/db/client.ts` is the only entrypoint; every data function starts with `const db = await getDatabase()`. Never open a second connection.
4. **IDs via `createId(prefix)`** from `lib/id.ts` (`{prefix}_{ms}_{rand8}`). Never `Math.random()`, `crypto.randomUUID()`, or bare `Date.now()`. Prefixes: `todo`, `habit`, `hcmp`, `cal`, `smeal`, `wrk`, `ex`, `eset`, `wsex`, `pom`, `rec`, `guest`.
5. **Date keys via `toDateKey()`** from `lib/time.ts` — local-calendar `YYYY-MM-DD` since migration 5 (`app_meta.date_key_cutover`; old UTC rows are not backfilled).
6. **Migrations are append-only** — never edit an existing block. Current stored schema version is **24**; add a new `if (version < 25) { ... }` block in `runMigrations()` in `core/db/client.ts`. `core/db/schema.sql` is a stale partial snapshot and reference-only — never executed at runtime; the runtime truth is `core/db/client.ts`.
7. **Hard-delete exceptions** — `habit_completions`: SELECT existing `(habit_id, date_key)` → INSERT (`hcmp`) or UPDATE count; hard `DELETE` allowed only when decrementing from 1 to 0, with a durable remote delete intent. `saved_meals` also hard-deletes by design (`deleteSavedMeal` in `features/calories/calories.data.ts`) with the same remote-delete contract. Neither is unsynced.

## Conventions

- Styling: NativeWind `className` with Tailwind utilities. Do **not** use `StyleSheet.create()` for new code (inline `StyleSheet` only for JS-dynamic values). Section colors from `constants/sectionColors.ts`.
- Lists: `@shopify/flash-list` (`FlashList`), not `FlatList` — except `features/todos/TodosScreen.tsx`, which intentionally uses `DraggableFlatList` (`react-native-draggable-flatlist`) for drag-reorder; do not convert it. Safe area: `<Screen>` from `core/ui/Screen.tsx`. Animations: `react-native-reanimated`. SVG: `react-native-svg`.
- Refresh pattern: re-call the list function after every mutation; `useActiveForegroundRefresh(isActive, ...)` from `lib/useForegroundRefresh.ts` keyed on `isActive`, plus `useForegroundRefresh` for app-state/visibility.
- Every new `*.domain.ts` function needs a Vitest test in `tests/`. Component rendering tests are intentionally limited.
- Do **not** add `data-testid` to app components to satisfy E2E; fix broken selectors in the spec instead. If an E2E test reveals a real bug, fix the app, not the test.

## Installed-but-unused (do not wire up without an explicit decision)

`date-fns`. State today is local `useState` only.

## Environment variables (all optional; app runs local-only if unset)

Supabase: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Command parser: `EXPO_PUBLIC_AI_COMMAND_PARSE_MODE` (`remote_with_fallback` to enable), `EXPO_PUBLIC_AI_COMMAND_INTERNAL_ROLLOUT`, `..._BACKEND_HOST`, `..._SUPABASE_FUNCTION_NAME`, `..._PROXY_URL`. `EXPO_PUBLIC_*` is bundled into the client — never put secrets there.

## Web / PWA gotcha

SQLite WASM requires `crossOriginIsolated`, enforced by COOP/COEP headers in `metro.config.js` (dev), `app.json`, and `vercel.json` (prod: `require-corp` / `same-origin` + SPA rewrite `/(.*)` → `/index.html`). Service worker `public/sw.js` cache is `superhabits-shell-v3`; localhost requests are network-first (no stale Metro cache). Deploy: `npm run build:web` → `dist/` on Vercel. Native APK: `eas build -p android --profile preview` (package `com.dale16.superhabits`).
