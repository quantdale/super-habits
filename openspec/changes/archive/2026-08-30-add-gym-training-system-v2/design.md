# Gym V2 design

## Product shape

Workout remains one section of the existing single-page shell. It becomes a progressive-disclosure training workspace with six internal areas: Today, Week, Routines, Progress, History, and Body Weight. Existing routine cards, quick completion, history detail, heatmap, and guided session entry points remain available. The landing view prioritizes the next decision a user needs to make rather than rendering every chart at once.

The implementation is independent of openGym. Research is limited to product concepts such as a week plan, exercise picker, guided set logging, rest, body weight, and progress views. The repository receives no AGPL code, media, animations, or copied exercise dataset.

## Identity and schema

Migration 22 is append-only. Existing routine and session names remain valid legacy evidence. New configuration rows may carry `catalog_exercise_id`; built-in IDs resolve from a checked-in TypeScript catalog, custom IDs resolve from a synced `custom_exercises` table, and null IDs remain legacy free-text. Historical session-exercise names are immutable snapshots. Guided session rows also snapshot modality and catalog identity so old history stays legible after a routine or custom exercise is renamed or archived.

The migration extends the existing workout tables instead of replacing them:

- routines gain an optional training goal/tag;
- routine exercises gain catalog identity, modality, notes, superset group, and progression settings;
- routine sets retain legacy active/rest timing and gain type-aware target fields;
- workout logs gain a routine-name snapshot;
- session exercises gain modality/catalog snapshots;
- session sets gain duration, distance, pace, effort value, and effort scale.

Four new synced, soft-deletable user tables are added:

- `custom_exercises` — user-authored identity and metadata;
- `workout_weekly_plan` — one explicit workout/rest entry per weekday;
- `workout_schedule_overrides` — bounded date-specific routine/rest decisions and move provenance;
- `body_weight_entries` — immutable measurement facts with edit/delete tombstones, local date key, timestamp, unit, and note.

The built-in catalog is static application source and is not copied into SQLite or cloud backup. Body weight is stored in its entered unit; display conversion is pure and never rewrites history. Workout preferences (effort scale, goal weight, and opt-in workout reminder) join the versioned recoverable-settings payload.

## Domain contracts

`features/workout/workout.domain.ts` remains pure and gains:

- modality and effort normalization, type-aware prescription summaries, and valid-volume rules;
- local-calendar weekly plan/override resolution and superset-aware sequencing;
- deterministic progression rules (`none`, `linear`, `double`) returning a recommendation, reason code, and explanation;
- guarded PR/estimated-1RM calculations for eligible strength sets only;
- body-weight unit conversion/trend and training-summary reducers.

Unknown values remain `null`; zero is never fabricated for an unrecorded set. Skipped sets are excluded from successful progression and PR qualification. Estimated 1RM is capped to a sensible rep range and never produced for timed/cardio work. Progression consumes completed immutable history and never changes a routine silently.

## Data and sync boundaries

All new authoritative writes use the existing `runBackupMutation`/`runSyncedMutation` transaction boundary. Custom exercises, plan rows, overrides, body-weight entries, extended routine/session rows, and their tombstones enter the durable SQLite outbox. App-meta workout preferences are included through `enqueueBackupSettingsRecord`; the active session draft remains local operational state and is normalized for restart but is not remote backup data.

Backup scope advances from 5 to 6. The previous scope-5 entity set and canonical columns are frozen for old manifests and Portable format-2 files; scope 6 appends the four new tables and live Gym columns. Restore fetches, validates, checksums, and graph-checks the exact declared scope before a single empty-device transaction. Restore applies custom exercises before routines, plan/override rows after routines, body-weight facts independently, and never replays workout side effects or notifications. Portable export/import uses the same scope and graph rules without network access.

Supabase receives an additive migration for the four new tables, extended columns, indexes, owner RLS, and foreign-key constraints that tolerate tombstoned historical parents. The disposable simulation backend mirrors the contract.

## Session engine

The existing timer sequence remains the compatibility spine. Each active phase carries modality and prescription context. Legacy/timed phases continue to count down and auto-complete; manual strength/bodyweight phases use an explicit complete-set action; cardio/timed phases record actual duration and optional distance/pace. Rest phases retain adjustable defaults, are draft-persisted, and can request a native completion notification when backgrounded. Web exposes an honest in-app fallback. A best-effort wake lock is acquired only while an active guided session is mounted and released on finish, cancel, or unmount.

Draft normalization accepts old shapes and preserves cursor, elapsed time, dispositions, entered values, effort, modality inputs, and timer state. Existing quick-complete logs remain content-light and distinguishable from guided sessions.

## Validation strategy

Pure-domain tests cover schedule resolution, prescriptions, modality volume, effort normalization, progression, PR guards, body-weight semantics, timer compatibility, legacy rows, and superset sequencing. SQLite integration tests cover migration 22, CRUD/soft deletes, owner emptiness, draft recovery, session provenance, and outbox rows. Backup/portable tests cover scope-5 compatibility, scope-6 round trips, invalid references, and historical snapshots. Playwright covers routine construction, picker/custom exercise, schedule/today, guided modality logging, draft resume, progress/body weight, and quick-log distinction. Simulation seeds weeks of training, rest/override days, restart, backup/recovery, and schema introspection.
