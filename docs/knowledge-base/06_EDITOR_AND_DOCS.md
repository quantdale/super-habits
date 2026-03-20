# 06_EDITOR_AND_DOCS.md

## Scope

This document covers **Cursor IDE project assets** under **`.cursor/`** (rules, skills, commands, agents) and **top-level human-facing documentation** (`README.md`). It also notes **`CODEBASE_KNOWLEDGE.md`** if present.

---

## Purpose

**What it does:** Encodes **repeatable AI/editor workflows** (scaffold feature, migration, audit, fix-data, fix-ui, check) and **non-negotiable project rules** for contributors and agents. **`README.md`** gives a short overview and smoke-test checklist for humans.

**Problem it solves:** Keeps data-layer vs UI-layer responsibilities explicit and aligns automation with SQLite/sync invariants.

---

## Tech stack

**Not applicable** — these are Markdown and Cursor config files, not runtime dependencies.

---

## Architecture pattern

**Editor-integrated documentation:** rules as **`.mdc`** with frontmatter; commands as **`.md`**; skills as **`SKILL.md`**; agents as **`.md`** with YAML frontmatter (`name`, `description`, `model`).

---

## Entry points

| Asset | Role |
|-------|------|
| `.cursor/rules/superhabits-rules.mdc` | **`alwaysApply: true`** — loaded as workspace rules; full project invariants and conventions. |
| `.cursor/commands/*.md` | Slash-command style playbooks (`new-feature`, `new-migration`, `audit`, `check`, `fix-data`, `fix-ui`). |
| `.cursor/skills/*/SKILL.md` | Deeper guidance: DB/sync, feature layout, RN/Expo UI. |
| `.cursor/agents/*.md` | Role prompts for **data-agent** vs **feature-agent** with scope split. |
| `README.md` | Project intro, scripts, architecture bullets, manual smoke tests. |

---

## Folder structure

### `.cursor/rules/`

| File | Description |
|------|-------------|
| `superhabits-rules.mdc` | Project identity, stack, **7 non-negotiable invariants** (soft delete, sync enqueue, DB singleton, `createId`, `toDateKey`, migrations, habit_completions uniqueness), naming conventions, new-feature layout, unused deps list, testing requirements, **known bugs** list. |

### `.cursor/commands/`

| File | Summary |
|------|---------|
| `new-feature.md` | Phased intake → plan → approval → implement; lists files to touch (migration, types, data, domain, screen, route, tab, tests); references three skills. |
| `new-migration.md` | Plan-first migration; points to `core/db/client.ts`; says **never** modify existing cases / bootstrap DDL; schema.sql reference only. **Note:** states “Current schema version: 3. New migration: case 4” — **conflicts** with `superhabits-rules.mdc` (schema **4**, next **5**) at time of documentation. |
| `audit.md` | Read-only pass over `features/`, `core/`, `lib/`, `app/`, `tests/` for invariant violations and known bugs. |
| `check.md` | Run `npm run typecheck` and `npm test`; expects **7 tests** passing. |
| `fix-data.md` | Data-layer fixes via **data-agent** + db-and-sync skill. |
| `fix-ui.md` | UI/domain fixes via **feature-agent** + feature-module + rn-expo skills. |

### `.cursor/skills/`

| Skill folder | Focus |
|--------------|--------|
| `db-and-sync-invariants/` | SQLite singleton, soft delete, sync enqueue exceptions, `createId`/`nowIso`/`toDateKey`, migrations. **Note:** SKILL states “Current: 3 / Next: 4” — **conflicts** with `superhabits-rules.mdc` (4 / 5). |
| `feature-module-pattern/` | Three-file feature layout, rules for `.data` / `.domain` / `Screen` / route. |
| `rn-expo-conventions/` | expo-router, NativeWind, FlashList, platform, notifications, state patterns. |

### `.cursor/agents/`

| File | Scope |
|------|--------|
| `data-agent.md` | **In scope:** `core/db/`, `sync.engine.ts`, `guestProfile.ts`, `features/**/*.data.ts`, `lib/id.ts`, `lib/time.ts`, tests. **Out:** screens, `app/`, `core/ui/`. Lists non-negotiables; says **“Current schema version: 3 — next migration: case 4”** — **conflicts** with `superhabits-rules.mdc`. |
| `feature-agent.md` | **In scope:** `*Screen`, `*.domain`, `core/ui`, `app/`, `lib/notifications.ts`, `AppProviders`. **Out:** `*.data.ts`, `core/db/`, `lib/id.ts`, `lib/time.ts`. |

### `.cursor/` other files

| Pattern | Description |
|---------|-------------|
| `debug-*.log` | Log files present under `.cursor/` (e.g. `debug-29741c.log`, `debug-6867cf.log`) — **IDE/debug artifacts**, not product documentation. |

### Repository root docs

| File | Status / content |
|------|------------------|
| `README.md` | **Present** — MVP modules list, npm scripts, high-level architecture, 7-step smoke checklist. |
| `CODEBASE_KNOWLEDGE.md` | **Not found** in workspace at path `CODEBASE_KNOWLEDGE.md` (glob/search returned no file). If restored or renamed, re-inventory separately. |

---

## API surface (HTTP / REST)

**Not found.**

---

## Data models

**Not found** in these files (rules describe entities conceptually; canonical types remain in `core/db/types.ts`).

---

## Config & environment variables

**Not found** in `.cursor/` or `README.md`.

---

## Inter-service communication

**Not found.**

---

## Auth & authorization

**Not found** — rules discuss **guest/local** data patterns, not remote auth providers.

---

## Key business logic

| Source | Logic |
|--------|--------|
| `superhabits-rules.mdc` | Defines **soft delete**, **sync enqueue** exceptions, **ID/date** rules, **migration** process. |
| `audit.md` | Defines what to scan for (hard deletes, missing enqueue, direct DB in screens, etc.). |
| `check.md` | Defines quality-gate commands and expected test count (**6**). |

---

## Background jobs / scheduled tasks

**Not found.**

---

## Error handling

**Not found** as automated tooling — commands instruct running `typecheck`/`test` and reporting failures.

---

## Testing

| Source | Statement |
|--------|-----------|
| `superhabits-rules.mdc` | New `*.domain.ts` functions require Vitest tests; **`npm test`**; **7 tests** passing (baseline called out). |
| `check.md` | Expects **7 tests passing**. |
| `data-agent.md` / `feature-agent.md` | Each says **“7 tests must pass after every change”**. |

---

## Deployment

**Not found** in `.cursor/` or `README.md` (README says local smoke tests only).

---

## Quirks

1. **Schema version:** Cursor commands/skills/agents were aligned to **`core/db/client.ts`** (stored version **4**, next **5**). Re-run this check when adding migrations.
2. **`feature-module-pattern/SKILL.md`** examples mention functions (e.g. `calculateStreak`, `formatTime`) that **may not** exist in the current codebase — treat as illustrative.
3. **`@shopify/flash-list` v2** does not expose **`estimatedItemSize`** in TypeScript props (differs from FlashList v1 docs online). **`TodosScreen`** uses `data`, `renderItem`, `keyExtractor` only.
4. **`.cursor/debug-*.log`** files are not part of the documented product; they may appear in git status depending on ignore rules.
5. **`CODEBASE_KNOWLEDGE.md`:** Referenced in earlier project snapshots but **missing** from the workspace — any master doc that linked to it should be updated.

---

## Open questions

1. Whether **`CODEBASE_KNOWLEDGE.md`** was removed, renamed, or never committed in this clone — **not** determinable from files present.
2. After future migrations, update **all** references (rules, skills, agents, `check.md`) so they stay in sync with `runMigrations`.
