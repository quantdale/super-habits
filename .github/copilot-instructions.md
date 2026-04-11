# SuperHabits Copilot Instructions

Read first:

1. `AGENTS.md`
2. `docs/PROJECT_STRUCTURE_MAP.md`
3. `docs/master-context.md`
4. `docs/working-rules.md`

## Repo Reality

- Offline-first Expo app for web, iOS, and Android
- SQLite is the source of truth
- Supabase is optional push-only backup sync
- Top-level tabs are Overview, Todos, Habits, Pomodoro, Workout, and Calories
- `/settings` is a routed utility screen outside the tab set

## Key Rules

- UI does not import `getDatabase()`
- Domain files stay pure
- Data files own SQLite writes and `syncEngine.enqueue(...)`
- `createId(prefix)` is the ID source
- `toDateKey()` uses local calendar dates
- `core/db/client.ts` migrations are append-only
- `core/db/schema.sql` is reference-only

## Commands

- `npm run typecheck`
- `npm test`
- `npm run build:web`
- `npm run e2e`

## E2E Reality

- Build web before E2E when the bundle changed.
- Playwright runs against static `dist/` served by `node scripts/serve-e2e.js`.
- Do not describe E2E as running against `npm run web`.

## Known Repo Caveat

- `npm run typecheck` is currently expected to fail until `tsconfig.json` stops using `ignoreDeprecations: "6.0"` with TypeScript `~5.9.2`.
