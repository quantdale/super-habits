## 0. Decisions required before implementation

- [ ] 0.1 **Decide the day-rollover contract** (design.md Open Questions): with the app mounted and the clock crossing midnight, do sections auto-refresh to the new day, show an affordance, or keep the old day until interacted with? J2 cannot be written without this. Record the decision in `docs/testing/` and, if it differs from current behaviour, file a separate application change — do not fix it here.
- [ ] 0.2 **Decide the in-memory session-loss contract** for Pomodoro and the active workout session on reload: assert current behaviour as intended, or file it as a defect. Recommendation: assert current behaviour and file a UX note, so the test does not silently encode an accident as a requirement.
- [ ] 0.3 **Decide the restore-eligibility contract when only soft-deleted local rows exist** (`getLocalSyncBackedCounts()` filters `deleted_at IS NULL`, and restore uses `INSERT OR REPLACE`). Intended, or a defect that can resurrect a todo deleted while offline?
- [ ] 0.4 **Choose the integration SQLite driver**: `better-sqlite3` (works on CI Node 20) vs `node:sqlite` (requires raising CI to Node 22+). Recommendation: `better-sqlite3`; the D2 adapter makes this reversible.
- [ ] 0.5 **Decide whether sync journeys get their own `dist/` build in CI** (dummy `EXPO_PUBLIC_SUPABASE_*` are bundled at export time) or run nightly only. Recommendation: nightly plus on-demand.

## 1. Correct the stale architecture documentation

- [ ] 1.1 Update `AGENTS.md`: remove `app/(tabs)/`, `app/settings.tsx`, `app/command.tsx`, the six-tab-route description, and the `ensureGuestProfile()` / `core/auth/guestProfile.ts` bootstrap step (that module does not exist). Replace with the real single-page model from `app/index.tsx` + `NavigationProvider`, and the real `AppProviders` bootstrap order.
- [ ] 1.2 Apply the same corrections to `CLAUDE.md` (routing section, bootstrap order, `/settings` and `/command` route claims).
- [ ] 1.3 Update the `useFocusEffect` refresh-pattern guidance in both files to `useActiveForegroundRefresh(isActive, …)`.
- [ ] 1.4 Correct the stated test baselines in `AGENTS.md` (Vitest version and current test/spec counts) to what the repo actually reports.

## 2. Integration test level (real SQLite)

- [ ] 2.1 Add the chosen driver as a devDependency (task 0.4).
- [ ] 2.2 Add `tests/integration/setup.ts` — the same mocks as `tests/setup.ts` **except** `expo-sqlite`, which must not be mocked here.
- [ ] 2.3 Add `tests/integration/helpers/db.ts`: a thin adapter exposing `execAsync` / `runAsync` / `getAllAsync` / `getFirstAsync` / `withTransactionAsync` over the driver, plus `createTestDatabase()` returning a fresh in-process database, and a `getDatabase` mock bound to it.
- [ ] 2.4 Add a second Vitest project (or a second config) for `tests/integration/**`, wired into a `test:integration` script and into `npm test`'s CI invocation.
- [ ] 2.5 `tests/integration/migrations.test.ts`: bootstrap DDL + `runMigrations()` from zero reaches version 11; every table/index the app queries exists; re-running is a no-op; a step that throws does not advance the version and rolls back.
- [ ] 2.6 `tests/integration/constraints.test.ts`: `UNIQUE(habit_id, date_key)` with the `ON CONFLICT DO UPDATE` increment path (including two rapid increments); `saved_meals` `COLLATE NOCASE` unique index; the two linked-action unique indexes (`(rule_id, source_event_id)` and `(chain_id, rule_id, effect_fingerprint)`).
- [ ] 2.7 `tests/integration/softDelete.test.ts`: every read path across all five feature data layers excludes soft-deleted rows; aggregates exclude them; deletes never hard-delete a synced table.
- [ ] 2.8 `tests/integration/restore.test.ts`: `getLocalSyncBackedCounts()` emptiness semantics (including the soft-deleted-only case from task 0.3), the in-transaction re-check abort path, and `applyRemote*` import behaviour via `INSERT OR REPLACE`.
- [ ] 2.9 `tests/integration/linkedActions.test.ts`: a full source-trigger → rule-match → effect-apply → execution-record cycle against real rows, including re-fire suppression and `target_missing` skips.
- [ ] 2.10 `tests/integration/dateKeys.test.ts`: local date-key writes and reads, `getUtcIsoRangeForLocalDateKeys()` boundaries for `pomodoro_sessions` / `workout_logs`, and a mixed corpus containing pre-cutover UTC keys. Run this file under a non-UTC `TZ`.
- [ ] 2.11 Add `tests/integration/fixtures/` with `SMALL` / `TYPICAL` / `HEAVY` seeders built by calling the real data-layer functions with an injected clock (never hand-written `INSERT`s).

## 3. Journey harness

- [ ] 3.1 `e2e/helpers/journey.ts`: journey declaration helper (persona, goal, fixture, risks), `test.describe.serial` wiring, single shared `page`, ordered steps, abort-remaining-on-failure.
- [ ] 3.2 `e2e/helpers/reset.ts`: full reset that clears OPFS SQLite files **and** the AsyncStorage keys (`superhabits.theme.mode`, `superhabits.theme.slots.v2`, `superhabits.calories.viewMode`, `superhabits.command.last-used-mode`, `superhabits.command.internal-rollout.remote-enabled`) — `clearDatabase()` alone leaves preferences behind.
- [ ] 3.3 `e2e/helpers/clock.ts`: install `page.clock` **before first render**, plus `advanceToNextDay()` / `setLocalTime()`; document that rows written before a jump keep their real timestamps.
- [ ] 3.4 `e2e/helpers/failure.ts`: offline toggle, and `page.route()` injectors for 503, timeout, malformed body, and per-entity partial failure against the Supabase origin.
- [ ] 3.5 `e2e/helpers/seed.ts`: browser-side seeding through the real data layers via `page.evaluate()`, sharing the fixture definitions from task 2.11 where practical.
- [ ] 3.6 `e2e/helpers/oracles.ts`: `expectRows()` (row-level SQL assertions via `page.evaluate()`), `expectOutbox()`, `expectUnchanged()` (negative oracle), and `expectAcrossSurfaces()` (same fact from ≥2 surfaces + after reload).
- [ ] 3.7 Add a `journeys` project to `playwright.config.ts` (`testDir: e2e/journeys`, longer per-test timeout, `workers: 1`, serial), leaving the existing default project untouched.
- [ ] 3.8 Add `npm run e2e:journeys` and `npm run e2e:journeys:p0` scripts.

## 4. Journeys

- [ ] 4.1 `J1 a-tuesday.spec.ts` (P1) — one continuous session across Overview → Habits → Todos → Calories → Pomodoro, with the timer running across section switches; assert aggregates from a second surface at each step and after a reload.
- [ ] 4.2 `J2 past-midnight.spec.ts` (P1) — clock crosses midnight with sections mounted; assert the contract decided in task 0.1, the `date_key` of a post-rollover write, and agreement after reload. Run under a non-UTC `TZ`.
- [ ] 4.3 `J3 the-commute.spec.ts` (P5) — offline writes → outbox growth and dedupe → full reload → `app_meta.sync_outbox` survived → reconnect → each record pushed exactly once.
- [ ] 4.4 `J4 bad-backend.spec.ts` (P5) — 503 / malformed / timeout / per-entity partial failure; assert requeue scope, backoff respected by interval flush but bypassable by visibility/reconnect, and the Settings-visible failure state.
- [ ] 4.5 `J5 new-phone.spec.ts` (P6) — restore prompt → dismiss → reload (no re-prompt) → add a todo → restore blocked; second pass accepts the restore and asserts what did **not** come back (completions, saved meals, pomodoro sessions, workout logs) and that streaks read zero.
- [ ] 4.6 `J6 chain-reaction.spec.ts` (P3) — linked action fires exactly once, execution row exists, re-fire suppressed, deleted target skips with `target_missing`.
- [ ] 4.7 `J7 fat-fingers.spec.ts` (P4) — double-submit, double-increment, empty/over-length input, delete-then-cancel, delete-the-wrong-item, stale edit, reload mid-save; one row or zero, never two.
- [ ] 4.8 `J8 three-months-in.spec.ts` (P2) — HEAVY fixture cold start; aggregates, heatmap boundaries (364 days / 52 weeks), diary navigation, large-list scroll and filter, plus the responsiveness thresholds from task 6.2.
- [ ] 4.9 `J9 two-tabs.spec.ts` (P4) — second tab surfaces the actionable bootstrap error rather than a blank screen; first tab still healthy and writable after the second closes.
- [ ] 4.10 `J10 settings-ripple.spec.ts` (P3) — calorie goal, Pomodoro defaults and theme changed from Settings; each reflected in its section, surviving reload, including a settings change made while a timer is paused.

## 5. Exploratory missions and gap register

- [ ] 5.1 `docs/testing/exploratory-missions.md` with ten missions, each stating objective, starting state, area, realistic behaviour to try, risks, and what to observe — without prescribing every interaction. Cover at minimum: native notifications and `Alert.alert`; real-device multi-day usage; swipe-gesture conflicts with list scroll and drag reorder; all 14 themes for legibility; command center with the flag enabled; PWA install/offline shell; heavy-data feel on a low-end device; recovery from a corrupted OPFS database; long-session memory behaviour; and first-run through a real restore.
- [ ] 5.2 `docs/testing/known-gaps.md` with the seven gaps from design.md, each with reason and recommendation, plus a standing rule that any skipped or quarantined journey is added here with its reason.
- [ ] 5.3 Add a findings-recording convention so a mission result becomes either an automated regression test or a filed defect — not a note that evaporates.

## 6. CI and baselines

- [ ] 6.1 Extend `.github/workflows/ci.yml`: run the integration project in `quality` (under `TZ=Asia/Manila`); run the P0 journey subset in `e2e` on pull requests; run the full journey set on `main` and on a schedule.
- [ ] 6.2 Measure a baseline for the J8 thresholds on CI hardware, then set the assertions loosely enough to catch cliffs rather than noise. Record the measured numbers alongside the thresholds.
- [ ] 6.3 Update `e2e/README.md` with the journey model, the two-persistence-store reset caveat, the clock helper, the failure injectors, and the dummy-Supabase build requirement.

## 7. Verification

- [ ] 7.1 `npm run typecheck` and `npm run lint` clean (lint warnings must stay under the 81 cap).
- [ ] 7.2 `npm test` — existing 424 unit tests still pass, unchanged, alongside the new integration project.
- [ ] 7.3 `npm run build:web` then `npm run e2e` — all 87 existing E2E tests still pass with the new Playwright project registered.
- [ ] 7.4 `npm run e2e:journeys` — the full journey suite passes, or every failure is triaged into either a filed application defect or a corrected test. **Application defects found here are filed as separate changes, not fixed in this change.**
- [ ] 7.5 Confirm each journey asserts at least one row-level oracle and at least one negative oracle; confirm no `data-testid` was added to any application component.
- [ ] 7.6 Record, in the change's follow-up notes, every defect the journeys surfaced — with the journey and step that found it — so the value of this layer is visible rather than folded silently into a green run.
