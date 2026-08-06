## 1. Fix — stable re-entry identity in the engine

The re-entry guards are keyed on `eventId`/`chainId` that `normalizeSourceAction` regenerates per `processSourceAction` call (`core/linked-actions/linkedActions.engine.ts:103-106`), so two completions of the same source todo never match. Key the guards on a stable semantic identity instead.

- [ ] 1.1 **New data-layer lookup** — add a prior-applied lookup in `core/linked-actions/linkedActions.data.ts` mirroring the existing `getAppliedHabitDayCalorieExecution` (`linkedActions.data.ts:457`): match an execution with `status = 'applied'` by rule id + source identity (`source_feature`, `source_entity_id`, `trigger_type`, and `source_date_key` / `source_record_id` on `linked_action_events`) rather than by the per-call event/chain ids.
- [ ] 1.2 **Consult it before executing** — in `LinkedActionsEngine.processSourceAction` (`core/linked-actions/linkedActions.engine.ts:262`), run the new lookup for non-idempotent effects (at least `habit.increment`) alongside the existing `source_event_already_executed` / `chain_guard_duplicate` guards (`linkedActions.engine.ts:305-324`) and map a hit to a `duplicate` result with a new reason (e.g. `source_identity_already_executed`), with execution-row recording intact.
- [ ] 1.3 **Narrow to the same day** — the lookup must key on the source's day (date key / completion timestamp), so a same-day untick→tick of the source is a duplicate while a genuine next-day completion still applies; `todo.complete` behaviour, the `target_missing` skip, and `self_target_noop` must remain unchanged.

## 2. Fix — idempotent `habit.increment` (second line of defence)

- [ ] 2.1 **Increment backstop** — implement the proposal's second line of defence so a `habit.increment` never double-applies for the same sourced completion even where the stable identity is unavailable: either the engine consults the 1.1 lookup before the effect runs, or the `'habit.increment'` executor in `core/linked-actions/linkedActions.effects.ts:42-53` becomes a no-op for an already-applied (source, day); keep `incrementHabitFromLinkedAction` (`features/habits/habits.data.ts:293`) single-fire semantics (`target_missing`, `invalid_amount`, `count += amount`) unchanged.
- [ ] 2.2 **No collateral change** — confirm the `todo.complete` path is untouched (idempotent; J6 asserts `applied` then `skipped` on re-fire) and no schema/migration change is introduced (no SQLite or `app_meta` impact).

## 3. Unit tests (Vitest)

- [ ] 3.1 **Re-fire dedup** — `tests/linkedActions.engine.test.ts`: two `processSourceAction` calls with fresh `eventId`/`chainId` but the same source entity + trigger + day against a `habit.increment` rule yield `applied` then `duplicate` with the executor invoked exactly once; mirror the existing `applies todo.completed -> habit.increment using the same execution and dedupe flow` test (`tests/linkedActions.engine.test.ts:118`).
- [ ] 3.2 **Next-day still applies** — `tests/linkedActions.engine.test.ts`: a second completion of the same source on a different day key is not a duplicate and increments again, proving the dedup is scoped to (source, trigger, day).
- [ ] 3.3 **Lookup contract** — `tests/linkedActions.data.test.ts`: the new 1.1 lookup returns the applied execution for a matching (rule, source identity, day), null for non-applied statuses and for non-matching source identities.
- [ ] 3.4 **Habit path regression** — run the existing `tests/habits.data.test.ts` `incrementHabitFromLinkedAction` coverage unchanged; add cases there only if the idempotency backstop (2.1) changes the function's signature.

## 4. Regression journey (E2E)

- [ ] 4.1 **New J6-style journey** — add `e2e/journeys/chain-reaction-habit-increment.spec.ts` modeled on `e2e/journeys/chain-reaction.spec.ts` (J6): author a `todo.completed → habit.increment` rule through the todo editor's Linked Actions card, complete the source, and assert exactly one `applied` execution plus a row-level `habit_completions` count of 1 for the target day (`expectRows` oracle).
- [ ] 4.2 **Untick→tick step** — in the same journey, untick then re-tick the source and assert execution statuses `['applied', 'skipped']` (or `duplicate`) and that the target's `habit_completions` row still has `count = 1`; J6's own `todo.complete` and `target_missing` assertions in `chain-reaction.spec.ts` remain untouched.
- [ ] 4.3 **No quarantine to release** — confirmed: `docs/testing/known-gaps.md` has no `habit.increment`/J6 entry and `e2e/journeys/chain-reaction.spec.ts` has no `test.fixme()`/`it.fails()`; keep it that way, add the new journey unquarantined to the `journeys` project (`playwright.config.ts:74`), and do not add `data-testid` attributes.

## 5. Verification

- [ ] 5.1 `npm run typecheck` and `npm run lint` clean (no new errors/warnings).
- [ ] 5.2 `npm test` — full suite passes including the new `tests/linkedActions.engine.test.ts` and `tests/linkedActions.data.test.ts` cases.
- [ ] 5.3 `npm run e2e` — the new `chain-reaction-habit-increment.spec.ts` and the unchanged `chain-reaction.spec.ts` (J6) pass in the `journeys` project; no `dist-sync`/`e2e:sync` lane involvement (no remote/sync boundary in this change).
- [ ] 5.4 **Spec conformance** — `todo.complete` re-fire still reports `applied` then `skipped` (assertion at `e2e/journeys/chain-reaction.spec.ts:197-200`), the deleted-target step still skips with `target_missing`, and execution rows are still recorded for every fire.
