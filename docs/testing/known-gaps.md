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

### CG-1 — Day-rollover presentation freshness

**Decided contract (D9b):** a mounted surface must never label a stale day "Today". When the local calendar day changes while the app is open, the **active** section refreshes its day-scoped data, and **inactive** mounted sections are marked stale so they refresh on activation rather than rendering yesterday's numbers from memory.

- **Reason:** the write half (D9a) is already correct — every data-layer write derives its day key from `toDateKey()` at call time, so a write issued after midnight lands on the new day regardless of mount time. But the presentation half is not: `useActiveForegroundRefresh` fires on `isActive` transitions and on `visibilitychange`/`AppState` foreground, and a midnight tick is neither. The decided contract is expected to fail today.
- **Quarantined tests:** `e2e/journeys/past-midnight-freshness.spec.ts` (`test.fixme()`), asserting no mounted surface labels a stale day "Today" and that an inactive section refreshes on activation rather than rendering held values.
- **Companion change:** `fix-day-rollover-refresh` — a provider-level day-key watcher that bumps a context value the sections already consume for refresh, so the active section refreshes on rollover and inactive sections refresh on activation. When it lands, the quarantine is removed in that change, not here.

### CG-2 — Restore emptiness must count deleted rows

**Decided contract (D10):** a device that has ever held rows in a synced table is not an empty device. `getLocalSyncBackedCounts()` must count all rows regardless of `deleted_at`, so a device whose todos were all deleted still counts as non-empty and restore is refused. Because the import uses `INSERT OR REPLACE` keyed on `id`, restoring onto such a device would silently resurrect a todo the user deleted while offline (a delete that was never pushed) — the user's most recent intent would lose to a stale backup.

- **Reason:** `getLocalSyncBackedCounts()` currently filters `deleted_at IS NULL`, so a device holding only soft-deleted rows looks empty and restore proceeds. Per-row merge semantics were rejected as out of scope for a push-only backup (that would turn a one-shot import into a merge, i.e. two-way sync).
- **Quarantined tests:** `tests/integration/restore.test.ts` task 2.8a (`it.fails()`) — a device holding only soft-deleted rows is not empty, and an import never resurrects a locally-deleted todo whose deletion had not yet been pushed; plus the third branch of `e2e/journeys/J5 new-phone.spec.ts` — the user-facing half of the same contract.
- **Companion change:** `fix-restore-emptiness-counts-deleted-rows` — drop the `deleted_at IS NULL` filter from `getLocalSyncBackedCounts()` (and the in-transaction re-check), so deleted history blocks restore. When it lands, the quarantine is removed in that change, not here.

### CG-3 — Double-submit add-todo creates two rows

**Decided contract:** the add/edit-todo modal write path is "one row or zero, never two" (parent change risk **R5**, duplicate-writes from rapid input). A double-tap or rapid repeated press of Add/Save must never create a second todo row.

- **Reason:** `TodosScreen.onSave()` has no re-entry guard. Two rapid presses in the same tick each run the create path, so `createTodo` fires twice and two rows with the same title are persisted. J7 step 11 reproduces it consistently (row count = 2 after a synchronous double-press of the Add-task submit).
- **Quarantined tests:** `e2e/journeys/fat-fingers.spec.ts` step 11 (`test.fixme()`, strict `expect(n).toBe(1)` retained in place), asserting exactly one row after two complete presses of the Add-task submit in the same tick.
- **Companion change:** `fix-todo-add-double-submit` — a re-entry guard (`isSubmitting` / disabled submit) in `onSave()`. When it lands, the quarantine is removed in that change, not here.

### CG-4 — Recurring-todo expansion can miss the D14 switch ceiling

**Decided contract (D14):** after the HEAVY fixture has mounted all sections, each section switch remains within the measured 800ms responsiveness ceiling. The threshold is intentionally unchanged; it catches a user-visible performance cliff rather than hiding it in a slower assertion.

- **Reason:** the first Todos activation expands recurring todos asynchronously. The existing HEAVY journey consistently measures the subsequent `overview→todos` switch at roughly 1.1s while the other switches remain within the ceiling. This is the known recurring-expansion/performance issue represented by `fix-recurring-todo-expansion-idempotency`, not a timing flake.
- **Quarantined tests:** `e2e/journeys/three-months-in.spec.ts` step 3 (`test.fixme()`, with the strict `≤ 800ms` assertion retained in the step body).
- **Companion change:** `fix-recurring-todo-expansion-idempotency` — make expansion idempotent and remove the quarantine there after measuring the unchanged D14 contract.

### CG-5 — HEAVY diary saved-meal search exceeds the D14 ceiling

**Decided contract (D14):** the HEAVY Calories diary's saved-meal search responds within 500ms after the user enters a query. The assertion and ceiling remain unchanged.

- **Reason:** after rebuilding the current application, three isolated full HEAVY journey runs measured the diary search at 712ms, 677ms, and 771ms. The failure is reproducible in the current environment and is not resolved by a retry or a larger timeout; it needs a focused performance investigation.
- **Quarantined tests:** `e2e/journeys/three-months-in.spec.ts` step 6 (`test.fixme()`, with the strict `≤ 500ms` assertion retained in the step body).
- **Companion change:** a focused calorie-diary performance change must profile and optimize the input path, then remove this quarantine without changing the D14 ceiling.

---

## Capability gaps

Untestable with this repo and this harness, regardless of application behaviour. Each names the reason and the recommended closing path.

### 1. Native platforms

**Reason:** the committed `.maestro/` layer now reaches a built Android/iOS app for semantic smoke, persistence, and lifecycle-path checks. However, Playwright and the local Windows host still cannot prove all native behavior: notification tray delivery, long-running background execution, `Alert.alert` confirmations, system offline toggling, and platform-specific performance remain dependent on a booted device or EAS/macOS lane.

**Closing path:** run `npm run qa:native:android` on an Android-capable host and the `.eas/workflows/native-e2e.yml` Android/iOS jobs for cross-platform coverage. Add stable notification-shade and system-network assertions only after selecting a supported device-lab mechanism. (Supplemented by the manual exploratory missions in `docs/testing/exploratory-missions.md` — M1, M2.)

### 2. Real Supabase round-trips

**Reason:** only injected responses are exercised at the network boundary, so RLS policies, actual upsert conflict behaviour, and schema drift between SQLite and Postgres are not verified.

**Closing path:** a separate contract-test change against a disposable project (the `add-user-simulation-platform` change's disposable-backend lane is the intended vehicle).

### 3. True concurrency

**Reason:** OPFS permits one writer per origin, so genuine concurrent-write conflict behaviour cannot exist on web and is not specified by the app. The multi-tab journey (J9) asserts the _lock outcome_, not a conflict model. Inventing one would be inventing requirements.

**Closing path:** none until the product specifies a concurrency model. Deliberately not fabricated.

### 4. Load/stress testing

**Reason:** the `HEAVY` fixture is a realistic ceiling for one human over three months, not a load test. Sustained-load and memory-leak profiling need instrumentation this change does not add.

**Closing path:** a separate change; profile a long session with the Chrome DevTools protocol.

### 5. Migration-from-old-database journeys

**Reason:** testing a v6 database upgrading to v11 requires a captured legacy database file; none exists in the repo. The integration level covers migrations running forward from zero.

**Closing path:** capture and commit anonymised legacy fixtures as a follow-up.

### 6. Pre-cutover UTC date keys

**Reason:** migration 5 deliberately does not backfill, so real installs contain a mix of UTC-format and local date keys. Fixtures can simulate this, but no real corpus exists to validate against.

**Closing path:** obtain/anonymise a real corpus, or accept fixture-only simulation (documented as such).

### 7. Authorization

**Reason:** no roles, no per-user client-side enforcement — the app is single-user with anonymous Supabase sign-in and no authorization boundary. There is nothing to test client-side; Supabase RLS is server-side configuration outside this repo.

**Closing path:** stated rather than faked. The session behaviour that does exist (anonymous bootstrap, graceful failure when Supabase is unconfigured) is covered by the suite.

### 8. Restore remote boundary (standard `dist/` build) — CLOSED by the `journeys-sync` lane

**Reason:** the restore prompt needs a Supabase-backed remote to appear. The standard `dist/` web export bundles no `EXPO_PUBLIC_SUPABASE_*` env, so `supabase` is null and `getRestorePreview()` reports `remote_backup_unavailable` — the prompt can never appear and no import can run. In the standard lane, the journey branches that observe that boundary (J5: dismiss, no re-prompt after dismissal, accept-restore, what-does-not-come-back) stay gated with `test.fixme(!remoteBackupDetected, …)` and show as skipped — a lane attribute, not a coverage hole.

**Resolution (closed 2026-08-04, task 6.1a/Q5):** the dummy-Supabase `dist-sync/` build (non-routable `https://dummy.supabase.co` + placeholder anon key) is served on `localhost:8082` by the dedicated `journeys-sync` Playwright project (`npm run e2e:sync`, main/nightly only, never PRs). Against it, the J5 mock backup makes the prompt appear and the restore branches **run and pass** (verified: 6/6 boundary steps green). The gates remain in the code only so the standard `dist/` lane can keep the same files; they release when a boundary is present, never by weakening an assertion. J5's CG-2 branch stays quarantined separately under CG-2.

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

### P3 — Manually maintained reference schema

**Reason:** `simulation/backend/schema.sql` is a hand-written **reference copy** of the Supabase dashboard configuration (the four synced tables + RLS + the `parse-ai-command` edge function). It is not the runtime authority — the real dashboard is — so it can drift silently with any dashboard change, and a drifting schema tests the stale copy instead of the real one while still proving the out-of-repo schema problem (audit SEC-003).

**Closing path:** any dashboard-vs-`schema.sql` discrepancy found by the disposable-backend lane is filed as a finding (procedure in `simulation/backend/DRIFT.md`); the real close is the follow-up change that moves the Supabase schema into version control. Until then the file is header-commented as a manual copy and is kept compatible with a future local `supabase start` stack.

### P4 — No persistent staging environment

**Reason:** there is no standing staging Supabase/Vercel environment. The disposable-backend lane creates-or-wipes a throwaway project per run (design D8), which is excellent isolation but means nothing persists between runs: long-lived data, RLS role changes, and cross-day cloud behaviour cannot be observed anywhere.

**Closing path:** deliberate trade (D8 rejected standing infra on cost/security for a single-user app). If a standing env is ever wanted, `schema.sql` is compatible with a local `supabase start` stack, and promotion of the disposable lane to a `main` gating lane is decided only after 14 consecutive flake-free nightly runs (design open questions). Recorded so the absence of staging is a decision, not an accident.
