# ExecPlan: Recoverable Account V1

Plan-Version: 2
Status: COMPLETED

> **Closure notice (2026-08-14):** An independent post-delivery review found
> three correctness/lifecycle defects in the shipped implementation: (1) native
> Auth storage was selected window-first instead of platform-first, (2) account
> protection verified frozen outbox/remote COUNTS instead of immutable
> ownership facts, and (3) fresh anonymous installs left the dataset unbound so
> local-only-first activity could strand later synced writes. The remediation
> is tracked authoritatively in
> `.agent/execplans/recoverable-account-v1-closure.md` (ACTIVE) and supersedes
> the completion claims below for those three areas. This plan's record of the
> original delivery work is preserved unchanged.

## Purpose

Build a recoverable account boundary for Super Habits so anonymous users can protect the existing Supabase identity with a verified email, recover that same identity on an empty device, and never silently rebind populated local data or durable outbox work to another owner.

## User Outcome

An existing user can see whether backup is anonymous/unprotected or protected, request email protection, verify it without changing the Supabase UUID or remote row ownership, and later choose Recover Existing on a genuinely empty device. If auth disappears or the wrong account is present, the user keeps local use while remote backup pauses with actionable recovery guidance.

## Context

The repository is an Expo/React Native single-page app for web, Android, and iOS. SQLite is the local source of truth; `lib/supabase.ts` owns the optional client and `core/providers/AppProviders.tsx` owns startup orchestration. `core/sync/sync.engine.ts` persists and publishes the durable outbox, `core/sync/supabase.adapter.ts` pushes owner-scoped rows, and `core/sync/restore.coordinator.ts` implements limited empty-device Restore V1. Settings is a modal under the existing six-bucket information architecture. Existing Supabase RLS ownership hardening and Command Center V2 are already delivered on the starting `main` and must not regress.

## Scope

This plan covers local owner binding, account-state inspection/coordinator, anonymous-to-permanent email protection, empty-device existing-account recovery, session-loss and wrong-owner fail-closed behavior, outbox/restore gates, Backup / Sync / Restore Settings UI, focused unit/integration/E2E/simulation/native coverage, safe live Auth configuration inspection/canary classification, documentation reconciliation, main-only delivery, and final GitHub CI verification.

## Non-Goals

Full two-way sync, expanded Restore V1 entity scope, account merging or transfer, populated-device account switching, account deletion, social providers, password storage, billing, backup table/RLS redesign, and general backup completeness remain out of scope.

## Starting Git State

- Checkout: `C:\Users\Michael Roy\Documents\super-habits`
- Branch: `main`
- Starting `HEAD`, local `main`, and `origin/main`: `1c2deb5905e097c28fad561666ea43f007646e40`
- Remote topology at start: only `origin/main` (plus symbolic `origin/HEAD`); one worktree.
- Working tree at start: clean.
- Historical reviewed baseline supplied by the user matches the actual current SHA; `git fetch origin --prune` found no advancement.

## Current Auth Architecture

`lib/supabase.ts` creates an optional `@supabase/supabase-js` client at module
scope from `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
The current client uses `AsyncStorage` whenever `window` exists, disables
`autoRefreshToken` and `persistSession` on native, and sets
`detectSessionInUrl: false`; it exposes `getSession`-based cached UID access,
`getUser`-based verified UID access, and `ensureAnonymousSession()`.
`AppProviders.tsx` currently initializes SQLite, unconditionally calls
`ensureAnonymousSession()` when configured, marks auth bootstrap ready, hydrates
the outbox, and then loads Restore V1 preview. Its interval, visibility, and
NetInfo flush listeners are enabled by remote mode alone. There is no account
coordinator, durable local owner key, auth-state listener, or binding gate in
the current implementation.

The installed package is `@supabase/supabase-js` `2.101.1` (the package range
is `^2.101.1`). Its checked-in Auth JS definitions support
`updateUser({ email })`, `verifyOtp({ email, token, type: 'email_change' })`
for email-change verification, and
`signInWithOtp({ email, options: { shouldCreateUser: false } })`; OTP input is
the documented six-digit path. Supabase's current docs state that anonymous
conversion through `updateUser` requires manual linking to be enabled, and
that `signInWithOtp` otherwise creates users by default.

## Current Anonymous Session Lifecycle

The actual startup sequence is: service-worker registration; SQLite
`initializeDatabase()`; unconditional `ensureAnonymousSession()`; set
`authBootstrapReady`; `syncEngine.hydrate()`; and `getRestorePreview()`.
`ensureAnonymousSession()` returns an existing cached session, creates an
anonymous session when `getSession()` is null, and otherwise leaves the error
to `AppProviders` logging. It does not inspect local data or the outbox. Auth
storage loss therefore creates a new anonymous UID before the current code
knows whether the SQLite/OPFS dataset is populated. Sync hydration and the
flush listeners are not gated on verified identity or owner binding. Restore
does use verified `getUser()` identity and owner-scoped queries, but has no
local owner-binding check.

`getSession()` is cached/storage evidence and can return a stale session;
`getUser()` is the verified remote identity and can clear an invalid session.
The coordinator must use the former only for local evidence/queue ownership
and the latter for remote flush, restore, and post-verification checks.

## Local Dataset Ownership Model

The final model is one durable local-only owner binding, stored through the
registered `app_meta` mechanism under `account.owner_user_id`. It applies to
the SQLite dataset as a whole, not to each local domain row. The binding is
never synced or rewritten to accommodate another session. The inspected
user-content tables are `todos`, `habits`, `habit_completions`,
`pomodoro_sessions`, `workout_routines`, `routine_exercises`,
`routine_exercise_sets`, `workout_logs`, `workout_session_exercises`,
`calorie_entries`, `saved_meals`, `linked_action_rules`,
`linked_action_events`, and `linked_action_executions`. Counts include
soft-deleted/tombstone rows because they remain meaningful local history and
sync state; infrastructure-only `app_meta`, `sync_outbox`, and
`processed_notification_actions` are excluded from user-content counts.
Pending outbox rows are separately reported and always block account
replacement.

## Durable Account Binding Design

- Empty/no-binding/no-session: safe to create one anonymous session only when
  the inspection proves the database is empty and the outbox has no rows; the
  session is not allowed to claim populated data.
- Empty/no-binding/current session: the explicit recovery flow may replace a
  temporary anonymous session; ordinary local writes or a successful restore
  establish the binding only after the identity/empty-device guard passes.
- Data/no-binding/current session: legacy-bind to the current UID only if all durable outbox owners are empty or that UID.
- Binding A/session A: healthy.
- Binding A/no session with data or outbox: recovery required; no anonymous recreation.
- Binding A/session B with data/binding: owner mismatch; local-only, no remote flush/restore.
- Missing binding/multiple outbox owners: account conflict; fail closed.
- Missing binding/data/no session: unresolved legacy state; no new anonymous binding until safe evidence exists.

Existing outbox persistence already refuses owner rebinding and preserves a
known owner when a mutation is enqueued without auth, but
`runSyncedMutation()` currently supplies `null` for a new record when auth is
missing and the adapter checks only record-vs-session equality. The new
coordinator must add the missing dataset-binding equality gate and ensure a
new offline mutation under binding A is recorded as A rather than null.

## Anonymous→Permanent Upgrade Flow

Capture and reverify the current anonymous UID, confirm the local binding matches, request the supported Supabase email-linking flow, keep a pending state, then verify the email through the selected cross-platform mechanism. After verification, retrieve the current user, require the same UID and permanent identity, preserve binding/outbox owners, and leave remote backup rows untouched. Any conflict, failure, or unexpected UID change fails closed and leaves the user anonymous/local-first.

## Existing-Account Sign-In Flow

Expose Recover Existing in the Backup / Sync / Restore surface and empty-device entry path. Inspect local data before authentication; require no meaningful user data and zero pending outbox. Request email OTP/passwordless recovery using the installed SDK’s explicit no-account-creation option. Verify a bounded OTP or safe callback, bind only the returned UID after identity and emptiness rechecks, and start the existing Restore V1 preview. No populated-device sign-in-anyway or merge path exists.

## Email Verification Strategy

Current official Supabase documentation confirms `updateUser({ email })` links an email identity to an anonymous user when manual linking is enabled, and that either an email-change link or six-digit OTP can complete verification. It also documents `verifyOtp({ email, token, type: 'email' })` and passwordless `signInWithOtp`. The implementation will prefer email OTP for explicit native/web parity, but the actual project template/configuration and installed `@supabase/supabase-js` types must be verified before code finalization. OTP input is bounded, cooldown-protected, non-logged, and generic on unknown-account failures.

## Empty-Device Safety Rules

Recover Existing is allowed only before session replacement when all meaningful user-owned tables are empty and pending outbox count is zero. Temporary anonymous sessions on empty devices may be replaced only when their local outbox is empty and no remote mutation was created for that temporary UID. The app never deletes local data, transfers rows, merges accounts, or signs in another account on a populated device.

## Session-Loss Behavior

With a binding or meaningful data and no verified session, ordinary local reads/writes continue. Remote sync and restore pause; binding and outbox remain durable; new synced writes keep the existing binding owner. Correct reauthentication clears recovery-required state and resumes normal gates. Local-only/no-configured-remote mode remains usable and distinct from auth loss.

## Wrong-Account Behavior

If the current verified UID differs from the local binding while meaningful data exists, state is `owner_mismatch`. Local use continues, but remote flush, restore, and new remote assignment are blocked. The UI says to sign back into the account that owns the device backup and hides raw UUIDs. No automatic repair, data deletion, merge, or owner mutation is exposed.

## Outbox Ownership Interaction

Existing durable outbox rows already record enqueue-time ownership. Flush must require current verified UID = local binding = every row owner. Missing auth, owner mismatch, multiple owners, partial failures, restart, tombstones, and writes during a flush preserve rows and recorded owners. No owner ID is rewritten or dropped as an auth recovery side effect.

## Restore Interaction

Restore V1 remains empty-device-only and limited to its current supported entities (`todos`, `habits`, `calorie_entries`). After recovery, it rechecks verified identity and local owner binding before owner-scoped preview and before import. A local mutation arriving between preview and import blocks the import without overwriting local data.

## Supabase Configuration Requirements

Read-only inspection of project `kruubbynsmxzxfdunaal` succeeded through the
authenticated Supabase CLI (`2.113.0`) and the public Auth settings endpoint:
the project is `ACTIVE_HEALTHY`, anonymous users are enabled, email auth is
enabled, signups are enabled, and email confirmation is required
(`mailer_autoconfirm: false`). The public endpoint does not expose manual
linking, Site URL, redirect allowlist, email template body, CAPTCHA, or exact
rate-limit configuration. The repository's local `supabase/config.toml` is a
local-development file and still says anonymous/manual linking are disabled,
so it is not treated as live evidence. The Management API auth-config endpoint
returns `401` without a PAT. Therefore the live status for manual linking and
template/redirect/CAPTCHA details is `MANUAL_CONFIGURATION_REQUIRED` /
`CREDENTIAL_REQUIRED`; the exact Dashboard location is Authentication →
Configuration for manual linking, Authentication → Providers → Email for
secure email-change/template settings, and Authentication → URL Configuration
for Site URL/redirects. No live Auth configuration was mutated.

## Web Flow

Use the existing static Expo export and browser session persistence. Test refresh retention, auth-storage loss with OPFS data remaining, OTP verification, no duplicate temporary anonymous rebinding, callback/error handling if applicable, and no infinite redirect. Do not introduce browser-only APIs into static export paths without platform guards.

## Android Flow

Use the existing available API 36 target if present and run native account flows serially. The preferred OTP path avoids a deep-link dependency; if the live email template requires links, configure only the allowlisted `superhabits://` callback and validate token-hash parsing through Supabase, never logging credentials. Record APK/source/package/hash and classify unavailable device/EAS infrastructure explicitly.

## iOS considerations

The same OTP/state-machine behavior must remain platform-neutral. If magic-link callbacks are required, iOS needs the registered `superhabits` scheme and allowlisted redirect; macOS/iOS tooling or EAS credentials may be external blockers and must not be claimed as passes.

## Security Threat Model

1. Lost session creates a new anonymous owner → prevented by recovery-required/legacy-unknown gates.
2. Account B signs into populated device A → owner mismatch blocks remote work and merge.
3. Mistyped recovery email creates a permanent account → explicit no-create recovery request.
4. Email belonging to B steals/mixes A data → link conflict stays on A; no sign-in/transfer.
5. Outbox A flushes while B is authenticated → triple owner equality gate denies flush.
6. Verification changes UUID unexpectedly → post-verification UUID equality fails closed.
7. Malicious deep link → allowlisted redirect and Supabase token verification only; no raw token persistence.
8. OTP/token appears in logs → bounded UI handling and redacted auth errors.
9. Remote outage blocks offline use → local-first writes continue.
10. Protection rewrites remote owners → same-UUID proof and row-count/owner regression checks.

## Test Matrix

- Pure account-state decision matrix: empty/no session, empty/temp anonymous, data/matching, legacy bind, binding/no session, binding A/session B, no binding/no session, one/multiple outbox owners.
- Mock Auth: protect pending/success/conflict/failure/timeout/resend/idempotence; recover known/unknown/wrong/expired/duplicate; UUID and owner preservation.
- Real SQLite: migration/bootstrap, all user-owned table counts, restart/session loss, offline enqueue, owner A recovery, owner B mismatch, outbox durability and partial failure.
- Restore/sync: owner scope, empty-device guard, identity recheck, supported entity scope, tombstones, malformed backup, no overwrite.
- Web E2E: Settings states, protection/recovery UI, populated-device rejection, recovered restore, refresh/storage-loss behavior.
- Regression: Command Center V2, AI auth/quota, existing Settings/persistence, RLS/schema and remote owner tests.

## Native Matrix

- Android API 36 when available: smoke, settings account state, OTP/recovery or callback path, populated-device block, empty-device sign-in, Restore V1, Todo/Habit/Calories restore, Pomodoro/reminder/Command Center regressions.
- iOS: run when macOS/simulator/EAS exists; otherwise record `ENVIRONMENT` or `CREDENTIAL_REQUIRED` with command/evidence.
- Native auth/email delivery is not fabricated in CI; deterministic/mock coverage remains the gate when mail infrastructure is unavailable.

## Production Verification

Record pre/post Auth configuration and backup row/owner counts without destructive experiments. Apply the minimum Auth settings only after local and web gates pass. Use disposable prefixed identities/rows for positive-path canary; never use a genuine existing user. Run schema/RLS/advisor checks after any live configuration/schema action. If a safe positive canary or authorized session is unavailable, report the exact blocker and do not claim it.

## Decision Log

- 2026-08-14 — Stay on `main` — the user mandates a main-only final branch and the fetched remote is unchanged.
- 2026-08-14 — Create one OpenSpec capability — account binding/protection/recovery/session safety share one externally visible invariant and must be implemented as one state machine.
- 2026-08-14 — Prefer `app_meta` binding — no new user-editable local table or Supabase table is required for a single local dataset owner.
- 2026-08-14 — Prefer OTP pending SDK/config verification — current Supabase docs support OTP for email verification and passwordless sign-in, while project template behavior must be inspected before committing to callback handling.
- 2026-08-15 — Use email-change OTP for protection and email OTP for recovery — this keeps the product flow explicit and platform-neutral across web, Android, and iOS without introducing callback-token parsing or a deep-link dependency in V1.
- 2026-08-15 — Separate owner recovery from empty-device account replacement — a bound dataset may sign back into its expected owner even if a temporary/wrong session is present, while an unbound populated dataset remains legacy-owner-unknown and cannot guess.
- 2026-08-15 — Keep known owner IDs on offline writes — a missing session pauses remote authorization but does not make new local sync intents ownerless; the existing binding remains the durable eventual owner.

## Surprises & Discoveries

- The supplied historical baseline is still current on `origin/main`; no integration was needed at startup.
- `AGENTS.md`/project map describe schema v15 and durable outbox owner binding, while `.cursorrules`, OpenSpec config context, and one skill copy retain stale v14/v15-next wording; runtime code and current authoritative docs will determine migration work.
- Current official Supabase docs explicitly state that anonymous users use the authenticated role, `updateUser({ email })` is the anonymous-to-permanent email path with manual linking, and passwordless OTP defaults to account creation unless the no-create option is set; installed SDK definitions and project settings still require direct verification.
- The current client has the inverse of the desired native persistence defaults: it turns off session persistence/refresh on native and uses AsyncStorage in browser builds. The coordinator work must correct this without touching browser-only APIs during static export.
- There are no existing account-coordinator/auth-flow tests; current coverage starts at owner-scoped sync/restore mocks and does not exercise `ensureAnonymousSession()`, auth storage loss, or account switching.
- Live public Auth settings confirm anonymous and email providers are available, but manual linking and email-template/redirect settings require authenticated Management API/Dashboard access; no safe live email canary can be claimed yet.
- The SDK's `shouldCreateUser: false` option is serialized as `create_user: false` in the Auth request, which the mocked recovery journey asserts so a recover-existing typo cannot silently create an account.
- The first mocked restore attempt exposed that the protection fingerprint must describe the pre-existing owner's rows consistently; the final mock separates row-count fingerprint queries from the owner-scoped restore response and resets temporary Auth identity when the simulated device is cleared.
- Browser auth storage uses `sb-*` keys in addition to app metadata; the E2E reset helper now clears both `superhabits.*` and Supabase Auth storage when modeling a cleared browser profile while retaining OPFS data.

## Validation Ledger

- 2026-08-14 — `git status --short`, branches, worktrees, remotes — PASS — clean `main`, one worktree, only `origin/main`.
- 2026-08-14 — `git fetch origin --prune` and SHA/remote-head reconciliation — PASS — local and remote all at `1c2deb5905e097c28fad561666ea43f007646e40`.
- 2026-08-14 — Durable repository guidance read — PASS — AGENTS, workflow, structure map, Cursor rules, PLANS, feature/data/RN guidance, and prior ownership plans read.
- 2026-08-14 — Current Supabase documentation discovery — PASS — anonymous auth, linking, identities, OTP/verify, redirects, native persistence, config, rate-limit/CAPTCHA guidance reviewed; official citations are retained in the final handoff.
- 2026-08-14 — `npm ci` — PASS — 1,138 packages installed; postinstall patches applied; npm reported 16 known transitive advisories.
- 2026-08-14 — `npm run typecheck` — PASS — zero TypeScript errors.
- 2026-08-14 — `npm run lint` — PASS — zero ESLint errors under the repository warning threshold; the initial concurrent attempt timed out, serial rerun passed.
- 2026-08-14 — `npm test` — PASS — 81 Vitest files and 838 tests passed; existing expected stderr diagnostics remained non-failing.
- 2026-08-14 — `npm run qa:fast` — PASS — typecheck/lint plus 63 unit files and 743 unit tests.
- 2026-08-14 — `npm run supabase:schema:validate` — PASS — 5 migration files, 4 owner-scoped sync tables, and private AI quota RPC contract.
- 2026-08-14 — `npm run openspec:validate` — PASS — 25/25 changes/specs validated.
- 2026-08-14 — `npm run agent:plan:validate:all` — PASS — all versioned plans, including this ACTIVE plan, validated.
- 2026-08-14 — `git diff --check` — PASS — no whitespace errors.
- 2026-08-14 — Current implementation audit — PASS — `lib/supabase.ts`, `AppProviders.tsx`, sync persistence/engine/adapter/mutation, restore coordinator/types, app-meta/client, settings, migrations/policies, and existing sync/restore tests were read; all user-owned local tables were enumerated; no account-flow tests exist.
- 2026-08-14 — Installed SDK definitions — PASS — `@supabase/supabase-js` `2.101.1` exposes the intended `updateUser`, `verifyOtp` email-change type, `resend`, and `signInWithOtp` `shouldCreateUser` option.
- 2026-08-14 — Live Auth read-only inspection — PASS/PARTIAL — project list and Auth settings succeeded; anonymous/email enabled and email confirmation required. Management auth config returned `401`, so manual linking, template, redirect, CAPTCHA, and exact rate limits remain `MANUAL_CONFIGURATION_REQUIRED` / `CREDENTIAL_REQUIRED`; no live write occurred.
- 2026-08-15 — Account ownership implementation — PASS — added `account.owner_user_id` and pending-flow app-meta keys, all-table local account inspection, pure account-state decisions, injectable account coordinator, fail-closed bootstrap/session-loss/mismatch behavior, owner-preserving offline mutations, outbox adapter gates, and Restore V1 identity gates.
- 2026-08-15 — Focused account tests — PASS — account domain/coordinator tests, real-SQLite ownership/restart tests, real-SQLite recovery/outbox resume test, adapter owner-gate tests, and Restore V1 regressions passed.
- 2026-08-15 — Web/build smoke — PASS — `npm run build:web`, `npm run build:sync`, Chromium settings/infrastructure smoke (12 tests), and mocked `journeys-sync` Recoverable Account V1 (2 tests) passed.
- 2026-08-15 — QA impact assessment — PASS/ESCALATED — `npm run qa:affected` identified sync/restore, database, native UI/persistence, Pomodoro/notification lifecycle, and workflow/documentation gates; full affected lanes remain to be run.
- 2026-08-15 — Legacy outbox compatibility — PASS — a verified current UID may adopt v14-era unowned outbox rows only when no conflicting owner evidence exists; no-session and conflicting-owner cases remain fail-closed; focused domain/coordinator coverage passed (31 tests).
- 2026-08-15 — `npm run qa:fast` — PASS — typecheck, lint, and 775 unit tests across 65 files.
- 2026-08-15 — `npm test` — PASS — 873 tests across 85 Vitest files (775 unit, 98 integration).
- 2026-08-15 — Serial integration/timezone gates — PASS — `npm run qa:integration` 98/98; `npm run qa:timezones` 42/42 in Asia/Manila, UTC, America/New_York, Pacific/Honolulu, and Pacific/Kiritimati.
- 2026-08-15 — Repository contract gates — PASS — 140 theme checks, Supabase schema validation, OpenSpec 25/25, all ExecPlan validation, QA impact-map validation, and simulation model validation for 21 scenarios.
- 2026-08-15 — Final web exports — PASS — `npm run build:web` and `npm run build:sync` completed; final Recoverable Account V1 `journeys-sync` focus passed 4/4.
- 2026-08-15 — Final web E2E — PASS — Chromium 88 passed/7 intentional skips out of 95; standard journeys 72 passed/21 intentional skips out of 93; `journeys-sync` 30/30; simulation browser project 3/3; full deterministic simulation CLI previously passed 21/21.
- 2026-08-15 — Native regression — PASS/PARTIAL — Android smoke 2/2, persistence 10/10, lifecycle 5/5 on Nitro_API_36; iOS smoke is an explicit ENVIRONMENT block because Xcode/simctl is unavailable; real email/native account canary was not fabricated.
- 2026-08-15 — Expo Doctor/security tooling — PASS/PARTIAL — `npx expo-doctor` 20/20; `npm audit` and `npm audit --omit=dev` retain 16 known transitive advisories whose forced fixes would change the Expo/React Native dependency graph; no forced remediation applied. Whole-repository `format:check` remains a known baseline gap across 90 existing files; `git diff --check` passes.
- 2026-08-15 — Parallel QA attempt — ENVIRONMENT — a deliberately parallel batch caused shared SQLite integration timeouts; the required serial integration rerun passed 98/98, so no test was weakened or skipped.
- 2026-08-15 — Journey assertion stabilization — PASS — added explicit UI commit/readiness waits in `e2e/journeys/a-tuesday.spec.ts` and `e2e/journeys/fat-fingers.spec.ts`; the focused journey subset passed 19/19 and `npm run qa:fast` passed with 775 unit tests across 65 files. SQL persistence assertions remain unchanged.
- 2026-08-15 — GitHub Actions run #355 (`31835064798`, head `b264a925`) — FAIL/DIAGNOSED — `quality` passed; the full E2E job exposed async journey read-after-write races in the calorie and stale-edit assertions (with two additional timing flakes). The failures were reproduced/isolated locally, classified as test synchronization rather than product behavior, and fixed with event-driven UI waits in `6a97d55`.
- 2026-08-15 — GitHub Actions run #356 (`31840061085`, head `6a97d551`) — PASS — `quality` job `94894769551` and the full `e2e` job `94895177048` completed successfully for the pushed stabilization commit.
- 2026-08-15 — GitHub Actions run #357 (`31842128710`, head `d00c2e8e`) — PASS — final closure commit passed `quality` job `94901070919` and full `e2e` job `94901487015`; the run completed successfully.

## Current Checkpoint

- Current milestone: Recoverable Account V1 implementation, documentation, validation, main delivery, and final GitHub CI verification are complete.
- Completed: Reconciled Git, confirmed main-only remote, read durable guidance and prior security plans, created/validated OpenSpec artifacts and ExecPlan, reviewed current official Supabase Auth documentation, audited all user-owned tables, verified SDK 2.101.1 signatures, inspected live Auth settings without mutation, implemented durable owner binding and account coordinator, hardened bootstrap/sync/restore, added protection/recovery Settings UI, added unit/SQLite/mocked web coverage, added simulation personas, ran web/sync/native QA, reconciled durable docs, stabilized async journey assertions, pushed `main`, and verified GitHub Actions run #357 for the final closure SHA.
- In progress: None.
- Important modified files: `core/auth/`, `core/db/appMeta.ts`, `core/providers/`, `core/sync/`, `lib/supabase.ts`, `features/settings/`, account/restore integration tests, `e2e/journeys/recoverable-account-v1.spec.ts`, `e2e/journeys/a-tuesday.spec.ts`, `e2e/journeys/fat-fingers.spec.ts`, simulation personas, reconciled guidance docs, and the OpenSpec change directory.
- Last successful validation: full Vitest (873/873), serial integration/timezone/contract gates, final web exports, Chromium 88/95, journeys 72/93, sync 30/30, account focus 4/4, focused journey stabilization 19/19, simulation browser 3/3, deterministic simulation 21/21, Android smoke/persistence/lifecycle lanes, and GitHub Actions quality/e2e run #356.
- Current failures: No product assertion failures. Whole-repository `format:check` reports 90 pre-existing repository files; npm audit reports 16 known transitive advisories; neither was “fixed” by weakening the task scope or forcing an Expo/RN downgrade.
- Relevant quarantines: Live manual-linking/template/redirect/CAPTCHA settings and real email delivery are not verified; no live canary is claimed. iOS/EAS and native real-email account delivery remain external infrastructure gaps.
- Blockers: None for repository implementation or delivery. Production Auth configuration requires Dashboard/Management API credentials; a live canary requires a disposable test identity and safe cleanup path, and those limitations remain explicitly documented.
- Condition required to unblock: None.
- Exact resume action after unblock: None; if resumed, inspect this completed plan before starting a separately scoped follow-up.
- Exact next action: None — the Recoverable Account V1 definition of done is satisfied.
- Remaining definition of done: Complete — closure evidence is committed and pushed on `main`, final SHA equality and main-only topology are verified, and final GitHub quality/e2e are green.

## Progress

- [x] Reconcile current `main`, `origin/main`, remote branches, and worktrees.
- [x] Read required repository guidance, skills, and completed ownership plans.
- [x] Verify current official Supabase Auth documentation and record initial design constraints.
- [x] Create OpenSpec change directory and initial planning artifacts.
- [x] Validate planning artifacts and run exact repository baseline QA.
- [x] Audit current auth/session/bootstrap, local tables, outbox, restore, settings, SDK definitions, and live Auth configuration.
- [x] Implement owner binding, account coordinator, protection, recovery, sync/restore gates, and UI.
- [x] Add unit/integration/E2E/simulation/native coverage and run affected/full QA.
- [x] Reconcile documentation, live configuration/canary evidence, complete artifacts, commit/push main, and verify GitHub CI for the implementation/stabilization delivery.
- [x] Close the ExecPlan after pushing the closure evidence and verifying CI for the final closure SHA.

## Changed Files / Areas

- `openspec/changes/add-recoverable-account-v1/proposal.md` — product rationale and capability boundary.
- `openspec/changes/add-recoverable-account-v1/specs/recoverable-account/spec.md` — normative account ownership/recovery requirements.
- `openspec/changes/add-recoverable-account-v1/design.md` — architecture, flow, security, migration, and rollback decisions.
- `openspec/changes/add-recoverable-account-v1/tasks.md` — implementation and validation checklist.
- `openspec/changes/add-recoverable-account-v1/execplan.md` — durable implementation state and evidence ledger.
- `core/auth/` — local account inspection, state decisions, coordinator, and typed account contracts.
- `core/providers/`, `core/sync/`, `lib/supabase.ts` — bootstrap, owner-safe mutation/flush/restore gates, and Auth wrappers.
- `features/settings/`, `tests/`, `e2e/` — account UI and unit/SQLite/mocked web regression coverage.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, and this ExecPlan completely.
2. Run `git status --short`, `git diff --stat`, and `git diff --name-only`; Git wins over stale narrative.
3. Run `npm run agent:resume -- --plan openspec/changes/add-recoverable-account-v1/execplan.md` and inspect discrepancies/QA impact.
4. Read the OpenSpec proposal, design, spec, and tasks; run `openspec status --change add-recoverable-account-v1 --json` and `openspec instructions apply --change add-recoverable-account-v1 --json`.
5. Continue only from `Current Checkpoint` → `Exact next action`, updating this plan before each major milestone.

## Outcomes & Retrospective

- Status: Completed; implementation, local validation, main delivery, and GitHub Actions run #357 are complete.
- Summary: The repository now has a UUID-preserving anonymous protection flow, empty-device-only existing-account recovery, durable local ownership, and fail-closed session/outbox/restore behavior, with live configuration limitations explicitly recorded.
- Evidence: Git reconciliation, official Supabase documentation, implementation files, unit/SQLite/web/native/simulation QA, and live read-only Auth inspection are recorded above.
- Remaining work: None within Recoverable Account V1. Follow-up work remains intentionally limited to broader backup completeness, account switching/merge, account deletion, and production Auth configuration/canary work requiring external credentials.
- Follow-up: Broader backup completeness, account switching/merge, and account deletion remain outside V1.
