# Known-Gap Register — SuperHabits

This register names what cannot be tested today, and why. It exists so that reduced coverage is never silently presented as passing coverage. It is owned by the `add-real-world-user-simulation-testing` change and is the single source of truth for the two kinds of gap that are otherwise easy to confuse.

Two kinds of gap, kept distinct because they close in different ways:

- **Contract gaps** — the contract is decided, the test is written, but the application does not satisfy it yet. Each is quarantined per the D13 protocol and closes when its companion change lands.
- **Capability gaps** — untestable from this repo and this harness, regardless of application behaviour. Each carries a reason and a recommended closing path.

## Standing rule

> **Any skipped or quarantined test is added to this register, with its reason. Weakening an assertion is never an acceptable resolution.**

Concretely:

- A test written against a decided contract that the application does not yet satisfy is **quarantined** (`test.fixme()` in Playwright, `it.fails()` in Vitest) with a comment naming the companion change, and is registered **here** as a contract gap. It is removed from quarantine _in the companion change_, never in this testing change.
- A journey or test that is **skipped** (not merely quarantined) is added here with its reason, so reduced coverage is visible.
- A test that **fails** because the application does not meet a decided contract is resolved as a **filed defect and a quarantined test** — never by loosening the assertion to match current behaviour.

Every entry below is either a contract gap or a capability gap. If a new uncovered area is found during implementation, it is added here under the appropriate heading before the work is considered done.

---

## Contract gaps

### CG-1 — Day-rollover presentation freshness — CLOSED

**Decided contract (D9b):** a mounted surface must never label a stale day "Today". When the local calendar day changes while the app is open, the **active** section refreshes its day-scoped data, and **inactive** mounted sections are marked stale so they refresh on activation rather than rendering yesterday's numbers from memory.

- **Reason:** before the fix, `useActiveForegroundRefresh` fired on `isActive` transitions and on `visibilitychange`/`AppState` foreground, but a mounted app could cross midnight without either signal.
- **Resolution (closed 2026-08-09, `fix-day-rollover-refresh`):** `DayRolloverProvider` tracks the local date key and bumps a shared generation on rollover, visibility, or foreground checks. All six section refresh paths consume that generation; active sections refresh immediately and inactive sections refresh on activation. J2b's unchanged strict active/inactive assertions pass 4/4, and J2a's unchanged write assertions pass 4/4 when run in its isolated clock context.

### CG-2 — Restore emptiness must count deleted rows — CLOSED

**Decided contract (D10):** a device that has ever held rows in a synced table is not an empty device. `getLocalSyncBackedCounts()` must count all rows regardless of `deleted_at`, so a device whose todos were all deleted still counts as non-empty and restore is refused. Because the import uses `INSERT OR REPLACE` keyed on `id`, restoring onto such a device would silently resurrect a todo the user deleted while offline (a delete that was never pushed) — the user's most recent intent would lose to a stale backup.

- **Reason:** `getLocalSyncBackedCounts()` filtered `deleted_at IS NULL`, so a device holding only soft-deleted rows looked empty and restore proceeded. Per-row merge semantics remain out of scope for a push-only backup (that would turn a one-shot import into a merge, i.e. two-way sync).
- **Resolution (closed 2026-08-09, `fix-restore-emptiness-counts-deleted-rows`):** the local count query now counts every row, and the in-transaction re-check inherits that rule. The two real-SQLite integration assertions pass unchanged: tombstones block restore and a stale remote row cannot resurrect a locally deleted todo. J5's user-facing branch is released for the `journeys-sync` remote-boundary lane.

### CG-3 — Double-submit add-todo creates two rows — CLOSED

**Decided contract:** the add/edit-todo modal write path is "one row or zero, never two" (parent change risk **R5**, duplicate-writes from rapid input). A double-tap or rapid repeated press of Add/Save must never create a second todo row.

**Resolution (2026-08-09, `fix-todo-add-double-submit`):** `TodosScreen.onSave()` now enters a synchronous unit-tested re-entry guard before validation and releases it in `finally`; the submit control and modal close path are disabled while the async save is in flight. J7 step 11 runs unquarantined with the unchanged strict row oracle and passes against the static web app.

### CG-4 — Recurring-todo expansion can miss the D14 switch ceiling — CLOSED

**Decided contract (D14):** after the HEAVY fixture has mounted all sections, each section switch remains within the measured 800ms responsiveness ceiling. The threshold is intentionally unchanged; it catches a user-visible performance cliff rather than hiding it in a slower assertion.

- **Historical reason:** the first Todos activation expanded recurring todos asynchronously. After atomic same-day idempotency, same-day expansion suppression, mounted-screen memoization, and fresh-build reruns, isolated HEAVY measurements reached 813ms (with other repeats in the 760–778ms range) against the unchanged 800ms ceiling.
- **Resolution (closed 2026-08-10, `close-cg4-cg5-performance-gaps`):** the mounted section now suppresses inactive content from the accessibility tree without changing its visual mounted layout, and the task list keeps stable key/render/drag callbacks across section activation. With the unchanged HEAVY J8 fixture, thresholds, timing, and assertion, an initial focused strict batch measured overview→Todos at 573–644ms (median 608.5ms, p90 642ms), and the final accepted-source full continuity batch measured 733–761ms (median 755ms, p90 757ms, max 761ms) in 10/10 runs with CG-5 still quarantined. Recurrence expansion, idempotency, list ordering, and the full J8 row-level oracle remained green.
- **Tests:** `e2e/journeys/three-months-in.spec.ts` step 3 now runs unquarantined with the strict `≤ 800ms` assertion.
- **2026-09-04 Wave-8 note (certification infrastructure v2, host variance):** six consecutive file-level runs on the same HEAVY fixture measured worst-switch 745 / 781 / 774 / 751 / **910 (workout→calories, hard-ceiling breach)** / 775ms with the slowest switch varying by run — ceiling held 5/6, the WM2.4 15% diagnostic headroom floor missed 5/5. No product-code change in the switch path; the WM2.4 floor is miscalibrated for cold-emulator/host-jitter conditions on this host. The strict assertion is deliberately NOT weakened or quarantined (it caught the real 910 excursion). Tracked as a P2 perf-hardening follow-up in `.agent/execplans/certification-infrastructure-v2.md` (Finding W8-1); evidence under `.cursor/playwright-output/e2e-failures/three-months-in-*`.

### CG-5 — HEAVY diary saved-meal search exceeds the D14 ceiling — CLOSED

**Decided contract (D14):** the HEAVY Calories diary's saved-meal search responds within 500ms after the user enters a query. The assertion and ceiling remain unchanged.

- **Historical reason:** after local search-state/memoization and static quick-add isolation, fresh strict HEAVY runs measured 501–603ms, including a latest 513ms result, against the unchanged 500ms ceiling. The saved-meal picker remained within 500ms.
- **Historical reason:** profiling initially showed the diary search itself was an in-memory 15-meal filter with a roughly 1–15ms input-to-result commit, while authoritative full-path runs after the 200+ task-list walk recorded misses at 508–528ms. A web list-window candidate passed only 2/10 strict runs (493–494ms successes and eight 506–520ms misses), so it was rejected as unreliable. The fixture, timing boundary, assertion, and 500ms threshold were retained unchanged.
- **Attribution:** the J8 step calls `returnToApp` before the measured Calories interaction, so the walked task list is not retained in the measured DOM. Chromium profiling attributed the residual work to post-reload Calories activation and background refresh scheduling: representative activation contained 157ms + 79ms long tasks, approximately 406ms script time and 625ms task time; a delayed settled search measured 66ms.
- **Resolution (closed 2026-08-10, `close-cg4-cg5-performance-gaps`):** `CaloriesScreen.refresh` now starts the entry, summary, goal, and saved-meal reads concurrently and publishes the saved-meal catalog as soon as its small query pair resolves. This preserves the same saved-meal ordering, matching semantics, diary results, empty-search behavior, and eventual aggregate state while removing unrelated aggregate work from the early search path. Against fresh exports and the unchanged HEAVY J8 journey, Batch A measured `373, 370, 386, 351, 367, 396, 355, 371, 360, 368ms` (min 351, median 369, p90 386, max 396; 10/10), and independent Batch B measured `369, 364, 368, 366, 412, 363, 355, 354, 369, 359ms` (min 354, median 365, p90 369, max 412; 10/10). Each run completed all 7 steps, including the Task 200 deep-row and row-level oracles.
- **Tests:** `e2e/journeys/three-months-in.spec.ts` step 6 now runs normally with its strict `≤ 500ms` assertion. The saved-meal picker remained within 500ms, and the J8 calorie diary/search semantics remained green.

### CG-6 — Heatmap week-column boundary — CLOSED

**Decided contract:** a heatmap rendered with an explicit `weeks` value must not exceed that number of visible week columns, including when calendar alignment requires a leading partial column.

- **Reason:** a 364-day window beginning on a Sunday was padded to 365 cells and rendered as 53 columns even though the Habits surface passed `weeks={52}`. J8's unchanged boundary assertion caught the mismatch.
- **Resolution (closed 2026-08-10):** `buildHeatmapWeekColumns` now trims calendar padding to the explicit width while retaining the most recent columns. Unit coverage and the unchanged HEAVY J8 52-column assertion pass.

### CG-7 — Service-worker registration reload race — CLOSED

**Decided contract (WM2.4):** a reload landing while `register()` is in flight must never surface an unhandled rejection; the registration is retried on the next page load and the update flow is unchanged.

- **Reason (reproduced 2026-09-03, WM2.3 diagnostic trace):** workbox-window 7.3.0's `register()` reads `this._registration.waiting` immediately after `navigator.serviceWorker.register()` resolves; during a reload race that promise can resolve `undefined`, throwing `TypeError: Cannot read properties of undefined (reading 'waiting')` as an unhandled rejection (app survives; console shows a crash-grade pageerror).
- **Resolution (closed 2026-09-03, `harden-warm-momentum-2-4-*`):** the registration boundary in `core/pwa/registerServiceWorker.ts` now handles the promise chain — a falsy registration logs a retryable-noop warning and any rejection is logged, never unhandled. `applyServiceWorkerUpdate` semantics are unchanged; the full pwa-update suite (5/5, three consecutive runs) and the new reload-race regression test stay green.

### CG-8 — Journey tab-label parity — CLOSED (guard added)

**Decided contract (WM2.4):** every tab label used by e2e helpers/journeys must match the app's section-rail labels, enforced in the PR quality lane so main/nightly-only lanes cannot rot silently.

- **Reason:** the P2 heavy journey clicked tab 'Overview' for ~30 days after the WM2.0 rename to 'Today' (0ef426c) because the journeys project skips PR lanes and nothing compared labels. Discovered and fixed 2026-09-03 (WM2.3); the _class_ remained unguarded.
- **Resolution (closed 2026-09-03):** `scripts/journey-label-parity.mjs` parses `NAV_ITEMS` in `app/index.tsx` as the single source of truth and checks every e2e label map plus inline tab clicks; wired into `qa:fast`. Negative check verified: renaming a rail label produces 8 named failures. Parser unit-tested in `tests/journeyLabelParity.test.ts`.

### CG-9 — Full-parallel Vitest load sensitivity (timeout + bind-race class) — CLOSED

**Decided contract (WM2.4):** load-sensitive real-I/O tests carry explicit bounds sized to their meaning, not the 5s default; spawned servers fail fast on bind death via child-watching probes with bounded bind-race retries; a genuine hang still fails fast.

- **Reason (reproduced 2026-09-03):** across seven full `npm test` runs, four different files failed sporadically — `caloriesIntegrity`, `portableOwnerRecovery`, `fixtures`, `portableLargeDataset` (integration: real SQLite bootstrap per test, file-backed imports, tens-of-thousands-row export/import), and `web-lifecycle` (spawns two real node HTTP servers). Two distinct mechanisms were proven with captured stack traces: (a) the 5s/30s bounds being tighter than the operation's meaning under parallel worker load (no assertion ever failed — pure timeouts); (b) a `pickPort()` TOCTOU bind race — the port scanner sees a port free while a previous test's server is still mid-shutdown, the spawned server dies instantly on `EADDRINUSE`, and a probe _not watching the child_ then burns its full 10s. Classification: `TEST_BUG` for both; no product, no flake of any assertion.
- **Resolution (closed 2026-09-03):** integration project sets `testTimeout: 15_000` with rationale in `vitest.config.ts`; `portableLargeDataset` describe gets a proportional 120s ceiling (its own timing assertions at 30–60s remain the real contract); `fixtures` gets 30s; `web-lifecycle`'s tree-isolation spec gets 10s child-watching readiness probes, a bounded 3-attempt spawn retry on a fresh port for both owned and victim servers, a 60s describe ceiling exceeding the worst path, and a bounded cleanup wait (the only previously unbounded await). No assertion semantics changed; no blind retries — the retry is specifically the proven bind race, with the child watcher making genuine server failures fail fast. Verified by eight consecutive full parallel runs (see ExecPlan ledger).

---

## Capability gaps

Untestable with this repo and this harness, regardless of application behaviour. Each names the reason and the recommended closing path.

### 1. Native platforms

**Reason:** Nitro's Windows Android lane now reaches the installed SuperHabits
`e2e-test` equivalent and has proven native smoke, SQLite-backed persistence,
Pomodoro lifecycle, the notification scheduling path, short-horizon local
notification posting after app process termination, and direct Android
notification-shade action selection on the current-source APK. The remaining
capability gaps are long-horizon recurrence, long-running background
execution, focused `Alert.alert` confirmations, system offline toggling, and
platform-specific performance. iOS remains dependent on EAS/macOS because
Windows has no Xcode `xcrun/simctl`.

**Closing path:** keep `npm run qa:native:android`, the targeted persistence
lane, lifecycle lane, and the test-only delivery probe as the local Android
gates. Run the `.eas/workflows/native-e2e.yml` jobs for iOS/cross-platform
coverage. Add stable visual notification-shade and system-network assertions
only after selecting a supported device-lab mechanism. (Supplemented by the
manual exploratory missions in `docs/testing/exploratory-missions.md` — M1,
M2.)

**Habit Engine V2 note (2026-08-10):** the official Maestro 2.8.0 launcher was
found in the persisted Windows user install path after the Codex process's
stale PATH was diagnosed. The portable native runner now discovers that
launcher, and the current-source Android build passed the scheduled M/W/F
habit persistence flow plus the 6/6 targeted persistence lane. Deterministic
Android clock mutation for native off-day semantics remains intentionally
unproven; domain, timezone, and web fake-clock coverage own that contract.

**Habit Reminders V1 note (2026-08-12):** the current-source Android APK's
test-only 20-second delivery probe observed the expected habit reminder in
Android's notification manager after app process termination. This closes the
previous Android posting/delivery gap at the notification-manager boundary;
the visual shade, long-horizon recurrence, and iOS boundaries remain open.

**Habit Reminders V2 note (2026-08-12):** the current-source Android APK
passed exact-habit routing, Mark complete, Snooze, and replay-after-kill
through the production response dispatcher using the same-path test seam.
SQLite/integration coverage proves durable action claims, canonical +1
completion, Linked Action replay safety, deterministic single-snooze
replacement, and local-midnight/stale/schedule/deletion no-op behavior. The
visual notification shade and direct manual selection of the two action
buttons remain unasserted on Nitro because emulator automation is unreliable;
the installed Expo category and Android notification-manager posting are
verified. iOS actionable-notification execution remains cloud/macOS-only.

**Superseding current-source evidence (2026-08-13):** a fresh delivery on the
same current-source APK was inspected through the Android System UI hierarchy.
The semantic `Mark complete` action was activated after cold start and routed
to the exact habit; replaying it left one completion. A second fresh delivery
was activated through the semantic `Snooze` action and `dumpsys alarm` showed
one replacement notification approximately 15 minutes ahead. This closes the
Android shade-action capability for the tested path; the dated 2026-08-12
statement above remains historical evidence from before that proof.

### 2. Real Supabase round-trips

**Reason:** the repository now contains the additive Habit Engine V2 migration
and the disposable reference schema, but this workstation has no authorized
Supabase target or disposable Postgres environment. RLS policies, actual
upsert conflict behaviour, and schema drift between SQLite and Postgres remain
unverified at the real remote boundary.

**Closing path:** apply `supabase/migrations/20260810130000_add_habits_rule_history.sql`
to an explicitly identified development/guarded disposable project, then run
the `add-user-simulation-platform` disposable-backend round-trip lane.

### 3. True concurrency

**Reason:** OPFS permits one writer per origin, so genuine concurrent-write conflict behaviour cannot exist on web and is not specified by the app. The multi-tab journey (J9) asserts the _lock outcome_, not a conflict model. Inventing one would be inventing requirements.

**Closing path:** none until the product specifies a concurrency model. Deliberately not fabricated.

### 4. Load/stress testing

**Reason:** the `HEAVY` fixture is a realistic ceiling for one human over three months, not a load test. Sustained-load and memory-leak profiling need instrumentation this change does not add.

**Closing path:** partially closed by the deterministic long-session soak lane (`simulation/scenarios/soakSustainedUse.ts`), which provides bounded resource-soak coverage through repeated full section tours, periodic hard reloads, a local-midnight crossing, and acceptance that requires two clean fresh-state runs. Remaining: no Chrome DevTools heap/memory-leak profiling instrumentation, and no native-device load profiling.

### 5. Migration-from-old-database journeys — synthetic matrix covered; real corpus still open

**Reason:** testing an upgrade from a captured real-world database file still has no anonymized legacy corpus in the repo. The integration level now covers migrations forward from zero AND a synthetic historical-fixture laboratory (`tests/integration/migrationFixtures.test.ts` plus the legacy cases in `tests/integration/migrations.test.ts`) that hand-builds era-shaped databases at representative boundaries — v6 habit rule-history backfill, v13 legacy JSON outbox import, v17 daily_plans inline-UNIQUE rebuild, v19 durable-state promotion (NULL = unknown timing/link metadata), and the migration-24 skipped-block-6 defensive repair with sort_order backfill — and upgrades each through the real runtime chain with version/row/tombstone/default/idempotency oracles.

**Closing path:** capture and commit anonymised real-corpus fixtures as a follow-up; the synthetic matrix proves the migration code paths, not that it matches the shape of data written by historical production builds.

**2026-08-26 re-verify:** this campaign re-ran the synthetic historical-fixture laboratory (3/3) and the migration-forward suites on the final tree; all pass. Real-corpus proof remains explicitly open as stated above — synthetic coverage is not a substitute for a captured real-world database file.

**2026-09-04 note (certification infrastructure v2, wave 3):** the synthetic side is now a mature-user corpus, not just era shapes — `seedMature()` in `tests/integration/fixtures/seeders.ts` builds ~9k deterministic rows (210 days, 20 habits with pause/archive lifecycle, 600 + 12 recurring todos, calorie diary + saved-meal catalog, 8 routines + 70 logs, 105 pomodoros, projects/goals, 4933 pending outbox intents) plus edge states (interrupted Focus/Workout, `backup.scope_version = 6`, one pre-cutover UTC date key, tombstones), with an exact-count manifest and a byte-reproducibility proof in `tests/integration/corpus.test.ts`. Captured real-world data is still open (no personal data was used).

### 6. Pre-cutover UTC date keys

**Reason:** migration 5 deliberately does not backfill, so real installs contain a mix of UTC-format and local date keys. Fixtures can simulate this, but no real corpus exists to validate against.

**Closing path:** obtain/anonymise a real corpus, or accept fixture-only simulation (documented as such).

**2026-09-04 note:** fixture-only simulation now includes a deterministic pre-cutover UTC date-key row plus the migration-5 no-backfill semantics in every MATURE corpus (`tests/integration/corpus.test.ts`); the real-corpus half stays open.

### 7. Authorization

**Reason:** no roles, no per-user client-side enforcement — the app is single-user with anonymous Supabase sign-in and no authorization boundary. There is nothing to test client-side; Supabase RLS is server-side configuration outside this repo.

**Closing path:** stated rather than faked. The session behaviour that does exist (anonymous bootstrap, graceful failure when Supabase is unconfigured) is covered by the suite.

### 8. Restore remote boundary (standard `dist/` build) — CLOSED by the `journeys-sync` lane

**Reason:** the restore prompt needs a Supabase-backed remote to appear. The standard `dist/` web export bundles no `EXPO_PUBLIC_SUPABASE_*` env, so `supabase` is null and `getRestorePreview()` reports `remote_backup_unavailable` — the prompt can never appear and no import can run. In the standard lane, the journey branches that observe that boundary (J5: dismiss, no re-prompt after dismissal, accept-restore, what-does-not-come-back) stay gated with `test.fixme(!remoteBackupDetected, …)` and show as skipped — a lane attribute, not a coverage hole.

**Resolution (closed 2026-08-04, task 6.1a/Q5; real-worker boundary verified 2026-08-09):** the dummy-Supabase `dist-sync/` build (non-routable `https://dummy.supabase.co` + placeholder anon key) is served on `localhost:8082` by the dedicated `journeys-sync` Playwright project (`npm run e2e:sync`, main/nightly only, never PRs). Against it, the J5 mock backup makes the prompt appear and all restore branches **run and pass** with the production service worker active (verified: 7/7 J5 steps green, including the CG-2 tombstone branch). The worker now bypasses cross-origin API/auth traffic while preserving same-origin shell caching; the gates remain in the code only so the standard `dist/` lane can keep the same files, releasing when a boundary is present rather than weakening an assertion. J5's CG-2 branch is now released separately under CG-2.

**Host-unreachability caveat (2026-08-26):** the `journeys-sync` lane is ENVIRONMENT-sensitive on hosts that cannot resolve `dummy.supabase.co`. This campaign's local Windows host returned NXDOMAIN for `*.supabase.co` (nslookup against 8.8.8.8 and 1.1.1.1; `curl` exited `000` in ~0.12s), so the pass-through injection escapes to a dead host and the partial-failure (bad-backend P5 step 5) and recoverable-account-v1 (A step 2) journeys deterministically miss locally. A bisect at the pre-campaign SHA `7a49647` failed identically on this host, while CI run 491 (same SHA) was green on GitHub runners — proving the lane is valid on reachable DNS and the local misses are ENVIRONMENT, not product regressions. Authoritative green for this lane is the CI rerun after push, not a local run on an unreachable dummy host.

### 9. Reconnect-push boundary (standard `dist/` build) — CLOSED by the `journeys-sync` lane

**Reason:** J3 (the-commute) "pushed exactly once" needs a real remote boundary. On the standard `dist/` build the outbox grows, dedupes per (entity, id), and survives a reload — but a flush with `supabase` null no-ops and would **drop** the records, which is not a push and cannot be asserted as one. The reconnect-push step is runtime-gated (`test.fixme(!remoteBoundaryDetected, …)`) and skipped there.

**Resolution (closed 2026-08-04, task 6.1a/Q5):** against `dist-sync/` in the `journeys-sync` project, the counting upsert injector observes the flush at the network boundary and asserts each of the four outbox records (todos ×2, habits, calorie_entries) is delivered **exactly once** and the outbox drains — **passing** (verified). J4's backend-failure steps (503 / malformed / timeout / partial / backoff) run under the same lane and pass 6/6. The gates remain so the standard `dist/` lane skips them with an honest reason instead of failing on a no-op flush.

### 10. Internal command evaluation suite — env-gated opt-in lane

**Reason:** `e2e/command.eval.internal.spec.ts` (2 tests) drives the real remote parser path (model-proxy outcomes, forced fallback) against a live backend. The whole describe is gated with `test.skip(...)` unless `E2E_COMMAND_INTERNAL_EVAL=true` AND the internal-rollout build flags are set (`EXPO_PUBLIC_AI_COMMAND_INTERNAL_ROLLOUT=true`, `EXPO_PUBLIC_AI_COMMAND_PARSE_MODE=remote_with_fallback`) AND a remote backend is configured (`EXPO_PUBLIC_AI_COMMAND_PROXY_URL`, or Supabase env vars). The standard lane and CI never set the gate, so the suite shows as skipped there — an opt-in lane attribute, not a coverage hole: the same assertions run on the standard lane against the mock parser (`e2e/command.eval.mock.spec.ts`).

**Closing path:** opt in on demand — `E2E_COMMAND_INTERNAL_EVAL=true` against an internal-capable build with a reachable backend. The run writes its quality artifact to `test-results/command-eval-internal.json` and fails on semantic mismatches or unexpected mock effective paths.

### 11. Internal command observation suite — env-gated opt-in lane

**Reason:** `e2e/command.observation.internal.spec.ts` (4 tests) observes the internal real-parser flow (opt-in metadata visibility, representative todo/habit outcomes, parse→preview→confirm, forced-fallback metadata) against a live backend. Gated identically to entry 10 at describe level via `E2E_COMMAND_INTERNAL_OBSERVATION=true` plus the same build flags and backend requirements; never set by the standard lane or CI, so it shows as skipped there. The mock-parser twin (`e2e/command.observation.mock.spec.ts`) covers the same surface on the standard lane.

**Closing path:** opt in on demand — `E2E_COMMAND_INTERNAL_OBSERVATION=true` against an internal-capable build with a reachable backend.

---

## Related

- Missions that probe these gaps by hand: `docs/testing/exploratory-missions.md`.
- How a mission finding becomes a regression test or a filed defect: the "Recording findings" section of `docs/testing/exploratory-missions.md`.
- The full design rationale for CG-1 / CG-2 and the parent's seven capability gaps: decisions D9/D10 and the "Known Gaps" section of `openspec/changes/add-real-world-user-simulation-testing/design.md`. Entries 8 and 9 of this register above were the dist-sync lane's two capability gaps and are closed by it (see their resolution notes).

---

## Platform capability gaps — `add-user-simulation-platform`

The user-simulation platform (`simulation/`) layers a model + multiple runners over the parent harness. Its own additional capability gaps are listed below, kept distinct from the parent's eleven above — the parent's gaps remain open (the disposable-backend lane partially closes parent gap #2 — real Supabase round-trips — which is exactly why it is report-only while it builds a flake-free track record). These four gaps exist _regardless of application behaviour_: they are properties of the platform's lanes and environment.

### P1 — Native-device exploration

**Reason:** the simulation platform remains web-only by design. The native Maestro layer is a separate focused gate; it does not attempt to replay every seeded persona scenario on a device. Notification delivery, native alerts, and real-device performance therefore remain outside simulation lanes.

**Closing path:** use the focused native flows for platform reality and keep seeded simulation for web behavioral stress; expand native scenarios only when a native-specific defect justifies them. The manual exploratory missions in `docs/testing/exploratory-missions.md` remain the supplement.

### P2 — AI-lane non-determinism and cost

**Reason:** the exploratory lane is driven by an _external_ agent runtime (this CLI or any Playwright-MCP-capable agent), not by the seeded engine. An LLM is non-deterministic — there is no seed guarantee (design D4) — and each mission costs money and unpredictable latency, so the lane can never gate. Missions are open-ended by design, so a finding needs human triage against a rubric rather than an oracle.

**Closing path:** non-gating by design (D7); missions are time-boxed and their anomaly reports require repro evidence (trace + persisted state) to be actionable. The triage rule converts every anomaly into either a filed defect change, a new deterministic scenario in the library, or a documented non-issue — never a note that evaporates. Chronic non-finding missions are retired, not kept as ceremony. CI wiring (runtime + credentials) is an open question recorded in `simulation/ai/RUNBOOK.md` (task 7.5); v1 runs the lane locally/on-demand.

### P3 — Live Supabase schema verification

**Reason:** the repository now owns an additive Supabase migration series and a static contract validator, but this workstation does not have verified read access to the intended production project's information schema and RLS policies. A live project can still have historical dashboard drift until it is inspected.

**Closing path:** run `npm run supabase:schema:validate` for repository-side checks, then perform a read-only authenticated comparison of the linked project against `supabase/migrations/` and file any exact discrepancy. The disposable fixture is now a compatibility payload, not the authority. The live comparison remains `CREDENTIAL_REQUIRED` until project access is available.

### P4 — No persistent staging environment

**Reason:** there is no standing staging Supabase/Vercel environment. The disposable-backend lane creates-or-wipes a throwaway project per run (design D8), which is excellent isolation but means nothing persists between runs: long-lived data, RLS role changes, and cross-day cloud behaviour cannot be observed anywhere.

**Closing path:** deliberate trade (D8 rejected standing infra on cost/security for a single-user app). If a standing env is ever wanted, `schema.sql` is compatible with a local `supabase start` stack, and promotion of the disposable lane to a `main` gating lane is decided only after 14 consecutive flake-free nightly runs (design open questions). Recorded so the absence of staging is a decision, not an accident.
