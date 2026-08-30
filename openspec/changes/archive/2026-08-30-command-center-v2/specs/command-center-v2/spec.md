## Purpose

Define a bounded, confirmation-first Command Center that can safely orchestrate
supported actions across SuperHabits features while keeping SQLite, domain
invariants, reminders, Linked Actions, and the local date model authoritative.

## ADDED Requirements

### Requirement: Supported mutation drafts are explicit and allowlisted

The Command Center SHALL support only `create_todo`, `complete_todo`,
`create_habit`, `log_habit`, `log_calorie_entry`, `log_workout_routine`, and
`start_focus_session` mutation kinds in V2. Each draft SHALL expose its own
intent-specific fields, status, confidence, warnings, and missing fields; a
single object with unrelated nullable fields SHALL NOT be used as the public
contract. The model SHALL reference entities by human-facing title or name,
not by an invented internal ID.

#### Scenario: Existing create actions remain supported

- **WHEN** a user submits a valid Todo or Habit create command
- **THEN** the Command Center produces the existing corresponding create draft
  and preserves its edit, validation, preview, and confirmation behavior.

#### Scenario: Unsupported mutation is rejected

- **WHEN** a user asks the Command Center to delete a Todo, change a reminder,
  execute SQL, or perform another non-allowlisted mutation
- **THEN** the result is `unsupported` and no mutation draft is executable.

### Requirement: Remote candidates are locally normalized and bounded

The client SHALL normalize and validate every remote or mock candidate again
before it can enter review. Validation SHALL reject malformed strings, unknown
enums, non-integer or negative numeric values, oversized values, invalid dates,
unsupported fields, and missing required fields. User text SHALL be treated as
data, not as parser policy, and parser output SHALL never be interpreted as SQL,
code, an ID-selection instruction, or an execution instruction.

#### Scenario: Invalid calorie candidate becomes needs-input

- **WHEN** the parser returns a calorie action with a missing food name,
  negative calories, or nutrition inferred without a supplied numeric value
- **THEN** local normalization rejects the invalid fields, asks for the missing
  or corrected value, and performs no write.

#### Scenario: Extra model fields cannot expand the action

- **WHEN** a parser response includes an unknown mutation kind, an internal ID,
  a SQL string, or arbitrary extra action fields
- **THEN** the client ignores or rejects the candidate and does not execute the
  extra instruction.

### Requirement: Every mutation uses preview then explicit confirmation

The Command Center SHALL show a precise review preview before every mutation.
The preview SHALL identify the action, affected entity or input, current state
when relevant, proposed result, local date/time, warnings, and meaningful
side-effects. Parsing, normalization, resolution, and preview construction
MUST NOT mutate SQLite or start a timer. Execution SHALL occur only after an
explicit user confirmation in the review state.

#### Scenario: Parsing does not write

- **WHEN** a user submits "complete Buy groceries" and the parser resolves a
  unique incomplete Todo
- **THEN** the preview is visible while the Todo remains incomplete until the
  user confirms.

#### Scenario: Habit preview explains threshold effects

- **WHEN** a user prepares a Habit increment that reaches the effective target
- **THEN** the preview shows the current and resulting progress and explains
  that normal completion-linked behavior may run after confirmation.

### Requirement: Entity references resolve deterministically

Todo, Habit, and Workout routine references SHALL resolve only against active
local entities using deterministic case-insensitive exact matching. A unique
match SHALL resolve; duplicate matches SHALL produce `needs_input` with
deterministic choices; no match or a deleted-only match SHALL not be silently
selected. Fuzzy or semantic model selection SHALL NOT silently choose a
mutation target.

#### Scenario: Duplicate Todo titles require a choice

- **WHEN** two active Todos have the title "Buy groceries" and the user asks to
  complete that title
- **THEN** the Command Center says that two matches were found and presents
  deterministic choices without changing either Todo.

#### Scenario: Deleted entity cannot be selected

- **WHEN** only a deleted Habit or Workout routine matches the requested name
- **THEN** the result is a rejected or needs-input state with no executable
  mutation.

### Requirement: Confirmed mutations use canonical feature behavior

After confirmation, the Command Center SHALL call the same authoritative
feature entrypoints used by the normal UI. It SHALL NOT write SQLite directly,
dispatch duplicate Linked Action source events, bypass sync enqueue, bypass
reminder reconciliation, invent nutrition, or create workout exercise/set
details. A confirmed mutation SHALL remain local-first when remote parsing is
unavailable.

#### Scenario: Confirmed Todo completion uses normal side effects

- **WHEN** a user confirms a unique incomplete Todo completion
- **THEN** the Todo is completed through the canonical Todo path, including
  recurrence and Linked Actions behavior, with no Command-specific duplicate
  source event.

#### Scenario: Remote parsing failure does not corrupt local state

- **WHEN** remote parsing is unavailable before confirmation
- **THEN** the user sees an unavailable or deterministic fallback result and no
  feature row is changed.

### Requirement: Todo completion is safe and idempotent

V2 SHALL support completion of exactly one active Todo by title/reference. An
already completed Todo SHALL produce a safe no-op preview/result. Recurring
Todo expansion and completion Linked Actions SHALL follow the canonical Todo
semantics. Todo deletion, arbitrary property editing, and ambiguous bulk
completion SHALL remain unsupported.

#### Scenario: Incomplete Todo completes

- **WHEN** the user confirms completion for one active incomplete Todo
- **THEN** its state becomes completed and the previewed result is shown.

#### Scenario: Already completed Todo is a no-op

- **WHEN** the resolved Todo is already completed
- **THEN** the Command Center reports that no change is needed and does not
  toggle it back to incomplete.

### Requirement: Habit logging uses the current local day and canonical semantics

V2 SHALL support one progress increment for exactly one active Habit on the
current local calendar day. The action SHALL use the effective target and
schedule semantics already defined by the product, preserve off-day behavior,
reconcile reminders through the canonical path, and emit a threshold Linked
Action only through the canonical completion transition. Model-supplied
historical Habit dates SHALL be rejected in V2.

#### Scenario: Habit increment crosses target once

- **WHEN** a user confirms a Habit log that moves progress from below the
  effective target to at least the target
- **THEN** progress is incremented for today and the normal completion event
  and reminder reconciliation happen exactly once.

#### Scenario: Historical Habit date is rejected

- **WHEN** a parser candidate supplies a date other than the current local day
  for a Habit log
- **THEN** the draft is rejected or needs-input and no historical completion is
  written.

### Requirement: Calorie logging records only supplied nutrition

V2 SHALL support a calorie entry with a required food name and positive,
bounded user-supplied calories. Protein, carbohydrates, fats, and fiber MAY be
provided as bounded non-negative values and otherwise SHALL use the existing
product default semantics. Meal type SHALL use an existing safe default when
available. Consumed date SHALL default to the current local date and explicit
historical dates SHALL be accepted only when the existing calorie contract
supports them. The Command Center SHALL NOT estimate nutrition from a food
name.

#### Scenario: Complete calorie entry is previewed and logged

- **WHEN** the user submits supplied calories and optional supplied macros for a
  food and confirms the preview
- **THEN** the entry is written through the canonical calorie function with the
  shown meal type/date and normal saved-meal behavior.

#### Scenario: Nutrition estimation is refused

- **WHEN** the user says only "I ate chicken breast" without a calorie value
- **THEN** the Command Center asks for calories and does not invent or write
  nutrition values.

### Requirement: Workout logging is limited to an existing routine

V2 SHALL support logging one completed active Workout routine by exact name.
Duplicate routine names SHALL require a choice, and missing or deleted
routines SHALL be rejected or needs-input. The action SHALL use the canonical
routine completion/log path and SHALL NOT construct exercise, set, weight, or
rep details from natural language.

#### Scenario: Existing routine is logged

- **WHEN** a user confirms "I finished Push Day" and exactly one active Push
  Day routine exists
- **THEN** one canonical completed routine log is created for the current local
  context.

#### Scenario: Routine ambiguity is safe

- **WHEN** multiple active routines have the requested name
- **THEN** the Command Center presents needs-input choices and creates no log.

### Requirement: Focus start uses the live timer lifecycle

V2 SHALL support starting one focus session with a bounded duration in the
existing supported range. It SHALL not change Pomodoro defaults, create a
completed history row at start, silently stop or replace an active/paused
session, or invent historical focus time. A live timer start SHALL use the
canonical timer lifecycle, including notification and app-lifecycle behavior.

#### Scenario: Valid focus session starts after confirmation

- **WHEN** the user confirms a 25-minute focus draft while no session is
  active
- **THEN** the Pomodoro surface starts the canonical live timer for 25 minutes
  and no completed history row is created at that moment.

#### Scenario: Active focus session is not replaced

- **WHEN** a focus session is running or paused and the user submits another
  start command
- **THEN** the result is a conflict/needs-input state and the existing session
  remains unchanged.

### Requirement: Duplicate confirmation cannot duplicate a mutation

The Command Center SHALL assign a local execution token to a reviewed draft and
guard execution deterministically so repeated confirmation of that same draft
cannot duplicate a Habit increment, calorie entry, workout log, focus start,
or other non-idempotent effect. A failed execution MAY be retried only after
the guard is safely released. The UI SHALL also expose an accessible busy/state
change, but visual button disabling SHALL NOT be the only protection.

#### Scenario: Double confirmation is harmless

- **WHEN** two confirmation attempts for the same reviewed draft arrive before
  the first finishes
- **THEN** only one canonical mutation is accepted and the second receives a
  safe duplicate/in-flight result.

### Requirement: Needs-input and errors are accessible and actionable

The Command Center SHALL render missing fields, ambiguity choices, conflicts,
unsupported results, and unavailable errors as readable states with semantic
roles, labels, and state announcements on web and native. After parsing, focus
SHALL move to the preview or first correction target when the platform exposes
focus management. Needs-input corrections SHALL preserve the parse → review
flow and SHALL not bypass confirmation.

#### Scenario: Missing calories receives correction focus

- **WHEN** a calorie draft lacks the required calories value
- **THEN** the missing-value message is readable and the calories correction
  control is labeled and focusable without writing an entry.

### Requirement: Command scope and security remain bounded

The remote parser SHALL preserve explicit authentication, request bounds,
quotas, upstream timeouts, provider error sanitization, and no service-role
exposure. The model SHALL receive no raw SQLite rows, credentials, arbitrary
tables, or ownership controls. The Command Center SHALL remain usable for
canonical local feature work when the remote provider is unavailable.

#### Scenario: Unauthenticated parser request is rejected

- **WHEN** the parser Edge Function receives a request without a valid bearer
  token
- **THEN** it rejects the request before provider execution and reveals no
  provider or database details.

#### Scenario: Prompt injection cannot expand scope

- **WHEN** user text asks the model to ignore its schema, output SQL, or execute
  an unsupported delete
- **THEN** the remote response is normalized to an allowlisted unsupported or
  needs-input result and no mutation occurs.
