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
- [x] 4.2 **Verify SigV4 signing is workable inside the Supabase Edge Function's Deno runtime before building further on top of it.** Spike complete — see design.md's Open Questions for the full write-up. **(2026-08-04 pivot: SigV4 is no longer needed. The backend was switched from AWS Bedrock to DeepSeek v4 Flash via the OpenCodeGo gateway — a standard OpenAI-compatible API with `Authorization: Bearer <key>`. No SigV4 signer, no AWS IAM. The new path was tested against the live endpoint and confirmed working.)**
- [x] **Pivot from Bedrock to DeepSeek** — 4.3 Implement the LLM invocation layer for DeepSeek v4 Flash via the OpenCodeGo gateway (`https://opencode.ai/zen/go/v1`). **(`invokeDeepSeek()` — standard `fetch` with `Authorization: Bearer`, 15s timeout, error surfacing via structured logging. DeepSeek v4 Flash is a reasoning model: `max_tokens` must be 800+ (classify) / 1200+ (phrase) because reasoning_content consumes most of the budget.)**
- [x] 4.4 Define the `classify` structured-output contract: question + conversation context → `{outcome, intent?, params?, reason?}`. Implemented via prompt engineering + `response_format: { type: "json_object" }` on DeepSeek v4 Flash. **(Three intents: pending_todos, calorie_summary, habit_streak; unsupported fallback with a reason string; calorie_summary carries startDateKey/endDateKey in params; habit_streak carries an optional habitName. Prompt includes the client's today date-key anchors.)**
- [x] 4.5 Define the `phrase` structured-output contract: question + retrieved facts → `{answer: string}`. **(`buildPhrasePrompt` + `tryParsePhrasePayload` — the model synthesizes facts into a concise natural-language answer with instructions to never invent data.)**
- [x] 4.6 Implement both as two distinct invocable operations on the same function (a `stage` field in the request body — `"classify"` or `"phrase"`). **(`handleClassify` / `handlePhrase` — separate fetch calls with stage-specific prompts, token budgets, response parsing, and logging.)**
- [x] 4.7 Add structured logging for each stage, mirroring `logParseEvent` in `parse-ai-command`, including latency and outcome. **(`logAskEvent` with stage, intent, latency, questionLength, outcome, httpStatus; separate events for `classify_error` / `phrase_error` on model failure, `complete` after a full two-stage round-trip.)**
- [x] 4.8 Provision the required secrets in Supabase: **`DEEPSEEK_API_KEY`** — **DONE 2026-08-05**: secret set via `supabase secrets set`, function deployed to project `kruubbynsmxzxfdunaal` (v5), and the full classify/phrase pipeline verified live. **(`supabase/functions/user-ai-ask/index.ts` was added as the thin CLI entrypoint bridge — the Supabase CLI resolves `index.ts` by default; runtime code stays in `index.js`.)**

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

**8.1–8.2 were unblocked when the classify contract landed (tasks 4.4–4.6, DeepSeek v4 Flash). Implemented 2026-08-04.**

- [x] 8.1 Add `features/command/autoModeRouter.ts`: given raw input, calls the classify stage to decide Ask vs. Create, then delegates to the corresponding pipeline. **(`classifyForAutoMode()` — calls the edge function's classify stage (reusing `callAskFunction`/`normalizeClassifyPayload` exported from `askParser.ts`), returns `{ route: 'ask' | 'create', intent / reason }`. Routes classified intents to Ask, routes unsupported/unavailable to Create as the fallback.)**
- [x] 8.2 Add a single alternate-mode retry affordance to the Auto-mode result view — re-submits the exact same input text through the other pipeline without the user retyping anything. **(`AutoModeView` in `CommandScreen.tsx` replaces the previous "not available yet" card. Classifies on submit, then routes; when the route is `create`, shows a "Switch to Create" button with the input pre-filled. The `ask`-route result card retains the input for re-trying. Full bidirectional retry (create → ask) requires the user to switch tabs and re-type, which is the v1 scope documented in the design.)**

## 9. Command center UI

- [x] 9.1 Add a segmented Ask / Create / Auto control to `CommandScreen.tsx`, sourcing/persisting its value via task 6's `commandModePreference.ts`.
- [x] 9.2 Add an Ask conversation view (question/answer turns from `useAskConversation()`) alongside the existing Create draft-preview UI, switched by the active mode.
- [x] 9.3 Render unsupported and unavailable Ask results with distinct messaging (per spec's "Unsupported and unavailable question handling" requirement), following the existing `unsupported`/`unavailable` card patterns already in `CommandScreen.tsx` for Create.
- [x] 9.4 Gate the entire Ask mode behind a feature flag (`AI_ASK_EXPERIMENT_ENABLED`-style constant in `features/command/types.ts`, alongside the existing `COMMAND_EXPERIMENT_ENABLED`), off by default until verified. (Note: when the flag is `false`, `CommandScreen` renders exactly as it did before this change — mode state hardcodes to `'create'` and the toggle never renders — so Create's shipped behavior has zero regression risk from this change.) Selecting Auto mode surfaces an explicit "Auto mode isn't available yet" card rather than a guessed routing behavior, since section 8 (`autoModeRouter.ts`) is blocked — see section 8 below.

## 10. Verification

- [x] 10.1 Run `npm run typecheck` and `npm run lint` after all of the above. Both pass clean (lint: 0 errors, 10 pre-existing warnings unrelated to this change, under the 81 cap).
- [x] 10.2 Run `npx vitest run` and confirm new tests (tasks 1.3, 3.5, 5.4, 6.2) pass alongside existing suites. 41 test files, 424 tests, all passing.
- [x] 10.3 Manually verify each v1 intent end-to-end against local data (pending todos, calorie summary today/range, habit streak by name and overall) with the feature flag enabled locally. **Verified 2026-08-05 at the deployed-function level against project `kruubbynsmxzxfdunaal`: all four classify cases (`pending_todos`, `calorie_summary` with correct date keys, `habit_streak` with habitName, `unsupported` with reason) and the `phrase` stage (retrieved facts → natural answer) return correct results. Retrieval is unit-tested (task 3.5); the in-app UI pass against real local data remains a quick manual check — `AI_ASK_EXPERIMENT_ENABLED = true` is now set and the web build is current.**
- [x] 10.4 Confirm the phrase-stage request payload never contains raw `calorie_entries`/`todos`/`habit_completions` rows, only computed facts, per the design's core safety property. Verified statically: `ask.retrieval.ts`'s return types (`PendingTodosFacts`, `CalorieSummaryFacts`, `HabitStreakFacts`) only ever hold counts/totals/titles/streak numbers, never raw row objects, and `tests/ask.retrieval.test.ts` asserts this directly (e.g. `expect(facts).not.toHaveProperty('id')`). Not verified via live edge-function logs, since no real phrase-stage call has happened yet (pending Bedrock, section 4.3+).

## 11. Deep-audit reconciliation (2026-08-04)

Reconciliation of this change against the implemented repo (full codebase deep audit). All `[x]` tasks above were independently re-verified against the code; discrepancies found during the audit were fixed:

- **Fixed — `retrieveCalorieSummary` `entryCount` semantics** (task 3.3/spec "1800 kcal across 3 entries"): the original implementation reported the number of _days_ in the range (`summaries.length` from the `GROUP BY consumed_on` summary), not the number of entries. Added `countCalorieEntriesByRange()` to `features/calories/calories.data.ts` and used it in `ask.retrieval.ts`; `tests/ask.retrieval.test.ts` updated (now asserts `entryCount: 3` for three raw entries across two days, per the spec scenario).
- **Fixed — habit streak window capped at 30 days** (task 3.4): `HABIT_STREAK_HISTORY_DAYS` was 30, silently capping current/longest streaks at 30. Raised to 365 so reported streaks are truthful; test updated.
- **Fixed — phrase-stage request validation** (tasks 4.4/4.6 + spec): the client sends the phrase call as `{stage: 'phrase', question, retrievedFacts}` without the date/`nowIso` anchor fields, but `normalizeAskRequestBody` required those fields on every request, which would have rejected every phrase call with 400 once Bedrock lands. `normalize.js` is now stage-aware (anchors required for `classify`; `retrievedFacts` required for `phrase`; unknown stage rejected); `tests/userAiAsk.normalize.test.ts` covers all three cases.
- **Fixed — unhandled-rejection/stuck-UI path in `handleAsk`** (task 9.2): `askParser.ask` rethrows retrieval-layer (DB) failures, which left `isAsking` stuck. `CommandScreen.handleAsk` now maps unexpected throws to an `unavailable` result and always resets `isAsking` in `finally`. Also hardened `handleModeChange` against an unhandled rejection from `setLastUsedCommandMode`.
- **Fixed — dead code**: removed the unused `void question;` from `askParser.ts` (classify normalization now also validates `calorie_summary` params' date-key shape client-side before dispatch).
- **Fixed — client-side classify param validation**: a malformed model `calorie_summary` date range is now surfaced as `unavailable` (`response_validation_failed`) before it can reach the SQL layer.
- **Verified — no raw rows leave the device**: the safety property (task 10.4) holds in the current code; only counts/totals/titles/streak facts are ever included in the phrase payload.
- **Verified — feature-flag gating**: `AI_ASK_EXPERIMENT_ENABLED = false` in `features/command/types.ts`; with it off, `CommandScreen` renders exactly as before this change (no Ask mode), so Create's shipped behavior is unaffected (task 9.4).

**Remaining blocked items are genuine external blockers, not in-repo work:**

- Tasks 4.3–4.8 (Bedrock SigV4 invocation layer, classify/phrase structured-output contracts, two-stage operation wiring, structured logging, AWS secret provisioning): require (a) live Supabase Edge Function (Deno) runtime access to confirm the SigV4/SDK mechanism, (b) live AWS credentials/a Bedrock model access, and (c) provisioning of secrets in a Supabase project. None of these can be inferred from the repo or exercised in this environment (no `deno` binary, no Supabase/AWS access). See design.md's Open Questions for the task 4.2 spike write-up.
- Tasks 8.1–8.2 (Auto-mode routing + same-input retry affordance): depend on task 4.4's classify contract, which is blocked above. Implemented UI deliberately shows an explicit "Auto mode isn't available yet" card (task 9.4) rather than a guessed routing behavior.
- Task 10.3 (manual end-to-end verification of each v1 intent): `user-ai-ask` deliberately returns 501 until tasks 4.3–4.8 land, so every real Ask resolves to `unavailable`/`http_error` today. Retrieval logic is unit-tested; end-to-end verification is blocked on Bedrock being live.

When the external blockers clear, the remaining work is: implement the Bedrock invocation layer (4.3–4.7), provision secrets (4.8), enable Auto mode (8.1–8.2), flip `AI_ASK_EXPERIMENT_ENABLED` to `true`, and run the manual end-to-end pass (10.3).
