# SuperHabits

SuperHabits is an offline-first productivity app for web, iOS, and Android built from a single Expo + React Native codebase.

The app is local-first:

- SQLite is the source of truth
- web uses static export plus OPFS-backed SQLite runtime support
- Supabase is optional and currently acts as one-way push backup sync, not bidirectional sync

## Current Stack

Exact versions live in `package.json`. Current repo state includes:

- Expo 55
- React 19
- React Native 0.83
- TypeScript 5.9
- Expo Router
- NativeWind 4
- `expo-sqlite`
- Supabase JS client
- Vitest
- Playwright

## Product Areas

- Overview
- Todos
- Habits
- Pomodoro / Focus
- Workout
- Calories
- Settings utility route

## Development

```bash
npm install
npm run start
```

Useful commands:

- `npm run android`
- `npm run ios`
- `npm run web`
- `npm run build:web`
- `npm run typecheck`
- `npm test`
- `npm run e2e`

## Web / PWA Notes

- Production-like web validation uses static export, not Metro.
- Playwright E2E runs against `dist/` served by `node scripts/serve-e2e.js`.
- Web SQLite reliability depends on COOP and COEP headers configured in `vercel.json`.

## Documentation Map

- Bootstrap: `AGENTS.md`
- Structure: `docs/PROJECT_STRUCTURE_MAP.md`
- Core context: `docs/master-context.md`
- Working rules: `docs/working-rules.md`
- Supporting deep dive: `docs/knowledge-base/SUPERHABITS_UNIFIED_KNOWLEDGE_BASE.md`

## Known Drift / Risks

- `core/db/schema.sql` is reference-only and stale relative to runtime migrations.
- Sync is push-only today because `SupabaseSyncAdapter.pull()` is not implemented.
- `npm run typecheck` is currently blocked by the repo's `tsconfig.json` `ignoreDeprecations` setting versus the installed TypeScript version.
