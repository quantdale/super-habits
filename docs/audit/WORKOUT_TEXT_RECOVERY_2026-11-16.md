# Workout writer-valid text recovery (D4)

Owner decision: import/restore accepts every value the workout writers/editor
accept — no truncation, no writer tightening. Branch `fix/workout-text-import-limits`
in `/workspace/wt-cx-workout-text` (work was rebased onto current `origin/main`).

## Defects and evidence

`tests/integration/workoutPortableTextLimits.test.ts` drives the real writers on
migrated SQLite, then `exportPortableBackup` → `preparePortableImport` (`ready`)
→ `confirmPortableImport` (`restored`), and compares every workout row and the
workout preferences exactly across devices.

```sh
npx vitest run --project integration tests/integration/workoutPortableTextLimits.test.ts
```

- Before the source fix: **22/22 failed** (19 isolated text/array cases, 1
  combined edit/history/prescription case, 2 goal-weight cases).
- After: **22/22 passed**. Logs: `.agent/evidence/workout-text/{before,after}.log`.

Two defects: (a) shared validators used recovery-only limits shorter than what
writers persist (instructions 1,000; array items 100; serialized arrays 5,000;
notes 10,000; weekly/override/body notes 500; name/snapshot/group 300;
description 5,000; primary area/equipment 1,000), and (b) recovery normalization
dropped a writer-valid goal weight above 1,000 because it reused the body-entry
ceiling (`saveWorkoutPreferences` has no goal ceiling; values round-trip kg/lb).

## Field audit (all workout text/array fields)

| Field(s)                                                                                  | Writer/editor contract                                                                                       | Repair                                                                                                    |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `workout_routines.name`, `routine_exercises.name`                                         | trimmed content ≤100; **create stores raw whitespace**, edits trim                                           | raw ceiling raised; historical 300-char trimmed-content allowance kept; 100/101 writer rejection retained |
| `workout_routines.description`, `goal_tag`                                                | unbounded (create untrimmed, edits trim)                                                                     | exact recovery under generous ceiling                                                                     |
| `routine_exercises.notes`, `superset_group`                                               | unbounded, edits trim                                                                                        | exact recovery                                                                                            |
| `workout_logs.notes` (quick completion, linked action, session save)                      | unbounded                                                                                                    | exact recovery                                                                                            |
| `workout_logs.routine_name`, `workout_session_exercises.exercise_name`                    | snapshots with no length cap                                                                                 | exact recovery incl. raw whitespace                                                                       |
| `custom_exercises.name`                                                                   | trimmed ≤100                                                                                                 | unchanged (300 allowance already compatible)                                                              |
| `custom_exercises.description`, `instructions`, `primary_area`, `equipment`               | unbounded (trim/lowercase)                                                                                   | exact recovery                                                                                            |
| `custom_exercises.aliases`, `secondary_areas`                                             | trim/lowercase/dedupe, first 12/8 items, **no item cap**                                                     | per-item cap dropped; JSON escaping no longer rejects a valid array                                       |
| `workout_weekly_plan.note`, `workout_schedule_overrides.note`, `body_weight_entries.note` | unbounded (body note trims)                                                                                  | exact recovery                                                                                            |
| Routine/session prescriptions, set measurements, effort, progression                      | numeric contracts (`validateSetTiming`, `assertSetPrescriptionWrite`, `normalizeEffort`, body weight ≤1,000) | already compatible; covered by round trips and writer-boundary assertions                                 |
| Set notes                                                                                 | no such column or writer input                                                                               | not applicable                                                                                            |
| Operational drafts / pending saves                                                        | intentionally outside the backup allowlist                                                                   | out of scope                                                                                              |
| Workout preferences (`goalWeight`)                                                        | any positive finite number with unit                                                                         | recovery ceiling removed; `null` legacy exports cannot be recovered                                       |

Restore-only `applyRemoteWorkout*` appliers bind values without truncation, so
the fix belongs at the shared validation boundary.

## Bounds chosen

Writer-unbounded strings and serialized string arrays accept up to **100 MiB in
JavaScript characters**, matching the existing snapshot-recovery ceiling; the
portable envelope's **100 MiB UTF-8 total** and cloud request byte budgets are
unchanged. Validators stay protective: JSON arrays must still parse to strings,
IDs/enums/finite-number/graph checks and all other feature bounds are unchanged.
No writer, UI, schema, migration or hosted state was modified; no slicing or
truncation exists on any restore path.

## Recovery/generation paths share the rules

`validateBackupRow` (one `RULES_BY_ENTITY` table) is used by Portable import,
Restore V2, legacy-snapshot certification, and Restore v1; generation decode
verifies chunk bytes/checksums and settings with `normalizeRecoverableSettings`
(also fixed) before rows enter the same validator. The repair therefore covers
the cloud restore path, not only file import.

## Frozen server residual (not repaired here)

`supabase/migrations/20261115100000_add_recurring_spawn_provenance.sql` still
caps the published row contract: `instructions` 1,000, array items 100,
serialized arrays 5,000, weekly/override/body-note 500, plus the other short
limits above (name/snapshot/group 300, description 5,000, primary area/equipment
1,000, notes 10,000). Cloud **generation publication** of writer-valid long data
can therefore still be refused server-side; the in-process test double does not
execute that Postgres validator, so green client tests do not certify
publication. Closing it needs a separate append-only server-contract change and
a local Postgres proof. No migration or hosted SQL was edited, added or applied.

## Validation

- `npm run typecheck`, `npm run lint` — pass, 0 errors/warnings.
- New integration regression — 22 passed; the same file fails 22/22 with only
  `core/backup/*` reverted.
- Focused backup/portable/recovery/migration suites — 206 passed (9 files).

## Non-workout leads (unchanged, unconfirmed)

Habit `rule_history` growth against its 50,000-character recovery bound, and raw
whitespace kept by other feature writers versus their name/title recovery caps.
Neither is a confirmed defect of this change.
