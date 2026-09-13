## Context

Habit Reminders V1 already owns a bounded fourteen-local-day one-shot schedule in `features/habits/habitReminders.service.ts`, deterministic normal IDs, native permission/channel primitives in `lib/notifications.ts`, a root listener plus `getLastNotificationResponse()` recovery in `app/_layout.tsx`, and a coalesced lifecycle signal. Habit completion is owned by `features/habits/habits.data.ts`; threshold crossing calls `linkedActionsEngine.processSourceAction`. The app is a mounted single-page shell with no per-feature routes.

## Goals / Non-Goals

**Goals:**

- Extend the current notification path instead of adding a competing listener or queue.
- Make exact-habit routing safe across cold start and section/modal state.
- Make completion and snooze actions durable against replay and process restart.
- Preserve V1 reconciliation, schedule history, local-calendar semantics, sync/restore, and Pomodoro isolation.

**Non-Goals:**

- Configurable or chained snoozes, recurring nags, push, analytics, web-native action emulation, new routes, or habit pause/skip features.

## Decisions

### 1. Stable metadata and category

Keep normal IDs `habit-reminder:<habitId>:<dateKey>` and add an occurrence ID in `data`. Use a single category identifier without `:` or `-` (Expo's installed API warns those characters can be unreliable), for example `habitReminder`. Register it alongside the existing stable Android channel. Both actions use `opensAppToForeground: true`; this is the reliable choice because Expo documents that a killed app does not deliver a non-foreground action response to the JS listener.

### 2. One dispatcher, one startup recovery path

Move response interpretation into `core/notifications/notificationResponseDispatcher.ts`. The root host registers the existing listener only after `authBootstrapReady`, reads the existing last response once at the same boundary, serializes dispatch, bounds a small in-memory response fingerprint set, and clears the native last response after handling. Action idempotency remains durable, so clearing is not the correctness mechanism.

### 3. Exact focus through NavigationProvider

Add `openHabit(habitId)` and a single pending focus ID to `NavigationProvider`. It selects Habits and closes Settings. `HabitsScreen` consumes the ID once after its first database-backed list refresh, opens the existing edit modal for the matching active row, and discards it if the row is absent. No route or new detail screen is needed.

### 4. Durable action marker and canonical completion

Add schema version 13 table `processed_notification_actions` with a primary action key, kind/action/occurrence fields, a locally generated stable Linked Action event ID, whether a threshold event is required, and `processed_at`. A cleanup query runs inside each claim transaction for rows older than a bounded retention period (35 days). The Mark complete data function claims the row and performs the active/current-date/scheduled/target validation plus one completion upsert in the same SQLite transaction. It then calls the existing Linked Actions engine outside the transaction using the stored event ID; replay can finish a crash that happened before the downstream engine, while the engine's existing source-event/execution dedupe prevents a second effect.

### 5. Snooze repair with deterministic identity

Use `habit-reminder-snooze:<habitId>:<dateKey>` and a `snoozed: true` metadata flag. Claim the `SNOOZE` key durably, then validate the current habit/date/schedule/target and `toDateKey(now + 15 minutes) === dateKey`. Before scheduling, inspect the native inventory and preserve one valid deterministic snooze; if a crash occurred after the claim but before scheduling, a replay repairs the missing entry. Invalid/completed occurrences cancel their same-day identities. Snooze never enters habit persistence or sync.

### 6. Reconciliation preservation

Update V1 reconciliation to recognize both normal and snooze namespaces, keep valid snoozes during broad lifecycle passes, collapse snooze duplicates, and cancel snoozes when the occurrence is no longer valid. Normal plan entries remain the authoritative configured-time schedule; no automatic normal reminder is created after a snooze.

### 7. Remote and web boundaries

Processed response state is local operational data and is excluded from the Supabase adapter and restore v1. Completion rows remain local-only as before; habit row sync behavior is unchanged. Web returns unsupported for native categories/actions and continues normal web habit navigation and mutations.

## Risks / Trade-offs

- SQLite marker and completion are atomic, but Linked Actions are an existing follow-up subsystem outside that transaction; deterministic source event IDs plus existing execution dedupe make crash replay repairable without a queue.
- Foregrounding action responses may open the app for an action, but it is more reliable across process death than invisible JS delivery on the installed Expo stack.
- A user can tap a notification already visible across midnight; conservative current-date validation avoids backdating.
- Native tray automation may remain capability-limited; test-only response injection must enter the same production dispatcher and native reports must preserve exact evidence.

## Migration Plan

1. Add append-only local migration 13 and real-SQLite coverage for schema, claim, cleanup, and restart replay.
2. Extend category/content/response dispatch and exact navigation.
3. Add canonical notification completion and snooze action handlers, then reconcile V1 service behavior.
4. Add focused tests, simulation, Maestro/native probes, and run affected/broad QA.

Supabase migration: NONE REQUIRED.
