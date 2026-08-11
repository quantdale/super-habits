## 1. Fix — stable re-entry identity in the engine

The re-entry guards are keyed on `eventId`/`chainId` that `normalizeSourceAction` regenerates per `processSourceAction` call (`core/linked-actions/linkedActions.engine.ts:103-106`), so two completions of the same source todo never match. Key the guards on a stable semantic identity instead.

- [x] 1.1 **New data-layer lookup** — add a prior-applied lookup in `core/linked-actions/linkedActions.data.ts` mirroring the existing `getAppliedHabitDayCalorieExecution` (`linkedActions.data.ts:457`): match an execution with `status = 'applied'` by rule id + source identity (`source_feature`, `source_entity_id`, `trigger_type`, and `source_date_key` / `source_record_id` on `linked_action_events`) rather than by the per-call event/chain ids.
- [x] 1.2 **Consult it before executing** — in `LinkedActionsEngine.processSourceAction` (`core/linked-actions/linkedActions.engine.ts:262`), run the new lookup for non-idempotent effects (at least `habit.increment`) alongside the existing `source_event_already_executed` / `chain_guard_duplicate` guards (`linkedActions.engine.ts:305-324`) and map a hit to a `duplicate` result with a new reason (e.g. `source_identity_already_executed`), with execution-row recording intact.
- [x] 1.3 **Narrow to the same day** — the lookup must key on the source's day (date key / completion timestamp), so a same-day untick→tick of the source is a duplicate while a genuine next-day completion still applies; `todo.complete` behaviour, the `target_missing` skip, and `self_target_noop` remain unchanged.

## 2. Fix — idempotent `habit.increment` (second line of defence)

- [x] 2.1 **Increment backstop** — implement the proposal's second line of defence so a `habit.increment` never double-applies for the same sourced completion when the stable source identity is available: the engine consults the applied-execution lookup before the effect runs; `incrementHabitFromLinkedAction` (`features/habits/habits.data.ts:293`) single-fire semantics (`target_missing`, `invalid_amount`, `count += amount`) remain unchanged.
- [x] 2.2 **No collateral change** — confirm the `todo.complete` path is untouched (idempotent; J6 asserts `applied` then `skipped`) and no schema/migration change is introduced (no SQLite or `app_meta` impact).

## 3. Unit tests (Vitest)

- [x] 3.1 **Re-fire dedup** — `tests/linkedActions.engine.test.ts`: fresh source event ids for the same source entity + trigger + day yield `applied` then `duplicate` with the executor invoked exactly once; the existing habit-increment flow remains covered.
- [x] 3.2 **Next-day still applies** — `tests/linkedActions.engine.test.ts` and the real-DB integration test prove a second completion on a different day key is not a duplicate and increments again.
- [x] 3.3 **Lookup contract** — `tests/linkedActions.data.test.ts`: the new lookup returns the applied execution for a matching rule/source/day identity.
- [x] 3.4 **Habit path regression** — existing `tests/habits.data.test.ts` increment coverage remains unchanged and passes.

## 4. Regression journey (E2E)

- [x] 4.1 **New J6-style journey** — add `e2e/journeys/chain-reaction-habit-increment.spec.ts` modeled on `e2e/journeys/chain-reaction.spec.ts` (J6): author a `todo.completed → habit.increment` rule through the todo editor's Linked Actions card, complete the source, and assert exactly one `applied` execution plus a row-level `habit_completions` count of 1 for the target day (`expectRows` oracle).
- [x] 4.2 **Untick→tick step** — the journey re-ticks the source and proves two source events produce one persisted applied execution and one target completion; the duplicate path is an engine result rather than a second execution row. J6's own `todo.complete` and `target_missing` assertions in `chain-reaction.spec.ts` remain untouched.
- [x] 4.3 **No quarantine to release** — confirmed: `docs/testing/known-gaps.md` has no `habit.increment`/J6 entry and both journeys run unquarantined; no `data-testid` attributes were added.

## 5. Verification

- [x] 5.1 `npm run typecheck` and `npm run lint` pass with 0 errors and warnings under the existing cap.
- [x] 5.2 `npm test` — full suite passes (656 tests), including the new linked-action engine/data cases.
- [x] 5.3 The new `chain-reaction-habit-increment.spec.ts` and unchanged J6 `chain-reaction.spec.ts` pass in the `journeys` project; no remote/sync boundary is involved.
- [x] 5.4 **Spec conformance** — `todo.complete` re-fire remains `applied` then `skipped`, deleted-target handling remains `target_missing`, and focused engine/integration tests prove the source/day duplicate contract.
