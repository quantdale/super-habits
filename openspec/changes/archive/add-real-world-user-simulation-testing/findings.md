# Findings Register — `add-real-world-user-simulation-testing`

Follow-up defects register (task 7.6): every real defect the journeys surfaced,
its severity, and its disposition. Nothing here evaporates — each finding is
either **filed as a companion change**, **fixed in the harness**, or
**documented as a non-issue / product note** with its evidence path.

Disposition keys:

- **Filed** — a companion OpenSpec change exists under `openspec/changes/`; it
  owns the app-side fix and releases any quarantine.
- **Harness fix** — a defect in the test harness itself, fixed in this change.
- **Documented non-issue / harness note** — not an app defect; recorded so the
  reduced guarantee is visible.
- **Contract gap** — decided contract the app does not yet satisfy; quarantined
  per D13, released by the named companion change.
- **Product note** — a real, bounded behaviour worth recording without a fix.

---

## 1. J5 — Restore round-trip broken by the service worker ⚠ High — Filed (#2)

- **Found by:** J5 "New phone" (all steps; the SW mitigation lives in
  `e2e/journeys/new-phone.spec.ts` `stubOutServiceWorker`).
- **Defect:** `public/sw.js` routes every GET through its fetch handler. The
  restore-eligibility check issues cross-origin data GETs
  (`GET /rest/v1/<entity>?select=updated_at…`); on cross-origin cache/fetch
  failure the handler's `.catch(() => cached)` resolves `respondWith(undefined)`
  → `net::ERR_FAILED` → `getRestorePreview()` reports `remoteState: 'error'` →
  **the restore prompt can never appear while the SW controls the page**.
- **Evidence:** J5 had to stub out the service worker test-side before the
  restore contract was observable; the spec documents the finding inline and
  flags the mitigation as test-side only.
- **Disposition:** Filed → `fix-restore-service-worker` (SW bypass for
  cross-origin data GETs, or a `respondWith(cached ?? fetch(request))` that
  never resolves `undefined`).

## 2. J6 — `habit.increment` linked-action re-entry ⚠ Medium — Filed (#4) + documented

- **Found by:** J6 "Chain reaction" (observed while writing the journey; the
  journey itself covers `todo.complete` only).
- **Defect:** the engine's re-entry guards (`source_event_already_executed`,
  `chain_guard_duplicate` in `core/linked-actions/linkedActions.engine.ts`) are
  keyed on `eventId`/`chainId` that **the UI regenerates per completion**
  (`createId` when the caller supplies none). A todo→habit `habit.increment`
  chain therefore re-fires on untick→tick and increments the target again.
  `todo.complete` chains are safe only because the effect is idempotent.
- **Evidence:** J6's author noted the guard identity while authoring the
  `todo.completed → todo.complete` rule; the same analysis shows the increment
  effect is not idempotent.
- **Disposition:** Filed → `fix-linked-action-habit-increment-reentry` (stable
  re-entry identity keyed on source+trigger+day, plus an idempotent increment
  effect as second line of defence). Latent today — no shipped journey wires a
  `habit.increment` rule.

### 2a. J6 — `target_missing` unreachable via pure UI — Documented non-issue

- **Finding:** `removeTodo()` also soft-deletes the linked-action rule that
  references the target, so a user cannot reach the engine's defensive
  `target_missing` skip through the UI alone.
- **Disposition:** Documented (J6 spec header). Not a defect — the cleanup is
  deliberate; the engine's defensive skip is still asserted by J6 step 3 by
  deleting the target row directly (simulating the stale-link state).

### 2b. J6 — skipped-execution row growth — Product note

- **Finding:** every re-fire appends a `linked_action_executions` row even when
  the execution is `skipped` (J6 asserts `['applied', 'skipped', 'skipped']`).
  Over years of untick→tick on one source, the executions table grows without
  bound (no correctness impact — the dedup guards read the latest row).
- **Disposition:** Product note — bounded, cosmetic growth on a local-only
  table; revisit if the table becomes large.

## 3. J7 — Add-todo double-submit creates two rows ⚠ High — Filed (#1) + quarantined

- **Found by:** J7 "Fat fingers" step 11 ("double-submit add-todo lands exactly
  ONE row").
- **Defect:** `features/todos/TodosScreen.tsx` `onSave()` has no re-entry guard;
  a synchronous double-press of the Add-task submit runs the create path twice,
  persisting two rows (J7 reproduces it consistently: row count = 2).
- **Evidence:** J7 step 11 was failing on the defect; quarantined per D13 with
  the strict `expect(n).toBe(1)` retained (it releases automatically when the
  companion lands).
- **Disposition:** Filed → `fix-todo-add-double-submit` (re-entry guard
  `isSubmitting`/disabled submit). Registered under **CG-3** in
  `docs/testing/known-gaps.md`.

## 4. J8 — Recurring-todo expansion not idempotent ⚠ Medium — Filed (#5) + harness fix

- **Found by:** J8 "Three months in" (steps 3/4/7; documented in the spec
  header).
- **Defect:** `findMissingRecurrenceIds` snapshots the uncovered set while the
  previous activation's awaited inserts still commit, so rapid re-activation of
  the Todos section creates **additional today-instances** of the same
  daily-recurring series (observed: ~10→34 instances across visits).
- **Evidence:** J8's row oracles had to be written as invariants (self-consistency,
  outbox create-count == row growth) instead of an exact recurrence count;
  outbox growth correlates with the extra instances.
- **Disposition:** Filed → `fix-recurring-todo-expansion-idempotency` (existence
  re-check / upsert keyed on `(recurrence_id, due_date)` / serialized
  activations).

### 4a. J8 — `seed.ts` HEAVY fixture aborts on the real schema ⚠ Harness — Fixed here

- **Defect:** `e2e/helpers/seed.ts` `buildFixtureSql('HEAVY')` collided on the
  real `UNIQUE(habit_id, date_key)` index in `habit_completions` (error code 19
  aborted the whole multi-statement seed) and inserted both 'salad' and 'Salad'
  into `saved_meals`, violating its `COLLATE NOCASE` unique index.
- **Evidence:** J8's original workaround block documented both collisions inline.
- **Disposition:** **Harness fix, done in this change** — `buildCompletions` now
  derives each row's day from a per-habit offset + per-habit index (all
  (habit_id, date_key) pairs unique, exact 275-row volume, no rows skipped) and
  `buildSavedMeals` names are case-distinct ('Salad platter' replaces 'salad').
  J8 now seeds via `seedFixture('HEAVY')` with no inline workaround.

## 5. J10 — Pomodoro defaults do not propagate to an already-mounted Focus section ⚠ Medium — Filed (#3)

- **Found by:** J10 "Settings ripple" step 5 (risk R11).
- **Defect:** `PomodoroScreen` reads `pomodoro_settings` only on mount; sections
  are permanently mounted, so a Settings save does not reach the live Focus
  section — the new default lands only after a reload.
- **Evidence:** J10 step 5 surfaces the live-section case (defaults changed while
  the section was already mounted and a session paused); the reload-survival
  half passes, the live-propagation half is the gap.
- **Disposition:** Filed → `fix-pomodoro-defaults-propagation` (re-read defaults
  on activation/settings-change signal without disturbing a running/paused
  session).

## 6. J1 — Focus-session stat one-render lag — Minor — Documented non-issue

- **Found by:** J1 "A Tuesday" step 7 (completion path).
- **Finding:** after the clock completes a focus session, the Focus section's
  own "Focus sessions" stat can lag one render because the completion path fires
  `void logPomodoroSession()` and `void loadHistory()` concurrently — a benign
  race that self-heals on the next foreground refresh.
- **Disposition:** Documented non-issue (assertion deliberately made on the
  durable row oracle + Overview instead of the transient stat, per the J1 spec
  note). Minor, self-heals.

## 7. J2b — Day-rollover presentation freshness — Contract gap — Companion exists

- **Found by:** J2b "past-midnight-freshness" (quarantined).
- **Defect:** a mounted surface can label a stale day "Today" because
  `useActiveForegroundRefresh` fires on `isActive` transitions and foreground,
  and a midnight tick is neither (decided contract D9b).
- **Disposition:** Contract gap **CG-1** → companion `fix-day-rollover-refresh`
  already filed; this register records it so the follow-up list is complete.

## 8. J3 / J4 — Environment and harness notes — Documented

- **J4 "The backend is having a bad day"** — headless Chromium exposes
  `navigator.connection`; `@react-native-community/netinfo`'s web module listens
  to its `change` event, **not** the window `online`/`offline` events that
  Playwright's `context.setOffline()` fires. The reconnect-flush helper therefore
  dispatches the NetInfo `change` event explicitly. Documented harness note; the
  sync contract under failure is what matters and is asserted.
- **J3 "The commute"** — the legacy `todos.spec.ts` completion interaction clicks
  the title text only and never verifies completion; the journey clicks the real
  checkbox row so the completion is actually asserted. Documented harness note.
- **J3 reconnect-push half** — "pushed exactly once" needs a Supabase-backed
  remote; on the standard `dist/` build a flush with `supabase` null would drop
  the records, not push them, so the half is quarantined pending the
  dummy-Supabase `dist-sync/` build (task 6.1a, Q5). Registered as capability
  gaps **8/9** in `docs/testing/known-gaps.md`.

---

## Register summary

| #   | Journey | Finding                                        | Severity     | Disposition                                          |
| --- | ------- | ---------------------------------------------- | ------------ | ---------------------------------------------------- |
| 1   | J5      | SW breaks cross-origin restore GETs            | High         | Filed → `fix-restore-service-worker`                 |
| 2   | J6      | `habit.increment` linked-action re-entry       | Medium       | Filed → `fix-linked-action-habit-increment-reentry`  |
| 2a  | J6      | `target_missing` unreachable via pure UI       | —            | Documented non-issue                                 |
| 2b  | J6      | Skipped-execution row growth                   | —            | Product note                                         |
| 3   | J7      | Add-todo double-submit → two rows              | High         | Filed → `fix-todo-add-double-submit` (CG-3)          |
| 4   | J8      | Recurring-todo expansion non-idempotent        | Medium       | Filed → `fix-recurring-todo-expansion-idempotency`   |
| 4a  | J8      | `seed.ts` HEAVY UNIQUE/NOCASE collisions       | High         | **Harness fix, done here**                           |
| 5   | J10     | Pomodoro defaults don't propagate live         | Medium       | Filed → `fix-pomodoro-defaults-propagation`          |
| 6   | J1      | Focus stat one-render lag                      | Minor        | Documented non-issue                                 |
| 7   | J2b     | Day-rollover freshness (CG-1)                  | Contract gap | Companion `fix-day-rollover-refresh` (already filed) |
| 8   | J3/J4   | Env/harness notes (NetInfo event, legacy spec) | —            | Documented                                           |

### 2026-08-04 post-green-run additions (full-suite verification pass)

| #   | Journey | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Severity | Disposition         |
| --- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------- |
| 9   | J1      | Hardcoded today-completion counts (`toBe(2)`) broke when the reworked TYPICAL fixture began seeding a completion on the journey's "today" (the fixture's last history day) — two assertions (step 2 count + step 8 reload oracle) and the step-2 row oracle were made seed-drift-proof (baseline-relative, scoped to the ticked habits)                                                                                                                      | —        | Test fix, done here |
| 10  | J4      | On a standard `npm run build:web` (local-only, no `EXPO_PUBLIC_SUPABASE_*` baked) every flush no-ops and DRAINS the outbox, so the failure scenarios are meaningless there — steps 2–6 are now runtime-gated on a detected Supabase boundary (`test.fixme` naming task 6.1a/Q5, mirroring J3/J5); they run for real against the future `dist-sync/` lane. Also added a service-worker stub so requests can't bypass `page.route` on a boundary-capable build | —        | Test fix, done here |
