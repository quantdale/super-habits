## Why

The current suite (424 Vitest tests across 41 files; 87 Playwright tests across 13 spec files) tests SuperHabits the way a developer reads it: one function, one screen, one feature at a time. Every E2E spec starts with `clearDatabase()` in `beforeEach`, so **no test in the repo has ever observed the app after more than one continuous minute of use, across a date boundary, or with data older than the current test**. That shape leaves whole classes of real-world defects structurally invisible:

- **The app is now a single page.** After `single-page-consolidation`, `app/index.tsx` mounts all six sections in one React tree and keeps them mounted after first activation (`opacity`/`pointerEvents`/`zIndex` swap, not unmount). Section switching is local state, not navigation. Nothing in the suite exercises what six simultaneously-live screens do to each other over a long session — stale derived counts, duplicated `visibilitychange` listeners, a Pomodoro interval still ticking while the user is in Calories, or a day boundary crossed while every screen still holds yesterday's `toDateKey()`.
- **Date keys are computed at call time but rendered from state captured at mount.** `toDateKey()` is local-calendar (migration 5). A user who leaves the app open past midnight — the single most ordinary thing a habit-tracker user does — is not covered by any test.
- **Persistence is verified by "the text is still on screen".** Most E2E assertions check a rendered label. Almost none re-observe the same fact from a second, independent surface (Overview counts, Settings restore eligibility, a different section's aggregate) after a reload.
- **Failure paths are untested end-to-end.** The sync outbox has a five-step backoff schedule, partial-failure requeue, and SQLite-persisted recovery (`app_meta.sync_outbox`); restore re-verifies emptiness inside its transaction; the command parser has `unsupported`/`unavailable` branches. All of that is unit-tested against mocks, and none of it is exercised through a user-visible flow with a real failure injected.
- **There is no test level between "mocked `getDatabase()`" and "full browser".** `tests/setup.ts` mocks `expo-sqlite` with a stub returning `[]`/`null`, so every data-layer test asserts _which SQL was called_, never _what SQLite did with it_. Migrations, `ON CONFLICT` upserts, the `UNIQUE(habit_id, date_key)` constraint, the linked-action chain-guard unique indexes, and the `saved_meals` `COLLATE NOCASE` index have no executing coverage anywhere.

This change adds a **real-world user simulation testing capability**: a persona-driven, journey-shaped, multi-session testing model layered on top of (not replacing) the existing suite, plus the one missing test level and the harness pieces those journeys need.

## What Changes

- **Add a journey-level E2E suite** (`e2e/journeys/`) built around six behavioural personas and ten critical user journeys. Journeys are multi-step and **session-scoped**: state is seeded once per journey and deliberately carried across steps, reloads, and simulated days, rather than cleared per test.
- **Add a real-SQLite integration test level** (`tests/integration/`, Vitest project) that runs the actual `runMigrations()` + data-layer SQL against an in-process SQLite database instead of the global `expo-sqlite` stub. This is where constraint behaviour, migration ordering, upserts, soft-delete filtering, and linked-action chain guards get executing coverage.
- **Add test harness modules**: deterministic clock control for day-rollover journeys, remote-failure injection (offline, 5xx, timeout, malformed response) via Playwright request routing, a realistic-data seeder (`e2e/helpers/seed.ts` + `tests/integration/fixtures/`), and multi-surface oracle helpers that assert the same fact from ≥2 independent surfaces.
- **Add explicit test oracles** to every journey: what changed, what must _not_ have changed, what persists after reload, what a second surface must report, and what the underlying SQLite rows must look like.
- **Add ten exploratory testing missions** (documented, human-run, time-boxed) for the areas automation cannot reach, plus a **known-gap register** that names what cannot be tested today and why.
- **Define the regression suite**: the subset of journeys that must run in CI on every PR, and the longer set that runs on `main`.
- **Correct the stale architecture documentation** that the journeys depend on: `AGENTS.md` and `CLAUDE.md` still describe `app/(tabs)/`, `/settings`, `/command` routes and an `ensureGuestProfile()` bootstrap step from `core/auth/guestProfile.ts` — none of which exist in the current tree.

Deliberately **not** changed: existing unit tests, existing E2E specs, application source. This change adds a testing layer and its harness; it does not fix any application defect it discovers. Defects found while implementing are filed, not silently patched.

## Capabilities

### New Capabilities

- `user-simulation-testing`: A persona-driven, journey-shaped testing capability that verifies SuperHabits behaves correctly under realistic, repeated, imperfect, interrupted, and long-running human use — across days, sections, failures, and restarts — with outcomes verified from multiple independent surfaces including the persisted SQLite state.

### Modified Capabilities

- None. No prior spec of record covers the existing test suite (`openspec/specs/` does not exist in this repo), and this change does not retroactively spec it. The existing Vitest and Playwright suites keep their current contract unchanged.

## Impact

- **New files**: `e2e/journeys/*.spec.ts`, `e2e/helpers/{seed,clock,failure,oracles,journey}.ts`, `tests/integration/**`, `tests/integration/fixtures/**`, `docs/testing/exploratory-missions.md`, `docs/testing/known-gaps.md`.
- **Modified files**: `vitest.config.ts` (add the integration project with its own setup file — the existing `tests/setup.ts` global `expo-sqlite` mock must not apply there), `playwright.config.ts` (journey project + longer timeout), `.github/workflows/ci.yml` (run integration tests in `quality`; run the journey regression subset in `e2e`), `package.json` scripts, `e2e/README.md`, `AGENTS.md` + `CLAUDE.md` (stale-architecture corrections).
- **New dev dependency**: one in-process SQLite driver for the integration level (`better-sqlite3`, or Node 22+ `node:sqlite` if the CI Node version is raised — see design.md's Open Questions). No runtime dependency changes; the app bundle is untouched.
- **Runtime/CI cost**: journeys are long by design. Expected +6–10 minutes of E2E wall-clock for the CI regression subset (`workers: 1` locally is still mandatory — OPFS holds one SQLite lock per origin). The full journey set, including multi-day and volume journeys, runs on `main` and nightly, not on every PR.
- **No production behaviour change**: no application source is modified, no schema migration is added, no `EXPO_PUBLIC_*` variable is introduced. Remote-dependent journeys run against injected fakes at the network boundary, never a live Supabase project.
- **Explicitly out of scope**: native (iOS/Android) journey automation — Playwright drives the web export only, so notification delivery, `AppState` background transitions, and `Alert.alert` confirmations remain manual/exploratory. This is recorded in the known-gap register rather than quietly skipped.
