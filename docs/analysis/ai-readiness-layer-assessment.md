# AI Readiness Layer Assessment

Date: 2026-04-13
Branch: `inspect/ai-readiness-layer`
Scope: inspection only, no runtime changes

## 1. Executive Summary

SuperHabits is structurally ready for an AI-assisted layer in one narrow sense: the app already has well-separated data contracts, deterministic validation, and feature-level write paths that can be wrapped safely. It is not ready for AI to mutate data directly. The safe path is to place AI above a read-only context layer and below a strict app-owned action gateway that emits Linked Actions drafts, requires user confirmation, and then delegates execution back into existing feature data flows.

The codebase already exposes enough structured context to support:
- natural-language-to-draft mapping for todos, habits, calories, pomodoro, and workout
- read-only daily and yearly summaries
- simple daily, weekly, and monthly insights based on counts, streaks, goals, and activity trends

The biggest gaps are not schema gaps alone. They are interface gaps:
- no canonical AI-safe read model
- no shared action schema across features
- no confirmation/audit layer
- no Linked Actions contract yet
- no explicit privacy controls for model use

Recommendation: add an AI orchestration layer later, but keep execution app-native and Linked-Actions-first. AI should propose, not perform.

## 2. Existing Usable Context/Data

### Core readiness already present

- SQLite is the single source of truth via [`core/db/client.ts`](/C:/Users/palac/.codex/worktrees/c2b8/superhabits/core/db/client.ts).
- Feature writes already flow through data modules instead of screens:
  - [`features/todos/todos.data.ts`](/C:/Users/palac/.codex/worktrees/c2b8/superhabits/features/todos/todos.data.ts)
  - [`features/habits/habits.data.ts`](/C:/Users/palac/.codex/worktrees/c2b8/superhabits/features/habits/habits.data.ts)
  - [`features/calories/calories.data.ts`](/C:/Users/palac/.codex/worktrees/c2b8/superhabits/features/calories/calories.data.ts)
  - [`features/pomodoro/pomodoro.data.ts`](/C:/Users/palac/.codex/worktrees/c2b8/superhabits/features/pomodoro/pomodoro.data.ts)
  - [`features/workout/workout.data.ts`](/C:/Users/palac/.codex/worktrees/c2b8/superhabits/features/workout/workout.data.ts)
- Existing validation already defines acceptable user inputs in [`lib/validation.ts`](/C:/Users/palac/.codex/worktrees/c2b8/superhabits/lib/validation.ts).
- Existing domain modules already compute several insight primitives:
  - habit streaks and consistency
  - calorie goal progress and trend series
  - pomodoro streaks
  - workout streaks and session summaries

### Data AI can already use reliably

#### Todos

From [`core/db/types.ts`](/C:/Users/palac/.codex/worktrees/c2b8/superhabits/core/db/types.ts) and [`features/todos/todos.data.ts`](/C:/Users/palac/.codex/worktrees/c2b8/superhabits/features/todos/todos.data.ts):
- title
- notes
- completed flag
- due date
- priority
- recurrence and recurrence series id
- sort order
- soft-delete state

Useful AI cases:
- "Remind me to call mom tomorrow"
- "Make this urgent"
- "Show my top pending tasks"
- recurring-task suggestions using existing daily recurrence support

#### Habits

From [`features/habits/habits.data.ts`](/C:/Users/palac/.codex/worktrees/c2b8/superhabits/features/habits/habits.data.ts):
- habit definitions: name, target, category, icon, color
- completion counts by `date_key`
- ranged completion history

From [`features/habits/habits.domain.ts`](/C:/Users/palac/.codex/worktrees/c2b8/superhabits/features/habits/habits.domain.ts):
- day-level completion state
- current streak
- longest streak
- overall consistency
- aggregated heatmap intensity

Useful AI cases:
- "Mark my reading habit done"
- "How consistent have I been this week?"
- "Which habit is most likely to break next?"

#### Calories

From [`features/calories/calories.data.ts`](/C:/Users/palac/.codex/worktrees/c2b8/superhabits/features/calories/calories.data.ts):
- food name
- calories
- macros and fiber
- meal type
- consumed-on date
- saved meals with usage history
- calorie/macros goal in `app_meta`
- daily summaries by date range

From [`features/calories/calories.domain.ts`](/C:/Users/palac/.codex/worktrees/c2b8/superhabits/features/calories/calories.domain.ts):
- kcal from macros
- goal progress
- daily trend points
- heatmap intensity relative to goal

Useful AI cases:
- "I ate overnight oats"
- "Log my usual yogurt bowl"
- "How far off my calorie goal am I this week?"
- saved-meal matching for food phrases

#### Pomodoro

From [`features/pomodoro/pomodoro.data.ts`](/C:/Users/palac/.codex/worktrees/c2b8/superhabits/features/pomodoro/pomodoro.data.ts):
- settings
- focus/break session logs with start/end/duration/type

From [`features/pomodoro/pomodoro.domain.ts`](/C:/Users/palac/.codex/worktrees/c2b8/superhabits/features/pomodoro/pomodoro.domain.ts):
- mode sequencing
- heatmap days
- day streaks

Useful AI cases:
- "Start a 25-minute focus session"
- "How many sessions did I do this week?"
- "When am I most consistent with focus?"

#### Workout

From [`features/workout/workout.data.ts`](/C:/Users/palac/.codex/worktrees/c2b8/superhabits/features/workout/workout.data.ts):
- routines
- nested exercises and sets
- workout logs
- completed session exercise summaries

From [`features/workout/workout.domain.ts`](/C:/Users/palac/.codex/worktrees/c2b8/superhabits/features/workout/workout.domain.ts):
- heatmap days
- streaks
- estimated session duration
- timer sequence
- completed-set summaries

Useful AI cases:
- "Start push day"
- "Log that I finished upper body"
- "Which routines am I neglecting?"

#### Cross-feature rollups already present

[`features/overview/OverviewScreen.tsx`](/C:/Users/palac/.codex/worktrees/c2b8/superhabits/features/overview/OverviewScreen.tsx) already assembles:
- pending todo count
- top pending todos
- calories consumed vs goal
- focus sessions and streak
- workout days and streak
- habit best streak and consistency

This is important because it proves the app already has enough local data for a first-pass insight layer without adding RAG.

### Operational context AI can use

- guest identity exists locally in [`core/auth/guestProfile.ts`](/C:/Users/palac/.codex/worktrees/c2b8/superhabits/core/auth/guestProfile.ts)
- syncable vs local-only entities are already explicit in [`core/sync/supabase.adapter.ts`](/C:/Users/palac/.codex/worktrees/c2b8/superhabits/core/sync/supabase.adapter.ts)
- remote mode can be disabled in [`lib/supabase.ts`](/C:/Users/palac/.codex/worktrees/c2b8/superhabits/lib/supabase.ts)

## 3. Missing Data for Insights

### Missing or weak context

- No completed timestamp for todos, only `completed` boolean.
- No habit completion time-of-day, only `date_key` and count.
- No explicit user goals except calories and pomodoro settings.
- No explicit habit motivation, notes, or desired outcome.
- No calorie portion size, serving units, or confidence source.
- No `consumed_at` time for meals, only `consumed_on` date and `created_at`.
- No workout effort, weight, reps, RPE, or actual duration.
- No pomodoro interruption reason, task label, or session outcome.
- No journal/reflection layer for causal insights.
- No cross-feature event table for unified timelines.
- No AI conversation memory or action audit history.

### Missing context for better natural-language mapping

- No synonym layer for foods, habits, or routines.
- No alias system for "usual breakfast", "push day", or "water habit".
- No structured disambiguation memory such as preferred meal defaults.
- No confidence or provenance field on generated entries.

### Missing context for strong weekly/monthly insights

- No normalized weekly/monthly aggregate layer.
- No canonical "day summary" read model shared across features.
- No correlation-ready event history across modules.
- No stable outcome metrics beyond counts, streaks, and goals.

Net result: the app is ready for descriptive insights and limited coaching prompts, but not for strong causal or deeply personalized coaching.

## 4. Recommended AI Action Interface

This is the critical design decision.

### Principle

AI must never call `*.data.ts` directly and never produce SQL. It should output a typed proposal. The app should resolve that proposal into Linked Actions drafts, validate arguments, show confirmation, and only then execute through existing data-layer functions.

### Recommended layers

1. `AIContextService`
Reads feature-safe context from app-owned read models.

2. `AIIntentInterpreter`
Turns natural language into a typed proposal only.

3. `AIActionResolver`
Maps intent proposals to allowed Linked Action templates plus concrete args.

4. `AIConfirmationController`
Builds preview UI, collects edits, and records approval or rejection.

5. `LinkedActionExecutor`
Calls existing feature actions after confirmation.

### Recommended proposal shape

```ts
type AIActionProposal = {
  sourceText: string;
  intent:
    | "todo.create"
    | "todo.update"
    | "habit.create"
    | "habit.increment"
    | "calorie.log"
    | "calorie.goal.update"
    | "pomodoro.start"
    | "workout.start"
    | "workout.log"
    | "insight.request";
  confidence: number;
  missingFields: string[];
  readContext: string[];
  proposedLinkedActions: LinkedActionDraft[];
  preview: {
    summary: string;
    fields: Record<string, unknown>;
  };
  safety: {
    requiresConfirmation: true;
    mutatesData: boolean;
    sensitiveFields: string[];
  };
};
```

### Recommended Linked Action draft shape

```ts
type LinkedActionDraft = {
  actionType: string;
  targetFeature: "todos" | "habits" | "calories" | "pomodoro" | "workout";
  args: Record<string, unknown>;
  validationSchemaId: string;
  dedupeKey?: string;
  notes?: string;
};
```

### Rules for the interface

- Only allow pre-registered action types.
- All action args must validate against app-owned schemas.
- Each action type maps to one existing app mutation path.
- No raw DB ids should come from the model unless selected from current app context.
- Resolver, not model, should attach actual entity ids after local lookup.
- All mutations require confirmation.
- Multi-step proposals should execute as a plan of linked drafts, not a blob of app logic.

### Example: "I ate overnight oats"

Safe flow:
1. AI interprets this as `calorie.log`.
2. App resolver looks for a matching `saved_meal`.
3. If one strong match exists, produce a draft using that meal’s macros.
4. If multiple matches exist, ask user to pick one.
5. If no match exists, ask for macros or suggest manual entry.
6. On confirm, execute via existing calories data flow.

This keeps AI out of calorie math, DB writes, and sync details.

## 5. Confirmation Flow Design

### Confirmation should be mandatory for all writes

The app already uses explicit save buttons, modal edits, and destructive confirmations. The AI layer should follow the same product posture.

### Recommended UX pattern

For every AI-proposed write, show:
- a one-line summary
- the exact fields to be written
- the affected feature
- one primary confirm action
- one or more quick replies for correction

### Recommended quick replies

- `Confirm`
- `Edit`
- `Cancel`
- `Use saved meal`
- `Set for today`
- `Set for yesterday`
- `Breakfast`
- `Lunch`
- `Dinner`
- `Snack`
- `Mark once`
- `Target is 2`

### Confirmation states

1. `drafted`
AI has a proposal but is missing required fields or user approval.

2. `editable`
User can adjust a few structured fields before execution.

3. `confirmed`
Draft is frozen and handed to Linked Actions.

4. `executed`
Existing app write path succeeds.

5. `failed`
Validation or execution failed; show app-native error.

### UX constraints worth keeping

- one user-visible action group at a time
- no silent background writes
- no auto-submit on high confidence
- destructive or ambiguous actions always require explicit confirmation

## 6. AI ↔ Linked Actions Interaction Model

### Non-bypass rule

AI should not bypass Linked Actions. Linked Actions should be the only mutable contract between AI and the app.

### Model

- AI reads context through read models.
- AI proposes intent and candidate linked actions.
- App resolver normalizes those into allowed action templates.
- User confirms.
- Linked Actions execute existing app flows.
- Data layer remains the only place that touches DB and sync enqueue.

### Why this fits the current codebase

The feature data modules already encode the real business rules:
- sync enqueue for synced entities
- soft delete behavior
- recurring todo logic
- saved meal upsert behavior
- workout parent routine bump behavior

If AI bypasses Linked Actions and talks to those modules ad hoc, it will duplicate product rules and create drift. If Linked Actions own the app-level commands, the AI layer stays replaceable.

### Initial allowed Linked Action set

- `todos.create`
- `todos.update`
- `todos.toggle`
- `habits.create`
- `habits.increment`
- `habits.decrement`
- `calories.createEntry`
- `calories.updateGoal`
- `pomodoro.startSession`
- `workout.startRoutine`
- `workout.logRoutineCompletion`

### Actions AI should not own initially

- bulk edits across features
- destructive deletes
- schema-affecting settings
- sync or backup behavior
- free-form derived calculations that alter stored records

## 7. Insight Generation Readiness

### Ready now

Daily insights:
- pending tasks
- calories vs goal
- focus streak
- workout streak
- habits completed today

Weekly insights:
- count of active days for calories, focus, and workout
- habit consistency percentage
- streak changes
- top pending todos

Monthly or yearly descriptive insights:
- calorie trend over time
- yearly focus session totals
- yearly workout frequency
- yearly habits heatmap consistency

### Partially ready

- cross-feature summaries such as "you focus better on workout days"
  - technically possible
  - currently expensive and ad hoc because there is no shared analytics read model

- recommendations like "log breakfast earlier"
  - weak because meal times are not explicitly stored

### Not ready for trustworthy delivery

- causal claims
- strong nutrition coaching
- behavior diagnosis
- schedule optimization based on time-of-day
- longitudinal coaching that depends on stable identity and memory

### Recommendation

Build a small app-owned `InsightQueryService` later that exposes:
- `getDailySnapshot(dateKey)`
- `getWeeklySummary(startDateKey)`
- `getMonthlySummary(monthKey)`
- `getCrossFeatureHighlights(range)`

That avoids duplicating OverviewScreen logic in AI code.

## 8. Privacy Considerations

### Sensitive data surface

Potentially sensitive fields already in scope:
- todo titles and notes
- food names
- calorie/macronutrient history
- habit names
- workout routine names
- focus history

### Recommended privacy boundaries

- Default to opt-in before any remote AI processing.
- Prefer minimal-scope reads instead of full-history dumps.
- Keep guest profile ids and raw local ids out of model prompts.
- Redact or omit notes unless the user explicitly asks for note-aware help.
- Do not send entire SQLite rows if a compact read model is enough.
- Keep AI conversation history separate from health/productivity records.
- Add a visible user control for AI availability and data scope before launch.

### Current codebase implications

- Sync is one-way push backup only for a subset of entities; several important histories remain local-only.
- Settings currently contain only placeholders for backup/sync/privacy in [`features/settings/SettingsScreen.tsx`](/C:/Users/palac/.codex/worktrees/c2b8/superhabits/features/settings/SettingsScreen.tsx).
- There is no current audit trail for model-suggested actions.

That means privacy policy cannot be bolted on later. It needs a first-class settings and consent model before any AI feature ships.

## 9. Minimal Roadmap to AI Integration

### Phase 1: Read models

- Add app-owned AI read models per feature.
- Add cross-feature daily/weekly/monthly snapshots.
- Keep this read-only.

### Phase 2: Action schemas and resolver

- Define allowed AI intents.
- Define Linked Action templates and validation schemas.
- Add resolver logic for local entity lookup and disambiguation.

### Phase 3: Confirmation and audit

- Add proposal state, confirmation UI primitives, and execution receipts.
- Record proposal, confirmation, and result locally for traceability.

### Phase 4: Read-only insights

- Ship daily/weekly/monthly insight generation using local summaries.
- Keep insights descriptive before moving into advice.

### Phase 5: Limited execution

- Enable confirmed actions for a small safe set:
  - todo create/update
  - habit increment
  - calorie log from saved meal or explicit macros
  - pomodoro start
  - workout start/log from existing routine

### Phase 6: RAG later, not now

If retrieval is needed later, layer it over derived AI documents, not raw tables:
- daily summaries
- routine summaries
- saved-meal catalog
- habit definitions
- streak milestone events

Do not add RAG before the read-model and confirmation layers exist.

## 10. Risks & Constraints

### Architectural risks

- Overview analytics are currently screen-owned and duplicated, not centralized.
- AI could easily drift from real app behavior if it bypasses data modules.
- Some valuable histories are local-only and not part of sync.
- `schema.sql` is stale and cannot be used as an AI contract.

### Product risks

- confirmation fatigue if proposals are too granular
- user distrust if proposals are opaque
- false certainty on ambiguous natural-language inputs
- overreaching insights from incomplete data

### Data risks

- date semantics changed at migration 5; old rows may reflect UTC-era keys
- todo completion lacks timestamp detail
- calorie timing is date-only
- workout quality/intensity is mostly absent

### Privacy risks

- AI prompts could expose highly personal routine and food data
- there is no current privacy/AI settings surface
- there is no action audit log yet

## Bottom Line

SuperHabits is ready for an AI planning layer, not an AI execution layer. The codebase already has enough structured local data for descriptive insights and safe draft generation. The next correct move is not chat UI or RAG. It is an app-owned AI contract:

- read models for context
- typed intent proposals
- Linked Actions as the only mutation path
- mandatory confirmation
- privacy controls before rollout
