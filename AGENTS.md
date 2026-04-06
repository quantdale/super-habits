# SuperHabits Agent Guide

Read this file first in every new session before exploring or editing the repo.

## Startup

1. Read `docs/PROJECT_STRUCTURE_MAP.md` first.
2. Then read:
   - `.cursorrules`
   - `.cursor/rules/superhabits-rules.mdc`
3. If the task is feature/UI work, also read:
   - `.cursor/skills/feature-module-pattern/SKILL.md`
   - `.cursor/skills/rn-expo-conventions/SKILL.md`
4. If the task is data/DB/sync work, also read:
   - `.cursor/skills/db-and-sync-invariants/SKILL.md`

## Authoritative Docs

- `docs/PROJECT_STRUCTURE_MAP.md`
- `.cursorrules`
- `.cursor/rules/superhabits-rules.mdc`
- `docs/knowledge-base/SUPERHABITS_UNIFIED_KNOWLEDGE_BASE.md`

If this file conflicts with the documents above, follow the more specific authoritative document.

## Architecture

- `app/`: Expo Router only. Thin route wrappers and layouts. No business logic.
- `features/`: Feature modules with `{feature}.data.ts`, `{feature}.domain.ts`, `*Screen.tsx` (exception: `features/overview/` is `OverviewScreen.tsx` only; `features/shared/` holds cross-feature components).
- `core/`: DB client, migrations, sync engine, providers, shared UI primitives.
- `lib/`: Pure helpers only. No DB access. No feature imports.

## Layering Rules

- Data layer: `*.data.ts`
  - Owns SQLite reads/writes, soft delete, sync enqueue, ID/time helpers.
  - No UI imports.
- Domain layer: `*.domain.ts`
  - Pure logic only.
  - No DB imports, no React, no side effects.
- UI layer: `*Screen.tsx`, feature components, `core/ui/`, `app/`
  - Presentation and orchestration only.
  - No direct DB imports.

## Non-Negotiable Invariants

- Soft delete only for main entities. Do not hard-delete synced entities.
- After applicable writes, call `syncEngine.enqueue(...)` immediately.
- Create IDs with `createId(prefix)` from `lib/id.ts`.
- Create YYYY-MM-DD date keys with `toDateKey()` from `lib/time.ts`.
- Migrations are append-only. Never edit old migration blocks.
- `schema.sql` is reference-only, not runtime authority.
- `getDatabase()` must remain the only DB entrypoint.

## Routing

- Thin route files only:
  - `app/(tabs)/{feature}.tsx` should render the screen and nothing else.

## Feature Workflow

- Read the relevant `*.data.ts` and `*.domain.ts` before changing feature logic.
- If modifying UI/domain code, treat the data file as the contract.
- If modifying persistence/schema/sync code, read `core/db/client.ts`, `core/db/types.ts`, `lib/id.ts`, and `lib/time.ts` first.

## Testing

- Run `npm run typecheck`
- Run `npm test`
- If web UI changed, run `npm run build:web` before Playwright E2E.
- E2E serves static `dist/` via `node scripts/serve-e2e.js`, not Metro.

## Task Routing

- Data/DB/sync/migration issues:
  - `.cursor/agents/data-agent.md`
- UI/domain/routing/component issues:
  - `.cursor/agents/feature-agent.md`

## Useful Command Specs

- `.cursor/commands/fix.md`
- `.cursor/commands/test.md`
- `.cursor/commands/pre-pr.md`

## Suggested Session Bootstrap Prompt

Use this in a new chat session:

`Read AGENTS.md and follow it before making changes.`
