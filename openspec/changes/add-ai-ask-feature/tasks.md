## 1. Todos data layer

- [x] 1.1 Add `listPendingTodos(): Promise<Todo[]>` to `features/todos/todos.data.ts` (same shape as `listTodos`, filtered to `completed = 0`).
- [x] 1.2 Add `countPendingTodos(): Promise<number>` to `features/todos/todos.data.ts`.
- [x] 1.3 Add Vitest coverage in `tests/` for both functions (pending-only rows returned, deleted/completed rows excluded).

## 2. Ask types and intent contract

- [x] 2.1 Add `features/command/ask.types.ts`: `AskIntent` (`'pending_todos' | 'calorie_summary' | 'habit_streak'`), `ClassifyResult`, `RetrievedFacts` (per-intent shape), `AskResult` (`answer | unsupported | unavailable`), mirroring the discriminated-union style of `types.ts`'s `ParseCommandResult`.
- [x] 2.2 Add `AskParseInput` (question text, prior conversation turns, locale/timeZone/date-key anchors — same anchor fields as `ParseCommandInput`).

## 3. Local retrieval orchestration (no network)

- [x] 3.1 Add `features/command/ask.retrieval.ts` with one function per v1 intent: `retrievePendingTodos()`, `retrieveCalorieSummary(startDateKey, endDateKey)`, `retrieveHabitStreak(habitName?)`.
- [x] 3.2 `retrievePendingTodos()` calls `listPendingTodos()`/`countPendingTodos()` (task 1.1/1.2) and returns a plain-fact object (count, titles) — no raw row objects beyond what's needed for the fact.
- [x] 3.3 `retrieveCalorieSummary()` calls existing `getCalorieSummaryByRange()` + `caloriesTotal()`; returns `{totalCalories, entryCount, dateRange}`.
- [x] 3.4 `retrieveHabitStreak()` calls existing `listHabits()` to resolve a habit by name (fuzzy/case-insensitive match), then `getCompletionHistory()` + `buildDayCompletions()` + `calculateCurrentStreak()`/`calculateLongestStreak()`; returns `{habitName, currentStreak, longestStreak}` or an overall summary across all habits if no name given.
- [x] 3.5 Add Vitest coverage for each retrieval function against a seeded in-memory/test DB, confirming the returned facts never include raw entry/completion rows. (Implemented as mocked-data-layer tests, matching this repo's existing `.data.ts` test convention — see `tests/ask.retrieval.test.ts`.)

## 4. Edge function: `user-ai-ask` (AWS Bedrock, Claude Haiku)

- [x] 4.1 Scaffold `supabase/functions/user-ai-ask/index.js`, copying only the request-validation/CORS/logging shape of `parse-ai-command/index.js` (do not import from or modify `parse-ai-command`). The model-invocation code is NOT shared with `parse-ai-command` — it targets a different provider entirely.
- [x] 4.2 **Verify SigV4 signing is workable inside the Supabase Edge Function's Deno runtime before building further on top of it.** Spike complete — see design.md's Open Questions for the full write-up: a Web-Crypto-only SigV4 signer (SHA-256 + HMAC-SHA256 + key-derivation chain) was implemented and cross-verified correct against Node's `node:crypto`, giving confidence the hand-rolled path is safe in Deno. Whether an AWS SDK (e.g. `@aws-sdk/client-bedrock-runtime`) runs unmodified in the actual Supabase Edge Function Deno runtime remains UNCONFIRMED — no `deno` binary or live Supabase/AWS access was available to test that half directly.
- [ ] **BLOCKED pending review of the 4.2 spike outcome** — 4.3 Implement the AWS request-signing/invocation layer for Bedrock's Converse API (or InvokeModel), using whichever mechanism task 4.2 confirms works.
- [ ] **BLOCKED** — 4.4 Define the `classify` structured-output contract: input `{question, conversationContext?}`, implemented as a single Claude tool definition matching `{intent, params, outcome: 'classified' | 'unsupported'}`, invoked with `tool_choice` forced to that one tool; read the resulting tool-call input as the result.
- [ ] **BLOCKED** — 4.5 Define the `phrase` structured-output contract: input `{question, retrievedFacts}`, implemented the same way as a single forced tool-call matching `{answer: string}`.
- [ ] **BLOCKED** — 4.6 Implement both as two distinct invocable operations on the same function (e.g. a `stage` field in the request body) or as two separate functions if that keeps the schemas cleaner — decide during implementation, keeping Create's `parse-ai-command` untouched either way.
- [ ] **BLOCKED** — 4.7 Add structured logging for each stage (`event: "ask_classify"` / `"ask_phrase"`), mirroring `logParseEvent` in `parse-ai-command`, including latency and outcome.
- [ ] **BLOCKED** — 4.8 Provision the new AWS secrets in Supabase: IAM credentials (access key/secret, or a role ARN if using an assumed-role pattern — decide per design.md's Open Questions) and a Bedrock model ID for Claude Haiku (e.g. an `AI_ASK_BEDROCK_MODEL_ID`-style secret). None of this can be inferred from the repo; set explicitly as part of this task.

## 5. Client-side Ask parser/facade

- [x] 5.1 Add `features/command/askParser.ts`: given `AskParseInput`, calls the edge function's classify stage, dispatches to the matching `ask.retrieval.ts` function (task 3), then calls the phrase stage with the retrieved facts, returning an `AskResult`.
- [x] 5.2 Reuse the existing Supabase invocation helpers (`getSupabaseAccessToken`, `getSupabaseAnonKey`, `getSupabaseFunctionUrl`) and the same request-timeout/abort pattern as `realCommandParser.ts`'s `fetchWithTimeout`.
- [x] 5.3 Map unsupported/timeout/http-error/malformed-json failures onto `AskResult`'s `unsupported`/`unavailable` branches, matching the granularity of `ParseUnavailableReasonCode` in `types.ts`.
- [x] 5.4 Add Vitest coverage for the facade's branching logic using a mocked edge-function response (classified / unsupported / network failure). (`tests/askParser.test.ts` — note: since `user-ai-ask` currently always returns 501 pending Bedrock, this facade's classify/phrase calls will hit the `http_error`/`unavailable` branch against the real deployed function until section 4.3-4.8 land; the mocked tests cover the branching logic itself, not a live round-trip.)

## 6. Last-used mode persistence

- [x] 6.1 Add `features/command/commandModePreference.ts` with `getLastUsedCommandMode()`/`setLastUsedCommandMode()`, copying the cache-then-persist shape of `commandInternalRollout.ts` exactly, keyed on `superhabits.command.last-used-mode`, values `'ask' | 'create' | 'auto'`, defaulting to `'auto'` when absent.
- [x] 6.2 Add Vitest coverage: default value when key absent, round-trip persistence, cache behavior on repeated reads.

## 7. Conversation history context

- [x] 7.1 Add `features/command/AskConversationContext.tsx`: `createContext` + `useState`, structurally parallel to `CommandCenterContext` in `CommandCenterProvider.tsx` — holds an in-memory array of `{question, answer}` turns for the current session only.
- [x] 7.2 Expose `addTurn()`, `clearHistory()`, and the current turn list via a `useAskConversation()` hook, matching the `useCommandCenter()` hook pattern.
- [x] 7.3 Wire `clearHistory()` only to app cold start (provider initialization, e.g. `AskConversationContext`'s top-level mount) — NOT to the command center modal's close handler. Closing and reopening the modal within the same app session must leave prior turns intact. (`AskConversationProvider` is mounted once in `app/_layout.tsx`, outside `CommandCenterProvider`/the modal tree, so it only remounts on app cold start.)

## 8. Auto-mode routing

**BLOCKED — depends on task 4.4's classify contract, which is blocked pending review of the 4.2 SigV4 spike outcome. Not started; no placeholder contract improvised.**

- [ ] 8.1 Add `features/command/autoModeRouter.ts`: given raw input, calls the same classify-shaped schema (reusing task 4.2/4.4's classify stage or a shared superset schema) to decide Ask vs. Create, then delegates to the corresponding existing pipeline (`commandParser` for Create, `askParser` for Ask).
- [ ] 8.2 Add a single alternate-mode retry affordance to the Auto-mode result view — "Try as Create instead" when Ask ran, "Try as Ask instead" when Create ran — that re-submits the exact same input text through the other pipeline (`commandParser` or `askParser`) without the user retyping anything. This is the full v1 scope for misroute recovery; no additional disambiguation UI.

## 9. Command center UI

- [x] 9.1 Add a segmented Ask / Create / Auto control to `CommandScreen.tsx`, sourcing/persisting its value via task 6's `commandModePreference.ts`.
- [x] 9.2 Add an Ask conversation view (question/answer turns from `useAskConversation()`) alongside the existing Create draft-preview UI, switched by the active mode.
- [x] 9.3 Render unsupported and unavailable Ask results with distinct messaging (per spec's "Unsupported and unavailable question handling" requirement), following the existing `unsupported`/`unavailable` card patterns already in `CommandScreen.tsx` for Create.
- [x] 9.4 Gate the entire Ask mode behind a feature flag (`AI_ASK_EXPERIMENT_ENABLED`-style constant in `features/command/types.ts`, alongside the existing `COMMAND_EXPERIMENT_ENABLED`), off by default until verified. (Note: when the flag is `false`, `CommandScreen` renders exactly as it did before this change — mode state hardcodes to `'create'` and the toggle never renders — so Create's shipped behavior has zero regression risk from this change.) Selecting Auto mode surfaces an explicit "Auto mode isn't available yet" card rather than a guessed routing behavior, since section 8 (`autoModeRouter.ts`) is blocked — see section 8 below.

## 10. Verification

- [x] 10.1 Run `npm run typecheck` and `npm run lint` after all of the above. Both pass clean (lint: 0 errors, 10 pre-existing warnings unrelated to this change, under the 81 cap).
- [x] 10.2 Run `npx vitest run` and confirm new tests (tasks 1.3, 3.5, 5.4, 6.2) pass alongside existing suites. 41 test files, 424 tests, all passing.
- [ ] **BLOCKED** — 10.3 Manually verify each v1 intent end-to-end against local data (pending todos, calorie summary today/range, habit streak by name and overall) with the feature flag enabled locally. Cannot complete: `user-ai-ask` currently always returns HTTP 501 (task 4.1's deliberate placeholder), so every real Ask question resolves to `unavailable`/`http_error` today. Retrieval logic itself is unit-tested (task 3.5) but not exercised end-to-end through a live model call.
- [x] 10.4 Confirm the phrase-stage request payload never contains raw `calorie_entries`/`todos`/`habit_completions` rows, only computed facts, per the design's core safety property. Verified statically: `ask.retrieval.ts`'s return types (`PendingTodosFacts`, `CalorieSummaryFacts`, `HabitStreakFacts`) only ever hold counts/totals/titles/streak numbers, never raw row objects, and `tests/ask.retrieval.test.ts` asserts this directly (e.g. `expect(facts).not.toHaveProperty('id')`). Not verified via live edge-function logs, since no real phrase-stage call has happened yet (pending Bedrock, section 4.3+).
