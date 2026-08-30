## Why

The repository already ships a strong first Gym V2 slice, but the current
Workout model still leaves several high-value training decisions implicit:
unilateral/per-side intent is not durable through a routine and session,
exercise definitions have limited search/instruction metadata, progression and
PR feedback are strongest for weighted sets only, and Workout is not yet fully
visible in the existing Today/weekly-review product surfaces. A second,
additive expansion is needed to make the feature truthful for real gym use
without restarting the shipped migration, weakening recovery guarantees, or
copying openGym assets or code.

## What Changes

- Add a stable, license-safe exercise-definition metadata contract for aliases,
  instructions, equipment/muscle filters, tracking semantics, external-load
  support, and unilateral/per-side behavior while keeping the bundled catalog
  static and custom definitions recoverable user data.
- Persist exercise-definition snapshots and per-side intent through routine
  configuration, active drafts, performed sets, duplication, portable backup,
  cloud backup, and restore without rewriting legacy historical facts.
- Extend deterministic progression to timed/static and bodyweight work, add
  explicit success/hold reasons and manual override boundaries, and prevent
  invalid, skipped, incomplete, or high-repetition evidence from advancing
  targets.
- Replace the current weighted-only PR presentation with modality-aware PR
  classifications and exercise-level history/trend read models, including a
  documented 12-repetition estimated-1RM eligibility ceiling and honest volume
  semantics.
- Surface planned, resumable, completed, and rest/unplanned workout states in
  existing Today/Overview and weekly-review summaries without adding a new top
  navigation surface or punitive missed-workout language.
- Add optional, lightweight native workout-day reminders using the existing
  notification conventions, with explicit permission/platform fallbacks.
- Harden active-session recovery and correction semantics for unilateral,
  timed, cardio, superset, and effort-enabled sets; keep manual logging fast,
  offline, accessible, and resilient on small screens.
- Expand migration, data-contract, backup/restore/portable, simulation,
  Playwright, and native persistence evidence for every new recoverable field.

## Capabilities

### New Capabilities

- `gym-workout-deep-expansion`: Exercise metadata, unilateral semantics,
  modality-aware progression/PR/history, cross-feature planning visibility,
  reminders, and crash-safe session behavior.
- `gym-workout-recovery-contract`: Versioned migration, ownership-safe sync,
  Backup/Restore V2, Portable Backup, and round-trip integrity for the expanded
  training state.

### Modified Capabilities

- None. The earlier `add-gym-training-system-v2` capability remains the
  compatibility baseline; this change adds a new normative expansion contract
  rather than mutating its completed artifacts.

## Impact

- SQLite runtime migration (next sequential version at implementation time),
  `core/db/types.ts`, Workout data/domain/screens, shared Today/Overview and
  weekly-review composition, settings/notification scheduling, backup/portable
  validators and restore ordering, Supabase migrations/schema validation, and
  simulation fixtures.
- New pure-domain tests, SQLite integration/migration tests, backup/portable
  round trips, Workout/Today Playwright journeys, and the highest-value native
  persistence flow.
- No new network dependency, telemetry, auth/account-ownership change,
  two-way sync rewrite, copied openGym source/assets/datasets, or top-level
  navigation change.
