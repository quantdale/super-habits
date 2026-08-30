## Purpose

Define the command center's read-only "Ask" capability: users ask natural-language questions about their own locally stored data (pending todos, calorie summaries, habit streaks) and receive answers from a two-call, schema-constrained retrieval pipeline — client-side fact computation against local SQLite, then remote phrasing over computed facts only — with an Auto mode classifier, persisted last-used mode, and in-memory session-scoped conversation history.

## Requirements

### Requirement: Ask mode in the command center

The command center SHALL offer a three-way mode selector — Ask, Create, Auto — as a single segmented control. Create mode SHALL behave exactly as the existing command-parsing pipeline behaves today, unmodified. Auto mode SHALL classify the input as either an Ask question or a Create command before routing to the corresponding pipeline.

#### Scenario: User selects Ask mode and asks a question

- **WHEN** the user selects Ask mode and submits "how many calories have I eaten today?"
- **THEN** the input is routed to the Ask pipeline and never reaches the Create draft parser.

#### Scenario: User selects Create mode, existing behavior is unaffected

- **WHEN** the user selects Create mode and submits "add a habit to drink water every morning"
- **THEN** the existing `create_habit` draft pipeline runs exactly as it does today, with no Ask-related code in its path.

#### Scenario: Auto mode routes an ambiguous-looking input

- **WHEN** the user leaves mode on Auto and submits "what's still pending today?"
- **THEN** the system classifies the input as an Ask question and routes it to the Ask pipeline without the user manually switching modes.

### Requirement: Auto-mode misroute offers a same-input retry in the other mode

When Auto mode routes an input to the wrong pipeline, the result view SHALL show a single, visible affordance that re-submits the exact same input text through the other pipeline (Ask ↔ Create), without requiring the user to retype anything. No richer disambiguation UI is required for v1.

#### Scenario: Ask pipeline ran but the input was actually a create command

- **WHEN** Auto mode classifies "add a habit to drink water every morning" as an Ask question and the Ask pipeline returns an unsupported or unhelpful result
- **THEN** the result view shows a "Try as Create instead" affordance that re-submits the same text through the Create pipeline without the user retyping it.

#### Scenario: Create pipeline ran but the input was actually a question

- **WHEN** Auto mode classifies "how many calories have I eaten today?" as a Create command and the Create pipeline returns an unsupported result
- **THEN** the result view shows a "Try as Ask instead" affordance that re-submits the same text through the Ask pipeline without the user retyping it.

### Requirement: Last-used mode persists across sessions

The system SHALL persist the last-used command mode to AsyncStorage under the key `superhabits.command.last-used-mode`, read on command-center launch and written whenever the user changes mode. Absent a stored value, the mode SHALL default to `"auto"`.

#### Scenario: Returning user sees their last mode

- **WHEN** a user previously selected Ask mode and reopens the command center in a new app session
- **THEN** the mode selector shows Ask as active, read from `superhabits.command.last-used-mode`.

#### Scenario: Fresh install defaults to Auto

- **WHEN** a user opens the command center for the first time and no value exists at `superhabits.command.last-used-mode`
- **THEN** the mode selector defaults to Auto.

### Requirement: Two-call retrieval pipeline with no raw rows sent to the model

Every supported Ask question SHALL use a classify call that returns a
structured `{intent, params}` result, local deterministic retrieval against
SQLite, and at most one phrase call that receives only the question and typed,
bounded facts. All arithmetic, date resolution, entity resolution, and data
retrieval between the calls SHALL happen in client-side TypeScript against
local SQLite, not inside either model call. A deterministic local fallback MAY
replace the phrase call's user-visible answer after provider failure.

#### Scenario: Classify call receives only the question

- **WHEN** the classify call is made for a question about local data
- **THEN** the request contains the question and bounded conversation context,
  but no stored user rows, database dump, credentials, or arbitrary query.

#### Scenario: Phrase call receives computed facts, not rows

- **WHEN** the calorie summary retrieval for today returns a computed total of
  1800 kcal across 3 entries
- **THEN** the phrase call payload contains normalized totals and entry count,
  but not the individual calorie entries.

#### Scenario: Model cannot alter a computed total

- **WHEN** the phrase call returns an answer referencing a calorie total
- **THEN** the numeric total available to the user originates from local
  retrieved facts or the deterministic fallback, not from an unverified model
  calculation.

#### Scenario: Phrase call receives computed facts only

- **WHEN** local retrieval computes a calorie total over a bounded range
- **THEN** the phrase request contains normalized totals and range metadata but
  not individual calorie rows.

#### Scenario: Phrase failure cannot alter facts

- **WHEN** the phrase call returns a conflicting number or fails
- **THEN** the client preserves local retrieved facts and either uses the
  deterministic formatter or reports the sanitized unavailable state.

### Requirement: Supported v1 intents

The Ask pipeline SHALL support exactly the following V2 read intents:
`pending_todos`, `calorie_summary`, `habit_progress`, `workout_summary`,
`focus_summary`, and `daily_overview`. It SHALL reject unsupported questions
without fabricated facts. Pending Todo retrieval MAY filter due today,
overdue, or priority when those filters are deterministically available.
Calorie summaries SHALL support today, a single date, and bounded date ranges.
Workout and focus summaries SHALL use canonical local history. The daily
overview SHALL combine bounded facts from Todos, Habits, Calories, Focus, and
Workout for the requested local day.

#### Scenario: Pending Todo question

- **WHEN** the user asks what remains pending today
- **THEN** classification selects `pending_todos`, local retrieval filters
  active incomplete Todos deterministically, and phrasing receives only the
  bounded count/list facts.

#### Scenario: Pending todos question

- **WHEN** the user asks "what are my pending tasks today?"
- **THEN** the classify call returns `pending_todos`, and local retrieval calls
  the Todos data layer for incomplete active Todos.

#### Scenario: Calorie range question

- **WHEN** the user asks how many calories and macros were consumed this week
- **THEN** classification selects `calorie_summary` with a bounded local-date
  range and retrieval returns calories, protein, carbohydrates, fats, fiber,
  and entry count when available.

#### Scenario: Calorie summary question, explicit range

- **WHEN** the user asks "how many calories did I eat this week?"
- **THEN** the classify call returns `calorie_summary` with a resolved bounded
  date range and retrieval calls the existing calorie summary function.

#### Scenario: Habit progress question

- **WHEN** the user asks how consistent they have been with exercise this
  month
- **THEN** classification selects `habit_progress` and retrieval returns
  bounded insight facts using existing Habit progress semantics.

#### Scenario: Habit streak question, named habit

- **WHEN** the user asks "what's my streak on drinking water?"
- **THEN** the classify call returns `habit_progress` with the named Habit
  parameter and retrieval computes its current progress using local data.

#### Scenario: Workout and focus questions

- **WHEN** the user asks how many workouts or completed Pomodoros occurred in a
  bounded period
- **THEN** the corresponding summary intent retrieves only bounded local
  aggregate facts and does not query remote backup tables.

#### Scenario: Daily overview question

- **WHEN** the user asks "how am I doing today?"
- **THEN** `daily_overview` returns a bounded cross-feature summary using the
  current local date conventions.

#### Scenario: Out-of-scope question is rejected

- **WHEN** the user asks for settings changes, database operations, coaching
  unsupported by product policy, or another non-allowlisted read
- **THEN** Ask returns an unsupported result and does not call the phrase step
  with fabricated facts.

#### Scenario: Out-of-scope question is rejected, not fabricated

- **WHEN** the user asks a question about unsupported account administration or
  another non-allowlisted read
- **THEN** the pipeline returns an unsupported result and does not call the
  phrase step with fabricated facts.

### Requirement: Local todo pending-count retrieval functions

`features/todos/todos.data.ts` SHALL expose `listPendingTodos()` and `countPendingTodos()` functions that filter to non-deleted, incomplete todos at the data layer, so pending-status filtering is no longer only available ad hoc inside screen components.

#### Scenario: Listing pending todos

- **WHEN** `listPendingTodos()` is called
- **THEN** it returns all todos where `deleted_at IS NULL` and `completed = 0`.

#### Scenario: Counting pending todos

- **WHEN** `countPendingTodos()` is called with 3 incomplete, non-deleted todos in the database
- **THEN** it returns `3`.

### Requirement: Session-scoped, in-memory chat history

Ask conversation history SHALL remain in memory for the current app process,
not SQLite or AsyncStorage, and SHALL be bounded before it is sent to the
classifier. Follow-up questions MAY use prior turns as context, but mutation
commands SHALL NOT use opaque conversational memory to select an entity.

#### Scenario: Follow-up uses bounded context

- **WHEN** the user asks a follow-up such as "what about yesterday?"
- **THEN** the classifier receives the bounded prior Ask context and local
  retrieval resolves the new date deterministically.

#### Scenario: Follow-up question reuses conversation context

- **WHEN** a user asks "how many calories today?" and then asks "what about
  yesterday?"
- **THEN** the second classifier request includes the first bounded question /
  answer turn so the date reference can be resolved consistently.

#### Scenario: Closing and reopening the command center preserves history

- **WHEN** a user closes and reopens the Command Center during the same app
  process
- **THEN** the in-memory Ask turns remain available and are not written to
  SQLite or AsyncStorage.

#### Scenario: Cold start clears history

- **WHEN** the app process is fully restarted
- **THEN** the next Ask request begins with no prior conversation turns.

#### Scenario: Opaque mutation reference is not accepted

- **WHEN** the user asks "complete that one" without an explicit selected
  reference
- **THEN** the Command Center does not use Ask memory to choose a Todo and
  returns needs-input or unsupported.

### Requirement: Unsupported and unavailable question handling

The Ask pipeline SHALL distinguish an understood but out-of-scope question
from a network, authentication, quota, or model failure. Unsupported results
SHALL be scoped and non-retryable in tone; unavailable results SHALL be
sanitized and retryable. A provider failure after valid local retrieval SHALL
use the deterministic fallback requirement where available.

#### Scenario: Unsupported question shows scope

- **WHEN** classification identifies a question outside the six V2 intents
- **THEN** the user sees a scoped unsupported message and no phrase request is
  made.

#### Scenario: Unsupported question shows a scoped message

- **WHEN** the classify call determines the question falls outside the six V2
  intents
- **THEN** the user sees a message indicating the assistant is out of scope,
  without a transient-failure framing.

#### Scenario: Provider failure shows retryable state

- **WHEN** classification or retrieval-bound phrasing fails due to a transient
  provider or network error
- **THEN** the user sees an unavailable/retryable state without provider
  internals or raw errors.

#### Scenario: Unavailable question shows a retryable message

- **WHEN** the classify or phrase call fails due to a network timeout or Edge
  Function error
- **THEN** the user sees a temporary-unavailable message with a retry path,
  without provider internals.

### Requirement: V2 Ask parameters and facts are bounded by intent

The Ask classifier SHALL return only an allowlisted intent and intent-specific
parameters. The client SHALL locally validate and bound date ranges, filters,
entity names, and numeric limits before retrieval. Retrieval SHALL return
typed, serializable facts for `pending_todos`, `calorie_summary`,
`habit_progress`, `workout_summary`, `focus_summary`, and `daily_overview`;
raw SQLite rows and unbounded history SHALL never be sent to the phrase model.

#### Scenario: Invalid range is rejected locally

- **WHEN** classification returns an inverted, oversized, or malformed date
  range
- **THEN** Ask returns an unsupported or needs-input result without an
  unbounded database query or phrase call.

#### Scenario: Daily overview is bounded

- **WHEN** the user asks for today's overview
- **THEN** local retrieval returns only normalized counts, totals, progress, and
  date context for the current local day, not raw rows or full history.

### Requirement: Habit progress uses existing insight semantics

The `habit_progress` intent SHALL support a named Habit or an overall bounded
Habit view and SHALL use the product's existing progress-insight semantics for
current streak, longest streak, scheduled/completed occurrences, recent
completion windows, effective target, and actual progress. Ask SHALL NOT
duplicate or replace Habit streak/target mathematics.

#### Scenario: Named Habit progress is retrieved

- **WHEN** the user asks "how is Gym going?"
- **THEN** Ask resolves the named active Habit deterministically and returns
  bounded insight facts for phrasing.

#### Scenario: Missing or ambiguous Habit is safe

- **WHEN** no active Habit or more than one active Habit matches the requested
  name
- **THEN** Ask returns needs-input or unsupported without choosing a Habit by
  semantic similarity.

### Requirement: Ask has deterministic phrase fallback

If classification succeeds and local retrieval produces valid facts but the
optional phrase provider fails, Ask SHALL return a concise deterministic local
answer when the intent has a supported formatter. The fallback SHALL identify
the relevant date/range and use only the retrieved facts. Classification,
retrieval, and phrase failures SHALL remain distinguishable from unsupported
questions.

#### Scenario: Phrase failure still answers a daily overview

- **WHEN** local daily-overview facts are valid and the phrase provider times
  out
- **THEN** Ask returns a deterministic summary from those facts and does not
  claim that a provider-generated analysis was completed.

#### Scenario: Unsupported intent skips phrasing

- **WHEN** classification returns an unsupported intent
- **THEN** Ask shows a scoped unsupported result and makes no phrase call.
