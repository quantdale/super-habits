# SuperHabits

Offline-first productivity app for **web (PWA)**, **iOS**, and **Android**. Data lives in SQLite on device; cloud sync is optional and gated behind remote mode (see `lib/supabase.ts`).

## Modules

| Tab        | Feature                                      |
| ---------- | -------------------------------------------- |
| To Do      | Task list                                    |
| Habits     | Habit tracking and completions               |
| Focus      | Pomodoro timer and session logging           |
| Workout    | Routines and completion checklist          |
| Calories   | Daily calorie log and totals                 |

## Stack

- **React Native** 0.83 · **Expo** 55 · **React** 19  
- **TypeScript** 5.9 · **expo-router** · **NativeWind** 4 (Tailwind)  
- **expo-sqlite** (WAL mode) · **Vitest** for unit tests  

## Prerequisites

- [Node.js](https://nodejs.org/) (use a current LTS; Expo SDK 55 is easiest on Node 20+)
- npm (ships with Node)

## Scripts

| Command              | Purpose                    |
| -------------------- | -------------------------- |
| `npm run start`      | Expo dev server            |
| `npm run web`        | Web / PWA dev              |
| `npm run android`    | Android                    |
| `npm run ios`        | iOS                        |
| `npm run typecheck`  | `tsc --noEmit`             |
| `npm run test`       | Vitest (CI-style, once)    |
| `npm run test:watch` | Vitest watch mode          |

## Project layout

- `features/*` — screens, `.data.ts` (SQLite), `.domain.ts` (pure logic)
- `app/*` — routes; tab shell in `app/(tabs)/`
- `core/*` — DB client, migrations, shared UI/sync helpers
- `lib/*` — IDs, time helpers, remote flags
- `tests/*` — Vitest specs (domain tests today; **19** passing tests)

Schema migrations run in `core/db/client.ts` (`runMigrations`). Stored schema version is tracked in `app_meta.db_schema_version` (currently **4**).

## Web / PWA notes

- **COEP** is set for `crossOriginIsolated` (shared-memory WASM on web); see `metro.config.js` and `app.json`.
- **Service worker** lives under `public/sw.js` (shell cache). Local dev targets use network-first behavior to avoid stale Metro bundles.

## Smoke test (manual)

1. Open **web** and a **native** target; confirm tabs load.
2. **To Do:** add, complete, and remove a task; confirm list updates.
3. **Habits:** add a habit and mark completion for today.
4. **Focus:** run a short pomodoro to completion; confirm a session is recorded.
5. **Workout:** create or use a routine and mark items done.
6. **Calories:** add entries; confirm daily total changes.
7. Force-close and reopen; confirm data persists.

## Audit Findings and Recommendations

### Main Issues Identified
- No explicit audit/fix/e2e-fix documentation files found, but audit processes and known issues are referenced in `docs/knowledge-base/SUPERHABITS_UNIFIED_KNOWLEDGE_BASE.md`.
- Some documentation (e.g., audit.md) is noted as "partially obsolete" and should be verified against runtime before acting.
- Error handling: Some errors are silently swallowed (e.g., DB open failures, service worker cache errors), which can obscure real issues.
- No global error/retry customization for query clients.
- ID generation is not crypto-strong (local only), which is acceptable for the use case but should be documented.
- E2E and unit tests are present and referenced, but some test stubs are skipped (e.g., calories.data.STUB.test.ts).
- UI validation is hard-reject only (no silent clamping), but error messages are surfaced to users.
- PWA: Service worker uses network-first for dev, cache-first for prod; stale cache risk is mitigated but should be documented.
- Accessibility and usability are not explicitly documented as tested or audited.

### Actionable Recommendations
- Update and verify all audit/fix documentation (e.g., audit.md, fix.md) to ensure they reflect the current codebase and runtime behavior.
- Improve error handling: Avoid silent error swallowing, especially for DB and service worker operations. Log or surface errors for debugging.
- Add or update documentation on error handling strategies and known limitations (e.g., local ID generation, soft delete exceptions).
- Expand accessibility and usability documentation. If audits have been performed, summarize findings and fixes; if not, add a TODO to perform them.
- Ensure all test stubs are either implemented or clearly marked as intentionally skipped, with reasons documented.
- Document the PWA service worker strategy and any known limitations or workarounds for stale cache issues.
- Add a section on UI/UX patterns and validation feedback, including how errors are shown and cleared.

See `docs/knowledge-base/SUPERHABITS_UNIFIED_KNOWLEDGE_BASE.md` and `docs/PROJECT_STRUCTURE_MAP.md` for more details.

## Contributing / data rules

Main entities use **soft delete** and a **sync enqueue** after writes when remote sync is enabled. Do not hard-delete synced rows or skip enqueue without reading the invariants in `.cursor/rules/superhabits-rules.mdc` (and the db/sync skill under `.cursor/skills/`).

**Known tradeoff:** `toDateKey()` in `lib/time.ts` uses UTC, not local midnight—changing it affects historical keys; coordinate before altering.
