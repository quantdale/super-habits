## Purpose

Define the real-world user-simulation testing capability layered on top of the existing suite: persona-driven, journey-shaped E2E tests in `e2e/journeys/` that exercise the app under realistic, repeated, interrupted, day-crossing, and long-running human use, with outcomes verified from multiple independent surfaces and persisted SQLite rows — plus a real-SQLite integration test level (`tests/integration/`), deterministic clock and failure-injection harnesses, a contract-gap protocol with a known-gap register, and CI wiring for fast and full regression lanes.

## Requirements

### Requirement: Persona-driven journey suite

The testing capability SHALL include a journey suite in `e2e/journeys/`, where each journey file corresponds to one named persona pursuing one goal across multiple steps. Each journey SHALL declare, in a header comment, its persona, goal, starting state, fixture size, and the risks it covers. Journeys SHALL NOT be organised by feature.

#### Scenario: Every journey names its persona and goal

- **WHEN** a journey file is added to `e2e/journeys/`
- **THEN** it declares persona, goal, starting state, fixture size, and covered risk IDs, and its steps read as a sequence a real person would perform rather than a list of feature checks.

#### Scenario: All six personas are represented

- **WHEN** the journey suite is complete
- **THEN** at least one journey exists for each of the Daily Driver, Weekend Returner, Power User, Error-Prone User, Commuter, and New Device Migrator personas.

### Requirement: Continuity is preserved within a journey

A journey SHALL clear application state at most once, at its start, and SHALL NOT reset the database, AsyncStorage, or the page between its own steps except where the step itself is a reload, restart, or clear. Steps SHALL run in declared order, and a failed step SHALL abort the remainder of that journey without affecting other journey files.

#### Scenario: State accumulates across steps

- **WHEN** a journey creates a todo in step 2 and reaches step 7
- **THEN** the todo created in step 2 is still present, without re-seeding, and later steps assert against the accumulated state.

#### Scenario: A journey clears both persistence stores at its start

- **WHEN** a journey begins
- **THEN** it clears OPFS SQLite files **and** AsyncStorage keys (`superhabits.theme.*`, `superhabits.calories.viewMode`, `superhabits.command.*`), because `clearDatabase()` alone leaves AsyncStorage intact and would leak preferences between journeys.

#### Scenario: A failed step stops its journey only

- **WHEN** step 4 of a journey fails
- **THEN** steps 5 onward in that file are skipped as meaningless, and other journey files still run.

### Requirement: Day-rollover write correctness

The suite SHALL cover the local-calendar day boundary being crossed while the application is open and all sections are mounted, using browser clock control installed before first render. Writes issued after the boundary SHALL land on the new calendar day, and rows written before it SHALL be left untouched.

#### Scenario: A write after rollover uses the new day's key

- **WHEN** a habit is incremented after the clock has crossed midnight, without a reload
- **THEN** the `habit_completions` row is written with the **new** day's `date_key`, and the previous day's row is unchanged in both count and `updated_at`.

#### Scenario: Pre-boundary rows are never retroactively rewritten

- **WHEN** the clock crosses midnight with entries already logged for the previous day
- **THEN** those rows keep their original `date_key` / `consumed_on` values, and the previous day's totals are unchanged when viewed later.

#### Scenario: Reload after rollover agrees with what was written

- **WHEN** the page is reloaded after the rollover and the same surfaces are opened
- **THEN** the values shown match the rows actually written on each side of the boundary, with no data appearing on the wrong day.

#### Scenario: Non-UTC timezone is exercised

- **WHEN** the rollover journey runs under a non-UTC timezone
- **THEN** local date keys, and any timestamp-column query converted through `getUtcIsoRangeForLocalDateKeys()`, select the same calendar day the user sees.

### Requirement: Day-rollover presentation freshness

A mounted surface SHALL NOT present a stale calendar day as "Today". When the local day changes while the application is open, the active section SHALL refresh its day-scoped data, and inactive mounted sections SHALL be marked stale so they refresh on activation rather than rendering values held from the previous day.

This requirement describes a decided contract that the application does not yet satisfy: refresh today is driven by `isActive` transitions and foreground events, neither of which a midnight tick produces. Its tests SHALL be written against this contract and quarantined per the contract-gap protocol, naming the companion change `fix-day-rollover-refresh`.

#### Scenario: The active section does not show yesterday as today

- **WHEN** the clock advances from 23:55 to 00:05 while a day-scoped section is active
- **THEN** that section's "today" data reflects the new day rather than values held from before the boundary.

#### Scenario: An inactive section refreshes on activation rather than showing memory

- **WHEN** the user switches to a section that was mounted before the boundary and has not been activated since
- **THEN** it displays the new day's data, not the values it held when it was last active.

#### Scenario: UI and database never disagree about which day a tick belongs to

- **WHEN** a habit is ticked at 00:10 with the app mounted since the previous evening
- **THEN** the panel that acknowledges the tick is labelled with the same day the row was written to.

### Requirement: Entity state-machine coverage including invalid transitions

For each mutable entity — todo, habit and habit completion, pomodoro session, calorie entry, workout routine/session, sync record, restore, command draft — the suite SHALL cover the valid transitions and at least the invalid or interrupting transitions that a user can actually reach.

#### Scenario: Edit abandoned by navigating away

- **WHEN** a user opens an entity for editing, changes a field, and switches to another section without saving, then returns
- **THEN** the documented behaviour holds (retained draft or discarded draft), and the persisted row is unchanged either way.

#### Scenario: Delete cancelled leaves the entity intact

- **WHEN** a user triggers a destructive action and cancels the confirmation
- **THEN** the entity remains present, its `deleted_at` is still `NULL`, and no sync record was enqueued.

#### Scenario: Increment against a soft-deleted habit creates no orphan row

- **WHEN** an increment is attempted for a habit whose `deleted_at` is set
- **THEN** no `habit_completions` row is created, and the call returns a zero count rather than throwing.

#### Scenario: Decrement to zero removes the completion row

- **WHEN** a habit completion at count 1 is decremented
- **THEN** the row is hard-deleted (the documented exception for this non-synced table), and a later increment on the same day creates a fresh row at count 1.

#### Scenario: Recurring todo completed repeatedly creates one instance per due date

- **WHEN** a daily recurring todo is completed, un-completed, and completed again several times in the same session
- **THEN** exactly one non-deleted instance exists for the next due date, matched on `recurrence_id` + `due_date`.

### Requirement: Cross-feature interaction coverage

The suite SHALL cover workflows that cross feature boundaries, including linked actions, Overview aggregation of every feature's data, Settings changes propagating into feature screens, and the command center writing into todos and habits.

#### Scenario: Linked action fires exactly once at target

- **WHEN** a source todo linked to a target entity is completed
- **THEN** the target's effect is applied once, a notice is surfaced, an execution row exists, and re-completing after un-completing does not apply the effect a second time.

#### Scenario: Linked action against a deleted target skips rather than errors

- **WHEN** the target entity of a linked-action rule has been soft-deleted and the source trigger fires
- **THEN** the effect resolves as skipped with a `target_missing` reason, no partial write occurs, and the user-visible flow completes without an error state.

#### Scenario: Overview reflects a change made in another mounted section

- **WHEN** a todo is completed in the Todos section and the user switches to the already-mounted Overview section
- **THEN** the pending-todo count and any derived summary reflect the change, without requiring a reload.

#### Scenario: A settings change reaches its feature section

- **WHEN** the daily calorie goal is changed in the Settings drawer and the drawer is closed
- **THEN** the Calories section shows progress against the new goal, and the value survives a reload.

### Requirement: Persistence verified from independent surfaces

Every journey step that mutates data SHALL verify the outcome from at least two independent surfaces, and at least one mutating step per journey SHALL additionally verify the persisted SQLite rows after a reload. A success message alone SHALL NOT be accepted as evidence that a mutation persisted.

#### Scenario: A mutation is confirmed from a second surface

- **WHEN** a calorie entry is added in the Calories section
- **THEN** the entry appears in the Calories list, the day's total and the Overview consumed-calories value both reflect it, and after a reload both still do.

#### Scenario: Row-level assertions accompany integrity-sensitive steps

- **WHEN** a journey step deletes, reorders, or restores data
- **THEN** the journey asserts the underlying rows — count, `deleted_at`, `sort_order`, and monotonic `updated_at` — rather than only the rendered list.

#### Scenario: Negative oracle accompanies every mutation

- **WHEN** a journey step asserts what changed
- **THEN** it also asserts what must not have changed — neighbouring rows, other features' aggregates, and the total row count for the affected table.

### Requirement: Interruption coverage

The suite SHALL interrupt workflows at meaningful points — before input, mid-input, mid-submission, immediately after submission, during a load, and while background work is in flight — by reloading, switching sections, hiding the tab, or restarting the page, and SHALL assert that the resulting state is deterministic and safe.

#### Scenario: Reload immediately after a write

- **WHEN** the page is reloaded immediately after a create action is submitted
- **THEN** the entity is either fully present or fully absent — never partially written — and the outbox reflects the same outcome.

#### Scenario: Section switch during a running timer

- **WHEN** the user switches sections while a Pomodoro session is running and returns later
- **THEN** the timer is still running with the correct remaining time, and the session logs correctly on completion.

#### Scenario: Reload during a running timer discards the session and logs nothing

- **WHEN** the page is reloaded while a Pomodoro session is running
- **THEN** the timer returns to a clean idle state at the configured duration, and **no** `pomodoro_sessions` row exists for the interrupted session — a partially-elapsed session is never logged, never half-counted toward a streak, and never duplicated by a later completed session.

#### Scenario: An abandoned workout session logs nothing

- **WHEN** an active workout session is interrupted by a reload or by ending it early
- **THEN** no `workout_logs` or `workout_session_exercises` rows are written for it, and the routine's history is unchanged.

#### Scenario: Tab hidden mid-session

- **WHEN** the tab is hidden while a timer runs
- **THEN** the background warning is surfaced on return and the elapsed time is computed from wall-clock delta rather than from missed ticks.

### Requirement: Realistic mistake and recovery coverage

The suite SHALL cover realistic user errors — double submission, empty and malformed input, over-length values, deleting the wrong item, editing stale data, retrying after a failure — and SHALL assert that data is not corrupted, feedback is understandable, the app stays usable, and the user can recover.

#### Scenario: Double-tapped submit creates one row

- **WHEN** a create button is tapped twice in rapid succession
- **THEN** exactly one row exists for that entity, and exactly one sync record is queued for it.

#### Scenario: Rapid double increment is not lost

- **WHEN** a habit circle is tapped twice within the same tick
- **THEN** the completion count is exactly 2, with no `UNIQUE(habit_id, date_key)` violation surfaced to the user and no lost increment.

#### Scenario: Invalid input is rejected without side effects

- **WHEN** a form is submitted with an empty required field or an over-length value
- **THEN** the specific validation message is shown, no row is written, no sync record is queued, and the user's other entered values are preserved so they can correct and resubmit.

#### Scenario: Retry after a failure does not duplicate

- **WHEN** a write fails, the user retries, and the retry succeeds
- **THEN** exactly one row exists and the failed attempt left nothing behind.

### Requirement: Failure injection and recovery for remote operations

The suite SHALL exercise remote failure at the network boundary — offline, timeout, 5xx, malformed body, and per-entity partial failure — and SHALL assert queue durability, backoff, requeue scope, user-visible messaging, and eventual convergence. No journey SHALL depend on a live Supabase project.

#### Scenario: Offline writes accumulate and survive a restart

- **WHEN** several writes are made while offline and the page is then fully reloaded
- **THEN** the persisted outbox in `app_meta.sync_outbox` still contains those records, deduped to one per `(entity, id)`, and no local data was lost.

#### Scenario: Reconnect flushes the queue exactly once per record

- **WHEN** connectivity is restored
- **THEN** each queued record is pushed exactly once, the queue drains to zero, failure state clears, and no duplicate rows are produced.

#### Scenario: Partial failure requeues only the failed entity

- **WHEN** a push succeeds for `todos` and fails for `habits`
- **THEN** only the habits records return to the queue, the todos records stay dropped, and the recorded error names the failing entity.

#### Scenario: Backoff is respected by interval flushes

- **WHEN** a push has just failed
- **THEN** the interval-driven flush does not retry before the scheduled retry time, while an explicit visibility or reconnect flush may retry opportunistically.

#### Scenario: A failing backend is surfaced to the user

- **WHEN** pushes have failed repeatedly
- **THEN** the Settings backup status communicates the failure state, and the app remains fully usable offline-first with no blocked writes.

### Requirement: Repetition and accumulation coverage

The suite SHALL execute repeated operations — the same action on one entity, the same action across many entities, repeated navigation, repeated reloads — within a single session, and SHALL assert against duplicated rows, incorrect counters, stale UI, accumulated listeners, and degradation.

#### Scenario: Repeated section switching does not degrade or duplicate

- **WHEN** the user cycles through all six sections ten times in one session
- **THEN** every section still renders correct data, no duplicate rows exist anywhere, and no section shows values from a prior visit.

#### Scenario: Repeated create/delete cycles leave a consistent count

- **WHEN** the same entity is created and deleted repeatedly
- **THEN** the visible count returns to its baseline each cycle, soft-deleted rows accumulate only as expected, and aggregates never count deleted rows.

#### Scenario: Long session does not accumulate duplicate effects

- **WHEN** a session runs long enough to include multiple visibility changes and foreground refreshes
- **THEN** each refresh produces one data load per surface, not a growing number, and no duplicate notices or sync flushes are triggered per event.

### Requirement: Realistic data volumes and values

Fixtures SHALL provide three named sizes (SMALL, TYPICAL, HEAVY) and SHALL include boundary and awkward values that users produce naturally: empty optional fields, maximum-length and over-length text, Unicode and emoji, names differing only by case, zero and maximum numeric values, and date keys predating the migration-5 local-key cutover.

#### Scenario: Heavy fixture renders correctly

- **WHEN** the application is opened cold against the HEAVY fixture
- **THEN** every section renders accurate aggregates, heatmaps render their full window without gaps or off-by-one days, and no surface displays `NaN`, `undefined`, `Infinity`, or `[object Object]`.

#### Scenario: Case-differing meal names respect the unique index

- **WHEN** entries named "Oatmeal" and "oatmeal" are logged
- **THEN** `saved_meals` behaves per its `COLLATE NOCASE` unique index without raising a user-visible error, and both calorie entries persist independently.

#### Scenario: Boundary values are accepted or rejected at the documented limit

- **WHEN** a 200-character todo title, a 201-character title, a 999g macro, and a computed 9999 kcal entry are submitted
- **THEN** each is accepted or rejected exactly at the documented validation boundary, with the specific message, and no partially-written row results.

#### Scenario: Legacy UTC date keys do not corrupt current views

- **WHEN** the fixture contains rows whose date keys were written in the pre-cutover UTC format
- **THEN** current-day views remain correct and the legacy rows are neither double-counted nor silently rewritten.

### Requirement: Destructive operation coverage

For every destructive action the suite SHALL cover attempt, cancel, and confirm; and after confirming SHALL verify the resulting state, attempts to access the affected data, the state of related entities, the state after a reload, and the effect on dependent surfaces.

#### Scenario: Deleting an entity leaves dependents consistent

- **WHEN** a habit with completion history, or a routine with logged workouts, is deleted
- **THEN** the entity disappears from its list, its historical child rows behave per the documented contract, aggregates and heatmaps recompute without counting it, and nothing renders as an orphan or a broken reference.

#### Scenario: Deleting a linked-action target disables the rule safely

- **WHEN** an entity that is the target of a linked-action rule is deleted
- **THEN** rules targeting it are cleared or neutralised, the source trigger still completes successfully, and no execution errors surface to the user.

#### Scenario: Soft delete is never a hard delete on synced tables

- **WHEN** any user-facing delete completes on `todos`, `habits`, `calorie_entries`, or `workout_routines`
- **THEN** the row still exists with `deleted_at` set, and a delete sync record is enqueued.

### Requirement: Backup and restore lifecycle coverage

The suite SHALL cover the full restore lifecycle from the user's perspective, including prompt eligibility, dismissal persistence keyed on the backup signature, blocking once local data exists, the disclosures shown, and precisely which data does and does not return.

#### Scenario: Dismissed prompt stays dismissed for the same backup

- **WHEN** the restore prompt is dismissed and the app is reloaded with the same remote backup state
- **THEN** the prompt does not reappear, and the dismissal is recorded against the backup's freshness signature.

#### Scenario: One local row blocks restore

- **WHEN** a single todo is created on an otherwise empty device and Settings is opened
- **THEN** the restore section reports that restore is blocked because active synced local rows exist.

#### Scenario: Restore imports only the scoped entities

- **WHEN** a restore completes on an empty device
- **THEN** todos, habits and calorie entries are imported with the reported counts, and habit completion history, saved meals, pomodoro sessions, workout logs and workout routines are absent — so streaks read zero and the disclosures shown to the user match what actually happened.

#### Scenario: Restore aborts if local rows appear mid-import

- **WHEN** local synced rows exist at the moment the import transaction re-checks emptiness
- **THEN** the import is abandoned, local data is unchanged, and the user is returned to a blocked state rather than a partial import.

### Requirement: A device with deleted history is not an empty device

Restore eligibility SHALL consider every row in the synced tables, regardless of `deleted_at`. A device that has ever held synced rows SHALL NOT be treated as empty, so a one-shot `INSERT OR REPLACE` import can never overwrite a local deletion with a stale backup row.

This requirement describes a decided contract that the application does not yet satisfy: `getLocalSyncBackedCounts()` currently filters `deleted_at IS NULL`. Its tests SHALL be written against this contract and quarantined per the contract-gap protocol, naming the companion change `fix-restore-emptiness-counts-deleted-rows`.

#### Scenario: Soft-deleted rows block restore

- **WHEN** a device's only synced rows are soft-deleted and a remote backup is available
- **THEN** restore is reported as blocked by local data, and the startup prompt is not offered.

#### Scenario: A deleted todo is never resurrected by an import

- **WHEN** a todo is deleted locally while offline, the deletion has not yet been pushed, and a restore is attempted
- **THEN** the todo does not reappear, and the user's most recent intent is not overwritten by the backup's older view of that row.

### Requirement: Multi-tab and single-writer behaviour

The suite SHALL cover a second tab being opened on the same origin and SHALL assert the user-visible outcome of the single OPFS writer lock, rather than asserting only a console error.

#### Scenario: Second tab surfaces an actionable failure

- **WHEN** a second tab is opened on the same origin while the first holds the database lock
- **THEN** the second tab shows the bootstrap error state with an actionable message, not a blank screen or a silently broken UI.

#### Scenario: The first tab is unaffected

- **WHEN** the second tab is closed
- **THEN** the first tab remains fully functional, its data is intact, and subsequent writes succeed.

### Requirement: Background and asynchronous processing coverage

The suite SHALL cover the application's background work — the 30-second sync interval, visibility-triggered flush, NetInfo reconnect flush, foreground refresh, timer ticking, and service-worker registration — while the user continues interacting, and SHALL assert eventual convergence of UI and persisted state.

#### Scenario: User interacts while a flush is in flight

- **WHEN** the user creates and deletes entities while a sync flush is in progress
- **THEN** no write is lost, the queue converges to empty after the flush completes and a subsequent flush runs, and no record is pushed twice.

#### Scenario: Foreground refresh reconciles a stale surface

- **WHEN** the tab is hidden, data changes are made in a way the surface did not observe, and the tab is shown again
- **THEN** the surface refreshes once and displays current values.

#### Scenario: Service worker does not serve stale application shell

- **WHEN** the app is reloaded after the shell cache version has changed
- **THEN** the current shell is served and no stale cache version remains active.

### Requirement: Performance-oriented user journeys

The suite SHALL assert user-perceptible responsiveness at realistic data volume, using thresholds derived from a measured baseline and set loosely enough to catch cliffs rather than noise. Formal load and stress testing SHALL be recorded as out of scope rather than implied.

#### Scenario: Cold start at heavy volume stays usable

- **WHEN** the app is opened cold against the HEAVY fixture
- **THEN** Overview reaches an interactive, populated state within the agreed threshold and does not render a partially-populated state that later jumps.

#### Scenario: Section switching stays responsive after long use

- **WHEN** all six sections have been activated and the session has run through many interactions
- **THEN** switching sections stays within the agreed threshold, with no progressive slowdown across repeated switches.

#### Scenario: Large lists remain interactive

- **WHEN** a list of 200+ todos or 600+ calorie entries is scrolled and filtered
- **THEN** input remains responsive and the correct rows are rendered throughout.

### Requirement: Exploratory testing missions

The capability SHALL include documented, time-boxed exploratory missions for areas automation cannot reach or where unknown-unknowns are likely. Each mission SHALL state objective, starting state, area, realistic behaviour to try, risks to investigate, and what to observe — without prescribing every interaction.

#### Scenario: Missions cover the automation gaps

- **WHEN** the mission set is reviewed
- **THEN** it covers at minimum native notification and `Alert.alert` behaviour, real-device long sessions, swipe-gesture conflicts with list scrolling and drag reorder, theme legibility across all themes, multi-day real-time usage, and command-center behaviour with the flag enabled.

#### Scenario: Mission findings are recorded

- **WHEN** an exploratory mission is run
- **THEN** its findings are recorded with enough reproduction detail to become either an automated regression test or a filed defect.

### Requirement: Regression suite definition and CI wiring

The capability SHALL define which journeys form the permanent regression suite, and SHALL wire them into CI such that the fast subset runs on every pull request and the full set runs on the default branch and on a schedule.

#### Scenario: PR lane runs the P0 journeys

- **WHEN** a pull request is opened
- **THEN** the integration tests and the P0 journeys (daily session, offline/reconnect, restore lifecycle, linked-action chain, mistake/recovery) run, and the suite fails the PR if any of them fail.

#### Scenario: Slow journeys do not gate every PR

- **WHEN** the multi-day, heavy-volume and performance journeys are scheduled
- **THEN** they run on the default branch and on a schedule rather than on every pull request, and their exclusion from the PR lane is explicit in CI configuration rather than incidental.

#### Scenario: Coverage reductions are visible

- **WHEN** a journey is skipped, quarantined, or narrowed
- **THEN** the reason is recorded in the known-gap register, so reduced coverage is never silently presented as passing coverage.

### Requirement: Real-SQLite integration test level

The capability SHALL add a Vitest integration project that executes the real `runMigrations()` and the real data-layer SQL against an in-process SQLite database, without the global `expo-sqlite` mock, so that constraint and migration behaviour is executed rather than asserted through a stub.

#### Scenario: Migrations run forward from an empty database

- **WHEN** the integration setup opens a fresh database and runs bootstrap DDL plus `runMigrations()`
- **THEN** the schema version reaches the current version, every table and index the app queries exists, and re-running migrations is a no-op.

#### Scenario: A failing migration step does not record itself as applied

- **WHEN** a migration step raises inside its transaction
- **THEN** the schema version is not advanced and the partial changes are rolled back.

#### Scenario: Constraints behave as the data layer assumes

- **WHEN** two increments target the same `(habit_id, date_key)`, or two saved meals differ only by case
- **THEN** the real `UNIQUE` constraints and `ON CONFLICT` clauses produce the counts and rows the data layer's callers depend on.

#### Scenario: Soft-delete filtering is verified against real rows

- **WHEN** rows are soft-deleted and every list function is called
- **THEN** no deleted row is returned by any read path, and aggregate queries exclude them.

### Requirement: Test data and reset strategy

The capability SHALL define and implement seeding and reset helpers with explicit, documented semantics per level, and journeys SHALL seed through real data-layer paths wherever a fixture must be reachable by real user actions.

#### Scenario: Seeded state is reachable by real usage

- **WHEN** a fixture is generated
- **THEN** it is produced by calling the same data-layer functions the UI calls, so no fixture can contain a row shape the application cannot itself produce.

#### Scenario: Reset semantics are explicit

- **WHEN** a test or journey resets state
- **THEN** the helper documents exactly what is cleared — OPFS SQLite files, AsyncStorage keys, in-memory sync queue — and what deliberately survives.

### Requirement: Contract-gap protocol

Where a decided contract describes behaviour the application does not yet have, the test SHALL be written against the decided contract, quarantined with an explicit expected-failure marker naming its companion change, and registered as a contract gap. A test SHALL NOT be weakened to match current behaviour in order to pass.

#### Scenario: A contract gap is written, not skipped

- **WHEN** a decided contract is not yet satisfied by the application
- **THEN** the test exists, expresses the contract, is quarantined with a comment naming the companion change, and appears in the known-gap register as a contract gap distinct from a capability gap.

#### Scenario: Quarantine is released by the companion change

- **WHEN** the companion application change lands
- **THEN** the quarantine marker is removed as part of that change and the test runs in the normal suite — the testing change does not carry the fix.

#### Scenario: Weakening an assertion is not an acceptable resolution

- **WHEN** a journey fails because the application does not meet a decided contract
- **THEN** the resolution is a filed defect and a quarantined test, never an assertion loosened to match the current behaviour.

### Requirement: Known-gap register

The capability SHALL maintain a register of what cannot currently be tested, why, and the recommended path to closing each gap, distinguishing contract gaps (decided behaviour not yet implemented) from capability gaps (untestable with this harness). Difficult areas SHALL NOT be silently omitted.

#### Scenario: Every untestable area is named

- **WHEN** the register is reviewed
- **THEN** it names at minimum native platform behaviour, real Supabase round-trips, true concurrency, load and memory profiling, legacy-database migration journeys, pre-cutover UTC date keys, and the absence of an authorization model — each with a reason and a recommendation.

#### Scenario: Contract gaps are tracked to closure

- **WHEN** the register is reviewed
- **THEN** each contract gap names its decided contract, its quarantined tests, and the companion change that will close it.

### Requirement: Authentication and authorization scope statement

Because the application is single-user with anonymous Supabase authentication, no roles, and no client-side authorization boundary, the capability SHALL document that no authorization test surface exists client-side rather than inventing one, and SHALL cover the session behaviour that does exist.

#### Scenario: Anonymous session bootstrap is covered

- **WHEN** the app bootstraps with Supabase configured
- **THEN** an anonymous session is established or the failure is handled without blocking local-first use, and the app remains fully functional when Supabase is unconfigured.

#### Scenario: Authorization is documented as out of scope, not skipped

- **WHEN** the testing model is reviewed for auth coverage
- **THEN** the absence of roles and client-side enforcement is stated explicitly, with server-side RLS identified as out-of-repo and recommended for a separate contract-testing change.
