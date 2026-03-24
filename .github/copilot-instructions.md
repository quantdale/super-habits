# SuperHabits — Copilot Instructions

Offline-first productivity app (To Do, Habits, Focus/Pomodoro, Workout, Calories) targeting web (PWA), iOS, and Android. Stack: React Native 0.84 · Expo 55 · React 19 · TypeScript 5.9 · Expo Router · NativeWind 4 · expo-sqlite (WAL; OPFS on web).

---

## Commands

```bash
npm run typecheck        # tsc --noEmit
npm run test             # vitest run (CI, once)
npm run test:watch       # vitest watch

# Single unit test file
npx vitest run tests/todos.domain.test.ts
# Single unit test by name
npx vitest run -t "test name substring"

npm run e2e              # Playwright headless (requires prior: npm run build:web)
npm run e2e:headed       # Playwright with visible browser
npm run e2e:debug        # Playwright inspector

# Single E2E spec
npx playwright test e2e/todos.spec.ts

npm run build:web        # Expo web export (needed before e2e in CI)
```

---

## Architecture

### Directory roles

| Path | Role |
|------|------|
| `app/` | Expo Router only — root stack, `(tabs)/_layout`, thin `*.tsx` per tab (each renders one `*Screen`). No business logic. |
| `features/` | Product modules — one subdirectory per feature (see pattern below). |
| `core/` | Cross-cutting infra: DB singleton + migrations (`core/db/client.ts`), entity types (`core/db/types.ts`), sync queue (`core/sync/sync.engine.ts`), `AppProviders`, shared `core/ui/` primitives. |
| `lib/` | Pure/platform helpers: `id`, `time`, `validation`, `supabase` stub, notifications. No DB, no feature imports. |
| `constants/` | Design tokens — `sectionColors.ts` (per-tab palette). |
| `tests/` | Vitest unit specs for `*.domain.ts` and `lib/` helpers. |
| `e2e/` | Playwright specs + `helpers/` (`db.ts`, `navigation.ts`, `forms.ts`). |

### Feature module pattern

Every feature follows this exact structure:

```
features/{name}/
  {name}.data.ts    ← SQLite CRUD; calls syncEngine.enqueue after writes; uses createId/toDateKey
  {name}.domain.ts  ← Pure logic only — no DB, no React (unit-tested in tests/)
  {Name}Screen.tsx  ← UI: calls .data and .domain; no getDatabase() import
  types.ts          ← Narrow/re-exported types
app/(tabs)/{name}.tsx → default export <{Name}Screen /> only
```

### State management

- **Local UI state:** `useState` per screen (forms, modals, filters).
- **Tab-focus refresh:** `useFocusEffect` (Expo Router) to reload data when a tab gains focus.
- **Sync state:** `SyncEngine` in `core/sync/sync.engine.ts` — custom queue, not Redux/Zustand.
- **`@tanstack/react-query`** and **`zustand`** are installed but not yet actively used in screens.

---

## Key Conventions

### Module layering (strict)

- **Screen (`*Screen.tsx`)** — orchestration and presentation only. Never import `getDatabase` or `expo-sqlite`.
- **Data (`{feature}.data.ts`)** — owns all SQLite reads/writes, soft deletes, and `syncEngine.enqueue`. May import domain pure helpers.
- **Domain (`{feature}.domain.ts`)** — pure logic (no `getDatabase`, no `expo-sqlite`, no React). Unit-testable.

### Soft delete

Never `DELETE FROM` main entity tables. Use `deleted_at` timestamp + filter `WHERE deleted_at IS NULL`. Documented exceptions: `habit_completions` (hard-delete at count 0), `saved_meals` (hard delete by design).

### Sync enqueue

After **every** mutating write on synced entities, call `syncEngine.enqueue` immediately — only from `*.data.ts`. Synced entities: `todos`, `habits`, `calorie_entries`, `workout_routines` (+ routine bump after nested edits). Not synced: `pomodoro_sessions`, `habit_completions`, `workout_logs`, nested workout tables.

### IDs and date keys

```ts
import { createId } from "@/lib/id";   // createId("todo") → "todo_<ms>_<rand8>"
import { toDateKey } from "@/lib/time"; // toDateKey() → "YYYY-MM-DD" (UTC)
```

**Entity prefix registry:**

| Prefix | Entity |
|--------|--------|
| `todo` | todos |
| `habit` | habits |
| `hcmp` | habit_completions |
| `cal` | calorie_entries |
| `smeal` | saved_meals |
| `wrk` | workout_routines / workout_logs |
| `ex` | routine_exercises |
| `eset` | routine_exercise_sets |
| `wsex` | workout_session_exercises |
| `pom` | pomodoro_sessions |
| `rec` | todos.recurrence_id |

`toDateKey()` uses UTC — do not change without coordinating (affects historical keys).

### Schema migrations

All migrations live in `core/db/client.ts` (`runMigrations`). They are **append-only** — never edit past `if (version < N)` blocks. Current schema: **v9**; next migration uses `if (version < 10)`. `core/db/schema.sql` is a reference, not runtime.

### Styling

NativeWind 4 (`className` prop) for all static styles. Use inline `StyleSheet` only for dynamic values that depend on JS variables. Section colors come from `constants/sectionColors.ts`.

### TypeScript

`strict: true`. Path alias `@/` maps to the project root (e.g., `@/lib/id`, `@/features/todos/todos.data`). Vitest globals (`describe`, `it`, `expect`) are available without imports.

### Pre-edit rule for feature logic

Before modifying a feature's business or persistence behavior, read the relevant `*.data.ts` and/or `*.domain.ts` and confirm the touchpoints in your reply. Read them first if you haven't.

---

## E2E Test Patterns

E2E tests run against a static web export served on `localhost:8081`. Each spec uses helpers from `e2e/helpers/`:

- **`clearDatabase(page)`** — deletes OPFS SQLite files and reloads for test isolation.
- **`goToTab(page, tab)`** — navigates and waits for React hydration (checks `__reactFiber` on inputs).
- **`fillCaloriesMacros` / `fillRoutineName`** (in `helpers/forms.ts`) — RN Web `TextInput` requires `click()` then `type(..., { delay })`, not `fill()` alone.

Use `getByText` for `Button`/`Pressable` labels (RN Web doesn't always expose `role=button` + accessible name). Playwright workers stay at 1 locally (OPFS lock per origin).

---

## MCP Servers (`.vscode/mcp.json`)

| Server | Use in this project |
|--------|---------------------|
| **playwright** | Browser automation — interact with the Expo web app on `localhost:8081`, inspect the DOM, fill forms, click elements during E2E debugging |
| **github** | Issues, PRs, code search across the repo (requires Docker + GitHub PAT prompt) |
| **fetch** | Fetch external URLs, docs, or APIs and return them as markdown/JSON |
| **lighthouse** | Run PWA / performance / accessibility audits against `localhost:8081` |

E2E work: start `npm run web` first, then use the **playwright** MCP to drive the browser in parallel with Playwright specs.

---

## Where Does X Live?

| Need | Location |
|------|----------|
| SQL, getDatabase, migrations | `core/db/client.ts` only |
| Entity TypeScript types | `core/db/types.ts` |
| Sync queue API | `core/sync/sync.engine.ts` |
| Reusable RN components | `core/ui/` |
| Feature CRUD + enqueue | `features/*/{name}.data.ts` |
| Pure rules, streaks, formatting | `features/*/{name}.domain.ts` |
| Screens and wiring | `features/*/*Screen.tsx` |
| ID generation | `lib/id.ts` |
| Date keys (YYYY-MM-DD) | `lib/time.ts` (`toDateKey`) |
| Form validation messages | `lib/validation.ts` |
| Section color tokens | `constants/sectionColors.ts` |
| Unit tests | `tests/*.test.ts` |
| E2E specs | `e2e/*.spec.ts` |
