# SuperHabits — AI Task Brief Template

Use this template when briefing ChatGPT or Codex for a task in this repo.

---

## Task

[Describe the task clearly in one paragraph.]

## Layer

Choose one:

- UI / domain
- Data / DB / sync
- Both

## Target files or paths

[List exact files or directories expected to change.]

## Must-preserve invariants

[List anything that must not break.]
Examples:

- do not edit old migrations
- do not hard-delete synced entities
- preserve recurring todo generation
- preserve local `toDateKey()` semantics
- keep domain files pure
- do not import DB in screens

## Relevant product behavior

[Describe the current behavior that matters for this task.]

## UI / design alignment

For UI work, require the change to follow the shared app-wide design language:

- use `features/overview/OverviewScreen.tsx` as the canonical visual reference
- match the shared page-header, stat-row, panel/card, and spacing rhythm
- reuse shared `core/ui/` primitives before inventing new styling patterns
- preserve feature section color identity while keeping the structural UI consistent

## Schema impact

Choose one:

- no schema change
- schema change required
- uncertain, verify first

If schema change is required:

- use next migration slot
- update affected runtime types
- check affected data-layer functions

## Sync impact

Choose one:

- no sync impact
- synced entity behavior changes
- non-synced entity only
- uncertain, verify first

## Platforms that matter

Choose any:

- web
- iOS
- Android
- PWA/static export
- sync behavior

## Acceptance criteria

[List concrete done conditions.]

## Validation required

Minimum:

- `npm run typecheck`
- `npm test`

Optional:

- `npm run build:web`
- `npm run e2e`

## Read first

Always read:

- `AGENTS.md`
- `docs/PROJECT_STRUCTURE_MAP.md`
- `docs/knowledge-base/SUPERHABITS_UNIFIED_KNOWLEDGE_BASE.md`

Also read all affected files completely before editing.

## Extra instruction

Verify behavior against current code, not stale docs.
