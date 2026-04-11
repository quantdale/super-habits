# SuperHabits AI Task Template

Purpose: reusable task briefs for Codex or ChatGPT. Reference the canonical docs instead of copying large rule blocks.

## Minimal Brief

```md
Read `AGENTS.md`, `docs/PROJECT_STRUCTURE_MAP.md`, `docs/master-context.md`, and `docs/working-rules.md` first.

Task type: [feature | fix | audit | migration | docs]
Layer: [UI/domain | data/DB/sync | both]
Scope: [files or folders]
Goal: [what should change]

Must preserve:
- SQLite as source of truth
- current layering boundaries
- current sync model
- [task-specific invariants]

Platforms that matter:
- [web / iOS / Android / PWA / sync]

Validation:
- [commands to run]

Check against current code, not stale docs.
If docs conflict with code, call out the drift explicitly.
```

## UI Task Addendum

```md
Before editing:
- read the feature's `*.data.ts`
- read the feature's `*.domain.ts`

Preserve:
- no direct DB imports in UI
- thin route wrappers
<<<<<<< HEAD
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
=======
- shared top-level screen structure
- feature color identity
>>>>>>> a74517a (dark mode, documentatiton, blank fix)
```

## Data / Sync Task Addendum

```md
Before editing:
- read `core/db/client.ts`
- read `core/db/types.ts`
- read the affected `*.data.ts`
- read relevant sync files
- read `lib/id.ts` and `lib/time.ts`

Preserve:
- `getDatabase()` as the only DB entrypoint
- append-only migrations
- immediate sync enqueue for synced entities
- `createId(prefix)` and `toDateKey()` usage
- push-only sync assumptions
```
<<<<<<< HEAD

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
=======
>>>>>>> a74517a (dark mode, documentatiton, blank fix)
