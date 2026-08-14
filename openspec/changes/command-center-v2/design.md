## Context

The existing Command Center already owns a local Create parser, a remote
Create normalizer, a confirmation preview, and a two-stage Ask parser. The
feature modules already own the authoritative writes and most of the required
read calculations. The main architectural gap is that entity resolution is
not centralized, the draft union contains only two kinds, Ask facts are too
narrow, and the live Pomodoro timer is local state inside a lazily mounted
screen.

The design must preserve the repository layering rules: screens orchestrate,
feature data modules own SQLite, domain modules stay pure, and remote Edge
Functions never receive local rows or choose internal IDs. See the proposal
and delta specs for the externally visible contract.

## Goals / Non-Goals

**Goals:**

- Extend the existing overlay with a single strict discriminated draft union.
- Keep local normalization, entity resolution, preview, confirmation, and
  execution visibly separate.
- Reuse canonical data/domain paths for Todo, Habit, Calories, Workout, and the
  live Pomodoro timer.
- Make Ask retrieval typed, bounded, local, and intent-specific, with safe
  phrase fallback.
- Keep the implementation additive and compatible with the current Create,
  Ask, Auto, navigation, sync, reminder, and Linked Action behavior.

**Non-Goals:**

- A generic agent loop, arbitrary database access, free-form feature editing,
  remote analytics, or a new command-history table.
- Replacing the existing feature screens or moving live timer state into
  SQLite at session start.
- A nutrition database, exercise/set language model, or historical Habit
  schedule editor.

## Decisions

### 1. Keep parsing separate from review preparation

The parser returns a strict candidate draft with human-facing references. A
new command review layer will locally normalize it, resolve entity references
from data-layer list functions, read the small amount of current state needed
for the preview, and return a review model. It will never call a mutating data
function. This keeps no-write-before-confirm independently testable and avoids
putting SQLite access in `command.domain.ts`.

Alternative considered: let the parser resolve IDs. Rejected because the
remote model must not receive or choose ownership-scoped IDs, and because
resolution rules belong to deterministic local product code.

### 2. Use pure resolver functions over active entity snapshots

`resolveTodoReference`, `resolveHabitReference`, and
`resolveWorkoutRoutineReference` will accept a reference and a list of active
entities, normalize case/whitespace deterministically, and return a tagged
resolution result (`exact`, `ambiguous`, `not_found`, `already_satisfied`, or
`conflict`). The review orchestrator loads each list once, so one command never
does N+1 title queries. Deleted entities are excluded by the existing data
layer; a deleted-only reference remains non-selectable.

Alternative considered: fuzzy matching or embedding search. Rejected for
mutation targets because a semantically plausible guess is not safe enough.

### 3. Add the smallest canonical APIs needed for safe execution

The Todo data module will expose an idempotent `completeTodo` path by factoring
the existing toggle mutation's recurrence and Linked Action behavior. The UI
toggle will retain its toggle semantics, while Command calls the completion
path. Habit logging will call `incrementHabit`; Calories will call
`addCalorieEntry`; Workout will call `completeRoutine`. These functions remain
the only write owners and preserve sync, reminders, saved meals, recurrence,
and Linked Actions.

Alternative considered: call `toggleTodo` with the current row. Rejected
because an already-completed Todo would be toggled back to incomplete.

### 4. Bridge Command to the existing Pomodoro timer lifecycle

Add a small root-level Pomodoro command bridge context. `PomodoroScreen` will
register its existing live timer start handler and running/paused state with
the bridge. The Command host will navigate to the Pomodoro section and enqueue
one explicit focus-start request when the screen is not mounted; the screen
consumes the request once it registers. When a handler reports a running or
paused timer, the request returns a conflict. The bridge changes no settings
and does not write completed history at start. The existing screen remains the
owner of ticks, app visibility behavior, notifications, and completion logging.

Alternative considered: call `logPomodoroSession` from Command. Rejected
because that fabricates completed history and bypasses the live lifecycle.
Alternative considered: move all timer state to a new global store. Deferred
because it would create a broader lifecycle regression surface than the
explicit registration bridge requires.

### 5. Keep an execution token in the reviewed draft

Review preparation assigns a local-only token using the repository ID helper;
it is not a domain ID and is never sent to the model or persisted. The executor
claims the token before awaiting a write, returns a safe in-flight/duplicate
outcome for replay, and releases the claim on failure. Canonical Todo
completion remains idempotent as a second line of defense. Editing a draft
creates a new review token.

Alternative considered: rely only on `disabled` UI state. Rejected because
double taps and concurrent event delivery can enter the handler twice.

### 6. Expand Ask with aggregate facts and deterministic formatters

Ask types will use one parameter variant and one fact variant per intent. Date
keys are validated with the existing local-date helpers and ranges are capped
to a product-defined maximum. Retrieval calls existing aggregate/list APIs,
uses one bulk Habit completion read for insight windows, and returns only
counts, totals, progress metrics, names, and date metadata. A local formatter
will cover the six V2 intents when phrase AI is unavailable; it will never add
recommendations or numbers not present in facts.

Alternative considered: let the phrase model summarize raw rows. Rejected by
the current Ask contract and the privacy/offline safety requirements.

### 7. Treat remote contracts as extraction/phrasing boundaries

The Edge Functions will update their allowlists, strict JSON shape/prompt, and
request/fact bounds while retaining `verify_jwt`, explicit bearer validation,
the existing durable quota classes, body limits, timeouts, retries, and error
sanitization. Client normalizers remain authoritative even when the provider
returns schema-constrained JSON.

## Risks / Trade-offs

- [Risk] The current Pomodoro timer is component-local and can be unmounted in
  a fresh session. → [Mitigation] The bridge queues exactly one request and
  only resolves it after the mounted screen registers and starts the timer;
  targeted lifecycle tests cover mounted, queued, and conflict paths.
- [Risk] A local execution guard is process-scoped and cannot protect a crash
  between two independent user submissions. → [Mitigation] The Todo path is
  idempotent, and the Command UI keeps one token per reviewed draft; no
  persistent schema is added until a real cross-process requirement exists.
- [Risk] Habit insight calculations can become expensive for many long-lived
  habits. → [Mitigation] Retrieval uses one bounded completion-range query for
  the requested window, caps returned habit/fact counts, and records a
  performance check; it does not load unrelated feature history.
- [Risk] Existing Create tests and remote normalizer fixtures assume two kinds.
  → [Mitigation] Preserve old field shapes/behavior for create drafts, extend
  the union additively, and run the existing parser, E2E, and remote security
  suites before broader V2 coverage.
- [Risk] Provider phrasing can fail after successful local retrieval. →
  [Mitigation] Use deterministic local formatters for all six intents and keep
  unavailable results distinct when the formatter cannot safely answer.
- [Risk] Edge Function deployment or Android infrastructure may be unavailable
  in the environment. → [Mitigation] Verify source/version/hash where access
  exists and record exact external blockers; never convert missing
  credentials/devices into a pass.

## Migration Plan

1. Add the local contracts, resolvers, review/preview state, canonical Todo
   completion API, Pomodoro bridge, and bounded Ask retrieval without changing
   the database schema.
2. Update local mock/remote parser normalizers and Edge Function contracts.
3. Run focused unit/integration/E2E/timezone/security gates, then the full
   headless suite and deterministic simulation lane.
4. Deploy `parse-ai-command` and `user-ai-ask` to project
   `kruubbynsmxzxfdunaal` with JWT verification unchanged; inspect deployed
   metadata and source/hash if the CLI permits it.
5. Build/run native QA when the Android toolchain and target are available.
6. If rollback is required, revert the V2 application commit and redeploy the
   previous Edge Function source; because no schema migration is planned,
   rollback does not require destructive data changes.
