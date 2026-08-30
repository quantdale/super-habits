# parallel-wave-v2-hardening Specification

## Purpose

Define the hardening and evidence contract for the parallel completion wave,
including cross-feature correctness, recovery, performance, and honest
external-boundary classification.

## Requirements

### Requirement: Hardening uses the authoritative current migration head

The implementation SHALL derive new SQLite migration numbering from the actual current `core/db/client.ts` chain and SHALL NOT rely on stale narrative that the schema is v15.

#### Scenario: Current baseline remains through migration 19

Given the current runtime migration chain ends at 19,
When hardening adds a new local schema change,
Then the first new migration uses version 20 or a later free version if main advanced,
And no historical migration block is rewritten.

### Requirement: User-domain lifecycle state is durable and recoverable

Habit paused/archive state SHALL no longer depend solely on device-local AsyncStorage if that state affects scheduling, actionability, streak interpretation, reminders, or restore semantics.

#### Scenario: Pause and resume without false misses

Given an active habit is paused for a calendar interval and later resumed,
When consistency/streak/due-state is calculated,
Then paused dates do not become artificial misses,
And historical completions before/during the lifecycle remain intact according to documented semantics.

#### Scenario: Legacy device-local lifecycle state exists

Given paused/archive IDs exist in the legacy AsyncStorage keys,
When the upgraded app initializes lifecycle state,
Then matching habits are migrated idempotently into the durable model,
And repeating initialization does not duplicate or corrupt lifecycle history.

### Requirement: Pomodoro session history owns its metadata

Todo association and completion note attached to a Pomodoro session SHALL be stored with authoritative recoverable session history rather than only in device-local maps.

#### Scenario: Restore preserves session metadata

Given a valid backup contains a Pomodoro session with a note and Todo association,
When an eligible empty device restores that backup,
Then the session metadata is restored with the session,
And no unrelated session receives that metadata.

#### Scenario: Linked Todo later changes

Given a completed focus session was associated with a Todo,
When the Todo is later renamed or soft-deleted,
Then focus history still renders an intelligible historical association without fabricating a live Todo.

### Requirement: Workout metrics have real provenance

Personal-record, weighted-volume, repetition, and duration metrics SHALL only be computed/displayed from meaningful captured or measured values.

#### Scenario: Legacy workout lacks load data

Given a historical workout row predates load/repetition capture,
When the history or trend UI renders,
Then missing historical load is represented as unavailable/unknown rather than as a genuine zero-load result,
And no weighted PR is claimed from missing data.

#### Scenario: New workout records load and reps

Given the current workout flow supports load/repetition entry,
When the session is completed,
Then those values are persisted in the authoritative workout history model,
And PR/volume calculations use the persisted values.

### Requirement: Backup and Portable evolution is version-safe

Any hardening change that modifies canonical recoverable data SHALL evolve the backup/portable contract explicitly and SHALL preserve all documented historical legitimate formats.

#### Scenario: Current canonical columns change

Given the current backup scope and portable format were issued before new durable fields,
When those fields become part of recoverable canonical data,
Then the current scope/format is advanced as required by repository version rules,
And historical V1/V2/other documented formats retain their original canonicalization and restore/import semantics.

### Requirement: Recoverable settings use the existing settings contract

User preferences selected for recovery SHALL be added through the allowlisted settings/version mechanism rather than ad-hoc remote columns.

#### Scenario: Restoring recoverable preferences

Given a backup contains allowlisted preferences such as calorie targets or notification settings,
When restore validation succeeds,
Then the preferences are applied using the staged settings restore mechanism,
And invalid/unconfirmed restore never mutates local settings.

### Requirement: Remote Command parsing matches the client-supported catalog

The deployed parser/classifier SHALL support the planning intents and ask kinds that the local client presents as remotely supported.

#### Scenario: Create project through remote parser

Given remote parser mode is enabled and the user requests a new project,
When the parser returns a draft,
Then the draft conforms to the same typed `create_project` contract as local parsing,
And execution still requires review and explicit confirmation through the canonical executor.

#### Scenario: Planning ask through remote classifier

Given the user asks for project status, goal progress, or today's focus,
When remote classification succeeds,
Then it maps to the matching supported read-only ask kind,
And does not grant arbitrary database query authority to model output.

### Requirement: Todo notification actions are complete and exactly-once

Registered mark-done and snooze actions SHALL be handled through the canonical notification dispatcher and canonical Todo APIs with duplicate-response protection.

#### Scenario: Duplicate mark-done response

Given the OS delivers the same mark-done notification response more than once,
When the dispatcher processes it,
Then the Todo completion mutation is applied at most once,
And duplicate responses are recognized through durable processed-action state.

#### Scenario: Snooze missing Todo

Given a snooze response references a deleted or missing Todo,
When it is processed,
Then no replacement reminder is scheduled for nonexistent work,
And the app fails safely without crashing.

### Requirement: Multi-record actions have explicit failure semantics

Bulk Todo operations, calorie day-copy, Weekly Review next-week application, and other discovered batch writes SHALL be atomic or expose deterministic structured partial outcomes with retry/idempotency.

#### Scenario: Failure occurs midway through an atomic batch

Given a batch contract is all-or-nothing,
When one item fails during the transaction,
Then no subset remains committed,
And retries do not duplicate earlier attempted effects.

#### Scenario: Operation uses structured partial outcomes

Given an operation intentionally allows per-item results,
When some items fail,
Then the caller receives explicit success/failure results for every attempted item,
And retrying failed items does not duplicate successful ones.

### Requirement: Cross-feature habit lifecycle semantics are consistent

Current actionable surfaces SHALL agree on whether a habit is active, paused, archived, or deleted.

#### Scenario: Habit is paused

Given a habit is paused,
When Overview, Daily Planning, reminders, Command retrieval, or current Progress summaries query actionable habits,
Then the habit is excluded from current due/actionable work according to lifecycle semantics,
While historical completion records remain available for historical views.

### Requirement: PWA update flow is safe and observable

The explicit service-worker update experience SHALL activate a waiting worker without reload loops and SHALL not strand returning users indefinitely on obsolete assets.

#### Scenario: User applies waiting update

Given a new service worker is waiting and the update banner is visible,
When the user applies the update,
Then the waiting worker is activated,
The app reloads at most once for that activation,
And the banner clears after the new controller takes over.

#### Scenario: User initially ignores update

Given a user ignores a waiting-worker banner and later revisits,
When the app registers the service worker again,
Then the available update can be surfaced again rather than being permanently hidden.

### Requirement: Parallel-wave repository residue is reconciled safely

Hardening SHALL remove unresolved merge artifacts and inspect reported lint-staged backup stashes without overwriting newer accepted work.

#### Scenario: Stash contains only already-integrated content

Given a lint-staged backup stash has no unique legitimate changes relative to current main,
When cleanup is performed,
Then it may be dropped deliberately,
And the decision is recorded in the ExecPlan.

#### Scenario: Stash contains unique legitimate work

Given a stash contains legitimate changes absent from main,
When it is inspected,
Then the changes are reviewed and integrated deliberately or explicitly rejected,
And the stash is not blindly dropped.

### Requirement: Full hardening validation is required

The campaign SHALL run broad regression appropriate to the repository rather than relying on the implementation wave's focused tests.

#### Scenario: Final repository candidate is ready

Given all known hardening defects are fixed,
When final validation runs,
Then typecheck, lint, full unit/integration, OpenSpec/ExecPlan validation, remote schema validation, full E2E, remote-boundary/dist-sync, and deterministic simulation pass,
And native validation is either executed successfully or recorded precisely as ENVIRONMENT when unavailable.

### Requirement: Live remote contract converges before completion

If the client sends new durable fields to Supabase, the corresponding reviewed additive production schema and parser deployment SHALL be applied and verified when live access is available.

#### Scenario: New backup columns exist locally but not live

Given the client backup payload includes new durable fields and live Supabase lacks them,
When the campaign reaches closure,
Then the plan remains ACTIVE/BLOCKED until the live migration is applied and verified,
Unless the client contract is intentionally changed so it no longer requires those fields.

### Requirement: Exact final SHA owns the green CI evidence

The hardening campaign SHALL only claim completion from GitHub Actions results for the exact final pushed commit.

#### Scenario: Documentation commit follows a green implementation commit

Given an implementation commit is green and a later documentation commit changes HEAD,
When completion is evaluated,
Then the earlier green run is not treated as proof for the later SHA,
And the exact final SHA must itself obtain green `quality` and `e2e` results.
