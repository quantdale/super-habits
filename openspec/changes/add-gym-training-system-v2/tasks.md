# Gym V2 implementation tasks

## Wave 0 — contracts and recovery

- [x] 0.1 Record baseline Git/OpenSpec/QA state and keep the ExecPlan checkpoint current.
- [x] 0.2 Add the migration-22 schema/types/indexes and runtime migration tests.
- [x] 0.3 Add the built-in catalog, custom exercise CRUD, modality/effort types, and legacy normalizers.
- [x] 0.4 Extend Backup scope/columns/settings, validators, graph rules, restore order, portable format, account tables, Supabase schema, and simulation schema.

## Wave 1 — routine builder and planning

- [x] 1.1 Extend routine/exercise/set data APIs for identity, modality prescriptions, notes, groups, progression, and atomic reorder.
- [x] 1.2 Replace free-text-only exercise entry with picker/search/filter/custom creation UI.
- [x] 1.3 Add accessible drag reorder and type-aware prescription editing while preserving legacy timing controls.
- [x] 1.4 Add weekly plan/override domain/data APIs and Workout Week/Today dashboard with reschedule flows.

## Wave 2 — guided training and progression

- [x] 2.1 Upgrade the existing guided session sequence/UI for manual strength/bodyweight, timed, and cardio inputs.
- [x] 2.2 Persist modality-specific session facts, effort scale/value, routine/exercise snapshots, and normalized durable drafts.
- [x] 2.3 Add rest notification reconciliation and best-effort screen wake behavior with web fallback copy.
- [x] 2.4 Implement deterministic manual, linear, and double-progression domain logic and explain recommendations in the session/progress UI.

## Wave 3 — body weight and progress

- [x] 3.1 Add body-weight CRUD, unit-safe display conversion, trend/goal preference, and accessible history UI.
- [x] 3.2 Add exercise history, guarded PRs, training totals, body-area distribution, and progressive-disclosure Progress UI.
- [x] 3.3 Preserve quick-complete distinction, historical detail snapshots, heatmap, linked-action logging, and legacy behavior.

## Wave 4 — validation and documentation

- [x] 4.1 Add focused domain tests for schedule, prescriptions, modality volume, effort, progression, PRs, body weight, timers, supersets, and legacy rows.
- [x] 4.2 Add migration/integration/ownership/outbox/backup/portable round-trip and corruption rejection tests.
- [x] 4.3 Add deterministic Workout E2E journeys for builder, today/reschedule, guided modalities, draft resume, custom exercise, body weight, progression, and quick logs.
- [x] 4.4 Extend simulation seeders/scenarios/introspection and update QA impact map/native/simulation documentation.
- [x] 4.5 Update project maps, README, Workout/backup docs, service-worker shell version, and OpenSpec/ExecPlan evidence.

## Wave 5 — certification

- [x] 5.1 Run focused gates after each coherent wave and fix repository-caused failures.
- [x] 5.2 Run canonical typecheck, lint, unit/integration, OpenSpec/plan/impact validation, build, Workout/P0 E2E, simulation, timezone, sync, schema, and diff checks.
- [x] 5.3 Run available native Workout QA; record exact environment blockers when a required target is unavailable.
- [ ] 5.4 Review the final diff, commit coherent milestones, push under repository governance, verify exact remote SHA/CI, clean tree, and mark the ExecPlan completed only when the definition of done is satisfied.
