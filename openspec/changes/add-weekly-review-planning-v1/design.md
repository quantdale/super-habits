# Design: Weekly Review & Planning V1

## 1. Design Intent

Weekly Review & Planning V1 closes the product loop between tracking and planning.

The application already records a rich set of deterministic local facts. The new feature must aggregate those facts into a weekly review without creating a second analytics system, and then turn explicit user decisions into canonical domain mutations without introducing an autonomous planner.

The architectural principle is:

> deterministic local facts → guided review → explicit decisions → preview → confirmation → canonical mutations → durable review record

The review is useful offline. AI is optional and never authoritative.

## 2. System Boundaries

### Existing systems reused

- Todos: canonical create/update/complete/recurrence semantics
- Habits: effective-dated schedules and targets, completion history, progress/consistency selectors
- Pomodoro: completed session history and focus summaries
- Workouts: workout logs and summary selectors
- Calories: local ledger, goals, saved meals
- Linked Actions: canonical side effects for genuine new Todo mutations only
- Backup Completeness V2: durable outbox, remote schema, manifest/checkpoint, Restore V2
- Portable Backup V1: deterministic envelope, checksums, atomic import
- Recoverable Account V1: owner binding and account safety
- Command Center V2: deterministic local retrieval + optional remote phrasing boundary

### New system

A `weekly-review` feature module owns:

- weekly period calculation
- deterministic review summary assembly
- review draft state
- Todo decision modeling
- priority/reflection modeling
- final review validation
- exactly-once execution guard
- durable weekly review persistence
- history/read model

It does not own existing Todo/Habit/Workout/Focus/Calories mutation semantics.

## 3. Module Structure

Preferred repository-consistent shape:

```text
features/weekly-review/
  weeklyReview.types.ts
  weeklyReview.domain.ts
  weeklyReview.data.ts
  weeklyReview.summary.ts
  weeklyReview.executor.ts
  weeklyReview.validation.ts
  WeeklyReviewScreen.tsx
  components/...
```

Exact names may vary to fit current conventions, but keep calculation, persistence, execution, and UI responsibilities separated.

## 4. Week Semantics

Use the repository's sanctioned local-time/date helpers.

V1 must define one canonical week boundary. Prefer ISO-like Monday-start weeks unless the existing product already has a user-configurable or established week-start convention. The implementation agent must inspect current date helpers and existing analytics behavior before finalizing this choice.

Required invariants:

- week start/end are local-date concepts, not UTC-date concepts
- historical `date_key` values are not recomputed
- review key is stable across restart
- year boundary is safe
- DST transitions are safe
- Manila, UTC, New York, Honolulu, and Kiritimati date tests cover the calculation

Suggested logical representation:

```ts
type ReviewWeek = {
  weekKey: string;       // canonical local week identifier
  startDateKey: string;  // YYYY-MM-DD local
  endDateKey: string;    // inclusive local date key
  nextWeekStartDateKey: string;
  nextWeekEndDateKey: string;
};
```

Do not store locale-formatted dates as keys.

## 5. Review Summary Contract

The summary is deterministic and derived entirely from local authoritative data.

Suggested normalized shape:

```ts
type WeeklyReviewSummaryV1 = {
  week: ReviewWeek;
  todos: {
    completedCount: number;
    incompleteCount: number;
    overdueCount: number;
    dueNextWeekCount: number;
    carryForwardCandidates: TodoCandidate[];
  };
  habits: {
    scheduledOccurrences: number;
    completedOccurrences: number;
    consistencyPercent: number | null;
    attention: HabitAttentionItem[];
  };
  focus: {
    sessions: number;
    minutes: number;
    priorWeekMinutes: number | null;
  };
  workouts: {
    sessions: number;
    priorWeekSessions: number | null;
    routines: RoutineFrequencyItem[];
  };
  calories: {
    loggedDays: number;
    averageCaloriesOnLoggedDays: number | null;
    configuredGoal: number | null;
  };
  wins: ReviewInsight[];
  attention: ReviewInsight[];
};
```

Use actual domain types/selectors where practical rather than duplicating structures.

### Summary rules

- Bounded queries only.
- No full-history scans when a week-range query suffices.
- Comparisons may query the immediately preceding week only.
- No model-generated numerical claims.
- No nutrition estimation.
- No inferred Workout that is not in logs.
- No inferred Habit completion.
- Wins/attention are deterministic templates backed by computed facts.

## 6. Attention Rules

Keep V1 rules simple, inspectable, and testable.

Examples, subject to actual product semantics:

- overdue Todo count > 0 → attention item
- Habit consistency materially below its recent baseline or below a simple threshold → attention item
- no Focus sessions when prior week had sessions → attention item
- no Workout sessions when recent activity exists → attention item
- logged calorie average materially above configured goal → neutral factual attention item, never medical/dietary judgment

Avoid pseudo-intelligent scoring systems without product justification.

Every insight should include a stable machine `kind` and human English copy.

## 7. Review Draft

Review calculation and review decisions are distinct.

A draft exists only in memory/UI until final confirmation unless crash-resume is deliberately implemented. V1 does not require durable incomplete drafts.

Suggested decision model:

```ts
type WeeklyTodoDecision =
  | { todoId: string; action: 'leave' }
  | { todoId: string; action: 'reschedule'; dueDate: string }
  | { todoId: string; action: 'carry_forward'; dueDate?: string };

type WeeklyPriorityDraft = {
  id: string;
  text: string;
};

type WeeklyReviewDraft = {
  weekKey: string;
  todoDecisions: WeeklyTodoDecision[];
  priorities: WeeklyPriorityDraft[];
  newCommitments: NewTodoCommitmentDraft[];
  reflection: string;
};
```

The agent must inspect existing Todo recurrence semantics before deciding whether `carry_forward` maps to date movement, creation of a new Todo, or another canonical operation. Recurring Todo source semantics must never be corrupted by naive duplication.

## 8. Entity Resolution and Mutation Safety

The guided UI operates on already-resolved local records, not model-generated names.

Before final confirmation:

- re-fetch every referenced Todo by ID
- verify it still exists and is compatible with the chosen action
- revalidate all dates
- revalidate priority limits and text bounds
- detect concurrent changes
- transform stale actions into clear conflicts rather than blindly applying them

No SQL is generated from draft content.

## 9. Preview

The final preview is mandatory.

It must clearly show:

- selected top priorities
- Todos to be rescheduled, including old and new due dates
- Todos to be carried forward and the precise effect
- new Todo commitments to be created
- reflection to be saved
- any notable side effects expected from canonical Todo operations

There is no write during summary, editing, or preview.

## 10. Execution

Execution occurs only after explicit confirmation.

Use a dedicated execution token/receipt model so a double tap cannot duplicate new commitments or apply reschedules twice.

Because the final review itself becomes durable authoritative state and can be submitted only once per canonical week, prefer a durable SQLite guard rather than a process-local `Set` if practical.

Recommended sequence:

1. revalidate draft and referenced entities
2. begin transaction or orchestrated canonical mutation sequence
3. claim review execution ID/week uniqueness
4. apply canonical Todo changes
5. persist weekly review record describing the decisions/result
6. commit
7. refresh providers/UI

If canonical Todo functions manage their own transactions/Linked Actions, do not bypass them merely to force one giant transaction. Instead design an execution receipt/state machine that remains crash-safe across canonical operations.

The implementation agent must explicitly analyze this tradeoff and record it in the ExecPlan.

## 11. Exactly-Once / Crash Safety

Potential failure:

```text
create commitment 1
→ process crashes
→ review resubmitted
→ commitment 1 duplicated
```

V1 must not permit this.

Preferred durable state machine:

```text
planned
→ executing
→ completed
```

with stable per-operation IDs/receipts where necessary.

A resumed execution must know which Todo effects already happened.

Do not rely solely on UI disabled state or an in-memory token.

## 12. Weekly Review Persistence

Create append-only SQLite migration(s).

Preferred high-level model:

```text
weekly_reviews
```

Potential fields:

- id TEXT PRIMARY KEY
- week_key TEXT NOT NULL
- week_start_date TEXT NOT NULL
- week_end_date TEXT NOT NULL
- next_week_start_date TEXT NOT NULL
- completed_at TEXT
- status TEXT
- summary_payload TEXT
- plan_payload TEXT
- reflection TEXT
- created_at TEXT
- updated_at TEXT

Enforce one canonical completed review per `week_key` unless a revision model is explicitly added.

The payloads must have versioned runtime validators. Do not store arbitrary unvalidated JSON.

If the exactly-once execution design requires normalized child tables/receipts, add them rather than overloading one JSON document.

## 13. Review History

Users should be able to read previous completed reviews.

V1 history requirements:

- list recent weekly reviews newest first
- open a past review read-only
- see summary, reflection, priorities, and recorded planning decisions
- no retroactive mutation of historical review facts in V1

If underlying Todo/Habit state later changes, the stored review is a historical snapshot and should remain stable.

## 14. Entry Points

### Home / Today

Add a compact card only when useful:

- review available/due near week end or start of next week
- unfinished current-week review
- latest review completed recently may show brief confirmation

Do not permanently consume large Home space.

### Progress / Insights

A Weekly Reviews history entry is appropriate if current information architecture supports it.

Do not create a seventh top-level tab.

## 15. Due/Availability Policy

Keep V1 simple.

A review may be opened manually at any time for the current canonical week.

The Home reminder/card may become prominent near the final day of the week and remain available for a bounded grace period into the next week if the previous week is unreviewed.

If late-review semantics are implemented, the review must explicitly identify the week being reviewed and never mix current-week data into the prior week.

## 16. Todo Decisions

### Leave unchanged

No mutation.

### Reschedule

Use canonical Todo update path.

The new due date must be within the next review/planning window unless the UI explicitly permits another future date.

### Carry forward

The implementation agent must inspect recurrence architecture.

For a normal one-off Todo, carrying forward may safely mean rescheduling it into the next week.

For recurring Todos, do not mutate recurrence source/history in a way that causes duplicate recurrence expansion or loss of recurrence semantics. If carry-forward is unsafe for recurring instances, use a dedicated safe option/copy with explicit UX or exclude that action for recurring items in V1.

### New commitment

Create through canonical Todo creation.

Bound the number created in one review to a reasonable V1 limit, e.g. 10.

## 17. Priorities

Priorities are review-plan concepts, not necessarily Todos.

V1 supports 1–5 short text priorities.

They are stored in the weekly plan and displayed on Home/Today during the target week.

Do not automatically turn every priority into a Todo.

The user may optionally create explicit Todo commitments separately.

## 18. Reflection

Optional free text.

Suggested maximum: 4,000 characters unless existing text conventions justify another bound.

No AI required.

If optional AI phrasing exists, never replace the user's original text without explicit acceptance.

## 19. Optional AI Summary

V1 can ship entirely without new AI API scope.

If implemented, reuse the existing secure `user-ai-ask`/Command Center boundary only for phrasing already-computed bounded facts.

The remote request receives only the minimum typed fact payload and no arbitrary database access.

AI failure falls back to deterministic local summary immediately.

Do not make AI a completion gate.

## 20. Command Center Integration

Keep bounded.

Recommended initial integration:

- Ask: `weekly_review_summary`
- Ask: `next_week_plan`

These read local deterministic weekly review facts/history.

Do not add free-form mutation commands that complete the weekly review autonomously.

Any Command Center expansion must preserve existing parser/security architecture and can be deferred if it materially increases scope.

## 21. Backup Completeness V2 Integration

`weekly_reviews` is authoritative user state.

Add it to the complete backup contract.

Required work:

- `BACKUP_ENTITIES`
- canonical column ordering
- runtime validators
- Supabase owner-scoped remote table
- append-only migration
- RLS from table creation
- durable outbox instrumentation on review persistence
- existing-user backfill scope bump if necessary
- manifest integrity
- Restore V2 fetch/validation/import
- graph validation if child receipt tables are added
- semantic restore tests

Do not back up incomplete transient UI drafts unless deliberately made authoritative.

If execution receipts are required only for crash-safety and replay prevention, classify them carefully before deciding whether they belong in disaster recovery.

## 22. Portable Backup V1 Integration

The portable file reuses Backup V2's complete recoverable scope.

Once Weekly Review becomes a Backup entity, portable export/import should inherit it if the shared contract is correctly designed.

Still add explicit regression tests proving:

- reviews export
- checksums cover them
- import restores them
- historical Todo mutations are not replayed
- owner compatibility remains intact
- 100 MB size contract remains intact

## 23. Supabase Schema

Add a secure owner-scoped table using current migration conventions.

Conceptually:

```sql
weekly_reviews (
  id text primary key,
  user_id uuid not null default auth.uid(),
  week_key text not null,
  ...
)
```

Use owner-scoped uniqueness where required, for example `(user_id, week_key)` rather than globally unique week keys.

RLS:

- authenticated SELECT own rows
- authenticated INSERT own rows
- authenticated UPDATE own rows
- authenticated DELETE only if local product supports review deletion; otherwise do not invent destructive UX
- no anon database role grants
- no PUBLIC grants

Remember Supabase anonymous Auth users operate under `authenticated` role.

## 24. Schema/Version Impact

This feature likely requires:

- new local SQLite migration
- Backup scope version bump
- new Supabase migration

Do not edit applied migration history.

All migrations are append-only.

Production migration must be deployed only after local schema validation and tests are green.

## 25. Restore / Portable Import Side Effects

Restoring historical `weekly_reviews` must be inert.

It must NOT:

- reschedule Todos
- create commitments
- run Linked Actions
- alter Habit history
- trigger reminders
- re-run a weekly review execution state machine

Restore only reconstructs the completed review records.

## 26. Home Priority Surface

During the target week, Home/Today may display the latest active next-week priorities from the most recent completed review whose target week includes today.

Requirements:

- max 3 shown compactly, with access to full plan
- no mutation from the card in V1 unless clearly defined
- hide automatically outside target week
- timezone/local-date safe

## 27. Notifications

No push notification requirement in V1.

A local in-app Home card is sufficient.

Do not create another notification scheduling subsystem in this phase.

## 28. Performance

Weekly aggregation is bounded to one or two weeks.

Targets:

- summary calculation should feel instant for normal data
- queries use date/index constraints where available
- do not scan all history on every Home render
- cache/memoize at provider level only if measurements justify it

Create a long-term fixture performance test to prove review calculation remains bounded with years of history.

## 29. Accessibility

The guided flow must support:

- semantic headings
- accessible labels
- deterministic focus order
- keyboard navigation on Web
- screen reader announcements for validation and save status
- not relying on color alone
- sufficiently large touch targets

The final confirmation must be unmistakable.

## 30. Testing Strategy

### Unit

- week calculations/timezones
- summary aggregation
- insight rules
- draft validation
- priority limits
- Todo decision validation
- review payload parsers
- exactly-once state transitions

### Integration / real SQLite

- migration fresh install + upgrade
- summary from actual tables
- review execution
- crash/retry at each operation boundary
- duplicate confirmation
- recurrence-safe Todo behavior
- restart persistence
- review history
- Backup V2 outbox/backfill
- Restore V2 inert import
- Portable export/import inert import

### Web E2E

- open review
- summary
- Todo decisions
- priorities
- reflection
- preview no-write
- confirmation
- Home priorities
- history
- double submit
- stale/concurrent Todo conflict
- offline/no-AI path

### Simulation

Add a long-term persona that executes at least four weekly reviews across a month.

### Native

Run serial Android validation if environment is available.

## 31. Rollout

No feature flag is required unless current repository policy requires one.

If rollout guard is added, do not persist it as recoverable user state unless it is a genuine user preference.

## 32. Failure Handling

- summary failure: show local retry, no writes
- stale draft: show conflict and return to decision step
- execution crash: durable receipt/state permits resume without duplicate effects
- backup remote unavailable: review still saves locally; outbox retries
- AI unavailable: deterministic local wording
- portable/cloud restore malformed review payload: reject entire restore/import before writes

## 33. Security

- no arbitrary SQL
- no model-controlled IDs
- no service-role credentials
- no cross-owner remote access
- runtime validate remote/portable weekly review payloads
- owner-scoped Supabase uniqueness
- no hidden account-binding changes
- reflection text treated as inert data

## 34. Documentation

Update relevant authoritative docs with:

- Weekly Review feature behavior
- week semantics
- backup inclusion
- optional AI boundary if used
- new module location

Keep all documentation English only.
