## ADDED Requirements

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
Every Ask question SHALL be answered via exactly two model calls: a classify call that returns a structured `{intent, params}` result via schema-constrained JSON, and a phrase call that receives only already-computed facts (never raw database rows) and returns a structured `{answer}` result via schema-constrained JSON. All arithmetic and data retrieval between the two calls SHALL happen in client-side TypeScript against local SQLite, not inside either model call.

#### Scenario: Classify call receives only the question
- **WHEN** the classify call is made for the question "what have I eaten today?"
- **THEN** the request payload contains the question text (and prior turns, if any) and no stored user data.

#### Scenario: Phrase call receives computed facts, not rows
- **WHEN** the calorie summary retrieval for today returns a computed total of 1800 kcal across 3 entries
- **THEN** the phrase call payload contains `{question, retrievedFacts: {totalCalories: 1800, entryCount: 3, ...}}` and does not contain the individual `calorie_entries` rows.

#### Scenario: Model cannot alter a computed total
- **WHEN** the phrase call returns an answer referencing a calorie total
- **THEN** the numeric total in the answer originates from the `retrievedFacts` computed by local TypeScript, not from a number invented by the model.

### Requirement: Supported v1 intents
The Ask pipeline SHALL support exactly three intents in v1: pending todos, calorie summary (today or an explicit date range), and habit streak (a specific habit by name, or overall). Any question that does not map to one of these three intents SHALL be classified as unsupported rather than answered with fabricated data.

#### Scenario: Pending todos question
- **WHEN** the user asks "what are my pending tasks today?"
- **THEN** the classify call returns intent `pending_todos`, and the retrieval step calls the todos data layer to list incomplete todos.

#### Scenario: Calorie summary question, explicit range
- **WHEN** the user asks "how many calories did I eat this week?"
- **THEN** the classify call returns intent `calorie_summary` with a resolved date range, and retrieval calls the existing calorie summary function over that range.

#### Scenario: Habit streak question, named habit
- **WHEN** the user asks "what's my streak on drinking water?"
- **THEN** the classify call returns intent `habit_streak` with a habit name parameter, and retrieval resolves the named habit and computes its current streak.

#### Scenario: Out-of-scope question is rejected, not fabricated
- **WHEN** the user asks a question about workout history (out of v1 scope)
- **THEN** the pipeline returns an unsupported result explaining the question is out of scope, and does not call the phrase step with fabricated facts.

### Requirement: Local todo pending-count retrieval functions
`features/todos/todos.data.ts` SHALL expose `listPendingTodos()` and `countPendingTodos()` functions that filter to non-deleted, incomplete todos at the data layer, so pending-status filtering is no longer only available ad hoc inside screen components.

#### Scenario: Listing pending todos
- **WHEN** `listPendingTodos()` is called
- **THEN** it returns all todos where `deleted_at IS NULL` and `completed = 0`.

#### Scenario: Counting pending todos
- **WHEN** `countPendingTodos()` is called with 3 incomplete, non-deleted todos in the database
- **THEN** it returns `3`.

### Requirement: Session-scoped, in-memory chat history
Ask conversation history SHALL be held only in memory for the current app session, via a dedicated context structurally parallel to the existing command-center context. "Session" SHALL mean the app's process lifetime, not the command-center modal's open/closed state. History SHALL NOT be written to SQLite or AsyncStorage, and SHALL be discarded only on app cold start — not on modal close. Follow-up questions within the same session SHALL include prior turns as context for the classify call.

#### Scenario: Follow-up question reuses conversation context
- **WHEN** a user asks "how many calories today?" and then asks "what about yesterday?"
- **THEN** the second classify call includes the first question/answer as context so "yesterday" resolves relative to the same calorie-summary intent.

#### Scenario: Closing and reopening the command center preserves history
- **WHEN** a user asks a question, closes the command center modal, and reopens it within the same app session
- **THEN** the prior question/answer turn is still present in the conversation view, unaffected by the modal close.

#### Scenario: Cold start clears history
- **WHEN** the app is fully restarted
- **THEN** no prior Ask conversation turns are available, and the next question starts with empty context.

### Requirement: Unsupported and unavailable question handling
The Ask pipeline SHALL distinguish between a question that is understood but out of v1 scope (unsupported) and a question that could not be processed due to a network, auth, or model failure (unavailable), surfacing a distinct, user-visible message for each rather than a generic failure.

#### Scenario: Unsupported question shows a scoped message
- **WHEN** the classify call determines the question falls outside the three supported v1 intents
- **THEN** the user sees a message indicating the question is out of scope for this version, without a retry-as-if-transient framing.

#### Scenario: Unavailable question shows a retryable message
- **WHEN** the classify or phrase call fails due to a network timeout or edge function error
- **THEN** the user sees a message indicating the assistant is temporarily unavailable, with an option to retry.
