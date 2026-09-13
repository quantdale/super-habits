## 1. Audit, contracts, and durable ownership

- [x] 1.1 Record current Git, package, Supabase SDK, Auth bootstrap, session-storage, outbox, restore, settings, migration, and live Auth configuration evidence in the ExecPlan.
- [x] 1.2 Add and register the local owner-binding app-meta key without changing prior migration semantics.
- [x] 1.3 Add typed account inspection for all user-owned tables, active/deleted semantics, binding, pending outbox count, and distinct outbox owners.
- [x] 1.4 Add pure account-state evidence/decision contracts covering empty, healthy, protected, recovery-required, legacy-owner-unknown, owner-mismatch, and multi-owner conflict cases.
- [x] 1.5 Add unit coverage for every account-state matrix case and the legacy-binding rules.

## 2. Account coordinator and bootstrap hardening

- [x] 2.1 Refactor Supabase session wrappers to expose safe current-user/session inspection and normalized non-sensitive auth outcomes while retaining optional local-only mode.
- [x] 2.2 Implement the account coordinator and integrate it into `AppProviders` before sync hydration, restore preview, and flush listeners.
- [x] 2.3 Prevent anonymous recreation/rebinding when a populated or owner-bound dataset has lost auth; preserve local usability and recovery-required status.
- [x] 2.4 Gate sync flush on current verified UID = local binding = every pending outbox owner, with explicit no-auth/mismatch/conflict results and no record rewriting.
- [x] 2.5 Add real-SQLite restart/outbox coverage for session loss, offline writes, owner A recovery, owner B mismatch, restart durability, tombstones, and partial failure.

## 3. Anonymous-to-permanent protection

- [x] 3.1 Implement the supported Supabase anonymous email-linking request with original-UID capture, request guard, validation, and safe conflict/error mapping.
- [x] 3.2 Implement verification completion/resume for the selected email OTP or supported callback mechanism, including resend cooldown and expiration handling.
- [x] 3.3 Verify post-protection user identity, anonymous/permanent status, unchanged binding, unchanged outbox owners, and no remote ownership rewrite; fail closed on unexpected UUID changes.
- [x] 3.4 Add unit/mock auth tests for pending, success, conflict, network failure, timeout, resend, duplicate taps, and already-protected idempotence.

## 4. Existing-account recovery and Restore V1

- [x] 4.1 Implement empty-device-only Recover Existing request with `shouldCreateUser: false` using the installed SDK’s actual TypeScript signature.
- [x] 4.2 Implement bounded OTP/link verification, generic unknown-account behavior, wrong/expired OTP handling, duplicate-request guard, and no-token logging.
- [x] 4.3 Bind the recovered UID only after successful identity verification and recheck the empty-device/outbox guard before remote access.
- [x] 4.4 Integrate recovered auth with the existing owner-scoped Restore V1 preview/import path without expanding entity scope or bypassing rechecks.
- [x] 4.5 Add unit and real-SQLite coverage for empty recovery, unknown email, wrong/expired OTP, populated-device rejection before switch, successful binding, and restore.

## 5. Settings, web, native, and simulation surfaces

- [x] 5.1 Add Backup / Sync / Restore account status and protection/recovery controls without adding a Settings bucket or exposing sensitive identifiers.
- [x] 5.2 Add web E2E coverage for anonymous/unprotected, protection pending/success, recovery-required, owner mismatch, empty-device recovery, populated-device rejection, and restore preview with deterministic mock auth.
- [x] 5.3 Add deterministic simulation personas for long-term anonymous protection, lost session, wrong account, new phone recovery, and unknown email.
- [x] 5.4 Add platform-safe deep-link/OTP parsing coverage and run available Android/native account flows serially; classify unavailable iOS/EAS/email infrastructure explicitly.
- [x] 5.5 Run Command Center, AI auth, restore, sync, RLS, and existing settings/persistence regressions after provider/bootstrap changes.

## 6. Live configuration, documentation, and QA

- [x] 6.1 Read-only inspect and record anonymous auth, email auth, manual linking, confirmation/template, redirects, rate limits, and CAPTCHA configuration; apply only minimum safe changes after the production gate.
- [x] 6.2 Perform disposable live canary only if a supported test identity and cleanup path are safe; record exact blocker otherwise and verify production row/owner counts unchanged.
- [x] 6.3 Reconcile README/AGENTS/project map/knowledge docs with Recoverable Account V1, current outbox/ownership, Restore V1 scope, Command Center facts, and non-volatile QA wording.
- [x] 6.4 Run affected QA, full headless QA, builds, sync/full E2E, deterministic simulation, Expo Doctor, audit, schema/OpenSpec/plan/impact validation, and diff checks; preserve failures and classifications.
- [x] 6.5 Complete the delivery evidence, create coherent commits on `main`, reconcile/fetch without overwrite, push only `origin/main`, and verify the implementation/stabilization SHA equality and remote branch topology.
- [x] 6.6 Inspect actual GitHub Actions quality/e2e for the final pushed SHA; fix repository-caused failures and repush until CI status is known.
