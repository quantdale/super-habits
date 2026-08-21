# UI/UX Mass Wave Hardening Specification

## ADDED Requirements

### Requirement: Post-wave hardening uses the actual current schema head

The campaign SHALL derive migration numbering from current source. Given migrations 20 and 21 already exist, any new local migration SHALL use the next free version (expected >=22) and SHALL NOT rewrite historical migration blocks.

#### Scenario: New hardening column is required

Given current `core/db/client.ts` ends at migration 21,
When a new durable field is required during hardening,
Then the migration uses version 22 or a later free version if main advanced,
And migrations 20 and 21 remain unchanged.

### Requirement: Production remote schema matches the active client contract

The campaign SHALL NOT claim completion while production Supabase lacks tables/columns required by the current backup, restore, sync, or Daily Plan contracts.

#### Scenario: Repository migrations are pending live

Given repository migrations `20260821000000`, `20260821010000`, or `20260822000000` are absent from the live migration ledger,
When hardening reaches remote convergence,
Then the migrations are reviewed and applied in order when authorized,
And the live schema, RLS, grants, relationships, indexes, row counts, owners, and migration ledger are verified afterward.

### Requirement: UI test drift is distinguished from product regressions

Hardening SHALL reproduce each failure against current behavior before changing tests.

#### Scenario: A selector fails after intended UI redesign

Given the user-visible behavior remains correct but a prior text/layout selector no longer matches,
When the E2E test is repaired,
Then it uses a stable semantic role, label, test ID, or user-facing contract,
And the meaningful assertion is preserved rather than weakened or skipped.

### Requirement: Todo redesign preserves safe equivalent actions

Todos SHALL retain canonical mutation semantics while exposing quick capture, filters, bulk actions, overflow actions, delete confirmation, and non-gesture equivalents accessibly.

#### Scenario: User cannot or does not use swipe

Given a Todo action is available by swipe,
When the user opens the row menu or equivalent control,
Then the same supported operation is available without relying on gesture-only discovery.

### Requirement: Historical Habit edits obey lifecycle and schedule history

A Habit completion write for a historical date SHALL be accepted only when that date is actionable under authoritative schedule/effective/lifecycle history.

#### Scenario: User taps a paused historical day

Given the Habit was paused on the selected date,
When a historical check-in is attempted,
Then the data/domain boundary rejects or no-ops the invalid completion,
And no completion row is created merely because the UI exposed a day cell.

### Requirement: Pomodoro recovery preserves exactly-once completion semantics and coherent UX

Crash/reload recovery SHALL not duplicate or lose a focus session and SHALL not produce a permanently inconsistent completion state solely because recovery occurred.

#### Scenario: App reloads as a session reaches completion

Given an active session is recovered around its completion boundary,
When reconciliation runs,
Then the completed session is persisted at most once,
Its duration/type/association/note remain correct,
And the user reaches a coherent post-session state or documented equivalent without duplicate logging.

### Requirement: Workout resume preserves meaningful in-progress measurements

Durable workout draft recovery SHALL preserve all user-entered in-progress data required to resume faithfully.

#### Scenario: User enters load/reps and app restarts

Given measurements were entered for an in-progress workout before a restart,
When the draft is resumed,
Then those measurements are restored at the appropriate set/session position,
And no missing value is silently converted to measured zero or completed work.

### Requirement: Quick calorie logging does not mutate saved-meal history implicitly

A one-off quick calorie entry SHALL NOT create or update saved-meal catalog state or usage counters unless product semantics explicitly say the user selected/saved a reusable meal.

#### Scenario: User logs only kcal quickly

Given the user enters a one-off quick calorie value,
When the entry is committed,
Then a calorie diary entry is created through a canonical logging path,
And saved-meal history/use counts remain unchanged unless the user explicitly chose reusable meal behavior.

### Requirement: Daily Plan priority snapshots remain structurally aligned and recoverable

`top_todo_titles` SHALL preserve historical display snapshots aligned index-wise with `top_todo_ids` without corrupting pre-v21 data or backup compatibility.

#### Scenario: Priority Todo is later renamed or deleted

Given a Daily Plan saved a Todo ID and title snapshot,
When that Todo is later renamed or deleted,
Then the historical plan displays the saved snapshot,
And the snapshot remains aligned with the correct priority ID through backup/restore/portable operations.

### Requirement: Warm Momentum accessibility and motion contracts are functional

The design system SHALL provide equivalent understandable feedback across normal motion and reduced-motion modes, visible keyboard focus on web, appropriately sized frequent touch targets, meaningful labels/roles/states, and non-color-only cues.

#### Scenario: Reduced Motion is enabled

Given reduced-motion is enabled,
When completion, transition, or feedback states occur,
Then nonessential animation is removed/reduced,
And an equivalent state change remains understandable without motion.

### Requirement: Today orientation remains deterministic and non-opaque

Next Best Action and Today progress SHALL be derived from trustworthy current state, explain why an action is surfaced, and SHALL NOT introduce an opaque composite productivity score.

#### Scenario: Sparse new-user data

Given only one or two product modules contain data,
When Today renders,
Then it presents a useful deterministic orientation or starter action without empty chart clutter or fabricated cross-feature scoring.

### Requirement: Guided Planning writes remain canonical and bounded

The guided Planning flow SHALL preserve the existing Daily Plan invariants, including bounded top priorities, valid Todo references/snapshots, local-date semantics, and explicit save/confirmation behavior.

#### Scenario: Guided plan selects priorities

Given the user chooses up to three valid Todo priorities,
When the plan is saved,
Then IDs and title snapshots are stored coherently through the canonical Daily Plan mutation,
And no additional plan row is created for the same active date.

### Requirement: Prior hardening obligations remain binding

The older `harden-parallel-completion-wave-v2` change SHALL be reconciled against current code and current validation rather than abandoned because a later UI wave landed.

#### Scenario: Older plan contains stale pre-wave checkpoint text

Given its implementation mostly landed but its ExecPlan remains ACTIVE,
When this campaign closes,
Then the older plan is updated to truthful current evidence and status,
And unresolved requirements are not silently marked complete.

### Requirement: Full regression and exact-head CI are mandatory

The implementation-only wave's typecheck/lint evidence is insufficient for production readiness.

#### Scenario: Final candidate is ready

Given all classified product defects and test drift are resolved,
When final validation runs,
Then full unit/integration, OpenSpec/ExecPlan validation, web build, Playwright/journeys/PWA, dist-sync, deterministic simulation, timezone validation, remote schema validation, and native-as-available gates pass,
And GitHub Actions `quality` and `e2e` are both green for the exact final pushed SHA.
