## Context

### What the product is (as discovered in the tree, not as documented)

SuperHabits is a single-user, offline-first personal productivity app. One Expo/React Native codebase ships to web (PWA), iOS and Android. Local SQLite is the source of truth; Supabase is an optional **push-only backup** plus a one-shot **restore onto an empty device** — not two-way sync.

Six sections: **Overview, Todos, Habits, Pomodoro (labelled "Focus"), Workout, Calories**. Plus a **Settings** drawer and an experimental **Command Center** overlay.

**Critical correction to the authoritative docs.** `AGENTS.md` and `CLAUDE.md` both describe `app/(tabs)/{feature}.tsx` route wrappers, `app/settings.tsx`, `app/command.tsx`, and an `ensureGuestProfile()` bootstrap step from `core/auth/guestProfile.ts`. **None of these exist.** The `single-page-consolidation` change replaced all of it:

- `app/` contains exactly `_layout.tsx` and `index.tsx`.
- `app/index.tsx` renders a top tab rail plus all six sections stacked absolutely. A section is **created lazily on first activation and then never unmounted** — visibility is `opacity` + `pointerEvents` + `zIndex` only. Inactive-section React state (timers, scroll, form input) survives switching.
- Section switching is `NavigationProvider.setActiveSection` — **local React state, no URL change**. Browser back/forward does not move between sections. There is no deep link to a section.
- Settings is a `<Modal layout="drawer">` rendered by `app/index.tsx`, driven by `isSettingsOpen`.
- Command Center is a global overlay (`GlobalCommandCenterHost` in `app/_layout.tsx`), gated by `COMMAND_EXPERIMENT_ENABLED`, with a floating launcher that is suppressed while a Pomodoro session is running (`useCommandLauncherSuppressed('pomodoro-active-session', …)`).
- Horizontal swipe (`Gesture.Pan`, 40px edge dead zones, threshold `width/3` or velocity 500) moves between adjacent sections.
- `useFocusEffect` no longer fires on section switch; screens use `useActiveForegroundRefresh(isActive, …)`, which refreshes when `isActive` flips true and on `visibilitychange`/`AppState` foreground.

`core/auth/` does not exist anywhere in the tree; `AppProviders` bootstraps `initializeDatabase()` → `ensureAnonymousSession()` → `syncEngine.hydrate()` → `getRestorePreview()` → optional restore prompt. Correcting these two docs is in scope for this change because every journey below is written against the real structure.

### Data and state model

| Concern                   | Mechanism                                                                                                                                                                                                                                                                                                                | Testing consequence                                                                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persistence               | `expo-sqlite`; WAL on native, SQLite WASM + OPFS on web. Single `getDatabase()` promise; on bootstrap failure the promise is reset to `null` so a later call retries.                                                                                                                                                    | OPFS holds **one lock per origin** → a second tab cannot open the DB. `workers: 1` locally is mandatory.                                                                                                         |
| Schema                    | Bootstrap DDL + append-only `runMigrations()`, currently version **11**, each step wrapped in `applyMigration()` (transaction + version bump together).                                                                                                                                                                  | Migration ordering and partial-failure rollback have **no executing test** today.                                                                                                                                |
| Soft delete               | `UPDATE … SET deleted_at` on `todos`, `habits`, `calorie_entries`, `workout_routines`, `routine_exercises`, `routine_exercise_sets`; every read filters `deleted_at IS NULL`.                                                                                                                                            | Deleted rows persist forever and are still pushed to the backup.                                                                                                                                                 |
| Sync                      | In-memory queue, deduped per `(entity, id)`, persisted to `app_meta.sync_outbox`; backoff `30s / 60s / 5m / 15m / 30m`; flush on 30s interval (respects backoff), web `visibilitychange → hidden`, and NetInfo reconnect. Partial failure requeues **only** the failed entity's records.                                 | Outbox behaviour across an app restart is the highest-value untested path.                                                                                                                                       |
| Synced entities           | `todos`, `habits`, `calorie_entries`, `workout_routines` only.                                                                                                                                                                                                                                                           | `habit_completions`, `pomodoro_sessions`, `workout_logs`, `saved_meals`, nested workout tables, and all linked-action tables are **local-only**: they never reach the backup and never come back from a restore. |
| Restore v1                | Allowed **only** when all four synced tables have zero rows with `deleted_at IS NULL`; re-verified inside the import transaction; dismissal keyed on a backup "freshness signature". Imports via `INSERT OR REPLACE`.                                                                                                    | Eligibility is a one-way door in practice, and the emptiness check ignores soft-deleted rows.                                                                                                                    |
| Date keys                 | `toDateKey()` → **local** `YYYY-MM-DD` since migration 5; timestamp columns (`pomodoro_sessions.started_at`, `workout_logs.completed_at`) queried via `getUtcIsoRangeForLocalDateKeys()`.                                                                                                                                | Day-rollover and non-UTC timezones are the sharpest correctness edge in the app. CI already runs unit tests under `TZ=Asia/Manila`.                                                                              |
| Feature-local persistence | AsyncStorage: `superhabits.theme.mode`, `superhabits.theme.slots.v2`, `superhabits.calories.viewMode`, `superhabits.command.last-used-mode`, `superhabits.command.internal-rollout.remote-enabled`. `app_meta` JSON blobs: `pomodoro_settings`, `calorie_goal`, `guest_profile`, sync outbox/status, restore signatures. | Two different persistence stores with different clear semantics — `clearDatabase()` wipes OPFS but **not** AsyncStorage.                                                                                         |
| Cross-feature engine      | `core/linked-actions/`: rules → events → executions, with `UNIQUE(rule_id, source_event_id)` and `UNIQUE(chain_id, rule_id, effect_fingerprint)` guarding re-entry, and an effect registry that writes into todos, habits, calories, pomodoro and workout.                                                               | This is the single largest cross-feature blast radius in the codebase.                                                                                                                                           |
| In-memory-only state      | Pomodoro timer (mode, remaining, `startedAt`, completed-focus count) is plain React state with a `Date.now()`-delta tick. The active workout session (`WorkoutSessionScreen`) is likewise in-memory.                                                                                                                     | Both are **lost on reload** and both survive section switches. Users will hit this; the expected behaviour needs to be asserted rather than assumed.                                                             |

### Testing infrastructure that already exists

- **Vitest** (`vitest.config.ts`): node environment, `tests/**/*.test.ts` + `core/**/__tests__/**`, `@/` alias, `__DEV__: true`. `tests/setup.ts` globally mocks `react-native`, `expo-crypto`, `expo-notifications`, `@/lib/supabase`, **and `expo-sqlite`** — the stub returns `[]` from `getAllAsync` and `null` from `getFirstAsync`. Data-layer tests therefore assert _the SQL that was issued_, never _what SQLite did_.
- **Playwright** (`playwright.config.ts`): Chromium only, `fullyParallel: false`, `workers: 1` locally / 2 in CI, 60s test timeout, runs against the **static export in `dist/`** served by `scripts/serve-e2e.js` on `:8081` with `require-corp` COEP. `clearDatabase()` removes `superhabits.db{,-wal,-shm}` from OPFS and reloads.
- **Conventions to extend, not replace**: no `data-testid` in app components (fix the selector in the spec instead); prefer `getByText` for RN Web `Pressable` labels; `domcontentloaded`/`load`, never `networkidle`; failure artifacts to `.cursor/playwright-output/`.
- **CI** (`.github/workflows/ci.yml`): `quality` (typecheck → lint → `npm test` under `TZ=Asia/Manila` → advisory audit), then `e2e` on PRs and `main` only.

### The gap this change closes

The suite is shaped like the code. Real usage is shaped like a life: the same person, the same database, day after day, making mistakes, getting interrupted, losing connectivity, and coming back. Every defect class below is currently unreachable by construction:

1. A day boundary crossed while the app is open (all six sections hold state captured at mount).
2. An outbox that survives a process kill, then flushes into a backend that fails halfway.
3. A restore offered to a device that only _looks_ empty because its rows are soft-deleted.
4. A streak that silently resets because `habit_completions` was never in the backup.
5. Accumulated listeners/intervals across six permanently-mounted screens in an hour-long session.
6. A linked-action chain re-fired by a user who double-taps, or by a recurring todo instance created for tomorrow.
7. Any constraint the SQL relies on (`UNIQUE(habit_id, date_key)`, `ON CONFLICT DO UPDATE`, `COLLATE NOCASE`) — the DB is mocked away.

## Goals / Non-Goals

**Goals**

- Verify the product **as experienced over time**: create → use → modify → leave → return → fail → recover → continue, with state deliberately carried between steps.
- Make **data integrity** a first-class oracle: every journey that mutates data asserts the persisted SQLite rows, not only the rendered text. A green screen over a corrupt database is a failed test.
- Verify each important outcome from **at least two independent surfaces** (e.g. the feature's own list _and_ the Overview aggregate _and_ the row in SQLite after a reload).
- Add the **one missing test level** (real SQLite, in-process) so constraint and migration behaviour is executed rather than asserted-by-mock.
- Keep the pyramid honest: push each behaviour to the cheapest level that gives real signal; reserve the browser for behaviours where the _integration_ is the thing under test.
- **Name what cannot be tested** and why, in a register that is reviewed rather than forgotten.

**Non-Goals**

- Not rewriting or deleting existing tests. The 424 unit tests and 87 E2E tests keep their contract; journeys sit on top.
- Not fixing application defects discovered while implementing. Findings are filed as separate changes — a testing change that also edits `features/` cannot report honestly on what it found.
- Not adding `data-testid` attributes. The existing rule stands; brittle selectors get fixed in the spec.
- Not automating native (iOS/Android). Playwright drives the web export only. Notification delivery, `AppState` background/foreground on device, and `Alert.alert` confirmations (a no-op on web) stay manual — recorded as gaps, not skipped silently.
- Not testing against a live Supabase project. All remote behaviour is exercised through injected responses at the network boundary.
- No formal load/stress testing. Performance is asserted only as _user-perceptible_ thresholds inside journeys; true load testing is recorded as a separate, out-of-scope requirement.
- No fuzzing for its own sake. "Chaos" here means plausible human messiness (double-taps, mid-request reloads, out-of-order feature use), not random input generation.

## Decisions

### D1 — Four test levels, with a new one in the middle

| Level                  | Runner                                                                                                              | What belongs here                                                                                                                                                                                | Why                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                   | Vitest (`tests/`)                                                                                                   | Pure `*.domain.ts` logic, parsers, policy tables, engine branching against mocks.                                                                                                                | Already the strongest layer. Unchanged.                                                                                                                                 |
| **Integration (new)**  | Vitest project `integration` (`tests/integration/`) with a **real in-process SQLite** and **no `expo-sqlite` mock** | Migrations 1→11 in order; constraint behaviour; soft-delete filtering; `ON CONFLICT` upserts; multi-write sequences within one data layer; linked-action chain guards; restore import semantics. | The behaviours most likely to corrupt data are exactly the ones the current mock erases. Fast (no browser), deterministic, and can seed months of data in milliseconds. |
| Journey E2E (new)      | Playwright project `journeys` (`e2e/journeys/`)                                                                     | Multi-step, multi-section, multi-"day" sessions with reloads, interruptions and injected failures.                                                                                               | The interaction between six permanently-mounted screens, OPFS, the service worker and the sync engine only exists in a real browser.                                    |
| Feature E2E (existing) | Playwright default project (`e2e/*.spec.ts`)                                                                        | Per-feature smoke and boundary checks.                                                                                                                                                           | Unchanged; fast failure localisation when a journey goes red.                                                                                                           |

Rejected alternative: express everything as journeys. Rejected because a 12-step browser journey is a terrible place to learn that a `UNIQUE` constraint fires — the failure lands far from the cause, and each run costs minutes.

### D2 — Integration level runs real SQL, not `expo-sqlite`

`tests/setup.ts` mocks `expo-sqlite` globally. The integration project gets **its own setup file** that does not, and instead binds `getDatabase()` to a real in-process database exposing the four methods the data layer uses (`execAsync`, `runAsync`, `getAllAsync`, `getFirstAsync`, `withTransactionAsync`). A thin adapter maps those onto the driver; `runMigrations()` from `core/db/client.ts` is executed verbatim, so migration coverage is of the _real_ migration code, not a copy.

Rejected alternative: `expo-sqlite`'s own Node build. Rejected because it drags the Expo native module resolution chain into a plain Vitest node environment; a small adapter over a standard driver is less machinery and fails more legibly. The driver choice itself (`better-sqlite3` vs Node 22 `node:sqlite`) is an Open Question below — the adapter boundary means the decision is reversible.

### D3 — Journeys are session-scoped; `clearDatabase()` is called once per journey, not per step

Every existing E2E spec clears in `beforeEach`. Journeys invert that: one `clearDatabase()` + seed at the start, then steps run in order against accumulating state. Playwright's `test.describe.serial` plus a single `page` fixture per journey file gives the ordering guarantee; a failed step aborts the rest of that journey (later steps are meaningless once continuity breaks) without affecting other journey files.

This is the single most important structural decision here. Isolation is what makes the current suite blind to accumulation, staleness and rollover.

### D4 — Time is controlled at the browser, not by waiting

Day-rollover journeys need to cross midnight without sleeping. `page.clock` (Playwright's clock API) installs at journey start; steps advance it explicitly (`clock.setSystemTime` / `clock.fastForward`). Because `toDateKey()` reads `new Date()` at call time and the Pomodoro tick uses `Date.now()` deltas, moving the browser clock is sufficient — no application hook is required.

Two constraints the journeys must respect: rows written _before_ a clock jump keep their real timestamps (that is realistic — the past is the past), and clock control must be installed before the app's first render, or `AppProviders` bootstrap will already have captured the real time.

Rejected alternative: seeding backdated rows only. Kept as a complement (it is how "returning user with three months of history" is built), but it cannot exercise a rollover _while the app is mounted_, which is the defect class of interest.

### D5 — Remote failure is injected at the network boundary

Journeys never talk to a real Supabase project. Failure modes are produced with `page.route()` against the Supabase REST/functions origin:

| Injected condition    | How                                                                   | Journey use                                  |
| --------------------- | --------------------------------------------------------------------- | -------------------------------------------- |
| Offline               | `context.setOffline(true)` (also drives NetInfo reconnect on restore) | Outbox accumulation, reconnect flush         |
| 5xx                   | `route.fulfill({ status: 503 })`                                      | Backoff schedule, partial-failure requeue    |
| Timeout               | `route` + delayed fulfil past the client's abort                      | `unavailable` branches in the command parser |
| Malformed body        | `route.fulfill({ body: '{' })`                                        | Parser/adapter robustness                    |
| Partial batch failure | Fulfil per-entity: `todos` 200, `habits` 500                          | Only the failed entity's records requeue     |

When Supabase env vars are unset (the CI default), `isRemoteEnabled()` still returns `true` but `supabase` is `null`, so the adapter no-ops. Journeys that assert sync behaviour therefore run in a Playwright project that supplies dummy `EXPO_PUBLIC_SUPABASE_*` values **at build time** (the export bundles them) — meaning those journeys require their own `dist/` build. This is a real constraint, not an inconvenience: it is called out in tasks and in Environment Requirements below.

### D6 — Seeding: two mechanisms, chosen by intent

- **Integration level**: seed by calling the real data-layer functions (`addTodo`, `incrementHabit`, `addCalorieEntry`, …) with an injected clock. This guarantees the fixture is reachable by real user actions — a hand-written `INSERT` can create a row shape the app can never produce.
- **Journey E2E**: seed via `page.evaluate()` into the already-open database using the same reasoning where practical; fall back to driving the UI when the journey's premise is "the user built this up by hand". A "three months of history" fixture is seeded, not clicked — clicking it would take hours and prove nothing.

Fixture volumes are fixed and named (`SMALL`, `TYPICAL`, `HEAVY` — see Test Data Strategy) so performance assertions mean the same thing across runs.

### D7 — Oracles: never a single surface, never only a toast

Every mutating journey step asserts against a **triple**:

1. **Immediate UI** — what the acting surface shows.
2. **Independent surface** — a different section, the Overview aggregate, the Settings restore eligibility, or the heatmap that derives from the same rows.
3. **Persisted state after a reload** — the rendered value again _and_, where integrity matters, the SQLite rows read via `page.evaluate()` (row count, `deleted_at`, `sort_order`, `updated_at` monotonicity, outbox contents).

Plus a **negative oracle**: what must _not_ have changed. Most data-corruption defects show up as an unexpected extra row or a silently mutated neighbour, which a positive-only assertion never sees.

### D8 — Selector policy is unchanged and non-negotiable

No `data-testid` is added to application components. Journeys use accessible names and visible text, exactly as the existing specs do. Where a journey needs a selector the app does not currently expose legibly, the fix is a shared helper in `e2e/helpers/`, not an app change and not a weakened assertion.

### D9 — Day-rollover contract: writes are already correct; presentation must not lie

The day boundary splits into two separable contracts, and conflating them is what made this look unanswerable.

**D9a — Write correctness (already true; asserted as a passing invariant).** Every data-layer write derives its day key from `toDateKey()` at call time, so a write issued after midnight already lands on the new day regardless of how long the app has been mounted. Rows written before the boundary keep their original keys; nothing is retroactively rewritten. This is the property that protects data integrity, it holds today, and the journey asserts it as a regression guard.

**D9b — Presentation freshness (decided target contract; expected to fail today).** The decided contract is: **a mounted surface must never present a stale day as "Today".** Concretely — when the local calendar day changes while the app is open, the **active** section refreshes its day-scoped data, and **inactive** mounted sections are marked stale so they refresh on activation rather than rendering yesterday's numbers from memory.

Chosen over the two alternatives because both fail the user: leaving the old day up until an interaction means a user who ticks a habit at 00:10 sees the tick apply to a "Today" panel that is actually yesterday — the UI and the database disagree, which is precisely the failure this whole change exists to catch. A manual "new day" affordance is better than nothing but puts the burden of noticing on the user, and does nothing for the six sections sitting mounted behind the active one.

Current code cannot satisfy D9b: `useActiveForegroundRefresh` fires on `isActive` transitions and on `visibilitychange`/`AppState` foreground, and a midnight tick is neither. So the D9b journey steps are written now, quarantined under the D13 protocol, and unblocked by a companion application change (`fix-day-rollover-refresh`) that this change does not implement. Recommended shape for that change, recorded so the follow-up is not designed from scratch: a single day-key watcher at the provider level (an interval or a `visibilitychange`-plus-timeout comparison of `toDateKey()` against the last-seen key) that bumps a context value the sections already depend on for refresh.

### D10 — Restore emptiness counts every row, not only undeleted ones

Decided contract: **a device that has ever held rows in a synced table is not an empty device.** `getLocalSyncBackedCounts()` currently filters `deleted_at IS NULL`, so a device whose todos were all deleted counts as empty and restore proceeds — and because the import uses `INSERT OR REPLACE` keyed on `id`, a todo the user deleted while offline (delete never pushed) is silently resurrected by rows the backup still holds as live. That is a data-integrity defect: the user's most recent intent loses to a stale backup, silently, on a device they just set up.

Counting all rows regardless of `deleted_at` is the minimal correct rule. Rejected alternative: per-row `updated_at` comparison during import (keep local when the local tombstone is newer). It is more precise and strictly more work — it turns a one-shot import into a merge, which is exactly the two-way-sync scope this product has deliberately not taken on. If restore v2 ever becomes a merge, that is the moment to revisit; for v1, refusing to import onto a device with history is both safer and simpler to explain.

Also decided, and testable today with no application change: the restore result must be honest about what did **not** come back. Habit completions, saved meals, pomodoro sessions, workout logs and workout routines are outside the restore scope, so streaks legitimately read zero after a restore — the disclosures already list this, and the journey asserts the disclosures match the actual outcome.

Like D9b, the emptiness rule needs an application change (`fix-restore-emptiness-counts-deleted-rows`); the integration test is written now and quarantined under D13.

### D11 — In-memory session loss is the contract for v1

Decided: the Pomodoro timer and the active workout session are **intentionally ephemeral**. A reload yields a clean idle state at the configured duration, and — the part that actually matters — **no partial session is ever logged**. `pomodoro_sessions` rows are written only when the countdown reaches zero, so an interrupted session produces no row, no duplicate, and no half-counted streak day. That is assertable against current code and becomes a regression guard.

This is a real product trade-off, not an accident being laundered into a requirement, so it is recorded as such: persisting `startedAt` + mode + duration to `app_meta` would let a reload resume mid-session, and users who reload a 25-minute timer at minute 20 will be annoyed. That is a UX improvement worth its own change, filed as a recommendation. What this change refuses to do is assert the current behaviour silently, as though nobody had noticed the cost.

### D12 — `better-sqlite3` on Node 20; no CI Node bump

Decided: `better-sqlite3` as the integration driver. `node:sqlite` is the tidier long-term answer (zero dependencies) but requires moving CI from Node 20 to 22+, and coupling a testing change to a runtime bump is how a testing change stops landing. The D2 adapter keeps the driver behind five methods, so the switch is a one-file change whenever the Node version moves for its own reasons.

### D13 — Contract-gap protocol: write the test, quarantine it, name the companion change

Two decided contracts (D9b, D10) describe behaviour the application does not yet have. The rule for those, and for anything similar found during implementation:

1. Write the test against the **decided contract**, not against current behaviour.
2. Quarantine it with `test.fixme()` (Playwright) or `it.fails()` (Vitest) plus a comment naming the companion change.
3. Register it in `docs/testing/known-gaps.md` as a **contract gap** — distinct from a **capability gap** (something untestable here, like native platforms).
4. When the companion change lands, the quarantine is removed in that change, not this one.

This keeps two things true at once: the suite stays green, and the gap is a named, tracked artifact rather than a test nobody wrote because it would have failed. What is explicitly forbidden is the third option — weakening the test to match current behaviour so it passes.

### D14 — Performance thresholds are provisional, generous, and recalibrated from a measurement

Journeys assert cliffs, not milliseconds. Provisional CI ceilings, to be recalibrated in task 6.2 against a measured baseline on CI hardware: cold Overview interactive and populated at HEAVY volume **≤ 5s**; section switch after all six are mounted **≤ 800ms**; list scroll/filter input response at 200+ rows **≤ 500ms**; no step in a journey takes more than 2× its measured baseline. Asserted with `expect.poll` and deliberately loose — a threshold tight enough to flake is a threshold that gets deleted. If a measured baseline exceeds a provisional ceiling, the finding is filed as a performance defect rather than the ceiling being raised to make it pass.

## User Personas

Six personas, each earning its place by producing scenarios the others do not.

**P1 — Maya, the Daily Driver (frequent user).** Opens the app 5–10 times a day, mostly on mobile web, for 30 seconds at a time. Ticks habits, adds a todo, logs a meal. Leaves the tab open all day. _Produces:_ day-rollover with the app mounted, repeated section switching, stale-aggregate detection, foreground-refresh correctness.

**P2 — Tom, the Weekend Returner (returning user).** Uses it in bursts, disappears for two to three weeks, comes back with months of accumulated data. _Produces:_ large-dataset rendering, streak recomputation after gaps, heatmap boundaries at 364 days, "why is my streak 0" expectations.

**P3 — Priya, the Power User.** Runs a Pomodoro while planning workouts, wires linked actions between features, reorders todos by drag, uses recurring tasks and the command center. _Produces:_ cross-feature chains, concurrent in-flight state across mounted sections, linked-action re-entry, command-center overlay interaction with a running timer.

**P4 — Sam, the Error-Prone User.** Double-taps, submits empty forms, deletes the wrong item, edits a stale card, reloads mid-save, retries after an error. _Produces:_ duplicate-write detection, validation recovery, destructive-operation confirmation/cancel paths, mid-flight interruption.

**P5 — Alex, the Commuter (offline user).** Uses the app on the train with no connectivity, reconnects at the office. Kills the browser tab regularly. _Produces:_ outbox accumulation and durability across restart, backoff behaviour, reconnect flush, "did anything get lost or duplicated" integrity checks.

**P6 — Jordan, the New Device Migrator.** Has a backup from an old device; installs the PWA fresh; hits the restore prompt. Sometimes dismisses it and adds a todo first. _Produces:_ restore eligibility lifecycle, the local-only-data disclosure gap (completions, saved meals, workouts do not come back), soft-deleted-rows-look-empty behaviour, dismissal-signature persistence.

There is no administrator/privileged persona: the app is single-user with anonymous Supabase auth and no roles. Section 12 of the spec records that explicitly rather than inventing an authorization model.

## Critical User Journeys

Ten journeys. Each names: persona, goal, starting state, the realistic action sequence, oracles, the mistake/failure branch, cross-feature effects, automation level, and test data. Full acceptance scenarios live in `specs/user-simulation-testing/spec.md`; this section is the design rationale for _why these ten_.

**J1 — "A Tuesday" (P1, journey E2E).** One continuous session: open → Overview → tick two habits → add a todo → switch to Calories, log breakfast → back to Overview (counts must reflect both) → start a 25-minute focus → switch to Todos while it runs → complete a todo → return to Focus (timer still running, correct remaining) → let it complete → verify session logged, Overview focus count and streak updated. _Catches:_ stale aggregates across mounted sections, timer death on section switch, `useActiveForegroundRefresh` not firing.

**J2 — "Past midnight" (P1, journey E2E + integration).** App open at 23:55 with today's data visible. Clock advances past midnight. Split per D9: **J2a** (passing) asserts write correctness — a habit ticked at 00:10 writes the new day's `date_key`, yesterday's rows are untouched, and a reload agrees with what was written. **J2b** (quarantined per D13, pending `fix-day-rollover-refresh`) asserts presentation freshness — no mounted surface still labels yesterday "Today", and an inactive section refreshes rather than rendering memory when it is activated. _Catches:_ the single most likely real-world correctness defect in the app, and separates the half that already works from the half that does not.

**J3 — "The commute" (P5, journey E2E).** Online, create data. Go offline. Create/edit/delete across todos, habits and calories. Observe the outbox grows and dedupes per `(entity, id)`. Kill and reopen the tab (full reload). Assert the outbox survived via `app_meta.sync_outbox`. Come back online → NetInfo reconnect flush → assert every record pushed exactly once, nothing lost, nothing duplicated, status cleared. _Catches:_ outbox durability, dedupe, reconnect wiring.

**J4 — "The backend is having a bad day" (P5, journey E2E).** With a queue pending, the backup returns 503 for `habits` and 200 for `todos`. Assert only the habits records requeue, the backoff timer is set, the interval flush respects it while an opportunistic visibility flush does not, and a later success clears failure state. Then a malformed response, then a timeout. _Catches:_ partial-failure requeue, backoff, error surfacing in Settings.

**J5 — "New phone" (P6, journey E2E).** Empty device with a remote backup available → restore prompt appears at bootstrap → dismiss it ("Not now") → reload (prompt must not reappear for the same backup signature) → add one todo → open Settings and observe restore is now blocked with the local-data-present message. Second run: accept the restore and verify imported counts, the disclosures shown, and — critically — that habit completion history, saved meals, pomodoro sessions and workout logs did **not** come back, so streaks read 0. A third branch covers D10's decided contract on a device holding only soft-deleted rows (quarantined per D13, pending `fix-restore-emptiness-counts-deleted-rows`): a locally-deleted todo must not be resurrected by the import. _Catches:_ eligibility lifecycle, dismissal signature, the resurrection defect, and the local-only-data expectation gap that will generate real support questions.

**J6 — "Chain reaction" (P3, journey E2E + integration).** Create a linked action (todo completed → habit incremented → …), complete the source todo, verify the target changed exactly once, the notice appeared, the execution row exists, and re-completing (untick → tick) does not double-apply. Then delete the target entity and re-fire — the effect must skip with `target_missing`, not error. _Catches:_ chain guards, effect-adapter skip paths, cross-feature blast radius.

**J7 — "Fat fingers" (P4, journey E2E).** Double-tap the add-todo submit; double-tap a habit circle; submit an empty form; delete the wrong item and confirm; cancel a delete; edit a card that another section already changed; reload mid-save. After each: exactly one row (or zero), an understandable message, the app still usable, and the original state intact where the action was cancelled. _Catches:_ duplicate writes, confirmation semantics, mid-flight interruption.

**J8 — "Three months in" (P2, journey E2E, seeded).** Seed `HEAVY` (≈90 days across all features), open cold, and walk the whole app: Overview aggregates, heatmaps at their 364-day and 52-week boundaries, Calories diary navigation, todo list with 200+ rows, search/filter in the diary and the saved-meal picker. Assert both correctness and _perceptible_ responsiveness thresholds. _Catches:_ aggregate arithmetic at scale, boundary-day off-by-ones, list performance cliffs.

**J9 — "Two tabs" (P4, journey E2E).** Open a second tab on the same origin. Per the current design, OPFS grants one lock, so the second tab cannot open the DB. Assert the user-visible outcome is the intentional "Unable to start" bootstrap gate with an actionable message — not a blank screen, a console-only error, or a silently broken UI. Then close the second tab and confirm the first is still healthy and writable. _Catches:_ the multi-tab reality of a PWA, which no current test asserts from the user's side.

**J10 — "Settings ripple" (P3, journey E2E).** Change the calorie goal, the Pomodoro defaults, and the theme from Settings, then close the drawer and verify each change is reflected in the owning section, survives a reload, and — for the theme — is applied by the AsyncStorage-backed slot, not just the current render. Then change the Pomodoro defaults _while a timer is paused_ and assert the documented outcome. _Catches:_ settings-to-feature propagation across permanently-mounted sections, and the two-persistence-store split (AsyncStorage vs `app_meta`).

## State Machines Under Test

Journeys are organised around entities' state, not screens. For each, valid _and_ invalid transitions are covered (the spec enumerates the acceptance scenarios).

- **Todo**: draft (modal open, unsaved) → created → completed → uncompleted → edited → reordered → soft-deleted. Invalid/awkward: edit → reload without saving; delete → cancel; complete a soft-deleted row; reorder while another section holds the old order; recurring completion → tomorrow's instance created exactly once even when completed repeatedly.
- **Habit + completion**: created → incremented (1..target) → target reached (fires linked actions **once**) → over-target → decremented → decremented to zero (**hard delete**, the documented exception) → habit soft-deleted with completions left orphaned. Invalid: increment a soft-deleted habit (guarded — must not create orphan completion rows); rapid double-increment (atomic upsert must not lose one or violate `UNIQUE`).
- **Pomodoro session**: idle → running → paused → resumed → reset → completed (logged) → next mode. Invalid/interrupting: reload while running (state is in-memory — the contract must be asserted, not assumed); change settings while paused; switch section while running; tab hidden while running (`BackgroundWarning`).
- **Calorie entry**: form draft → saved (also upserts a `saved_meal` under a `COLLATE NOCASE` unique index) → edited → soft-deleted; plus view mode form ↔ diary persisted across reloads, and diary date navigation into past days.
- **Workout**: routine → exercises → sets → session running (in-memory) → completed (logged) → routine soft-deleted with historical logs retained.
- **Sync record**: enqueued → deduped-in-place → flushing → pushed → failed → requeued → backed-off → retried → succeeded, with `hydrate()` restoring the queue across a process restart.
- **Restore**: unavailable → available+eligible → prompted → dismissed-for-this-signature → blocked-by-local-data → restored. Plus the ambiguous edge: a device whose only rows are soft-deleted counts as _empty_.
- **Command draft**: idle → parsing → parsed draft → edited → confirmed (written) / discarded; plus `unsupported` and `unavailable` outcomes and the double-confirm case.

## Risk Matrix

| #   | Area                                     | Why risky                                                                     | Likelihood a real user hits it | Blast radius                                   | Priority | Covered by                 |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------- | -------- | -------------------------- |
| R1  | Day rollover with app mounted            | Six screens hold state captured at mount; `toDateKey()` re-reads at call time | **High** (daily)               | Wrong day's data written/shown                 | **P0**   | J2, integration            |
| R2  | Sync outbox durability + partial failure | Persisted queue, backoff, per-entity requeue; zero end-to-end coverage        | High (any flaky network)       | Silent data loss or duplication in backup      | **P0**   | J3, J4                     |
| R3  | Restore eligibility & local-only data    | One-way door; completions/meals/logs never return                             | Medium (every migration)       | User believes data is backed up when it is not | **P0**   | J5                         |
| R4  | Linked-action chains                     | Cross-feature writes, unique-index guards, effect skips                       | Medium (power users)           | Cascading wrong writes across features         | **P0**   | J6, integration            |
| R5  | Duplicate writes from double interaction | RN Web `Pressable` + async writes                                             | High                           | Duplicate rows, wrong totals                   | P1       | J7                         |
| R6  | Six permanently-mounted screens          | Listener/interval accumulation, stale derived state                           | High (long sessions)           | Degradation, wrong aggregates                  | P1       | J1, J8                     |
| R7  | SQLite constraints & migrations          | Entirely mocked away today                                                    | Low frequency, catastrophic    | Corrupt/undeployable DB                        | P1       | integration                |
| R8  | Pomodoro/workout in-memory session loss  | No persistence by design                                                      | High                           | Lost session, user distrust                    | P1       | J1, J7                     |
| R9  | Large datasets                           | Heatmaps at 364 days, 200+ row lists                                          | Medium (after months)          | Unusable UI                                    | P2       | J8                         |
| R10 | Multi-tab OPFS lock                      | PWA users open tabs                                                           | Medium                         | App appears broken                             | P2       | J9                         |
| R11 | Settings → feature propagation           | Two persistence stores, mounted sections                                      | Medium                         | Setting appears not to apply                   | P2       | J10                        |
| R12 | Command center                           | Experimental, remote-dependent, overlay                                       | Low (flagged off)              | Contained to overlay                           | P3       | existing specs + J7 branch |

Not on the matrix, deliberately: authentication/authorization. The app is single-user with anonymous Supabase sign-in, no roles, no per-user resource access in the client. There is no enforcement boundary to test client-side; Supabase RLS is server-side configuration outside this repo. Recorded as a known gap rather than faked.

## Test Automation Strategy

| Behaviour class                                                                                               | Level                    | Rationale                                                                               |
| ------------------------------------------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------- |
| Streak/aggregate arithmetic, parsers, policy tables                                                           | Unit                     | Pure functions; fastest signal. Already covered — extend, do not duplicate in journeys. |
| Constraints, migrations, multi-write sequences, soft-delete filtering, restore import semantics, chain guards | **Integration**          | Needs a real DB, not a browser.                                                         |
| Anything spanning sections, reloads, OPFS, the service worker, the sync engine's triggers, or time            | **Journey E2E**          | The integration _is_ the thing under test.                                              |
| Per-feature CRUD smoke and validation                                                                         | Feature E2E (existing)   | Keep for fast localisation.                                                             |
| Notification delivery, native `Alert.alert`, `AppState` background, real device performance                   | **Manual / exploratory** | Unreachable from the web export. Documented as gaps.                                    |

Budget discipline: a behaviour belongs in a journey only if removing the surrounding steps would make it untestable. Anything else moves down a level.

## Test Data Strategy

Three named fixture sizes, used consistently so assertions and timings are comparable:

- **SMALL** — empty or 1–3 rows per feature. Empty states, first-run, validation.
- **TYPICAL** — ~14 days of history: 12 todos (mixed priority, 2 recurring, 3 completed, 1 soft-deleted), 5 habits (targets 1/3/8), completions with two deliberate gaps, ~40 calorie entries across all four meal types, 8 pomodoro sessions, 2 routines with 4 exercises each, 3 workout logs.
- **HEAVY** — ~90 days: ≥200 todos, 12 habits, ≥600 calorie entries, ≥120 pomodoro sessions, ≥40 workout logs, ≥15 saved meals. Used by J8 and by every performance-oriented assertion.

Value realism is a requirement, not a nicety. Fixtures must include: empty optional fields; 200-character titles (the validation ceiling) and one just over it; Unicode and emoji in names; names differing only by case (to exercise `saved_meals`' `COLLATE NOCASE` unique index); zero and maximum macro values (0 and 999g per macro, the 9999 kcal computed ceiling); `target_per_day` of 1, 3 and 99; a habit with no completions; a routine with no exercises; and rows whose `date_key` predates the migration-5 cutover (UTC-format keys that were never backfilled).

Reset semantics differ per level and must be stated in the helper, because getting this wrong is how "isolated" journeys silently share state:

- Integration: a fresh database per test file; migrations run from zero.
- Journeys: `clearDatabase()` **once per journey file**, then explicit seeding. Note that `clearDatabase()` removes OPFS files only — **AsyncStorage survives it**, so theme, calories view mode and command-mode preferences leak between journeys unless cleared explicitly. The journey helper must clear both.

## Environment Requirements

- Node 20 (current CI). If the integration level uses `node:sqlite`, CI must move to Node 22+ — see Open Questions.
- Chromium via Playwright; `PLAYWRIGHT_BROWSERS_PATH` is preconfigured in this environment.
- `npm run build:web` **before** any Playwright run that includes changed app code. Playwright does not build.
- `workers: 1` locally, always. OPFS holds one SQLite lock per origin; parallel workers against `:8081` flake.
- COOP/COEP (`same-origin` / `require-corp`) served by `scripts/serve-e2e.js` — `crossOriginIsolated` is required for SQLite WASM.
- Sync-behaviour journeys need a `dist/` built with dummy `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` (values are bundled at export time and drive `isSupabaseConfigured()`). These must be obviously-fake values pointing at a non-routable host — never real project credentials.
- Non-UTC timezone in CI for at least one run (`TZ=Asia/Manila` already used for unit tests) — extend to integration and to at least the rollover journey.

## Traceability

| Requirement (spec.md)                   | Journeys / levels                            | Primary risk |
| --------------------------------------- | -------------------------------------------- | ------------ |
| Persona-driven journey suite            | J1–J10                                       | R6           |
| Continuity without per-step reset       | all journeys                                 | R6           |
| Day-rollover write correctness          | J2a, integration                             | R1           |
| Day-rollover presentation freshness     | J2b (CG-1, quarantined)                      | R1           |
| Entity state-machine coverage           | J1, J6, J7, integration                      | R4, R5, R8   |
| Cross-feature interaction               | J1, J6, J10                                  | R4, R6       |
| Persistence via independent observation | all mutating steps                           | R1, R2       |
| Interruption coverage                   | J1, J3, J7                                   | R8           |
| Mistake & recovery                      | J7                                           | R5           |
| Failure injection & recovery            | J3, J4                                       | R2           |
| Repetition & accumulation               | J1, J7, J8                                   | R5, R6       |
| Realistic data volumes/values           | J8, integration fixtures                     | R9           |
| Destructive operations                  | J5, J6, J7                                   | R3, R4       |
| Backup/restore lifecycle                | J5                                           | R3           |
| Deleted history blocks restore          | J5 branch 3, integration (CG-2, quarantined) | R3           |
| Multi-tab / single-writer               | J9                                           | R10          |
| Background & async processing           | J1, J3, J4                                   | R2, R8       |
| Performance-oriented journeys           | J8                                           | R9           |
| Exploratory missions                    | M1–M10                                       | R8, R10, R12 |
| Regression suite & CI wiring            | J1, J3, J5, J6, J7                           | all P0       |
| Real-SQLite integration level           | `tests/integration/**`                       | R7           |
| Test data & reset strategy              | harness                                      | all          |
| Contract-gap protocol                   | CG-1, CG-2                                   | R1, R3       |
| Known-gap register                      | `docs/testing/known-gaps.md`                 | —            |
| Multi-surface oracles                   | all mutating steps                           | R1, R2       |
| Auth/authorization scope statement      | — (documented)                               | —            |

## Known Gaps (cannot be tested here, and why)

Recorded in `docs/testing/known-gaps.md`; summarised so reviewers see them without opening a second file. Two kinds, kept distinct because they close in different ways.

**Contract gaps** — the contract is decided, the test is written, the application does not satisfy it yet. Each is quarantined per D13 and closes when its companion change lands.

- **CG-1 — Day-rollover presentation freshness (D9b).** Companion change: `fix-day-rollover-refresh`. Quarantined test: J2b.
- **CG-2 — Restore emptiness must count soft-deleted rows (D10).** Companion change: `fix-restore-emptiness-counts-deleted-rows`. Quarantined tests: J5's third branch and `tests/integration/restore.test.ts`'s resurrection case.

**Capability gaps** — untestable from this repo and this harness, regardless of application behaviour.

1. **Native platforms.** Playwright drives the web export. iOS/Android behaviour — `expo-notifications` delivery, `AppState` background transitions, WAL journal mode, `Alert.alert` confirmations (a no-op on web, which is why `habits.spec.ts` cannot currently E2E a full delete) — is unreachable. _Recommendation:_ a Maestro/Detox smoke lane, or a documented manual checklist per release. Out of scope here.
2. **Real Supabase round-trips.** Only injected responses are exercised, so RLS policies, actual upsert conflict behaviour and schema drift between SQLite and Postgres are not verified. _Recommendation:_ a separate contract-test change against a disposable project.
3. **True concurrency.** OPFS permits one writer per origin, so genuine concurrent-write conflict behaviour cannot exist on web and is not specified by the app. J9 asserts the _lock outcome_, not a conflict model. Inventing one would be inventing requirements.
4. **Load/stress testing.** `HEAVY` is a realistic ceiling for one human over three months, not a load test. Sustained-load and memory-leak profiling need instrumentation this change does not add. _Recommendation:_ separate change; profile a long session with the Chrome DevTools protocol.
5. **Migration-from-old-database journeys.** Testing a v6 database upgrading to v11 requires a captured legacy database file; none exists in the repo. The integration level covers migrations running forward from zero. _Recommendation:_ capture and commit anonymised legacy fixtures as a follow-up.
6. **Pre-cutover UTC date keys.** Migration 5 deliberately does not backfill, so real installs contain a mix of UTC and local date keys. Fixtures can simulate this, but no real corpus exists to validate against.
7. **Authorization.** No roles, no per-user client-side enforcement. Nothing to test; stated rather than faked.

## Decision Log

Every question this design opened is now closed. Recorded here with its resolution so a reader does not have to reconstruct the reasoning from the decision sections.

| #   | Question                                                                  | Decision                                                                                                                                                            | Consequence                                              |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Q1  | Day-rollover behaviour with the app mounted                               | D9: writes are already correct and asserted as-is; presentation must never label a stale day "Today" — active section refreshes, inactive sections mark stale       | J2 splits into J2a (passing) and J2b (contract gap CG-1) |
| Q2  | In-memory Pomodoro/workout session loss on reload                         | D11: ephemeral is the v1 contract; the binding guarantee is that no partial session is ever logged. Resume-after-reload filed as a UX recommendation, not a defect  | Asserted as a passing regression guard                   |
| Q3  | Restore eligibility with only soft-deleted local rows                     | D10: a device that has ever held synced rows is not empty. Per-row merge semantics rejected as out-of-scope for a push-only backup                                  | Contract gap CG-2                                        |
| Q4  | Integration SQLite driver                                                 | D12: `better-sqlite3` on Node 20; no CI Node bump                                                                                                                   | Reversible behind the D2 adapter                         |
| Q5  | CI lane for sync journeys (needs a `dist/` built with dummy Supabase env) | Second build produces `dist-sync/`, consumed by a dedicated Playwright project, run on `main` and nightly — never on PRs                                            | PR feedback stays fast; +2–3 min on the slower lane only |
| Q6  | Performance thresholds                                                    | D14: provisional generous ceilings now, recalibrated from a measured baseline in task 6.2; a baseline that misses a ceiling is a filed defect, not a raised ceiling | J8 asserts cliffs, not milliseconds                      |

Two decisions (Q1, Q3) describe behaviour the application does not yet have. Both are handled by the D13 protocol — test written to the decided contract, quarantined, companion change named — rather than by weakening the assertion or deferring the decision.

## Assumptions to Validate During Implementation

Not open questions; things believed true from reading the code that implementation will confirm cheaply, each with what to do if it turns out false.

- **`page.clock` installed before first render is sufficient to drive rollover**, because `toDateKey()` reads `new Date()` at call time and the Pomodoro tick uses `Date.now()` deltas. If some path caches a date at module scope, the clock helper gains an explicit reload after the jump and the finding is filed.
- **`clearDatabase()` plus explicit AsyncStorage clearing gives a genuinely clean journey start.** If a third store turns out to hold state (service-worker cache serving a stale shell being the likely candidate), the reset helper grows a cache-clearing step.
- **`better-sqlite3` builds on the CI image without extra system packages.** If it does not, the adapter switches to `node:sqlite` and CI moves to Node 22 in the same commit — the cost of that path is a Node bump, which is why it is not the default.
- **Injecting failures at the Supabase origin reaches the sync adapter cleanly**, given `supabase-js` uses `fetch` under the hood. If request routing proves unreliable against the client's internals, the fallback is a build-time adapter seam — noted here so the journey is not quietly narrowed to "offline only" if the richer failure modes turn out to be awkward.
