# ExecPlan: Recoverable Account V1 Closure (Native Persistence + Ownership Transition + Concurrent Protection + Live Canary)

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Independent post-delivery review found three correctness/lifecycle defects in the
shipped Recoverable Account V1. This closure campaign fixes them and proves the
corrected lifecycle:

1. Native Supabase Auth must persist through process restart using real durable
   native storage, selected by platform, never by `typeof window`.
2. Account protection must verify immutable ownership facts only — the user may
   keep writing and sync may keep flushing while the OTP is pending.
3. A fresh anonymous install must claim the local dataset for the anonymous UID
   before any local-only-first activity can strand later synced writes.

## Context

- Feature: `openspec/changes/add-recoverable-account-v1/` (OPEN, all 26 tasks
  checked). Prior execplan `.../execplan.md` is COMPLETED; this plan supersedes
  it as authoritative for the remediation and does not falsify it.
- Repo state at start: `main` == `origin/main` == `1c353801e6b8cd14d5a31f3441261ffa3631021a`,
  clean tree, main-only topology.
- Baseline QA at start: typecheck 0, lint 0, `npm test` 873/85, integration
  98/20, openspec 25/25, plan validate all PASS, `git diff --check` clean.
- Supabase SDK: `@supabase/supabase-js` 2.101.1 (`@supabase/auth-js` 2.101.1).
  `SupportedStorage` = PromisifyMethods<Pick<Storage,'getItem'|'setItem'|'removeItem'>>.
- Live project env present in `.env.local` (`EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`) — never read/print values.
- Android: emulator `Nitro_API_36` available, Maestro 2.8.0, local gradle
  release/debug APK builds already exist. EAS CLI not installed → iOS/cloud
  lanes remain ENVIRONMENT as before.

## Scope

- Fix the three findings; prove native persistence, concurrent-protection
  tolerance, first-activity ownership claim; update OpenSpec; full QA; live
  config inspection + disposable canary if credentials allow; push main; verify CI.

## Non-Goals

- No Backup Completeness V2, account merging, multi-account switching UI,
  account deletion, OAuth/social login, full two-way sync, expanded backup
  entities, expanded Restore V1, unrelated UI redesigns.

## Progress

- [x] Reconcile git (main-only, clean, no origin advance)
- [x] Read durable guidance, OpenSpec, implementation, tests
- [x] Baseline QA green (873 tests / 85 files; integration 98/20)
- [x] Finding 1: platform-first auth storage + tests
- [x] Finding 3: provisional binding (data/domain/coordinator/hooks)
- [x] Finding 2: ownership-only protection + terminal lifecycle
- [x] Unit + integration coverage (808 unit / 104 integration)
- [x] OpenSpec amendment + prior-plan closure notice
- [ ] Web E2E run (journeys-sync + full)
- [ ] Full headless QA chain
- [ ] Android native restart proof
- [ ] Live config inspection + canary (if credentials allow)
- [ ] Push main, verify CI, final report

## Starting Git State

- Local main: `1c353801e6b8cd14d5a31f3441261ffa3631021a`
- origin/main: `1c353801e6b8cd14d5a31f3441261ffa3631021a` (no advance; no integration needed)
- Remote branches: `main` only. Working tree clean.

## Finding 1 Root Cause

`lib/supabase.ts` selects auth storage with `typeof window !== 'undefined'` as
the primary discriminator (`isBrowser` first, platform second). Any React
Native runtime where `window` exists (polyfills, some libraries, test
harnesses) silently selects browser `localStorage` semantics on native and
skips AsyncStorage, losing session persistence across restart.

## Finding 1 Resolution

- New pure module `lib/supabaseAuthOptions.ts`:
  - `resolveAuthRuntime(platformOs, hasWindow)` — platform-first:
    `web` + window → `browser`; `web` + no window → `ssr`; any non-web → `native`.
  - `resolveSupabaseAuthOptions(runtime, nativeStorage)` — browser: default
    storage (localStorage), autoRefresh true, persist true, detectSessionInUrl
    false; native: `AsyncStorage`, autoRefresh true, persist true,
    detectSessionInUrl false; ssr: no-op storage, autoRefresh/persist false.
- `lib/supabase.ts` calls both with `Platform.OS` / `typeof window`.
- Unit tests assert android/ios → AsyncStorage even when window exists (fails
  against the old window-first logic), web browser → browser path, web SSR →
  SSR-safe.

## Finding 2 Root Cause

`verifyProtection()` requires the pending outbox COUNT and the remote row-count
fingerprint to remain exactly equal to the pre-OTP snapshot. Legitimate user
writes and background sync while `protection_pending` therefore convert a
successful identity conversion into a spurious "ownership changed" failure that
signs the user out. Counts are mutable; ownership is not.

## Finding 2 Resolution

- Replace count invariants with ownership invariants (all verified AFTER OTP):
  A. verified UID == original UID; B. no longer anonymous; C. local dataset
  owner == original UID; D/E. every non-null outbox owner == original UID;
  F. remote rows visible to the user remain owned by original UID;
  G. no ownership-transfer evidence.
- `PendingProtection` drops `beforePendingOutboxCount`/`beforeRemoteFingerprint`
  from the required snapshot (fields stay optional in the guard for old
  records); `beforeOutboxOwnerIds` no longer an invariant (owners may appear
  while pending; only the owner SET membership to original UID matters).
- Remote fingerprint check becomes ownership-only (`ownerIds` ⊆ {original}).
  Counts remain only as diagnostics; `sameRemoteFingerprint` removed.
- Explicit terminal lifecycle: SUCCESS (clear pending, promote binding to
  permanent), RETRYABLE_PRE_VERIFICATION_FAILURE (OTP error / still anonymous —
  keep pending), TERMINAL_POST_VERIFICATION_SAFETY_FAILURE (UID changed, local
  or remote foreign owner, evidence fetch failure after conversion) → clear
  pending + sign out + write `account.protection_last_failure` diagnostic, so a
  converted account never loops as stale `protection_pending` after restart.
- Reconcile additionally clears a pending protection whose originalUserId
  differs from the current verified user.
- Tests: A (new outbox row while pending → success), B (outbox flush + remote
  count change while pending → success), C (linked-action cascade → success),
  D (foreign outbox owner → fail closed), E (UID change → fail closed), stale
  metadata reconcile after restart.

## Finding 3 Root Cause

A fresh anonymous install keeps `account.owner_user_id` NULL until legacy
content exists. First activity that is local-only (e.g. Pomodoro) populates the
dataset unbound; a later synced mutation then finds `hasUserData` and refuses
to adopt the session → ownerless outbox row → adapter requires
`localOwner === currentUserId` → sync fails closed forever.

## Finding 3 Resolution

Option A (mission §20 preferred): bind the fresh dataset to anonymous UID A as
soon as anonymous Auth bootstrap succeeds, marked PROVISIONAL via new app_meta
key `account.owner_binding_state` ('provisional' | 'permanent'; missing =
permanent for backward compatibility).

- `account.data.ts`: cache + read/write binding state; `bindProvisionalLocalDatasetOwner`,
  `promoteLocalDatasetOwnerIfProvisional`, `replaceProvisionalLocalDatasetOwner`
  (only when provisional), `inspectLocalAccountDataState` gains
  `ownerBindingProvisional`; `isEmptyForAccountReplacement` treats a provisional
  binding as replaceable.
- `decideAccountState`: `canRecoverExisting` = pristine && (binding null ||
  provisional); pristine provisional + no session → `shouldCreateAnonymous` true
  (auto new temp anonymous replaces provisional — safe because pristine implies
  no remote rows under A); pristine provisional + session A → anonymous_ready
  with canRecoverExisting true; populated + provisional → recovery/owner-mismatch
  paths unchanged (fail closed).
- Promotion to PERMANENT (durable) at first meaningful content:
  1. `runSyncedMutation` — in-transaction promote when changed (covers the 4
     synced tables);
  2. local-only first-write hooks in pomodoro/workout-log/habit-completion/
     saved-meal/linked-action-rule insert paths via shared helper
     `claimOwnerBindingOnFirstContent(db)` (no-op when already permanent);
  3. safety net: reconcile promotes when provisional && non-pristine;
  4. `verifyProtection` success promotes.
- `requestRecovery`/`verifyRecovery`: owner-recovery path only for PERMANENT
  binding; pristine provisional devices use the replaceable fresh-recovery path
  (remote-row check under temp A preserved → ACCOUNT_CONFLICT if present);
  verify replaces provisional A with B only after verified B and re-check of
  emptiness; populated provisional (unpromoted edge) promotes then follows
  owner-recovery rules → switching blocked.
- Sync flush triple check (verified UID == binding == outbox owners) unchanged.

## Native Auth Persistence Model

- Web: browser storage (default), autoRefresh on, persist on.
- Android/iOS: AsyncStorage explicitly, autoRefresh on, persist on,
  detectSessionInUrl false, `startAutoRefresh` on native (existing pattern).
- SSR/static export: no-op storage, autoRefresh/persist off; module import
  stays side-effect safe (`build:web` must pass).

## Empty Install Ownership Transition

Temporary empty anonymous session → provisional binding at bootstrap → first
meaningful content promotes to permanent → Recover Existing blocked forever
after promotion; pristine provisional remains replaceable by verified recovery.

## Protection Verification Invariants

See Finding 2 Resolution A–G. Mutable counts/activity never gate success.

## Pending Protection Lifecycle

`SUCCESS` | `RETRYABLE_PRE_VERIFICATION_FAILURE` | `TERMINAL_POST_VERIFICATION_SAFETY_FAILURE`; diagnostic key `account.protection_last_failure` (json: originalUserId, reason, at); stale records reconciled/cleared; restart after terminal failure lands on recovery_required or protected-with-same-UID (never stale protection_pending).

## Auth State Transition Matrix

| State                                       | Expected                                                |
| ------------------------------------------- | ------------------------------------------------------- |
| EMPTY + NO SESSION                          | remote_unavailable, create anonymous → provisional bind |
| EMPTY + TEMP ANON (no binding, legacy path) | anonymous_ready, bind provisional on reconcile          |
| EMPTY + PROVISIONAL A + SESSION A           | anonymous_ready, canRecoverExisting true                |
| EMPTY + PROVISIONAL A + NO SESSION          | create new anonymous (pristine) → provisional A2        |
| EMPTY + PROVISIONAL A + RECOVER B           | fresh-recovery path, replace A with B after verify      |
| DATA + OWNER A + SESSION A                  | anonymous_ready/protected                               |
| DATA + OWNER A + NO SESSION                 | recovery_required, no new anonymous                     |
| DATA + OWNER A + SESSION B                  | owner_mismatch, paused                                  |
| DATA + OWNER A + WRONG OUTBOX OWNER         | owner_mismatch/account_conflict                         |
| DATA + NO OWNER + SESSION A (legacy)        | bind A legacy (unchanged)                               |
| DATA + NO OWNER + NO SESSION                | legacy_owner_unknown (unchanged)                        |
| MULTI-OWNER OUTBOX                          | account_conflict (unchanged)                            |

## Local-Only Write Matrix

Pomodoro / habit completion / workout log / saved meal / linked-action rule →
durable claim hook promotes provisional → permanent. No sync required.

## Synced Write Matrix

First todo/habit/calorie/routine on provisional device → outbox owner = A
(cached binding; no network), promotion in-transaction. Never owner NULL on a
configured fresh anonymous install.

## Restart Matrix

- With session: same UID, binding/outbox owners intact.
- Without session + data: recovery_required, no anonymous recreation.
- Terminal protection failure: pending cleared, no stale loop.

## Live Supabase Auth Configuration

Read-only inspection of project `kruubbynsmxzxfdunaal` (anonymous/email
enabled, manual linking, OTP template uses six-digit `{{ .Token }}`). If
Management API access is unavailable → classify CREDENTIAL_REQUIRED /
MANUAL_CONFIGURATION_REQUIRED (previous session observed 401). No insecure
workarounds.

## Live Canary Plan

If a safe disposable email + cleanup path exists: anonymous A → protect →
OTP → same UID, permanent, remote rows owner A → fresh client recover →
same UID → cleanup. Never log OTP/JWT/refresh/service key. Delete nothing real.

## Test Matrix

- Unit: storage selection; domain provisional transitions; coordinator
  concurrent-protection scenarios A–E; stale metadata; recovery gates.
- Integration (real SQLite): first synced write owner; Pomodoro-first → Todo
  → owner A both; workout-first; recover B pristine allowed; recover blocked
  after local content; session loss after local-only-first (no new UID, outbox
  owner A, restart persistence).
- Web E2E: extend recoverable-account journeys (deterministic auth mock).

## Android Matrix

Nitro_API_36, serialized: auth storage restart test (anonymous A → force-stop →
relaunch → same UID, no second anonymous, no owner mismatch), plus existing
smoke/persistence/lifecycle gates. Record APK SHA-256.

## Validation Ledger

- 2026-08-14 — `git status/branch/ls-remote` — PASS — main-only, clean, SHA `1c35380`.
- 2026-08-14 — `npm ci` — PASS — clean install.
- 2026-08-14 — baseline `typecheck/lint/npm test/qa:integration/openspec:validate/plan:validate:all/diff --check` — PASS — 873 tests/85 files; integration 98/20; openspec 25/25; plans all PASS.
- 2026-08-14 — `typecheck + test:unit` (post Findings 1–3) — PASS — 808/808 (66 files).
- 2026-08-14 — `vitest --project integration` — PASS — 104/104 (21 files; 6 new ownership-transition tests).
- 2026-08-14 — `npm test` (final) — PASS — 912/912 (87 files).
- 2026-08-15 — `e2e:sync` journeys-sync — PASS — 33/33 (7-step recoverable-account journey incl. 3 new closure steps); final-build re-run 31/33 + bad-backend step 5 FLAKY (re-run standalone 6/6 PASS).
- 2026-08-15 — `npx playwright test` (chromium+journeys+simulation) — PASS — 172 passed / 0 failed / 55 runtime-gated skips.
- 2026-08-15 — `build:web` + `build:sync` — PASS ×3 (final source) — SSR/static export regression clean.
- 2026-08-15 — `qa:timezones` — PASS — 5 zones.
- 2026-08-15 — `qa:simulation --all --mode deterministic` — PASS — 21/21 scenarios.
- 2026-08-15 — `validate:themes` 140/140; `supabase:schema:validate` PASS (RLS unchanged); `qa:impact:validate` PASS; `expo-doctor` 20/20; `npm audit` = baseline 16 transitive advisories (6 moderate/10 high, unchanged).
- 2026-08-15 — Android native lanes (Nitro_API_36, serialized): smoke 2/2 (release APK); persistence 10/10 flows verified (2 lane failures under contention re-ran isolated → PASS; FLAKY_TEST); lifecycle 5/5 (E2E-flag APK); auth lane 3/3 flows on final APK — exactly 1 anonymous signup across clearState→kill→relaunch→protect; same UID; UI anonymous after relaunch; OTP → PROTECTED same UID. Final APK SHA-256 `cb96f15a…`; manifest-patched local build `88e192fa…` (android/ gitignored).
- 2026-08-15 — Live Supabase config + canary — NOT RUN — CREDENTIAL_REQUIRED (no URL/anon key/CLI/access token on this machine; `.env.local` is an empty template; mail.tm reachable but no project credentials).
- 2026-08-15 — `openspec:validate` — PASS — 25/25 (amended spec).

## Changed Files / Areas

- `lib/supabaseAuthOptions.ts` (new), `lib/supabase.ts` — platform-first storage.
- `core/db/appMeta.ts` — `account.owner_binding_state` + `account.protection_last_failure`.
- `core/auth/account.types.ts`, `account.data.ts`, `account.domain.ts`, `accountCoordinator.ts` — provisional ownership + ownership-only protection.
- `core/sync/syncedMutation.ts` — promote on first synced write.
- Local-only data layers (pomodoro/workout/habits/calories/linked-actions) — first-content claim hook.
- `tests/*` (domain, coordinator, supabaseAuthOptions), `tests/integration/accountOwnership.test.ts` etc.
- `e2e/journeys/recoverable-account-v1.spec.ts` (+ helpers if needed).
- `openspec/changes/add-recoverable-account-v1/specs/recoverable-account/spec.md` — amended requirements.
- `.maestro/` — native auth restart flow.
- This execplan.

## Recovery / Resume Instructions

1. `git status --short`, `git diff --stat`, reconcile with Current Checkpoint.
2. Re-read AGENTS.md + this plan's Current Checkpoint.
3. `npm run qa:affected` for pending changes.
4. Continue from Exact next action.

## Decision Log

- 2026-08-14 — Option A (provisional binding at anonymous bootstrap) over Option
  B/C — smallest set of durable hooks; pristine devices provably have no remote
  rows under a temp anonymous UID, making pristine-only replacement safe.
- 2026-08-14 — Ownership-only protection invariants; counts demoted to
  diagnostics — counts are mutable by legitimate activity; ownership is the
  security invariant.
- 2026-08-14 — Durable `owner_binding_state` (default permanent) rather than
  deriving provisional-ness from pristine-ness — a device that had content and
  later deleted everything must NOT become account-switchable again.
- 2026-08-14 — Promotion hooks at runSyncedMutation + local-only first-content
  call sites + reconcile safety net — deterministic durable claim without
  editing every mutation in the app.

## Surprises & Discoveries

- The shipped `lib/supabase.ts` at HEAD already passes AsyncStorage on plain
  Android/iOS Hermes (no `window` global) — the defect is the window-first
  precedence that misclassifies any native runtime where `window` exists, plus
  the untestable structure. Still HIGH: restructure platform-first.
- `tests/setup.ts` mocks `@/lib/supabase` entirely; real AsyncStorage import in
  node is avoided → the new resolver must be a pure module.
- Existing AppProviders flush gating already includes `protection_pending` —
  concurrent sync during OTP wait was intended; only the verify-time frozen
  counts were wrong.

## Current Checkpoint

- Current milestone: All implementation + validation complete; native auth persistence proven; commits + push + CI pending.
- Completed: Findings 1–3 fixed and tested; unit 912/912 (87 files); integration 104/104; timezones 5 zones PASS; simulation deterministic 21/21; journeys-sync 33/33 (recoverable-account journey 7/7 incl. concurrent-protection + first-local-only-switch-block) with bad-backend step 5 classified FLAKY_TEST (passed 2/3 full runs + standalone 6/6); standard E2E 172 passed / 0 failed; builds web+sync PASS; themes 140/140; supabase schema contract PASS; impact map valid; expo-doctor 20/20; audit = baseline 16 transitive advisories; Android: smoke 2/2 (release APK), persistence 10/10 verified (8/8 in-run + 2 isolated re-runs; lane failures classified FLAKY_TEST under contention — same APK passes isolated), lifecycle 5/5 (E2E-flag APK), native auth lane 3/3 flows on the final APK (SHA-256 cb96f15a…; later manifest-cleartext-local build 88e192fa…, gitignored android/): exactly ONE anonymous signup across clearState-launch → force-stop → relaunch → protect; same synthetic UID 00000000-…ca1a throughout; UI 'ANONYMOUS / UNPROTECTED' (not RECOVERY REQUIRED) after relaunch; on-device OTP → 'PROTECTED' with same UID. Live canary/config: NOT RUN — CREDENTIAL_REQUIRED (no URL/anon key/CLI/token; `.env.local` is an empty template). OpenSpec amended + validated; prior execplan closure notice added.
- In progress: none — next action is commit, push, CI verification.
- Important modified files: full list in git status (18 modified + 8 new); see Changed Files / Areas.
- Last successful validation: the gates above.
- Current failures: None.
- Relevant quarantines: none.
- Blockers: Live Supabase config/canary = CREDENTIAL_REQUIRED; iOS/EAS = ENVIRONMENT (no EAS CLI / macOS).
- Condition required to unblock: N/A.
- Exact resume action after unblock: N/A.
- Exact next action: Commit the four coherent commits, `git fetch origin`, verify no origin advance, push main (no force), confirm main == origin/main and main-only remote, then verify the GitHub Actions quality + e2e runs for the final SHA.
- Remaining definition of done: push + GitHub CI quality/e2e green + final report.

## Outcomes & Retrospective

- Status: Active (final commit/push/CI step remains).
- Summary: All three findings fixed: (1) platform-first auth storage with a testable resolver and 13 regression tests; (2) protection verifies ownership facts only, with explicit terminal lifecycle and stale-pending reconciliation; (3) provisional anonymous ownership claims the dataset at bootstrap, promotes durably on first meaningful content (synced + local-only hooks), keeps Recover Existing available only while pristine, and blocks switching on populated devices. Proven by 912 unit/integration tests, 33 journeys-sync + 172 standard E2E steps, 21 deterministic simulations, 5 timezones, Android smoke/persistence/lifecycle lanes, and a hermetic native auth-persistence lane (force-stop/relaunch restores the same session with no second anonymous user; on-device OTP protection preserves the UID).
- Follow-up: Live Supabase Auth configuration (manual linking, OTP template six-digit code) and a real-email canary remain CREDENTIAL_REQUIRED — a future session with project credentials should run `scripts/live-account-canary.sh`-style flow (script was intentionally not committed; rebuild from this plan) or use the Dashboard to verify the email-change/OTP templates before marking live production readiness. iOS/EAS remains ENVIRONMENT.
