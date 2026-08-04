## 0. Decisions — resolved (design.md Decision Log)

All six questions are closed. Recorded here so implementation starts from a settled brief; the reasoning is in design.md's D9–D14.

- [x] 0.1 **Day rollover** → D9. Split into write correctness (already true; asserted as a passing invariant in J2a) and presentation freshness (decided contract: a mounted surface must never label a stale day "Today" — active section refreshes, inactive sections mark stale). The freshness half is contract gap **CG-1**, companion change `fix-day-rollover-refresh`.
- [x] 0.2 **In-memory session loss** → D11. Ephemeral is the v1 contract; the binding guarantee is that **no partial session is ever logged**. Asserted as a passing regression guard. Resume-after-reload is filed as a UX recommendation, not treated as a defect.
- [x] 0.3 **Restore emptiness** → D10. A device that has ever held synced rows is not empty; count all rows regardless of `deleted_at`. Per-row merge semantics rejected as two-way-sync scope. Contract gap **CG-2**, companion change `fix-restore-emptiness-counts-deleted-rows`.
- [x] 0.4 **Integration driver** → D12. `better-sqlite3` on Node 20; no CI Node bump. Reversible behind the D2 adapter.
- [x] 0.5 **Sync-journey build lane** → Q5. A second export produces `dist-sync/` with dummy Supabase env, consumed by a dedicated Playwright project, run on `main` and nightly — never on pull requests.
- [x] 0.6 **Performance thresholds** → D14. Provisional generous ceilings now (cold Overview ≤ 5s at HEAVY, section switch ≤ 800ms, list input response ≤ 500ms), recalibrated from a measured baseline in task 6.2. A baseline that misses a ceiling is a filed defect, not a raised ceiling.

### 0.7 Companion changes to file (not implemented here)

- [ ] 0.7.1 File `fix-day-rollover-refresh` — a provider-level day-key watcher that bumps a context value the sections already consume for refresh, so the active section refreshes on rollover and inactive sections refresh on activation. Releases CG-1's quarantine.
- [ ] 0.7.2 File `fix-restore-emptiness-counts-deleted-rows` — drop the `deleted_at IS NULL` filter from `getLocalSyncBackedCounts()` (and the in-transaction re-check), so deleted history blocks restore. Releases CG-2's quarantine.
- [ ] 0.7.3 File the Pomodoro resume-after-reload UX recommendation (persist `startedAt` + mode + duration to `app_meta`) as a product note. No test depends on it.

## 1. Correct the stale architecture documentation

> **Reconciliation (2026-08-04):** tasks 1.1–1.4 were completed by commit `4867c1e` ("Complete OpenSpec changes and resolve deep audit findings") — the same corrections landed as part of the repo-wide deep audit before this change was reachable. AGENTS.md and CLAUDE.md now describe the single-page model (`app/index.tsx` + `NavigationProvider`, no `app/(tabs)/`, `app/settings.tsx`, or `app/command.tsx`), the real `AppProviders` bootstrap order (no `ensureGuestProfile()`/`core/auth/guestProfile.ts`), the `useActiveForegroundRefresh(isActive, …)` refresh pattern, and current test baselines (Vitest 3.2.7; 427 unit / 41 files; 90 E2E / 14 specs).

- [x] 1.1 Update `AGENTS.md`: remove `app/(tabs)/`, `app/settings.tsx`, `app/command.tsx`, the six-tab-route description, and the `ensureGuestProfile()` / `core/auth/guestProfile.ts` bootstrap step (that module does not exist). Replace with the real single-page model from `app/index.tsx` + `NavigationProvider`, and the real `AppProviders` bootstrap order.
- [x] 1.2 Apply the same corrections to `CLAUDE.md` (routing section, bootstrap order, `/settings` and `/command` route claims).
- [x] 1.3 Update the `useFocusEffect` refresh-pattern guidance in both files to `useActiveForegroundRefresh(isActive, …)`.
- [x] 1.4 Correct the stated test baselines in `AGENTS.md` (Vitest version and current test/spec counts) to what the repo actually reports.

## 2. Integration test level (real SQLite)

- [ ] 2.1 Add `better-sqlite3` as a devDependency (D12). Confirm it builds on the CI image without extra system packages; if it does not, switch the adapter to `node:sqlite` and raise CI to Node 22 in the same commit.
- [ ] 2.2 Add `tests/integration/setup.ts` — the same mocks as `tests/setup.ts` **except** `expo-sqlite`, which must not be mocked here.
- [ ] 2.3 Add `tests/integration/helpers/db.ts`: a thin adapter exposing `execAsync` / `runAsync` / `getAllAsync` / `getFirstAsync` / `withTransactionAsync` over the driver, plus `createTestDatabase()` returning a fresh in-process database, and a `getDatabase` mock bound to it.
- [ ] 2.4 Add a second Vitest project (or a second config) for `tests/integration/**`, wired into a `test:integration` script and into `npm test`'s CI invocation.
- [ ] 2.5 `tests/integration/migrations.test.ts`: bootstrap DDL + `runMigrations()` from zero reaches version 11; every table/index the app queries exists; re-running is a no-op; a step that throws does not advance the version and rolls back.
- [ ] 2.6 `tests/integration/constraints.test.ts`: `UNIQUE(habit_id, date_key)` with the `ON CONFLICT DO UPDATE` increment path (including two rapid increments); `saved_meals` `COLLATE NOCASE` unique index; the two linked-action unique indexes (`(rule_id, source_event_id)` and `(chain_id, rule_id, effect_fingerprint)`).
- [ ] 2.7 `tests/integration/softDelete.test.ts`: every read path across all five feature data layers excludes soft-deleted rows; aggregates exclude them; deletes never hard-delete a synced table.
- [ ] 2.8 `tests/integration/restore.test.ts`: `getLocalSyncBackedCounts()` emptiness semantics, the in-transaction re-check abort path, and `applyRemote*` import behaviour via `INSERT OR REPLACE`.
- [ ] 2.8a **CG-2 (quarantined, `it.fails()`)** — a device holding only soft-deleted rows is not empty, and an import never resurrects a locally-deleted todo whose deletion had not yet been pushed. Comment must name `fix-restore-emptiness-counts-deleted-rows`.
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
- [ ] 4.2 `J2a past-midnight-writes.spec.ts` (P1) — clock crosses midnight with sections mounted; a post-rollover tick writes the new `date_key`, pre-boundary rows are untouched, and a reload agrees with what was written. Run under a non-UTC `TZ`. Expected to pass today.
- [ ] 4.2a `J2b past-midnight-freshness.spec.ts` (P1) — **CG-1 (quarantined, `test.fixme()`)** — no mounted surface labels a stale day "Today"; an inactive section refreshes on activation rather than rendering held values. Comment must name `fix-day-rollover-refresh`.
- [ ] 4.3 `J3 the-commute.spec.ts` (P5) — offline writes → outbox growth and dedupe → full reload → `app_meta.sync_outbox` survived → reconnect → each record pushed exactly once.
- [ ] 4.4 `J4 bad-backend.spec.ts` (P5) — 503 / malformed / timeout / per-entity partial failure; assert requeue scope, backoff respected by interval flush but bypassable by visibility/reconnect, and the Settings-visible failure state.
- [ ] 4.5 `J5 new-phone.spec.ts` (P6) — restore prompt → dismiss → reload (no re-prompt) → add a todo → restore blocked; second pass accepts the restore and asserts what did **not** come back (completions, saved meals, pomodoro sessions, workout logs) and that streaks read zero. Third branch is CG-2's user-facing half, quarantined alongside task 2.8a.
- [ ] 4.6 `J6 chain-reaction.spec.ts` (P3) — linked action fires exactly once, execution row exists, re-fire suppressed, deleted target skips with `target_missing`.
- [ ] 4.7 `J7 fat-fingers.spec.ts` (P4) — double-submit, double-increment, empty/over-length input, delete-then-cancel, delete-the-wrong-item, stale edit, reload mid-save; one row or zero, never two. Includes D11's guarantee: a reload mid-timer logs no `pomodoro_sessions` row, and an abandoned workout logs nothing.
- [ ] 4.8 `J8 three-months-in.spec.ts` (P2) — HEAVY fixture cold start; aggregates, heatmap boundaries (364 days / 52 weeks), diary navigation, large-list scroll and filter, plus the responsiveness thresholds from task 6.2.
- [ ] 4.9 `J9 two-tabs.spec.ts` (P4) — second tab surfaces the actionable bootstrap error rather than a blank screen; first tab still healthy and writable after the second closes.
- [ ] 4.10 `J10 settings-ripple.spec.ts` (P3) — calorie goal, Pomodoro defaults and theme changed from Settings; each reflected in its section, surviving reload, including a settings change made while a timer is paused.

## 5. Exploratory missions and gap register

- [ ] 5.1 `docs/testing/exploratory-missions.md` with ten missions, each stating objective, starting state, area, realistic behaviour to try, risks, and what to observe — without prescribing every interaction. Cover at minimum: native notifications and `Alert.alert`; real-device multi-day usage; swipe-gesture conflicts with list scroll and drag reorder; all 14 themes for legibility; command center with the flag enabled; PWA install/offline shell; heavy-data feel on a low-end device; recovery from a corrupted OPFS database; long-session memory behaviour; and first-run through a real restore.
- [ ] 5.2 `docs/testing/known-gaps.md` split into **contract gaps** (CG-1 day-rollover freshness, CG-2 restore emptiness — each naming its decided contract, quarantined tests and companion change) and the seven **capability gaps** from design.md, each with reason and recommendation. Include the standing rule that any skipped or quarantined test is added here with its reason and that weakening an assertion is never an acceptable resolution.
- [ ] 5.3 Add a findings-recording convention so a mission result becomes either an automated regression test or a filed defect — not a note that evaporates.

## 6. CI and baselines

- [ ] 6.1 Extend `.github/workflows/ci.yml`: run the integration project in `quality` (under `TZ=Asia/Manila`); run the P0 journey subset in `e2e` on pull requests; run the full journey set on `main` and on a schedule.
- [ ] 6.1a Add the `dist-sync/` build step (dummy `EXPO_PUBLIC_SUPABASE_URL`/`_ANON_KEY` pointing at a non-routable host — never real credentials) and its dedicated Playwright project, wired into the `main`/nightly lane only, per Q5.
- [ ] 6.2 Measure a baseline for the J8 thresholds on CI hardware and recalibrate D14's provisional ceilings (cold Overview ≤ 5s at HEAVY, section switch ≤ 800ms, list input response ≤ 500ms). Record the measured numbers alongside the thresholds. A baseline that misses a ceiling is filed as a performance defect — the ceiling is not raised to make it pass.
- [ ] 6.3 Update `e2e/README.md` with the journey model, the two-persistence-store reset caveat, the clock helper, the failure injectors, and the dummy-Supabase build requirement.

## 7. Verification

- [ ] 7.1 `npm run typecheck` and `npm run lint` clean (lint warnings must stay under the 81 cap).
- [ ] 7.2 `npm test` — existing 424 unit tests still pass, unchanged, alongside the new integration project.
- [ ] 7.3 `npm run build:web` then `npm run e2e` — all 87 existing E2E tests still pass with the new Playwright project registered.
- [ ] 7.4 `npm run e2e:journeys` — the full journey suite passes with CG-1 and CG-2 quarantined, or every other failure is triaged into either a filed application defect or a corrected test. **Application defects found here are filed as separate changes, not fixed in this change.**
- [ ] 7.5 Confirm each journey asserts at least one row-level oracle and at least one negative oracle; confirm no `data-testid` was added to any application component; confirm every quarantined test names its companion change and appears in the known-gap register.
- [ ] 7.6 Record, in the change's follow-up notes, every defect the journeys surfaced — with the journey and step that found it — so the value of this layer is visible rather than folded silently into a green run.
