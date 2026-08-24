## Why

Workout currently records useful routine timers and session history, but it does not yet model the everyday decisions that make a gym system useful: choosing recognizable exercises, prescribing sets, planning a week, recording different training modalities, and understanding progression. This campaign turns the existing Workout surface into a coherent offline-first Gym / Training system while preserving legacy routines, quick logs, guided drafts, and historical evidence.

## What Changes

- Add a stable exercise identity layer with a built-in starter catalog, custom exercises, modality metadata, filters, and legacy free-text compatibility.
- Extend routine construction with searchable exercise selection, type-aware prescriptions, notes, grouping/supersets, drag reorder, and progression configuration.
- Add weekly plan entries and per-date overrides, then make Workout open on a Today dashboard with scheduled, rest-day, resume, and reschedule context.
- Upgrade guided sessions for weighted strength, bodyweight, timed, and cardio work; retain previous-performance context, rest behavior, durable drafts, optional RIR/RPE, and best-effort wake/notification behavior.
- Add deterministic manual, linear, and double-progression domain logic with explanations, exercise history, PRs, training totals, body-area summaries, and body-weight history/trends.
- Extend account ownership inspection, durable sync/outbox, Backup Completeness / Restore V2, Portable Backup, Supabase contracts, and dependency validation for all new user-owned Gym data.
- Add append-only migration, focused unit/integration/E2E/simulation coverage, PWA shell versioning, and reconciled Workout/QA documentation.

## Capabilities

### New Capabilities

- `gym-training-system`: exercise identity/catalog, routine prescriptions, weekly planning, guided modality-aware sessions, progression, body-weight tracking, and progress analytics.
- `gym-data-recovery`: ownership-safe persistence, cloud Backup/Restore V2, Portable Backup round trips, and validation for Gym data.

### Modified Capabilities

- None. No existing OpenSpec capability currently owns Workout requirements; the new capability spec captures the expanded contract.

## Impact

- SQLite schema/migration, entity types, Workout data/domain/screens, shared notification/settings plumbing, account emptiness inspection, sync/backup/portable contracts, Supabase migrations and simulation schema.
- New built-in TypeScript catalog data only; no external exercise dataset, media, AGPL source, or network dependency.
- Additional Vitest integration, Playwright Workout journeys, deterministic simulation scenarios, and documentation/QA impact-map entries.
