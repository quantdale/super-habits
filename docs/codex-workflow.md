# Codex Workflow for SuperHabits

Purpose: Codex-facing runbook. Keep canonical repo truth in the main docs instead of duplicating it here.

## Read Order

1. `AGENTS.md`
2. `docs/PROJECT_STRUCTURE_MAP.md`
3. `docs/master-context.md`
4. `docs/working-rules.md`

## Task Routing

- UI / domain work:
  - read the target screen
  - read the matching domain file
  - read the matching data file as contract
- Data / DB / sync work:
  - read the target data file
  - read `core/db/client.ts`
  - read `core/db/types.ts`
  - read relevant sync files
  - read `lib/id.ts` and `lib/time.ts`

## Validation

- Standard: `npm test`
- Web runtime changes: `npm run build:web`, then `npm run e2e`
- Typecheck:
  - run `npm run typecheck`
  - treat the current `ignoreDeprecations` mismatch in `tsconfig.json` as a known repo issue unless that config is part of the task

## Reporting

Report:

- root cause
- touched files
- commands run
- pass/fail or skipped checks
- remaining risks
