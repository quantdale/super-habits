# Design: Complete Repository Depth & Truth V1

## D1 — Legacy session-metadata promotion runs at bootstrap

`migrateLegacySessionMeta` runs in `AppProviders` immediately after `syncEngine.hydrate()`
and before account bootstrap / restore preview / backup maintenance. Rationale:

- The promotion exists so legacy notes/associations become durable and backup-recoverable;
  gating it on a Pomodoro screen visit would leave data stranded for users who never open
  the Focus surface after updating.
- It must run after `syncEngine.hydrate()` because it writes through the backup mutation
  path with durable outbox intents; hydrate restores the durable max revision first.
- It is best-effort (try/catch + console error) so a storage failure never blocks startup;
  the pass is idempotent and retries on the next launch, matching the
  `applyPendingThemeApplication` bootstrap-recovery convention.
- On restore-eligible devices the pass is a no-op (no matching rows → keys retired, no
  rows created), so it cannot interfere with the empty-device restore contract.

## D2 — Daily-plan deletion uses the existing soft-delete contract and confirmation UI

- Reuse `softDeleteDailyPlan` (soft delete + single coalesced durable delete intent).
- Reuse `useConfirmationDialog` (same pattern as `ReviewHistoryView`'s weekly-review
  delete) so web and native share one interaction.
- The history view stays read-only apart from delete: no new route, section, or creation
  surface. Expanded rows gain a danger action; the list refreshes after deletion and the
  local committed/completed counters recompute from the refreshed rows.

## D3 — Consolidations are behavior-preserving

- `features/todos/todos.data.ts` imports `cancelTodoReminderSafely` from
  `core/notifications/todoReminderScheduler.ts`; the private duplicate is deleted.
- `weeklyReviewReminderScheduler` uses `WEEKLY_REVIEW_REMINDER_DATA_VERSION` instead of a
  literal `1`.
- The dead `getBackfillStatus` export in `backupBackfill.ts` is removed; the live private
  helper in `backupRestore.ts` (with the correct `BACKUP_SCOPE_VERSION` comparison) stays
  the single implementation.
- `createPreferencePrecedenceGuard` is adopted where an ad-hoc equivalent already exists
  (Calories view mode) so the tested primitive replaces the hand-rolled pattern; other
  persisted preferences are adopted only where an equivalent race is demonstrable.

## D4 — Test-floor oracles use real SQLite and durable-intent shapes

- Integration tests use `freshDatabase()` and the unmodified data layers; assertions read
  rows and `sync_outbox`/`app_meta` directly (coalesced intent per entity+id).
- E2E additions use the existing `queryRows`/`expectOutbox` helpers; no new test-only
  hooks in app code and no `data-testid` attributes.

## D5 — Documentation truth is part of the definition of done

Every corrected claim is verified against code/test inventories at the final tree; no
statement is updated to a new value without checking the source (label parity guard,
`NAV_ITEMS`, `package.json`, schema version, prefix call sites, E2E inventory).
