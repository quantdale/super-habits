## Why

`features/command/` only lets users create things (todos, habits) via natural language — it has no read path. Users who log data throughout the day (a calorie entry, a habit tick) have no way to ask the app about that data in their own words ("how many calories have I eaten today?", "what's still pending?"). This adds that read-only counterpart: an "Ask" capability that answers questions about the user's own locally-stored data, without ever writing to the database.

## What Changes

- Add an **Ask** mode to the command center, alongside the existing (unchanged) **Create** mode, plus an **Auto** mode that classifies which one a given input is. Three-way segmented toggle in the command input UI.
- Add a two-call, schema-constrained retrieval pipeline: call 1 classifies the question into a known intent (`pending_todos`, `calorie_summary`, `habit_streak`) with any params (date range, habit name); client-side code then dispatches to local `.data.ts`/`.domain.ts` functions to compute the actual facts; call 2 turns `{question, retrievedFacts}` into a natural-language answer. The model never sees raw table rows in either call, only already-computed facts, so it cannot miscount or hallucinate a total.
- Add a new Supabase edge function, `user-ai-ask`, separate from `parse-ai-command` — Create's contract is untouched.
- Add two data-layer functions to `features/todos/todos.data.ts`: `listPendingTodos()` and `countPendingTodos()` (pending-filtering today only happens ad hoc in screen components).
- Add a lightweight orchestration layer (new `features/command/` modules) that maps classified intents to calls against the existing `.data.ts`/`.domain.ts` functions for calories (`getCalorieSummaryByRange`, `caloriesTotal`) and habits (`getCompletionHistory`, `buildDayCompletions`, `calculateCurrentStreak`, `calculateLongestStreak`).
- Add a new in-memory-only chat history context (`AskConversationContext`), structurally parallel to the existing `CommandCenterContext` — session-scoped, cleared on cold start, no persistence.
- Add a persisted last-used-mode preference (`superhabits.command.last-used-mode` in AsyncStorage, following the exact precedent of `commandInternalRollout.ts`), defaulting to `"auto"`.

## Capabilities

### New Capabilities
- `ai-ask`: Natural-language, read-only question answering over the user's own local data (pending todos, calorie summaries, habit streaks), via a local-retrieval-then-remote-phrasing pipeline, surfaced through a new Ask mode in the command center.

### Modified Capabilities
- None. `features/command/`'s existing create-draft pipeline has no prior spec of record in this repo (confirmed: no `openspec/specs/` directory exists, and `single-page-consolidation` only touched command's routing/wiring, not its capabilities) — this proposal does not retroactively spec it. Only the new Ask capability gets a spec.

## Impact

- **New files**: `user-ai-ask` Supabase edge function; new orchestration/context modules under `features/command/`; new intent-classification and fact-retrieval logic.
- **Modified files**: `features/todos/todos.data.ts` (new read functions), the command center UI (mode toggle), `CommandCenterProvider`/`CommandScreen` (routing between Create and Ask).
- **New network surface**: a second edge function alongside `parse-ai-command`; unlike Create, Ask sends derived facts about real logged user data (e.g. "3 entries totaling 1800 kcal") off-device to a third-party model API for the first time. Today's Create pipeline sends only the raw command string — zero stored data. This is a genuine privacy-posture change, not just an implementation detail, and should be flagged as a product/design decision requiring its own user-facing disclosure — that disclosure work is out of scope for this engineering change and is a follow-up.
- **No schema/migration impact**: no new SQLite tables; chat history is in-memory only (v1 scope).
- **Dependencies**: none new — reuses `@react-native-async-storage/async-storage`, existing Supabase invocation helpers (`getSupabaseAccessToken`, `getSupabaseAnonKey`, `getSupabaseFunctionUrl`).
