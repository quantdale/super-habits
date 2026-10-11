# W9.5 design notes

## Why not a broad finish rewrite

The W9 session anatomy, the engine (`buildTimerSequence`, dispositions,
`collectSessionSetRecords` → `groupSessionExercises` → `logWorkoutSession`),
the durable outbox, and the draft design are proven and merged. W9.5 changes
only the **decision** made from the data-layer result plus the **page shell**
of the landing. No schema, migration, sync, backup, or gamification rewrite.

## The success contract

`logWorkoutSession()` already reports truth:

```ts
type LogWorkoutSessionResult = { status: 'applied' | 'skipped'; logId: string | null };
```

`insertWorkoutLogRecord()` skips (no row written) when the routine is missing
or soft-deleted (`reason: 'target_missing'`), but that reason was dropped at
the `logWorkoutSession()` boundary. W9.5 propagates it additively
(`reason?: string | null`) so the UI can name the actual cause; callers that
ignore the return are unaffected.

Success requires **both** `status === 'applied'` and a truthy `logId`. This is
the same contract the XP guard already uses — W9.5 extends it to the success
state and draft cleanup instead of adding a second source of truth.

## Commit vs bookkeeping

The finish sequence is now explicitly staged:

1. **Commit decision** — was a durable workout row written? This alone
   decides saved vs not-saved.
2. **Post-commit bookkeeping** — draft cleanup and reward attribution. Both
   are isolated: a failure here keeps the committed workout reported as saved
   (with an honest note about the bookkeeping) and never invites a second
   insert. `recordAction` already swallows its own errors by design
   ("a reward must never break the action that earned it"), so the isolation
   is defense-in-depth for synchronous throws and test seams.
3. **UI state** — exactly one of saved-outcome or a truthful error.

## Draft retention and the write/clear race

`persistDraft` is debounced (250 ms) and best-effort. The completed-session
cleanup effect clears the draft when the summary is reached. A write that is
already in flight when the clear runs can land **after** the delete and
resurrect a stale draft. W9.5 adds a clear generation counter: a draft write
that resolves after a newer clear re-issues the delete. Writes stay
asynchronous; no new synchronous database traffic is introduced.

On the skipped/error path no clear is scheduled at all, so a durable draft
persisted before the summary stays put. When the routine was deleted the draft
is honestly acknowledged as unresumable rather than promising a resume.

## One scroll authority

`Screen scroll` builds a whole page shell (SafeAreaView, ScrollView, content
shell, gutter math, 144 + safe-area bottom clearance, keyboard handling).
Nesting it inside itself duplicated all of that. The landing keeps the outer
`Screen scroll` and the `ScreenSection` group grammar; the inner wrapper is
deleted. No ad-hoc ScrollView replaces the shared primitive.
