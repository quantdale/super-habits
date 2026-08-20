# Productivity Expansion Wave V1 Hardening — Spec Delta

## Purpose

Define the production-hardening requirements for Projects, Goals, Daily Planning, Planning Hub, Quick Capture, Activity Timeline, and Progress Insights implemented by Productivity Expansion Wave V1.

This change SHALL NOT add unrelated product features. It SHALL make the implemented wave correct, durable, owner-safe, recoverable, portable, backward-compatible, and fully validated.

## ADDED Requirements

### Requirement: Planning views are read-only until explicit user mutation

Opening Planning Hub or any read-only planning surface SHALL NOT create authoritative rows, enqueue backup changes, or promote a provisional owner binding.

A Daily Plan SHALL become persistent only after an explicit meaningful user mutation such as Save, Commit, or Complete.

#### Scenario: Pristine user previews Today planning

- **GIVEN** a pristine device with a provisional anonymous owner and no meaningful local data,
- **WHEN** the user opens Today planning and closes it without saving,
- **THEN** no Daily Plan row is created,
- **AND** no outbox row is created,
- **AND** the dataset remains eligible for Recover Existing.

#### Scenario: User explicitly saves a Daily Plan

- **WHEN** the user saves meaningful Daily Plan state,
- **THEN** an authoritative Daily Plan row is created or updated,
- **AND** owner binding is promoted according to Recoverable Account rules,
- **AND** the mutation becomes eligible for durable backup.

### Requirement: Daily Plan date uniqueness respects soft delete

The database SHALL enforce at most one active Daily Plan per valid local date key.

A soft-deleted Daily Plan SHALL NOT prevent creation of a new active Daily Plan for the same date.

#### Scenario: Delete then recreate same day

- **GIVEN** a Daily Plan for `2026-08-20` is soft-deleted,
- **WHEN** the user later saves a new plan for `2026-08-20`,
- **THEN** creation succeeds,
- **AND** the historical tombstone is preserved.

### Requirement: Completion events use stable completion facts

Todo, Project, Goal, and Daily Plan completion history SHALL use stable completion timestamps or equivalent durable immutable transition facts rather than mutable edit timestamps.

#### Scenario: Completed Todo is edited later

- **GIVEN** a Todo was completed on day A,
- **WHEN** its title, notes, priority, due date, Project, or Goal is edited on day B,
- **THEN** its completion remains attributed to day A in Progress and Timeline.

#### Scenario: Todo is reopened and completed again

- **WHEN** a completed Todo is reopened,
- **THEN** its active completion timestamp is cleared,
- **AND WHEN** it is completed again,
- **THEN** the new completion transition receives a new completion timestamp.

#### Scenario: Project completion survives later edit

- **GIVEN** a Project is completed at time A,
- **WHEN** an unrelated editable field changes at time B,
- **THEN** Timeline still reports completion at time A.

### Requirement: Calendar dates are real local calendar dates

Project target dates, Goal target dates, Daily Plan keys, Progress periods, and date-key Timeline facts SHALL use sanctioned local-calendar semantics.

Shape-only strings that are impossible dates SHALL be rejected.

#### Scenario: Impossible date

- **WHEN** a mutation supplies `2026-02-30`,
- **THEN** the operation fails validation rather than normalizing to a different date.

#### Scenario: Seven-day period around DST

- **GIVEN** America/New_York crosses a DST boundary,
- **WHEN** Progress builds a seven-local-day period,
- **THEN** the period begins at local midnight of the first date and ends at local midnight after the seventh date,
- **AND** it does not assume every local day is exactly 24 hours.

#### Scenario: Calorie date in UTC+14

- **GIVEN** an entry has authoritative `consumed_on = 2026-08-20`,
- **WHEN** Timeline renders in Pacific/Kiritimati,
- **THEN** the item remains grouped under `2026-08-20`.

### Requirement: Progress metrics use authoritative domain facts

Progress SHALL compare bounded periods using authoritative facts for each domain.

It SHALL NOT infer a count from an unrelated metric.

#### Scenario: Focus session count

- **GIVEN** three focus sessions with durations 10, 25, and 50 minutes,
- **WHEN** Progress is computed,
- **THEN** focus session count is 3,
- **AND** focus minutes are computed independently from actual durations.

#### Scenario: Rolling-period label

- **IF** Progress uses the latest seven local days rather than a calendar Monday–Sunday week,
- **THEN** user-facing copy describes it as the last seven days rather than “this week”.

### Requirement: Project and Goal associations are referentially coherent

Todo, Habit, Goal, and Project associations SHALL reference existing owner-compatible parents and SHALL remain coherent through move and soft-delete operations.

#### Scenario: Missing parent is rejected

- **WHEN** a Todo/Habit/Goal mutation attempts to associate a nonexistent or soft-deleted parent ID,
- **THEN** the mutation fails without changing the child.

#### Scenario: Item assigned to Project-backed Goal

- **GIVEN** Goal G belongs to Project P,
- **WHEN** a Todo or Habit is assigned to G,
- **THEN** its Project association is reconciled to P according to the documented hierarchy rule.

#### Scenario: Goal moves Projects

- **GIVEN** Goal G moves from Project P1 to P2,
- **WHEN** the move commits,
- **THEN** linked Todos/Habits are reconciled coherently,
- **AND** no child remains with a contradictory Project/Goal pairing.

#### Scenario: Goal soft delete

- **WHEN** Goal G is soft-deleted,
- **THEN** linked Todos/Habits have `goal_id` cleared,
- **AND** their valid Project association is preserved.

#### Scenario: Project soft delete

- **WHEN** Project P is soft-deleted,
- **THEN** Goals/Todos/Habits that reference P become unassigned from P,
- **AND** child content is not itself deleted.

### Requirement: Cross-owner Project and Goal references are impossible remotely

Remote relationship constraints and RLS SHALL prevent an authenticated owner from attaching a child row to another owner's Project or Goal.

#### Scenario: Owner A attempts to reference owner B Project

- **GIVEN** owner B owns Project PB,
- **WHEN** owner A attempts to insert/update a Goal/Todo/Habit referencing PB,
- **THEN** the write is rejected,
- **AND** no cross-owner relationship is persisted.

### Requirement: Daily Plan priorities use stable identity and historical snapshots

Daily Plan priority controls SHALL use Todo IDs rather than titles.

A historical plan SHALL remain intelligible if a selected Todo is later renamed, completed, or deleted.

#### Scenario: Duplicate titles

- **GIVEN** two pending Todos have the same title but different IDs,
- **WHEN** both are selected and one is removed,
- **THEN** only the selected ID is removed.

#### Scenario: Selected Todo later disappears

- **GIVEN** a completed Daily Plan selected Todo T,
- **WHEN** T is later renamed, completed, or deleted,
- **THEN** the historical plan remains readable using its bounded stored snapshot or equivalent stable representation,
- **AND** no Todo is recreated.

#### Scenario: Priority bound

- **WHEN** a plan is saved,
- **THEN** at most three unique valid priority Todo IDs are accepted.

### Requirement: Activity Timeline does not fabricate historical precision

Timeline SHALL use stable exact timestamps where the source domain has them and authoritative local date keys where it does not.

It SHALL NOT move events between calendar days by inventing UTC timestamps.

#### Scenario: Project created and completed within window

- **GIVEN** a Project was created and later completed within the displayed window,
- **WHEN** Timeline is built,
- **THEN** both valid events may be represented,
- **AND** completion is not substituted for creation solely because it happened later.

#### Scenario: Bounded merged result

- **WHEN** source queries collectively return more items than the Timeline display limit,
- **THEN** the merged Timeline remains deterministically bounded.

### Requirement: Projects, Goals, and Daily Plans are complete recoverable backup entities

After hardening, Projects, Goals, and Daily Plans SHALL participate in the owner-scoped durable backup contract rather than remaining local-only.

#### Scenario: Existing local planning data is backfilled

- **GIVEN** a user created Projects/Goals/Daily Plans during the implementation-only wave,
- **WHEN** the hardened backup scope initializes,
- **THEN** those existing rows are enqueued/backfilled under the correct owner without data loss.

#### Scenario: New planning mutation

- **WHEN** a hardened Project/Goal/Daily Plan mutation commits,
- **THEN** its owner-scoped durable backup intent is persisted through the standard synced mutation architecture.

### Requirement: Remote planning tables are owner-scoped and RLS protected

Supabase SHALL contain additive owner-scoped tables/columns required by the hardened planning model.

#### Scenario: Owner CRUD

- **GIVEN** an authenticated user,
- **THEN** they may SELECT/INSERT/UPDATE/DELETE only rows whose `user_id` equals their authenticated UID,
- **AND** no anon database-role or PUBLIC table privilege bypasses that rule.

#### Scenario: Existing production data survives migration

- **WHEN** the additive migration is applied,
- **THEN** existing user-owned rows retain their IDs, owner IDs, and content,
- **AND** no row is deleted merely to satisfy the migration.

### Requirement: Backup manifests encode prospective scope explicitly

New backup manifests SHALL carry an explicit backup scope version in addition to schema version.

Restore SHALL distinguish known historical exact scopes from corrupt/unknown partial scopes.

#### Scenario: Known legacy manifest

- **GIVEN** a historical manifest from a known pre-current scope that lacks explicit scope version,
- **WHEN** its exact entity set matches a recognized historical contract,
- **THEN** Restore may map it to that known scope and treat later-introduced entities according to the compatibility rule.

#### Scenario: Unknown partial manifest

- **GIVEN** a manifest is missing arbitrary current entities but does not match a known historical scope,
- **THEN** Restore rejects it as incomplete/invalid rather than treating missing data as empty.

### Requirement: Portable backup evolves without abandoning valid historical files

New portable exports SHALL encode a prospective explicit backup scope and include hardened planning data.

The importer SHALL retain explicit support for known historical Portable V1 scope variants.

#### Scenario: Historical Portable V1 file

- **GIVEN** a valid Portable V1 file produced by a recognized historical Super Habits scope,
- **WHEN** it is imported on an eligible empty device,
- **THEN** its original integrity/canonicalization rules are verified,
- **AND** it remains recoverable.

#### Scenario: New portable export

- **WHEN** a user exports after hardening,
- **THEN** the file includes current Projects, Goals, Daily Plans, planning associations, stable completion facts, and explicit current scope metadata,
- **AND** it satisfies the shared 100 MB export/import size contract.

#### Scenario: Unknown legacy-like file

- **WHEN** a file has an unrecognized partial entity set or incompatible version combination,
- **THEN** import fails before any local write.

### Requirement: Restore and portable import reconstruct planning state inertly

Restoring or importing historical planning data SHALL NOT replay historical user actions.

#### Scenario: Restore Daily Plan

- **WHEN** a completed Daily Plan is restored,
- **THEN** the plan record and priority snapshot are reconstructed,
- **AND** referenced Todos are not automatically completed/created,
- **AND** no Linked Action or Quick Capture mutation executes.

#### Scenario: Restore Project/Goal hierarchy

- **WHEN** planning rows are restored,
- **THEN** parents are imported before dependents,
- **AND** graph validation occurs before local commit.

### Requirement: Account recovery safety includes hardened planning state

Local and remote account safety SHALL treat Projects, Goals, and Daily Plans as meaningful user backup state.

#### Scenario: Planner preview on pristine device

- **WHEN** the user only views Planning Hub without saving,
- **THEN** local account state remains pristine.

#### Scenario: Temporary owner has only remote Project

- **GIVEN** temporary owner T has remote backup state only in a current planning entity,
- **WHEN** imported-owner recovery attempts to replace T,
- **THEN** the existing fail-closed remote-footprint guard blocks the switch.

### Requirement: Quick Capture preserves canonical mutation semantics

Quick Capture SHALL remain a thin UI entry point over hardened canonical domain APIs.

#### Scenario: Project capture

- **WHEN** a Project is created through Quick Capture after hardening,
- **THEN** it follows the same validation, owner, synced mutation, and backup rules as Project creation from Planning Hub.

#### Scenario: Failed capture

- **WHEN** capture validation fails,
- **THEN** no partial authoritative row or outbox intent is created.

### Requirement: Hardening includes full regression evidence

The campaign SHALL run the repository's full current validation stack and SHALL NOT claim production readiness from minimal compile checks alone.

#### Scenario: Final repository release gate

- **WHEN** the hardening session reports completion,
- **THEN** unit/integration/timezone/schema/OpenSpec/ExecPlan/Web E2E/dist-sync/simulation gates required by the hardening plan have passed,
- **AND** Android/iOS status is reported honestly according to environment availability,
- **AND** the exact final pushed SHA has GitHub Actions `quality = PASS` and `e2e = PASS`.

### Requirement: Hardening does not broaden product scope

This campaign SHALL repair and integrate the existing Productivity Expansion Wave V1 without adding unrelated product families.

#### Scenario: Agent encounters an attractive unrelated feature

- **WHEN** the hardening agent discovers an unrelated enhancement opportunity,
- **THEN** it records/defer it rather than expanding this campaign,
- **UNLESS** the change is strictly necessary to satisfy a hardening invariant above.
