# Todos Recurrence Management Specification

## ADDED Requirements

### Requirement: Recurring series editing distinguishes instance from series

Editing a Todo that belongs to a daily recurring series SHALL present explicit scope semantics: "this task only" (current instance) versus updating the series template so future instances inherit the change; completed history SHALL never be rewritten by a template edit.

#### Scenario: Edit the series title for future instances

Given a daily recurring todo with a completed instance from yesterday,
When the user edits the title with series scope,
Then the active (not completed) instances of that series carry the new title,
And the completed instance keeps its historical title,
And the next spawned copy uses the new title.

#### Scenario: Edit only the current instance

Given a daily recurring todo,
When the user edits title/notes/priority/due date with instance scope,
Then only that row changes,
And the series continues unaffected.

### Requirement: Stopping recurrence ends the series permanently

Stopping a recurring series SHALL set the recurrence marker to null on every row of the series and soft-delete pending future instances, so no future copy can ever be spawned again.

#### Scenario: Stop after completing today's copy

Given a daily series whose today instance is completed and whose tomorrow instance exists,
When the user stops the recurrence,
Then no instance of that series is pending in the future,
And day rollover does not spawn any new instance for the series,
And the completed instance remains visible in history.

#### Scenario: Stopped series does not resurrect

Given a stopped series with completed history,
When the app crosses into a new day and rollover recomputation runs,
Then no new todo is created for that series.

### Requirement: Restarting recurrence starts a new series

Re-enabling daily recurrence on a todo SHALL create a fresh series identity; previously stopped chains SHALL remain ended.

#### Scenario: Restart after stop

Given a stopped series,
When the user re-enables "Repeat daily" on a current task,
Then a new recurrence id is assigned,
And the new chain spawns daily copies independently of the old chain.

### Requirement: Destructive recurrence labels are unambiguous

Stop-repeat, delete-instance, and delete-series-implying actions SHALL use distinct labels and confirmation appropriate to reversibility; a label that could mean "this occurrence" and "the series" at once SHALL NOT be used.

#### Scenario: Stop versus delete copy

Given a recurring todo's edit surface,
When the management options render,
Then stopping future recurrences is labeled and described as keeping history,
And deleting the current instance is described as affecting only that copy.
