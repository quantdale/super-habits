# Design: Productivity Expansion Wave V1 Hardening

## 1. Design Intent

This campaign converts the implementation-only Productivity Expansion Wave V1 into production-grade Super Habits behavior.

The implementation wave intentionally optimized for feature throughput. This hardening pass optimizes for:

- correctness;
- historical truthfulness;
- local durability;
- owner isolation;
- disaster recovery;
- backward compatibility;
- deterministic testing;
- exact-final-SHA release evidence.

The architectural principle is:

> authoritative local state → explicit invariants → owner-scoped durability → portable recovery → deterministic derived views → exhaustive verification

No new feature family should be introduced unless it is strictly required to repair a hardening defect.

## 2. Starting Architecture

The current implementation contains:

- local SQLite schema version 17;
- `projects`;
- `goals`;
- `daily_plans`;
- nullable `project_id` / `goal_id` on Todos and Habits;
- `runLocalMutation()` for authoritative planning writes without remote outbox;
- Planning Hub;
- Quick Capture;
- Activity Timeline;
- Progress Insights;
- local account emptiness coverage for the new tables;
- no remote Backup/Restore/Portable coverage yet for Projects/Goals/Daily Plans.

The hardening campaign must preserve the six primary app sections and existing modal/drawer information architecture.

## 3. Hardening Order

Use this order because later durability work depends on corrected local semantics:

1. establish baseline and reproduce audited defects;
2. repair local schema/invariants;
3. repair completion/date/history semantics;
4. repair Project/Goal/Daily Plan references and UI identity;
5. add local tests/migration tests;
6. design versioned backup/portable compatibility;
7. add owner-scoped Supabase migration/RLS;
8. migrate planning entities from local-only writes to durable synced mutations;
9. extend Backup/Restore/Portable and remote test boundaries;
10. run semantic disaster-recovery tests;
11. run full E2E/simulation/native/security validation;
12. deploy/verify live additive migration if safe and authorized;
13. close only on exact-final-SHA green GitHub CI.

## 4. Read-Only Planning Views

### Problem

`DailyPlanView` currently calls a create-on-read data API. That creates a row and promotes a provisional owner simply by opening the planner.

### Required model

Separate read and mutation APIs:

```ts
getDailyPlan(dateKey): DailyPlan | null

createOrUpdateDailyPlan(dateKey, explicitUserInput): DailyPlan
```

The UI MAY construct a non-persisted empty draft when no row exists.

Opening Planning Hub, navigating among its internal tabs, viewing Today, viewing Progress, or viewing Timeline SHALL NOT create authoritative user rows or change owner-binding state.

The first authoritative Daily Plan row SHALL be created only when the user explicitly saves/commits/completes meaningful plan state.

### Recovery regression

A fresh provisional anonymous device must remain eligible for Recover Existing after:

- open Planning Hub;
- view Today;
- view Progress;
- view Timeline;
- close Planning Hub;

with no explicit save.

## 5. Daily Plan Active-Date Uniqueness

### Problem

Migration 17 puts a global UNIQUE constraint on `date_key` even though plans soft-delete.

### Target contract

There may be at most one ACTIVE Daily Plan per canonical local `date_key`.

A soft-deleted historical row SHALL NOT prevent creation of a new active row for that date.

Preferred SQLite contract:

```sql
CREATE UNIQUE INDEX ... ON daily_plans(date_key)
WHERE deleted_at IS NULL;
```

Because SQLite cannot simply drop the table-level UNIQUE constraint, use an append-only migration that rebuilds the table safely if required:

1. create replacement table with corrected constraints;
2. copy every row preserving IDs/timestamps/tombstones;
3. verify row counts/unique active dates;
4. swap tables;
5. recreate indexes;
6. commit schema-version bump atomically.

Do not delete tombstones to make the migration pass.

## 6. Stable Completion Facts

Derived Progress/Timeline must not infer a historical event from a mutable edit timestamp.

### Todo

Add `completed_at TEXT NULL`.

Rules:

- pending → completed: set `completed_at = now`;
- completed → pending: clear `completed_at`;
- editing title/notes/priority/due/project/goal while completed: preserve `completed_at`;
- idempotent complete on already completed row: preserve it;
- restored/imported rows preserve supplied completion timestamp;
- legacy completed rows receive a documented best-effort `completed_at = updated_at` migration value;
- legacy pending rows use null.

Recurring Todo creation must not accidentally inherit a prior instance completion timestamp.

### Project and Goal

Add stable completion time or equivalent immutable transition fact.

Preferred:

```text
completed_at TEXT NULL
```

Set on transition into `completed`, clear if reopened, preserve on unrelated edits. `archived` does not fabricate a completion event unless the project was already completed.

### Daily Plan

Add `completed_at TEXT NULL`.

Set only when status first transitions to `completed`; preserve on later reflection/metadata edits unless explicitly reopening is supported. If reopening is not supported in V1, completed state is monotonic from the UI.

### Activity Timeline

Use these completion facts for completion events.

Creation events use `created_at`.

Do not emit a false completion event merely because an entity's `updated_at` changed.

## 7. Canonical Calendar Semantics

All local-day metrics must use sanctioned calendar helpers.

### Date-key validation

A `YYYY-MM-DD` string is valid only when it represents a real Gregorian calendar date and round-trips exactly.

Reject examples such as:

- `2026-02-30`
- `2026-13-01`
- `2026-00-10`

Do not allow JavaScript Date normalization to silently turn invalid input into another day.

Use one shared date-key validator for Project targets, Goal targets, and Daily Plan keys where practical.

### Progress windows

A current seven-day period means seven LOCAL calendar dates inclusive of today, from local midnight of the first date through local midnight immediately after today.

The prior period is the immediately preceding seven local dates.

Timestamp-backed domains must compare against UTC instants derived from those local-midnight boundaries.

Do not calculate the end by blindly adding `24 * 60 * 60 * 1000` across DST.

Required timezone matrix:

- Asia/Manila;
- UTC;
- America/New_York around spring and fall DST;
- Pacific/Honolulu;
- Pacific/Kiritimati.

### Timeline authoritative date keys

If a domain already has an authoritative local date key (`consumed_on`, `date_key`), preserve it directly.

Do not fabricate UTC noon and then reconvert it.

A timeline item may carry a separate deterministic sort key if an exact timestamp does not exist. The UI must not pretend that synthetic ordering is precise event time.

## 8. Progress Metrics

Each metric must come from its authoritative source.

### Focus

Calculate independently:

- `focusMinutes`: sum actual focus session durations;
- `focusSessions`: count actual `pomodoro_sessions` rows where `session_type='focus'`.

Never infer session count from a 25-minute assumption.

### Todos

Count actual completion transitions using `completed_at`, not mutable `updated_at`.

### Habits

Define whether the card reports:

- completed scheduled occurrences; or
- completion rows; or
- completion counts.

Use existing Habit semantics and label the UI accurately. Do not silently create a new consistency formula.

### Workouts / Calories / Weekly Reviews

Continue using authoritative completion/date facts, with timezone-safe boundaries.

### Projects / Goals

Active counts are current-state metrics, not 7-day deltas unless explicit historical event data exists.

Goal average progress remains a current-state planning metric unless history is deliberately added later.

No global productivity score.

## 9. Project / Goal / Item Association Invariants

### Local model

A Goal has zero or one Project.

A Todo has zero or one Project and zero or one Goal.

A Habit has zero or one Project and zero or one Goal.

Association setters SHALL reject references to missing or soft-deleted parents.

The hardening session must explicitly decide whether `archived` parents are selectable. Recommended: existing associations may remain visible, but new assignments target active/paused parents only unless UX explicitly exposes archived records.

### Hierarchical consistency

If Goal G belongs to Project P and a Todo/Habit is assigned Goal G, the item's `project_id` SHALL be P.

Therefore setting Goal G on an item should auto-align its Project to G's Project.

If G has no Project, assigning it need not clear an explicitly assigned Project unless the product chooses a stricter hierarchy; document the selected rule and test it.

### Moving a Goal

When Goal G moves from P1 to P2:

- linked Todos/Habits whose `goal_id=G` should reconcile their `project_id` to P2;
- the move and child reconciliation should be locally atomic where practical;
- later remote outbox state must represent the coherent final result.

### Soft-deleting a Goal

Soft-delete G and clear `goal_id` from linked Todos/Habits in one local transaction/orchestration.

Preserve the item's current `project_id`.

### Soft-deleting a Project

Soft-delete P and clear `project_id` from:

- Goals under P;
- Todos assigned P;
- Habits assigned P.

Goals survive as unassigned Goals. Do not cascade soft-delete user content.

If a child Todo/Habit has a Goal that remains assigned to deleted P, the Goal itself must first become unassigned so the hierarchy remains consistent.

### Physical database references

Because IDs are globally generated but remote tables are multi-owner, remote FKs SHALL be owner-scoped.

Preferred shape:

- each parent has uniqueness supporting `(user_id, id)`;
- `(user_id, project_id)` references `projects(user_id,id)`;
- `(user_id, goal_id)` references `goals(user_id,id)`;
- physical delete may use `ON DELETE SET NULL` where appropriate;
- soft-delete cleanup remains application logic.

Never permit an owner A child to reference owner B's parent even if it knows the ID.

## 10. Daily Plan Priority Snapshot

### Stable identity

UI selection/removal must use Todo IDs, never titles.

Duplicate Todo titles SHALL behave independently.

### Referential validation

When explicitly saving a plan:

- max three unique IDs;
- each selected ID must resolve to an existing Todo at save time;
- define whether an already-completed Todo can be newly selected (recommended: candidate picker only offers pending Todos);
- stale/deleted IDs from older plans must render safely.

### Historical readability

A completed or historical Daily Plan should remain understandable if a referenced Todo is later completed, renamed, or deleted.

Preferred model: store a versioned snapshot alongside IDs, for example:

```ts
topTodoSnapshot: Array<{ id: string; title: string }>
```

Exact storage can be normalized child rows or validated JSON. Keep it bounded to three records.

For legacy rows with only IDs, best-effort hydrate titles from current Todos and persist/derive a compatibility representation without creating side effects merely by viewing.

No historical Todo mutation should replay during Restore/Portable import.

## 11. Local Migration Strategy

All local migrations are append-only.

Do not edit migration 17 as if already-upgraded devices never existed.

The hardening migration(s) should handle:

- Daily Plan active-only uniqueness;
- stable completion timestamps;
- any priority snapshot column/table;
- new indexes on association columns;
- any local schema needed for owner-consistent associations.

Test at least:

- fresh DB;
- v16 → latest;
- v17 → latest;
- representative populated v17 DB;
- soft-deleted Daily Plan duplicate date;
- completed Todos legacy backfill;
- migration interruption/rollback if harness supports it.

Schema-version bump and migration step remain atomic.

## 12. Cloud Backup Versioning

The current constants separate `BACKUP_SCHEMA_VERSION` and `BACKUP_SCOPE_VERSION`, but the remote manifest does not explicitly persist scope version.

This hardening must make future manifests unambiguous.

### Scope version

Bump current backup scope to a new version (expected 4, unless repository evidence requires another value) when Projects/Goals/Daily Plans and new row fields become recoverable.

New manifests SHALL persist `backup_scope_version` explicitly.

### Schema version

If Todo/Project/Goal/DailyPlan row contracts change in a way that an old validator cannot understand, deliberately bump `BACKUP_SCHEMA_VERSION` rather than silently changing the meaning of the existing version.

The implementation agent must inventory historical manifest shapes and choose the minimum correct version change.

### Historical restore compatibility

Known historical backups may omit `backup_scope_version`.

Restore must recognize ONLY exact known historical scopes.

Examples of historical scope epochs to investigate:

- pre-Weekly-Review entity scope;
- Weekly-Review-enabled scope;
- current hardened planning scope.

A missing newly introduced entity may be interpreted as empty only when the manifest/entity set exactly matches a known historical scope.

Unknown partial scopes remain invalid.

Do not turn compatibility into permissive "missing table = empty" behavior.

## 13. Portable Versioning

Current Portable V1 uses exact `BACKUP_ENTITIES` but does not encode a backup scope version. This means scope evolution can invalidate old files despite unchanged envelope/schema versions.

### Required direction

Introduce a new prospective portable envelope contract, likely `PORTABLE_BACKUP_FORMAT_VERSION = 2`, carrying explicit `backupScopeVersion`.

Preserve import support for known valid V1 historical entity sets.

A safe compatibility table should be explicit in code, for example conceptually:

```text
Portable V1 legacy scope A -> known 12-entity shape
Portable V1 legacy scope B -> known 13-entity Weekly Review shape
Portable V2 current scope   -> explicit scope version + current entities
```

Exact historical sets must be discovered from Git history/tests rather than guessed.

### Security/integrity

Each supported legacy shape still receives:

- exact entity-set validation for that shape;
- per-row runtime validation;
- per-entity checksums;
- payload checksum verification according to that version's canonicalization;
- graph validation;
- owner fingerprint safety.

Do not accept unknown extra/missing groups.

### Export

New exports use only the current hardened version and include Projects, Goals, Daily Plans, new Todo/Habit association columns, completion timestamps, and any priority snapshot data classified as authoritative.

Keep the 100 MB round-trip size contract.

## 14. Supabase Schema

Create additive production migration(s). Do not edit applied migrations.

### New tables

Add owner-scoped:

- `projects`;
- `goals`;
- `daily_plans`.

Every new table:

- `user_id UUID NOT NULL DEFAULT auth.uid()`;
- FK to `auth.users(id) ON DELETE CASCADE`;
- owner indexes;
- useful product query indexes;
- RLS enabled at creation;
- authenticated owner CRUD only;
- no anon DB-role table privileges;
- no PUBLIC privileges.

Remember Supabase anonymous Auth sessions still use the `authenticated` database role.

### Existing tables

Add planning association/completion fields to remote Todos/Habits as required.

Do not rewrite ownership of existing rows.

### Owner-scoped references

Enforce owner-consistent parent references as described in section 9.

### Live deployment

Before apply:

- inspect migration ledger;
- snapshot row/owner/null-owner counts for existing backed-up tables;
- validate no new constraint conflicts;
- validate local/staging migration semantics.

After apply:

- migration ledger correct;
- row counts preserved;
- existing ownership preserved;
- new tables/RLS/grants/indexes exact;
- two-user owner isolation proof where safe;
- security/performance advisors reviewed;
- no persistent canary rows left behind.

## 15. Durable Mutation Integration

Once remote schema and client contracts are ready, authoritative Project/Goal/DailyPlan mutations SHALL use the same durable owner-aware mutation/outbox architecture as other backup entities.

Do not enqueue new entity types before the remote contract exists in the migration/test environment.

After integration:

- create/update/status/reorder/delete Project mutations enqueue correct owner record;
- Goal mutations do the same;
- Daily Plan explicit mutations do the same;
- association changes on Todos/Habits carry updated planning columns;
- parent delete/move reconciliation enqueues all affected children coherently;
- first meaningful planning write still promotes provisional owner correctly;
- read-only planning views do not.

`runLocalMutation` may remain for truly local-only operational metadata if needed, but Projects/Goals/DailyPlans must stop using it as their normal persistence path.

## 16. Backup / Restore Integration

Add Projects/Goals/DailyPlans to complete recoverable scope.

### Canonical restore ordering

Define order based on dependencies. Preferred conceptual order:

1. Projects
2. Goals
3. Todos / Habits
4. Habit completions and existing child domains
5. Daily Plans after referenced Todos exist
6. remaining independent entities

Do not alter existing Workout/Linked Action dependency safety.

### Validation

Add runtime validators for every new entity and field.

Graph validation should reject:

- Goal references unknown Project;
- Todo/Habit references unknown Project/Goal;
- owner-inconsistent relation where owner evidence exists;
- Goal/Project mismatch according to hierarchy rule;
- malformed Daily Plan top-priority payload/snapshot;
- unknown status/horizon;
- impossible date keys;
- invalid completion timestamps.

### Restore behavior

Restore is inert reconstruction.

It must NOT:

- execute Quick Capture;
- run Linked Actions because a Todo association exists;
- complete Todos because they are priorities;
- create historical Daily Plans by calling UI creation paths;
- fire notifications;
- regenerate Project/Goal completion events.

## 17. Backup Backfill / Manifest

Bump backup scope and backfill existing local Projects/Goals/DailyPlans plus updated Todo/Habit row contracts.

A pre-hardening user who created local planning data during the implementation wave must not lose it when cloud coverage is introduced.

Backfill must:

- use current owner binding;
- enqueue only owner-consistent rows;
- preserve tombstones where included;
- upload child rows in dependency-safe fashion;
- publish a new complete manifest only after all current-scope rows/settings are remote and integrity-certified.

The existing race-safe manifest coherence architecture must remain intact.

## 18. Portable Export / Import

New portable exports include the complete hardened planning data.

Import preview should expose friendly counts for:

- Projects;
- Goals;
- Daily Plans.

Import stays empty-device-only in this phase.

The import transaction should restore Projects/Goals before dependent Todos/Habits and Daily Plans after Todos.

Historical side effects do not replay.

Owner compatibility remains unchanged: file metadata is not authentication.

## 19. Account Recovery Integration

Local account emptiness already includes Projects/Goals/DailyPlans. Preserve that.

Remote footprint safety should expand mechanically from the hardened backup constants. Update the shared E2E drift guard and deterministic Supabase mock contract accordingly.

Test a temporary anonymous account that has ONLY a new planning backup row. Matching imported-owner recovery must block replacement just as it does for `weekly_reviews`.

Opening Planning Hub without saving must NOT count as local user data on a pristine device.

## 20. Quick Capture Hardening

Quick Capture must continue reusing canonical domain mutation paths.

Hardening tests must prove:

- Todo creation uses Todo semantics and outbox;
- Habit uses Habit scheduling defaults/invariants;
- Calories uses canonical Calories path;
- Project/Goal uses hardened synced planning path;
- Focus only navigates to existing timer;
- double submit cannot create accidental duplicate records from one UI action;
- validation errors remain in overlay and do not partially write;
- modal open/close state does not interfere with Planning Hub/Settings/Weekly Review.

Do not add more capture types during hardening.

## 21. Activity Timeline Hardening

Timeline remains a derived bounded read model.

Fix historical facts and labels:

- Todo completion uses `completed_at`;
- Project/Goal completion uses stable completion fact;
- Daily Plan completion uses stable completion fact;
- calorie date grouping preserves `consumed_on` exactly;
- Habit completion date remains authoritative;
- Focus/Workout use their existing exact timestamps.

Creation + completion for Project/Goal can both appear if both events fall in the window. Do not use `else` logic that suppresses a valid creation event solely because completion also happened recently.

Items without exact event time may use deterministic date-only ordering but UI must not present fabricated precision.

Bound the total feed size after merging source-specific limits; avoid returning thousands of items despite per-query limits.

## 22. Progress Insights Hardening

Use true local seven-day windows.

Add tests for:

- midnight boundaries;
- DST spring/fall;
- sessions of 10/25/50 minutes proving real count ≠ inferred count;
- completed Todo edited later;
- Todo reopened and re-completed;
- zero previous period percentage copy;
- calorie local-day boundaries;
- weekly review exact completion period;
- active project/goal counts excluding deleted/archived/completed as defined.

The user-facing label should say "Last 7 days" instead of "This week" if the implementation is rolling seven days rather than calendar-week Monday–Sunday. Choose one semantics and make calculation + copy agree.

## 23. UI / React Hardening

The implementation wave reported several `react-hooks/set-state-in-effect` warnings in new views.

Do not merely suppress them.

Inspect whether each effect reflects a legitimate async data-load pattern or whether state/data-loading architecture should change. Resolve new warnings where practical without destabilizing the application.

Also verify:

- loading/error states;
- duplicate-title keys;
- button busy states;
- modal stacking;
- FAB safe-area behavior;
- keyboard behavior on Web;
- accessibility roles/labels;
- touch targets;
- empty states;
- theme contrast.

## 24. Testing Strategy

### Baseline

Unlike the implementation wave, run full baseline validation before changing hardening code. Record inherited failures separately from new failures.

### Unit

Add focused tests for:

- date validation;
- Project/Goal domain unions/bounds;
- Daily Plan priority parser/snapshot;
- local calendar range construction;
- Progress metric queries;
- Timeline date preservation/grouping;
- backup/portable compatibility mapping.

### Real SQLite integration

Test:

- fresh latest schema;
- v16 → latest;
- v17 → latest;
- populated v17 → latest;
- Daily Plan soft-delete/recreate;
- opening planner without save creates zero row;
- Todo completion timestamp lifecycle;
- Project/Goal completion timestamp lifecycle;
- association moves/deletes;
- duplicate-title Daily Plan priorities;
- restart persistence;
- outbox ownership for new entities;
- backup backfill.

### Backup / Portable

Test:

- current source → cloud backup → fresh Restore;
- current source → Portable V2 → fresh import;
- historical known Portable V1 variants still import;
- malformed partial legacy files reject;
- historical Backup manifest known scope restores safely;
- unknown partial manifest rejects;
- planning rows checksum and graph integrity;
- restore does not replay historical effects.

### Web E2E

At minimum:

1. create Project;
2. create Goal under Project;
3. associate Todo/Habit;
4. move Goal and observe coherent associations;
5. open Today on pristine test persona and prove no write until save;
6. select duplicate-title Todos independently;
7. save/complete Daily Plan;
8. Quick Capture every supported mode;
9. Timeline completion dates;
10. Progress seven-day comparison;
11. soft-delete Project/Goal and verify detach semantics;
12. backup/portable preview includes planning data;
13. existing account/recovery/weekly-review journeys remain green.

### Dist-sync

Update deterministic backup entity helpers/mocks for the new remote scope and add a new-planning-entity footprint safety scenario.

### Simulation

Extend the long-term deterministic user model with Projects, Goals, Daily Planning, and Quick Capture. Run the current documented simulation wrapper with its required static server lifecycle.

### Native

If `Nitro_API_36` is available:

- build current-source release/E2E APK;
- run serial smoke;
- Planning Hub;
- Quick Capture;
- persistence/relaunch;
- account-recovery pristine-view regression;
- file backup/import regression where practical.

If unavailable, record `ENVIRONMENT` rather than claiming runtime success.

## 25. Performance

Measure rather than guess.

Important queries:

- Planning Hub first open;
- Project detail with many linked children;
- Activity Timeline 30/90 days;
- Progress two-window aggregation;
- backup checkpoint with planning data;
- Portable export/import long-term fixture.

Add indexes based on observed query plans or obvious foreign-key/filter requirements, not random indexing.

## 26. Security

Preserve all previous security boundaries:

- RLS owner CRUD;
- no service role in client;
- no raw SQL from user text;
- no account merge;
- no owner rewrite;
- owner-scoped backup and associations;
- file owner fingerprint remains compatibility metadata only;
- Import remains empty-device-only;
- restore validates before write;
- Quick Capture text is parameterized data.

Test owner A cannot read/write/reference owner B Project/Goal/DailyPlan.

## 27. Full QA Gate

Required before final close, using current package scripts/equivalents:

```text
npm ci
npm run typecheck
npm run lint
npm test
npm run qa:fast
npm run qa:integration
npm run qa:timezones
npm run validate:themes
npm run supabase:schema:validate
npm run openspec:validate
npm run qa:impact:validate
npm run agent:plan:validate:all
npm run build:web
npm run build:sync
npm run e2e:sync
npm run e2e:full
npm run qa:simulation -- --all --mode deterministic
npx expo-doctor
npm audit
npm audit --omit=dev
git diff --check
```

If a listed command has changed, use the current documented equivalent and record it; do not silently skip the gate.

## 28. CI / Completion Protocol

The final pushed SHA itself must have GitHub Actions:

- `quality = PASS`;
- `e2e = PASS`, including dist-sync.

Do not call a parent SHA green enough.

Do not stop with CI pending.

Do not create a later bookkeeping-only commit after the accepted green SHA just to record the run ID. The final report can carry run metadata externally.

Final repository state:

- working tree clean;
- local main == origin/main;
- remote main-only;
- no force push.
