# SuperHabits AI Task Template

Purpose: reusable briefing templates for future ChatGPT/Codex sessions. Keep prompts concrete. Reference `docs/master-context.md` for architecture and `docs/working-rules.md` for guardrails instead of repeating them.

## Minimal Task Brief

Use this for most tasks:

```md
Read `AGENTS.md`, `docs/PROJECT_STRUCTURE_MAP.md`, `docs/master-context.md`, and `docs/working-rules.md` first.

Task type: [feature | fix | refactor | migration | audit | pre-PR]
Scope: [files/folders/features]
Goal: [what should change]

Must preserve:
- offline-first SQLite-first behavior
- current layering rules
- [task-specific invariants]

Check against current code, not stale docs.
If docs conflict with code, call it out explicitly.
```

## Feature Task

```md
Read `AGENTS.md`, `docs/master-context.md`, and `docs/working-rules.md` first.

This is feature/UI work in:
- `features/[feature]/`
- `app/(tabs)/[route].tsx` [only if needed]

Goal:
- [user-facing feature change]

Before editing:
- read `features/[feature]/[feature].data.ts`
- read `features/[feature]/[feature].domain.ts` if it exists

Must preserve:
- no direct DB access from screens/components
- thin route wrappers
- existing validation and sync behavior unless explicitly changing it

UI / design requirements:
- treat `features/overview/OverviewScreen.tsx` as the canonical visual reference for page structure
- match the shared app-wide header, panel/card, spacing, and section rhythm before introducing new visual patterns
- reuse shared UI primitives in `core/ui/` before creating one-off screen styling
- preserve feature color identity while keeping the structural layout language consistent across tabs

Validation:
- run `npm test`
- if web UI changed, run `npm run build:web`
- if web behavior changed, run `npm run e2e` after build
```

## Bug Fix Task

```md
Read `AGENTS.md`, `docs/master-context.md`, and `docs/working-rules.md` first.

Bug:
- [describe the observed behavior]

Expected:
- [describe the correct behavior]

Scope:
- [suspected files or feature]

Requirements:
- confirm root cause from code before patching
- keep the fix minimal
- call out any doc drift or stale comments you find

Validation:
- [tests/commands relevant to the bug]
```

## Data / Sync / Migration Task

```md
Read `AGENTS.md`, `docs/master-context.md`, and `docs/working-rules.md` first.

This is data/DB/sync work in:
- `core/db/client.ts`
- `core/db/types.ts`
- `core/sync/*`
- `features/[feature]/[feature].data.ts`

Goal:
- [migration or persistence change]

Must preserve:
- `getDatabase()` as the only DB entrypoint
- soft delete rules
- `createId(prefix)` usage
- `toDateKey()` usage
- immediate sync enqueue on synced entities
- append-only migrations

If schema changes:
- use the next migration slot documented in `docs/master-context.md`
- do not edit older migration blocks
- call out any required follow-up to `schema.sql` as documentation drift, not runtime authority

Validation:
- `npm test`
- `npm run typecheck` if it becomes valid in the repo
```

## Refactor Task

```md
Read `AGENTS.md`, `docs/master-context.md`, and `docs/working-rules.md` first.

Refactor goal:
- [clarity / duplication / structure objective]

Scope:
- [paths]

Constraints:
- no behavior changes unless explicitly listed
- preserve layering boundaries
- preserve sync and persistence semantics
- prefer small, reviewable edits over broad rewrites
- for UI refactors, align to the Overview-derived shared design system and prefer shared primitives over page-specific styling drift

Validation:
- [relevant tests]
```

## Audit / Review Task

```md
Read `AGENTS.md`, `docs/master-context.md`, and `docs/working-rules.md` first.

Audit scope:
- [feature / subsystem / PR / files]

Priorities:
1. correctness and regressions
2. invariant violations
3. sync/data risks
4. test gaps
5. stale docs or misleading comments

Output format:
- findings first, ordered by severity
- include file references
- keep summaries brief
```

## Pre-PR Task

```md
Read `AGENTS.md`, `docs/master-context.md`, and `docs/working-rules.md` first.

Prepare this change for review.

Do:
- inspect the touched files
- verify architecture and invariant compliance
- run the relevant checks
- list any remaining risks or gaps

Checks:
- `npm test`
- `npm run build:web` if web UI changed
- `npm run e2e` if web behavior changed and static build was updated
- `npm run typecheck` only if the repo-level config issue has been fixed
```

## What Good Briefs Include

- target files or feature area
- whether this is UI/domain work or data/sync work
- explicit invariants that must not change
- required validation commands
- whether web/PWA behavior matters
- whether stale docs should be treated as secondary to current code
- for UI work, whether the change matches the Overview-derived shared header/card/panel/spacing system
