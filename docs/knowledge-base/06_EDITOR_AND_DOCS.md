# 06_EDITOR_AND_DOCS.md

## Scope

Cursor project assets under `.cursor/` (read-only for KB authors per repo policy), root `README.md`, and documentation gaps. **This file summarizes** rules/agents/commands/skills — it does not replace the live files in `.cursor/`.

### MCP servers (`~/.cursor/mcp.json`)

Configured in the user’s Cursor settings (not in-repo). Complements Playwright for audits and HTTP inspection.

| MCP | Package | Purpose |
|-----|---------|---------|
| playwright | @playwright/mcp@latest | Live browser inspection, pre-PR checks |
| lighthouse | @danielsogl/lighthouse-mcp@latest | Performance audits, PWA checklist, Core Web Vitals |
| fetch | mcp-server-fetch (`pip install`; `python -m mcp_server_fetch`) | HTTP response headers, endpoint inspection |

---

## `.cursor/rules/superhabits-rules.mdc`

Workspace-level rules (always applied): project identity, **non-negotiable invariants** (soft delete, sync enqueue, DB singleton, `createId`, `toDateKey` UTC caveat, migrations append-only, `habit_completions` uniqueness pattern), file naming, feature structure, unused dependencies, testing expectations, known bugs.

**KB alignment:** Schema stored **4**, next migration **5**; **7** Vitest tests; sync flush gated on `isRemoteEnabled()` (see [02_CORE_INFRA.md](./02_CORE_INFRA.md)).

---

## `.cursor/agents/`

### `data-agent.md`

| Aspect | Content |
|--------|---------|
| **Scope** | `core/db/*`, `core/sync/sync.engine.ts`, `core/auth/guestProfile.ts`, `features/*/*.data.ts`, `lib/id.ts`, `lib/time.ts`, tests for data |
| **Out of scope** | Screens, `app/`, `core/ui/` |
| **Workflow** | Read files → plan → approval → implement → `npm run typecheck` + `npm test` → report |
| **Model** | `inherit` (frontmatter) |

### `feature-agent.md`

| Aspect | Content |
|--------|---------|
| **Scope** | `*Screen.tsx`, `*.domain.ts`, `core/ui/`, `app/`, `lib/notifications.ts`, `AppProviders` |
| **Out of scope** | `*.data.ts`, `core/db/*`, `lib/id.ts`, `lib/time.ts` |
| **Workflow** | Same pattern as data-agent |

**Stale lines in source file (KB truth vs agent text):** The agent file may still mention “hard-coded `meal_type='snack'`” and “7 tests” — runtime `CaloriesScreen` **selects** meal type; verify `.cursor` copy on edits.

---

## `.cursor/commands/` — full templates

The following reproduce **`.cursor/commands/*.md`** verbatim (fenced as markdown). Use the live files under `.cursor/commands/` if they differ.

### `audit.md`

**Placeholders:** none.

**Phase structure:** Single unnumbered pass (read → audit → report).

```markdown
# audit

Read-only audit of the SuperHabits codebase. No code changes.

---

Read-only audit — do not modify any file.

Read every file in features/, core/, lib/, app/, and tests/.

Audit for:
1. Invariant violations:
   - Hard deletes instead of soft deletes
   - Missing syncEngine.enqueue() after writes
   - IDs not using createId()
   - Timestamps not using nowIso() / toDateKey()
   - DB access before getDatabase()
2. Missing migrations for schema changes
3. domain.ts files that import from DB (purity violation)
4. Screen files that import from DB directly (bypassing data layer)
5. New domain functions without tests
6. Unused imports or dead code (beyond known: App.tsx, index.ts, nextPomodoroState)
7. Known bugs still present:
   - toDateKey() UTC issue (lib/time.ts)
   - meal_type hard-coded to "snack" (calories.data.ts)
   - sync queue never flushed
8. Any new issues since the last audit

Output for each finding:
- File + line range
- Severity: Critical / High / Medium / Low
- Problem
- Recommended fix

Sort by severity. End with counts.
```

**Hard constraints / non-negotiables:** Not stated (read-only audit).

---

### `check.md`

**Placeholders:** none.

**Phase structure:** Run commands → report (no numbered phases).

```markdown
# check

Run all quality gates for SuperHabits and report results.

---

Run the full local quality gate for SuperHabits.

From the project root:
1. npm run typecheck    (tsc --noEmit)
2. npm test             (vitest run)

Report for each:
- Pass / Fail
- If fail: exact error output and file + line

Expected baselines:
- typecheck: 0 errors
- npm test: 7 tests passing (update baseline if tests change)

Final summary: overall Pass / Fail.
If anything fails, identify root cause and suggest fix.
```

---

### `fix-data.md`

**Placeholders:**

| Token | Expects |
|-------|---------|
| `{{issue}}` | Plain-language description of the data-layer bug / change (SQLite, migration, `*.data.ts`, types) |

**Phase structure (Workflow):**

1. Read affected files in `core/db/` and `features/*/data.ts`.
2. Identify root cause (file + line).
3. Write plan; wait for approval.
4. Implement.
5. Run typecheck + test.
6. Report root cause, fix, test count.

**Constraints block (verbatim):**

```markdown
Hard constraints:
- Soft delete only
- syncEngine.enqueue() on every applicable write
- createId() for all IDs
- New columns require new migration
- Do not touch Screen or domain files (use /fix-ui for that)
```

**Full prompt body:**

```markdown
# fix-data

Fix a data layer issue (SQLite, migration, *.data.ts, types). Plan-first via data-agent.

---

Use data-agent subagent.
Apply db-and-sync-invariants skill.

Issue: {{issue}}

Workflow:
1. Read all affected files in core/db/ and features/*/data.ts.
2. Identify root cause precisely (file + line).
3. Write plan: files to change, exact changes.
4. Wait for approval.
5. Implement.
6. Run npm run typecheck, npm test.
7. Report: root cause, fix, test count.

Hard constraints:
- Soft delete only
- syncEngine.enqueue() on every applicable write
- createId() for all IDs
- New columns require new migration
- Do not touch Screen or domain files (use /fix-ui for that)
```

---

### `fix-ui.md`

**Placeholders:**

| Token | Expects |
|-------|---------|
| `{{issue}}` | Plain-language description of the UI / screen / domain logic issue |

**Phase structure (Workflow):** 1–8 as in file (read screens + domain → read `.data.ts` without modifying → plan → approval → implement → typecheck + test → report).

**Constraints block (verbatim):**

```markdown
Hard constraints:
- No direct DB imports in Screen or domain files
- New domain functions need Vitest tests
- Use FlashList not FlatList
- Use NativeWind className not StyleSheet.create
- Do not wire up zustand or React Query without explicit instruction
- Do not silently fix toDateKey() UTC bug
```

**Full prompt body:**

```markdown
# fix-ui

Fix a UI, screen, or domain logic issue in SuperHabits. Plan-first via feature-agent.

---

Use feature-agent subagent.
Apply feature-module-pattern and rn-expo-conventions skills.

Issue: {{issue}}

Workflow:
1. Read all affected Screen and domain files.
2. Read the corresponding .data.ts for the data API (do not modify it).
3. Identify root cause precisely (file + line).
4. Write plan: files to change, exact changes.
5. Wait for approval.
6. Implement.
7. Run npm run typecheck, npm test.
8. Report: root cause, fix, test count.

Hard constraints:
- No direct DB imports in Screen or domain files
- New domain functions need Vitest tests
- Use FlashList not FlatList
- Use NativeWind className not StyleSheet.create
- Do not wire up zustand or React Query without explicit instruction
- Do not silently fix toDateKey() UTC bug
```

---

### `new-feature.md`

**Placeholders:**

| Token | Expects |
|-------|---------|
| `{{feature}}` | Description of the new feature to scaffold (data, UX, persistence needs) |

**Phase structure:**

| Phase | Summary |
|-------|---------|
| **Phase 1 — Intake** | Answer questions (fields, entity, table, sync, domain, notifications, cross-feature) before planning |
| **Phase 2 — Plan** | List every file to create/modify (migration, types, data, domain, screen, route, tab, tests) |
| **Phase 3** | Wait for plan approval |
| **Phase 4 — Implement** | data-agent / feature-agent: data → domain → screen |
| **Phase 5 — Report** | Files, migration number, test count, limitations |

**Constraints:** No separate “Hard constraints” header; rules are embedded in skills (referenced in intro).

**Full prompt body:**

```markdown
# new-feature

Scaffold a new SuperHabits feature module end-to-end: DB table, migration, data layer, domain logic, screen, and route.

---

Apply db-and-sync-invariants, feature-module-pattern, and rn-expo-conventions skills.

New feature request: {{feature}}

Phase 1 — Intake (answer before planning):
- What data needs to persist? List every field with type.
- What is the entity name and ID prefix? (e.g. "todo", "habit", "cal")
- Does it need a new DB table? If yes, what columns?
- Should writes sync? (most entity tables do — exceptions: pomodoro_sessions, workout_logs, habit_completions)
- What pure domain logic is needed? (calculations, validations, state machines)
- Does it need notifications?
- Does it touch any existing feature's data?

Phase 2 — Plan (list every file to create or modify):
- New migration: core/db/client.ts runMigrations (current stored version: 4, next: 5)
- New type: core/db/types.ts
- New data file: features/{name}/{name}.data.ts
- New domain file: features/{name}/{name}.domain.ts
- New screen: features/{name}/{name}Screen.tsx
- New route: app/(tabs)/{name}.tsx
- Tab entry: app/(tabs)/_layout.tsx
- New tests: tests/{name}.domain.test.ts

Phase 3 — Wait for plan approval.

Phase 4 — Implement (data-agent for DB/data, feature-agent for UI/domain).
- Data layer first (schema + data functions)
- Domain logic second (pure, tested)
- Screen last (uses data + domain)

Phase 5 — Report:
- Files created/modified
- Migration number used
- Test count
- Any known limitations or deferred work
```

---

### `new-migration.md`

**Placeholders:**

| Token | Expects |
|-------|---------|
| `{{change}}` | Description of the schema change / migration to add |

**Phase structure:** “Plan first” numbered list (SQL, types, data.ts, confirm number) → wait for approval → implement → typecheck + test.

**Rules block (verbatim):**

```markdown
Rules:
- Current schema version: 4. New migration: version 5 (next if (version < 5) block in runMigrations).
- Read core/db/client.ts completely before writing anything.
- Never modify existing migration cases.
- Never modify bootstrap DDL.
- schema.sql is reference only — do not update it.
- After migration, update TypeScript types in core/db/types.ts.
```

**Full prompt body:**

```markdown
# new-migration

Safely add a new SQLite migration to SuperHabits. Plan-first.

---

Apply db-and-sync-invariants skill.
Use data-agent subagent.

Migration request: {{change}}

Rules:
- Current schema version: 4. New migration: version 5 (next if (version < 5) block in runMigrations).
- Read core/db/client.ts completely before writing anything.
- Never modify existing migration cases.
- Never modify bootstrap DDL.
- schema.sql is reference only — do not update it.
- After migration, update TypeScript types in core/db/types.ts.

Plan first:
1. Exact SQL for the migration
2. Updated TypeScript type(s) in core/db/types.ts
3. Any data.ts functions that need updating
4. Confirm migration number

Wait for approval, then implement.
Run npm run typecheck and npm test after.
```

---

**Note:** `audit.md` checklist items 7 (meal/snack, sync flush) may be stale vs current app — see [KNOWLEDGE_BASE.md](./KNOWLEDGE_BASE.md).

---

## `.cursor/skills/` (summaries)

### `db-and-sync-invariants/SKILL.md`

Soft-delete rules, sync enqueue entities, `createId` / `nowIso` / `toDateKey`, schema version, `habit_completions` exception, `schema.sql` non-authoritative.

### `feature-module-pattern/SKILL.md`

Three-part feature layout (`data`, `domain`, `Screen`), route thinness, `core/ui` usage. **Examples** in skill may name helpers not present in repo (e.g. streak helpers) — treat as illustrative.

### `rn-expo-conventions/SKILL.md`

Expo Router, NativeWind, FlashList v2 (no `estimatedItemSize` in typings), `AppProviders` bootstrap list, platform notes.

---

## Root `README.md`

| Section | Content |
|---------|---------|
| **Scripts** | start, android, ios, web, typecheck, test |
| **Architecture** | Features, core, routes, guest, SQLite, sync contracts |
| **Smoke test** | 7-step manual checklist |

---

## Documentation gaps

| Item | Status |
|------|--------|
| Root `CODEBASE_KNOWLEDGE.md` | Not present in repo at KB authoring |
| Production deploy / EAS | Not in repo |
| API server | None |

---

## Cross-reference

- Dependency and interaction maps: [00_INDEX.md](./00_INDEX.md)  
- Runtime behavior: sections 01–05  
