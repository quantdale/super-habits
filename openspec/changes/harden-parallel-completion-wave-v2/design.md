# Design — Parallel Completion Wave V2 Hardening

## 1. Baseline and authority

The authoritative implementation baseline is GitHub `main`. At authoring, the wave closure is `4b9b8ccf0dee7ce9ed9b1c6b8b6a10e3c7732051` and only remote `main` exists.

The prior wave's `HARDENING_HANDOFF.md` is evidence, not schema authority. `core/db/client.ts`, `core/db/types.ts`, backup/portable contracts, Supabase migrations, and live schema are authoritative for persistence. The current SQLite migration chain is through v19; any new migration must take the next free version after reconciling actual main.

## 2. Parallel hardening model

The primary agent owns:

- `core/db/client.ts`, `core/db/types.ts`
- `core/backup/**`, `core/portable/**`, `core/sync/**`, `core/auth/**`
- Supabase migration numbering and live apply
- shared app/provider integration
- this ExecPlan/tasks

Sub-agents may audit/fix non-overlapping feature surfaces and tests, but they must not concurrently edit the shared persistence/backup/sync hotspots above. The primary agent reviews every delegated result before integration.

Recommended parallel audit packets:

1. Todos/Habits lifecycle + bulk operations
2. Projects/Goals/Daily Plan/Weekly Review transaction/idempotency
3. Pomodoro persistence/timing
4. Workout metric provenance/persistence
5. Calories copy-day/targets
6. Command parser/remote parity
7. Notifications/native response actions
8. Overview/Activity/Progress cross-feature consistency
9. PWA/update/offline behavior
10. Browser E2E/simulation coverage inventory

## 3. Repository residue and safety

Before product changes:

- grep the entire working tree for conflict markers;
- inspect each `lint-staged automatic backup` stash reported by the wave and compare it to current main before dropping it;
- never recover stale content over newer accepted main;
- establish a documented/implemented safe parallel commit workflow so future agents cannot race through stash-based pre-commit behavior;
- do not rewrite published history merely to improve commit attribution.

## 4. Habit lifecycle durability

Current pause/archive state lives in AsyncStorage and is lost on restore/reinstall. Hardening must move lifecycle authority into durable habit state.

Minimum semantic requirements:

- states are closed and validated (`active`, `paused`, `archived`, or an equally explicit proven model);
- archived is not equivalent to deleted: historical completions remain;
- paused/archived habits do not appear as currently due or actionable;
- resuming a paused habit must not create false missed occurrences for the paused interval;
- Overview, Today planning, reminders, Command queries, Progress, and habit insights must use the same lifecycle semantics;
- legacy AsyncStorage paused/archive IDs are migrated idempotently and then retired safely.

A single current `status` column is acceptable only if pause-history semantics remain correct. If schedule/rule history must encode pause intervals, implement that explicitly rather than accepting false streaks.

## 5. Pomodoro session metadata durability

Current task association and completion note live in AsyncStorage keyed by session ID. Persist them with the authoritative session record.

Preserve both identity and human-readable history. A linked Todo may later be edited/deleted, so retaining an optional title snapshot alongside the linked ID is preferable if current UX depends on it.

Legacy AsyncStorage session metadata must migrate best-effort/idempotently into matching local sessions and must never fabricate sessions or reassign another user's data.

## 6. Workout metric provenance

The wave added PR/volume surfaces before the schema had weight/repetition/duration inputs.

Hardening must establish real provenance for every displayed metric:

- inspect the current workout session capture flow and domain formulas;
- add authoritative input fields only where users can actually enter or the app can actually measure them;
- if weight/reps belong on `workout_session_exercises`, add and capture them consistently; if the correct model is per-set, use that model instead of blindly following the handoff SQL;
- capture session duration from real session timing, not a constant/default pretending to be measurement;
- old rows remain valid and metrics distinguish missing historical data from actual zero load;
- PR detection and volume charts must not claim weighted metrics when the underlying row lacks meaningful inputs.

## 7. Migration and remote schema evolution

Expected local migration head is v19, so the first new local migration is expected to be v20 if main has not advanced. Verify before editing.

New durable fields on existing backup entities require coordinated evolution across:

- SQLite runtime migration + types
- feature data/domain/UI
- `BACKUP_ENTITY_COLUMNS` and validators
- backup scope/version/checksum rules
- Restore
- Portable export/import version compatibility
- simulation schema
- Supabase DDL/RLS/indexes/FKs where relevant
- schema validator and remote-boundary mocks/tests

Do not silently mutate the meaning of an already-issued backup/portable format. If canonical columns change, bump to the next compatible scope/format as required by the existing version architecture (expected Backup Scope V5 and possibly Portable V3 if the current baseline remains Scope V4 / Portable V2). All known historical legitimate backups must remain restorable/importable according to their documented semantics.

## 8. Recoverable settings classification

Review all new AsyncStorage stores from the handoff.

Recommended backup-settings candidates:

- calorie macro targets
- Pomodoro presets / active preset
- workout rest default
- notification preferences
- optionally Overview card layout as presentation preference

Use the existing recoverable settings allowlist and settings-version mechanism. Do not create ad-hoc remote settings columns.

Command history remains local by default because it can contain free-form user text; backing it up requires an explicit privacy/product decision.

## 9. Command Center remote parity

The local deterministic parser now understands planning intents that the Supabase Edge Function does not.

Update the remote parser/classifier so the supported create/ask catalog matches the client contract for:

- `create_project`
- `update_goal_progress`
- `add_todo_to_daily_plan`
- `project_status`
- `goal_progress`
- `today_focus`

Preserve parse -> review -> explicit confirm -> canonical executor. Model output never gets arbitrary SQL/database authority. Add parser contract tests and deploy the Edge Function only after source tests pass and live access is verified.

## 10. Notification action completion

Wire registered Todo reminder actions through `notificationResponseDispatcher` using canonical Todo APIs.

Required behavior:

- mark-done is idempotent and respects current Todo state;
- snooze schedules a new notification using an explicit bounded delay and cancels/replaces obsolete pending reminder state where appropriate;
- duplicate OS responses are deduped through the existing processed-notification action mechanism;
- deleted/completed/missing Todos fail safely;
- permission denial and unsupported platforms remain non-fatal;
- native-only code is mockable/testable without pretending web supports native notifications.

## 11. Multi-record mutation safety

Audit wave actions that currently loop sequentially.

At minimum cover:

- Todo bulk operations
- Calories copy-day
- Weekly Review / next-week application
- any carry-forward or batch planning write discovered during audit

Choose one of two explicit contracts per operation:

A. atomic all-or-nothing transaction; or
B. structured per-item outcome with deterministic retry/idempotency and visible partial-failure reporting.

Silent partial success is not acceptable.

## 12. Cross-feature consistency

Verify all new aggregates/read models use authoritative semantics:

- habit lifecycle across Overview/Planning/Progress/Command/reminders;
- project/goal rollups against real SQLite rows, not only pure math fixtures;
- focus stats use actual sessions and durable associations;
- workout metrics distinguish unavailable historical inputs from zero;
- Activity/Progress windows remain local-calendar correct across timezones;
- Weekly Review and Daily Plan links do not create duplicates on repeated action.

## 13. PWA hardening

Test the explicit waiting-worker update flow in a real browser context:

- offline/online indicator transitions;
- update banner appears only when a waiting worker exists;
- applying update activates the waiting worker and reloads once;
- no permanent reload loop;
- returning users eventually receive an update even if they ignored the first banner;
- cache version changes do not strand incompatible application assets.

## 14. QA escalation

After focused fixes, run the repository's full hardening gates, including current equivalents of:

- typecheck + lint
- full Vitest suite
- timezone matrix
- OpenSpec + all ExecPlan validators
- Supabase schema validator
- full Playwright E2E
- dist-sync / remote-boundary lane
- deterministic simulation library
- PWA-specific browser coverage
- native Android/iOS validation when a device/emulator exists

Native absence is `ENVIRONMENT`, not a fabricated pass. If a native environment is available, the new reminder flows must be exercised.

## 15. Live convergence

If Supabase access is available:

1. preflight live migration ledger/schema/row counts;
2. apply only reviewed additive migrations in order;
3. deploy the updated parser Edge Function if required;
4. verify live columns/RLS/grants/indexes/owner isolation and remote payloads;
5. run security/performance advisors and classify findings;
6. preserve production rows and owner assignments.

Do not mark the campaign COMPLETED if client backup payloads require remote columns that remain unapplied.

## 16. Completion

Exact final pushed SHA must have completed GitHub `quality` and `e2e` success. A green parent commit is not evidence for a later bookkeeping commit. Avoid creating a post-green documentation-only commit that invalidates exact-head closure.
