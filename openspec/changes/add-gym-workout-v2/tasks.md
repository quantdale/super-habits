# Gym / Workout V2 Deep Expansion Tasks

## 1. Contract and migration foundation

- [x] 1.1 Confirm the v22 baseline, inspect the existing Gym V2 backup/portable contracts, and update this change's ExecPlan checkpoint before implementation.
- [x] 1.2 Add migration 23-compatible typed fields for exercise aliases/instructions/external-load support and routine/session unilateral/external-load snapshots without editing prior migration blocks.
- [x] 1.3 Extend `core/db/types.ts`, bootstrap-compatible normalization, schema reference/fixture documentation, and migration tests for clean install, v22 upgrade, legacy rows, and idempotence.
- [x] 1.4 Extend the static catalog and custom-exercise data contract with aliases, instructions, tracking metadata, and external-load semantics; document catalog provenance and license boundary.

## 2. Exercise identity and programming semantics

- [x] 2.1 Add pure exercise-definition normalization/search/filter helpers with alias, equipment, muscle-area, modality, and custom/bundled provenance support.
- [x] 2.2 Persist and update routine exercise unilateral/external-load snapshots, preserve them through duplication/reorder, and enforce valid modality-aware measurements at the data boundary.
- [x] 2.3 Persist session exercise semantic snapshots and ensure legacy free-text sessions keep their historical fallback behavior.
- [x] 2.4 Add routine-builder progressive-disclosure controls for unilateral/per-side intent, aliases/instructions display, and compatible load fields with accessible labels.
- [x] 2.5 Add focused domain/data tests for catalog search, custom metadata, legacy normalization, unilateral labels, invalid measurements, duplication, and soft-delete/outbox behavior.

## 3. Deterministic progression and truthful analytics

- [x] 3.1 Refine the pure progression contract for weighted, bodyweight, and timed modalities, including invalid/missing/skipped evidence, safe clamping, reason codes, and manual override separation.
- [x] 3.2 Change estimated-1RM eligibility to the documented maximum of 12 repetitions and preserve load/rep history for higher repetitions.
- [x] 3.3 Add modality-aware PR classification for estimated-1RM, load, rep-at-load, timed duration, and cardio distance, plus exercise-level trend reducers with honest volume semantics.
- [x] 3.4 Wire previous-performance and progression guidance to durable exercise identity first with legacy name fallback, without persisting unconfirmed recommendations.
- [x] 3.5 Add exhaustive domain tests for progression, 1RM boundary, PR classification, trend aggregation, bodyweight semantics, unilateral semantics, timed/cardio data, and supersets.
- [x] 3.6 Add a compact exercise-history/progress presentation that uses virtualized or bounded data and remains usable at large text sizes.

## 4. Active session and recovery hardening

- [x] 4.1 Extend session phase/context and durable draft normalization for unilateral/external-load flags, timed/bodyweight progression context, rest deadlines, superset position, and correction of the latest entered set.
- [x] 4.2 Update active logging UI so per-side targets, previous performance, typed measurements, effort, rest, skip, and finish-early behavior remain one-handed and non-modal-maze workflows.
- [x] 4.3 Verify resumed sessions exclude app-closed wall-clock time, retain measurements/dispositions, and never resurrect skipped or fabricate unperformed sets.
- [x] 4.4 Add focused draft/data tests and a Playwright journey covering weighted, unilateral/bodyweight, timed/cardio, rest, correction, early finish, reload, and resume.

## 5. Cross-feature planning and reminders

- [x] 5.1 Add a pure Workout Today state reducer for planned/not-started, active/resumable, completed-today, rest, and unplanned states using local date keys.
- [x] 5.2 Compose the Workout Today state into Overview/Next Best Action without changing the six-section shell or daily-plan schema.
- [x] 5.3 Extend weekly-review workout summaries with scheduled versus completed context and neutral language; add domain/summary tests.
- [x] 5.4 Audit and harden the existing optional workout-day reminder for schedule overrides, deduplication, permission denial, web fallback, and preference-off cleanup.
- [x] 5.5 Add/extend Playwright and native persistence coverage for planned, rescheduled, completed, rest, and resumed Today states.

## 6. Backup, restore, portable, and cloud parity

- [x] 6.1 Bump the recoverable scope only as required (expected scope 7), append canonical columns/entities, and preserve scope-6/historical portable formats.
- [x] 6.2 Extend backup validators, deterministic canonicalization/checksums, settings allowlist where needed, backfill/checkpoint, and sync adapter projections for the new fields.
- [x] 6.3 Extend Restore V2 dependency/row validation and import ordering for custom metadata and semantic snapshots while preserving empty-device atomicity and no-side-effects behavior.
- [x] 6.4 Extend Portable Backup export/import, fixtures, compatibility labels, and round-trip tests for new Gym state.
- [x] 6.5 Add an additive Supabase migration plus simulation backend/schema validation for new columns, RLS/grants/indexes, and ownership-safe projections.
- [x] 6.6 Add corruption, checksum, missing-reference, legacy-scope, custom-exercise, unilateral, schedule, and routine/history restore tests.

## 7. Simulation, QA, documentation, and delivery

- [x] 7.1 Add deterministic simulation coverage for catalog selection, multi-modality logging, restart/resume, progression, schedule overrides, and recovery observations.
- [x] 7.2 Run `npm run qa:affected` after each coherent wave, classify failures using repository QA taxonomy, and preserve artifacts/known gaps.
- [x] 7.3 Update project maps, Workout/backup/provenance docs, QA impact map, and native-e2e documentation with truthful evidence and deferred P2 work.
- [x] 7.4 Run typecheck, lint, Vitest/integration, OpenSpec validation, ExecPlan validation, schema/impact/timezone checks, web build, focused/full E2E, sync E2E, and deterministic simulation as applicable.
- [x] 7.5 Run available native Android targeted persistence QA and record iOS/Android environment limitations precisely when unavailable.
- [ ] 7.6 Inspect complete diff, run `git diff --check`, create meaningful commits, push according to repository workflow, and complete the ExecPlan only against validated evidence.
