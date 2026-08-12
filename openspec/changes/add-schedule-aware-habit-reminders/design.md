## Context

Habit Engine V2 stores the synced habit's effective-dated schedule and target history in `habits.rule_history`; `reminder_time` is already a nullable column on local and reference remote schemas. The current notification wrapper schedules Pomodoro time intervals, requests permission, creates only the `default` Android channel, and keeps Pomodoro identifiers in component refs. App bootstrap initializes SQLite and restore/sync, while `DayRolloverProvider` and `useForegroundRefresh` already provide shared local-day and activation signals.

This change must preserve the existing single-page shell, SQLite singleton, soft-delete/sync invariants, current Habit V2 authority, and Pomodoro notification behavior. Notification scheduling is native-only in V1; web configuration remains visible but explicit about unsupported native scheduling.

## Goals / Non-Goals

**Goals:**

- Persist one opt-in reminder time per habit using the existing nullable `reminder_time` field.
- Plan a bounded fourteen-day local future window from Habit V2 effective rules and target/completion state.
- Reconcile the plan against Expo's scheduled-notification inventory with deterministic identifiers and minimal operations.
- Reuse the shared notification permission/channel boundary and isolate Habit reminder identifiers/content from Pomodoro.
- Reconcile at startup, foreground, rollover, relevant Habit mutations, and restore/delete transitions.
- Prove deterministic semantics, persistence, sync/restore compatibility, and Android configuration/delivery evidence honestly.

**Non-Goals:**

- Reminder history, multiple reminders, snooze, push/backend delivery, background polling, notification analytics, or a new navigation subsystem.
- Rewriting Habit Engine V2 rule history or introducing a separate reminder table/outbox entity.
- An infinite native recurring trigger or a 365-day per-habit schedule.

## Decisions

### 1. Reuse `habits.reminder_time` as the current-only configuration

Store `NULL` when disabled and validated `HH:MM` when enabled. This column already exists in the runtime bootstrap, v12 database, TypeScript row shape, reference schema, full-row Supabase adapter, and restore v1. No schema migration or remote migration is needed unless a live audit proves drift. The reminder is intentionally not effective-dated: it controls future notifications only, while schedule and target meaning for historical dates remains in `rule_history`.

Alternative rejected: a separate reminder table or JSON history would add a new sync/restore contract and would overfit V1.

### 2. Use a pure planner over local date keys and native date triggers

Add pure reminder-domain types/functions that accept a habit, completion rows, a local `now`, and a window size. For each date from today through day fourteen, resolve `getHabitRuleForDate`/`isHabitScheduledOn`, use the rule's historical target, suppress completed occurrences, and skip a same-day time that is already in the past. Construct the fire `Date` with local `new Date(year, month, day, hour, minute, 0, 0)` semantics; never derive an indefinite recurring UTC instant.

The native adapter schedules one-shot Expo `DATE` triggers using a deterministic identifier such as `habit-reminder:<habitId>:<dateKey>`. One-shot date triggers make effective schedule changes and DST/timezone changes explicit at the next reconciliation and keep the native queue bounded.

Alternative rejected: one daily/weekly recurring trigger per habit. Expo recurring triggers cannot represent effective-dated schedule edits, completion suppression, or one-time skipped occurrences without extra native state.

### 3. Reconcile by deterministic metadata, not persisted notification history

Habit notification content includes non-visible `data` with a version, `kind`, `habitId`, `dateKey`, and `time`. `getAllScheduledNotificationsAsync()` is the source of current native entries. Reconciliation filters only the `habit-reminder:` identifier namespace, groups duplicates by logical habit/date, preserves one exact desired entry, cancels stale/duplicate entries, and schedules missing entries with the deterministic identifier. It never calls `cancelAllScheduledNotificationsAsync`, so Pomodoro entries remain untouched. Native IDs returned by Expo are recorded only in the in-memory reconciliation result; the deterministic identifier is the durable identity.

This avoids an unbounded SQLite notification log and repairs missing entries after process death or OS queue loss.

### 4. Centralize permission and channel primitives in `lib/notifications.ts`

Keep Pomodoro's public functions compatible while adding:

- a permission-state reader that distinguishes `notDetermined`, `granted`, and `denied` from Expo's status response;
- an opt-in request path that creates a stable `habit-reminders` Android channel once and does not request permission during unrelated app startup;
- generic schedule/list/cancel primitives used by the Habit service;
- a stable channel with normal/default importance, default sound, and a modest vibration pattern.

Habit configuration may be saved as enabled only after permission is granted on native. A denied response leaves the row disabled and the editor displays guidance. Startup reconciliation reads permission but does not repeatedly prompt; if permission is later denied, it cancels only Habit reminder entries.

### 5. Integrate reconciliation at existing lifecycle boundaries

`AppProviders` starts a non-blocking reconciliation after database bootstrap/restore bootstrap completes. A small `HabitReminderReconciliationHost` under the existing providers consumes `DayRolloverProvider` generation and `useForegroundRefresh`; a serialized promise guard prevents overlapping runs from startup, foreground, and mutation-triggered requests. Habit data mutations call a lightweight exported `requestHabitReminderReconciliation()` after the DB write, so schedule/time/target/completion/delete changes settle as one queued run rather than creating transient duplicate schedules between fields.

Restore completion triggers reconciliation after imported habits are committed. A process restart re-runs the same startup path. Date rollover and timezone changes are handled at next foreground/rollover activation; continuous background timezone monitoring is not attempted.

### 6. Use existing time-picker dependency with an explicit web fallback

Native create/edit uses the already-installed `@react-native-community/datetimepicker` in `time` mode. Web uses a native `<input type="time">`-compatible React Native `TextInput` fallback with `HH:MM` validation, because the repository has no other time picker and browser native notifications are not part of this V1 contract. All controls expose semantic labels for enablement, time, permission state, and error guidance.

### 7. Keep tap behavior within the existing navigation context

The root layout registers one notification response listener. When `data.kind === 'habit-reminder'`, it calls `setActiveSection('habits')` through the existing navigation provider after the root is mounted. It does not add a route or exact-focus state; a tap opens Habits, which is the safe V1 fallback. The listener is removed on unmount.

### 8. Test the planner/service boundary without OS timing

Pure tests cover all required schedules, targets, off-days, completion, passed times, local/DST construction, window bounds, timezone matrices, edits, deletion, and rollover. Service tests use a fake native adapter with scheduled inventory and assert minimal preserve/cancel/schedule operations, duplicate collapse, namespace isolation, and serialized reconciliation. Real SQLite integration covers existing reminder-column persistence, disable/delete/restore behavior, legacy null fallback, and full-row sync/restore contracts. Web E2E covers UI persistence and explicit web state. Maestro covers Android permission/configuration/process restart and attempts a short-horizon delivery flow; notification-shade proof is recorded as VERIFIED only if the harness can inspect it.

## Risks / Trade-offs

- [Risk] Native schedulers may lose entries after OS restart or permission changes → startup/foreground inventory reconciliation repairs missing entries without disturbing Pomodoro.
- [Risk] A same-day completion can race the exact delivery instant → completion and foreground reconciliation cancel the one-shot entry when practical; after a notification has fired, V1 cannot retract it and reports that boundary explicitly.
- [Risk] Local date construction around DST can be mishandled by hand-written arithmetic → use local `Date` component construction and deterministic `TZ` test runs; do not store UTC recurrence instants.
- [Risk] Android 13+ permission denial prevents delivery → configuration remains disabled and the editor exposes guidance; startup does not nag.
- [Risk] Expo's scheduled inventory may be unavailable on web or unsupported native environments → adapter returns an explicit unsupported result and the UI remains graceful; no fake web schedule is claimed.
- [Risk] Fourteen days may leave a long offline gap → the app reconciles at every activation and the bounded window is deliberately a V1 reliability/performance trade-off.
- [Risk] Existing dirty notification/package changes overlap the shared wrapper → preserve the user's edits, extend the current API, and validate both existing notification tests and Pomodoro behavior before handoff.

## Migration Plan

1. Confirm the existing `reminder_time` column is present in fresh and upgraded local/reference/remote shapes; no local or Supabase migration is expected.
2. Add domain/planner and native adapter tests before wiring UI/lifecycle mutation hooks.
3. Implement habit CRUD/UI fields with explicit permission state and keep default/null behavior for legacy rows.
4. Wire bootstrap/foreground/rollover/restore and notification tap handling; keep reconciliation non-blocking and serialized.
5. Run affected unit/integration/timezone/web/native/simulation lanes, then inspect Git diffs and OpenSpec/ExecPlan validation.
6. Rollback is code-only: disable the reminder host and leave the nullable column untouched; no destructive data migration is required.

## Open Questions

None. The exact native notification-shade result is a validation outcome, not a design decision; it will be classified honestly based on the available Android harness.
