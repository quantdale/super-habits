# Tasks: Complete Product Correction Flows V1

## 1. Todos recurrence management

- [ ] 1.1 Data layer: series-scope template update, stop-series (clear marker on all rows + soft-delete future pending), restart with fresh recurrence_id; domain helpers pure-tested.
- [ ] 1.2 UI: edit sheet scope options + stop/restart controls with unambiguous labels and confirmation; honest recurring Linked-Actions copy.
- [ ] 1.3 Tests: unit + integration coverage for every semantics branch (daily chain, completed instance, no-resurrection rollover, restart, outbox intents).

## 2. Calories day correction

- [ ] 2.1 Data layer: `consumedOn` in `updateCalorieEntry` with validation and single outbox intent.
- [ ] 2.2 UI: date control in the edit modal (existing picker pattern), both Form/Diary refresh paths.
- [ ] 2.3 Tests: move yesterday↔today, month boundary, atomic multi-field save, idempotent re-save, failed-save no-op, aggregate refresh, outbox.

## 3. Workout correction

- [ ] 3.1 Activate `updateRoutine` edit UI; template/history isolation proof.
- [ ] 3.2 Activate custom-exercise edit/archive/restore + archived listing UI.
- [ ] 3.3 Contract-completed accidental-log deletion path (cascade + durable intents + restore inertness) with confirm UI; completed numerics immutable.
- [ ] 3.4 Tests for each newly mutable field and the delete cascade.

## 4. Pomodoro management and correction

- [ ] 4.1 Preset authoring UI wired to `savePomodoroPresets` (built-ins protected).
- [ ] 4.2 Post-hoc session note/relink from history via `setPomodoroSessionMeta`.
- [ ] 4.3 Tests: preset CRUD + persistence/recovery; relink/unlink single-intent semantics.

## 5. Weekly Review discoverability and management

- [ ] 5.1 Planning Hub Progress entry opening the existing modal.
- [ ] 5.2 History delete wired to `deleteWeeklyReview` with confirmation.
- [ ] 5.3 Tests: E2E guided flow (open → complete → revisit → delete) + real-SQL persistence oracles.

## 6. Linked Actions policy reconciliation

- [ ] 6.1 Audit trigger event emission for calorie/workout/pomodoro triggers; record findings.
- [ ] 6.2 Apply decision (expose with proof or honest relabel) to policy + editor rows.
- [ ] 6.3 Integration exactly-once proof per exposed path + E2E author→fire→effect.

## 7. Planning-surface test floor

- [ ] 7.1 Real-SQLite contract tests for `progress.data` and `activityTimeline.data`.
- [ ] 7.2 E2E for all Planning Hub views with data oracles.
- [ ] 7.3 Repair vacuous-assertion leads (Workout/Habits specs) with existing oracle helpers.
