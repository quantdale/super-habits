# Design — Gym / Workout V2 Deep Expansion

## Context

The previous Gym V2 change is already present at schema version 22 with
catalog IDs, custom exercises, typed prescriptions, weekly plan/overrides,
modality-aware guided sessions, session-set history, body weight, progression,
Workout reminders, and Backup scope 6. This change is additive: runtime SQLite
DDL and migration blocks in `core/db/client.ts` remain authoritative, the
existing durable mutation/outbox boundary remains in place, and the static
bundled catalog is not a remotely backed-up table.

The main gaps are semantic rather than a new navigation surface. Current
routine/session rows do not snapshot unilateral or external-load meaning,
catalog search metadata is minimal, progression is load/rep oriented, PR math
uses a permissive high-rep ceiling, and Overview/weekly review only see coarse
session counts. See the capability specs for the observable contract.

## Goals / Non-Goals

**Goals:**

- Add one append-only migration (version 23 unless repository state changes)
  for the smallest normalized set of new exercise/session metadata.
- Keep catalog identity static and license-safe while making custom metadata
  and historical snapshots durable.
- Make progression, PR classification, and exercise-history aggregation pure,
  deterministic, and independently testable.
- Reuse existing Workout, Overview, weekly-review, Settings, notification,
  sync, backup, portable, and simulation seams instead of adding state
  management or a second persistence path.
- Preserve legacy rows and frozen scope-6/portable canonical behavior through
  an explicit scope-7 contract.

**Non-Goals:**

- Full two-way Supabase pull/sync, account ownership changes, social features,
  coaching/AI, media, or an imported external exercise dataset.
- A second Workout tab, routed workout pages, or a global fitness score.
- Per-limb biomechanical analysis or a multi-row left/right set model; the
  first expansion records reps/load as entered per side and labels that fact.

## Decisions

### 1. Extend the existing definition and snapshot model

Add optional catalog metadata (`aliases`, `instructions`, and
`supportsExternalLoad`) to the static `ExerciseCatalogItem` and to
`custom_exercises`. Add `unilateral` and `supports_external_load` snapshots to
`routine_exercises` and `workout_session_exercises`. This keeps the definition
model stable while ensuring history does not change if the bundled catalog is
edited later.

The alternative—looking up current catalog metadata at render time—was
rejected because archived/renamed definitions and old history must remain
legible offline. A separate `exercise_definitions` SQLite table was also
rejected for this wave because it would duplicate the already useful static +
custom split and add another recovery graph.

### 2. Use modality plus explicit semantic flags, not a giant enum

Keep `WorkoutModality` as the high-level measurement contract. Add semantic
flags for unilateral work and external load rather than introducing one enum
value for every combination. The domain derives default external-load support
from modality/catalog metadata, then validates recorded values against the
snapshot. `unilateral = 1` means entered reps and load are per-side facts; no
automatic multiplication or division occurs.

The alternative—storing already-doubled totals—was rejected because it loses
what the user actually entered and makes future history comparisons unsafe.

### 3. Add progression strategy context without changing routine mode names

`ProgressionInput` gains an optional modality and target duration/rep context.
Existing `none`, `linear`, and `double` modes remain compatible. For timed and
bodyweight exercises, the same deterministic reducer returns duration or rep
recommendations using the existing `increase_reps` action plus a new
`increase_duration` action. All invalid inputs hold with a reason code. Greyskull
or percentage-based training is explicitly deferred until this contract has
long-lived evidence.

### 4. Make PR output a typed, backward-compatible read model

Keep existing `computePersonalRecords()` for legacy callers, but add a typed
modality-aware classifier for load, rep-at-load, estimated-1RM, duration, and
distance records. `estimate1RM()` and its validity predicate use a constant
12-rep eligibility ceiling. The history UI can consume the richer model while
old session detail remains readable.

The alternative—reusing one numeric PR field—was rejected because kilograms,
repetitions, seconds, and distance are not interchangeable and the UI would
mislead users.

### 5. Compose planning state at the read boundary

Overview reads the existing schedule resolver, draft, and local logs in
parallel, then shapes a `WorkoutTodayState` pure value. Weekly review adds
scheduled/completed counts and neutral adherence context to its existing
deterministic summary payload; no daily-plan schema change is required. The
Workout tab remains the editing owner for plans and overrides.

This avoids duplicating schedule writes or putting DB calls into the overview
domain. The alternative—adding workout columns to daily plans—was rejected as
unnecessary coupling.

### 6. Treat recovery as a coordinated scope-7 change

Scope 7 appends the new custom/routine/session metadata columns to canonical
backup column arrays and adds validators, restore application, portable
fixtures, and Supabase/simulation schema migration. Scope 6 canonical columns
and historical portable formats remain frozen. New fields use nullable/default
compatible SQL so old rows and old manifests still validate.

### 7. Keep writes transactional and history immutable

All new mutable rows use the current `runBackupMutation` boundary and
`syncEngine.enqueue`. Performed session rows remain insert-only. Routine
deletion stays soft-delete-only. Draft writes remain local app-meta
operational state and are never treated as completed workout backup data.

## Risks / Trade-offs

- [Risk] Adding columns to canonical backup rows can drift across local,
  portable, Supabase, and simulation contracts. → Mitigate with one scope-7
  registry update, schema validation, canonical round-trip tests, and explicit
  scope-6 compatibility fixtures.
- [Risk] A changed 1RM ceiling invalidates old UI expectations. → Mitigate by
  documenting the 12-rep rule, updating focused tests, and retaining load/rep
  history for higher reps.
- [Risk] Overview gains extra startup reads. → Mitigate with bounded local
  queries, parallel loading, and a compact pure summary rather than loading
  full performance history.
- [Risk] Unilateral labels may be missed in one screen path. → Mitigate with
  snapshot fields at routine/session boundaries, accessibility-copy tests, and
  a dedicated Playwright journey.
- [Risk] Native notification APIs vary by platform. → Reuse the existing
  WorkoutReminderHost/scheduler and make web/permission denial a no-op
  fallback; notification failure never blocks local training.
- [Risk] The bundled catalog remains intentionally curated rather than 1,000+
  exercises. → Document provenance and architecture; do not claim a larger
  dataset.

## Migration Plan

1. Add migration 23 with nullable/default-compatible columns and indexes only
   where read paths need them; extend row types and runtime/fixture schemas.
2. Ship domain and data-layer normalization that treats missing legacy values
   as the prior timed/free-text semantics.
3. Update backup scope to 7, Supabase migration, simulation schema, portable
   validators/import/export, and round-trip fixtures in one coordinated
   checkpoint.
4. Integrate UI/read-model changes and focused browser/native journeys.
5. Validate clean install, v22 upgrade/idempotence, unit/integration/backup
   suites, web build/E2E, simulation, schema/impact gates, then commit the
   coherent checkpoints.

Rollback is source-level/release rollback only; the additive migration is
intentionally not removed from an installed database. Older binaries ignore
the new nullable/default columns and retain V1/V2 behavior.

## Open Questions

None that change the contract. Future work can add limb-specific sets,
percentage-based programming, richer cardio metrics, and a larger
license-reviewed catalog behind the extension points defined here.
