## Context

Super Habits is local-first. SQLite is the source of truth, synced entity writes create durable `sync_outbox` records, and Supabase rows are owner-scoped by the authenticated UUID. The current startup path was designed around an automatically created anonymous session, so authentication loss must now be separated from a genuinely new empty installation.

The product does not support merging two populated devices or transferring data between users. Recoverable Account V1 therefore treats the local SQLite file as one dataset with one durable remote owner. Auth identity changes are allowed only when Supabase preserves the same UUID (anonymous protection), or when the local dataset is empty and the user explicitly recovers an existing account.

## Goals / Non-Goals

**Goals:**

- Make local dataset ownership explicit and durable without adding a user-editable row or rewriting entity rows.
- Keep ordinary anonymous/local-only use frictionless when the device is empty or the existing owner session is healthy.
- Fail closed for missing sessions, mismatched sessions, conflicting outbox owners, and unsafe account replacement while preserving local use.
- Use the current Supabase Auth APIs and configuration for email linking and passwordless existing-account recovery, with no custom password or account table.
- Resume the existing durable outbox and empty-device-only Restore V1 flow after the correct account returns.

**Non-Goals:**

- Full two-way sync, broader restore, account deletion, account switching on populated devices, account merging, or arbitrary owner reassignment.
- New Supabase tables, backup-row migrations, social providers, custom authentication servers, or password storage.

## Decisions

### 1. Store ownership in `app_meta`

Use a registered app-meta key such as `account.owner_user_id` for the local dataset owner. A separate account table is unnecessary because the binding is local infrastructure, not user-editable domain data. The binding is never synced and is not inferred from remote rows.

### 2. Determine meaningful local data centrally

Add one account-data inspection path that counts active rows across all user-owned tables, reads the owner binding, and reads durable outbox owner IDs/count. UI and bootstrap consume this result instead of duplicating Restore V1's narrower emptiness check. Infrastructure-only `app_meta`, `sync_outbox`, and notification-action state do not make an otherwise empty device populated, but pending outbox rows always block account replacement.

### 3. Use an explicit coordinator and pure state reducer

Keep Supabase API wrappers in `lib/supabase.ts`; put product policy and transitions in a core account coordinator. A pure decision function receives local evidence and current session evidence and returns states such as `local_only`, `anonymous_ready`, `protected`, `recovery_required`, `legacy_owner_unknown`, `owner_mismatch`, or `account_conflict`. The coordinator persists a binding only after the decision permits it.

### 4. Never rebind populated data

If a binding exists and the session is absent or different, no anonymous session is created and no binding/outbox owner is rewritten. New synced mutations continue to enqueue under the durable binding owner, even while remote flush is paused. If no binding exists, legacy bootstrap may bind only when current-session and outbox evidence are compatible; multiple outbox owners remain a conflict.

### 5. Protect with `updateUser({ email })`, then verify the same UUID

For an anonymous current session, request the supported email-linking flow after checking the binding. On completion, refresh/re-read the authenticated user, require the original UUID to be unchanged, and leave all remote rows and outbox owner IDs untouched. An email already belonging to another user is a safe conflict, never a sign-in or merge fallback.

### 6. Recover with email OTP and `shouldCreateUser: false`

Use the current Supabase passwordless email API after verifying the device is empty and has no pending outbox. The request must explicitly disable account creation. Verify the OTP with a bounded six-digit input, cooldown, duplicate-request guard, generic failure copy, and no token logging. A successful session binds the empty local dataset to the returned user, then invokes the existing Restore V1 preview/import guard.

OTP is preferred over magic-link callback handling for V1 because it avoids a new cross-platform callback parser while remaining supported for email-change verification and passwordless sign-in. If the live project template or SDK cannot support this consistently, the plan records the exact configuration blocker rather than silently changing the safety model.

### 7. Gate sync and restore on the same owner

Before every flush, compare the current verified session UID, local owner binding, and each pending record's recorded owner. Any mismatch or missing session returns an explicit blocked result; records remain durable. Restore repeats the identity check immediately before remote preview and before import, and retains its empty-device-only entity scope.

### 8. Keep remote failure non-blocking for local work

Auth/network/configuration failures set a recoverable remote status but do not prevent SQLite reads/writes. Settings explains whether remote backup is unavailable, recovery is required, or another account is active. Raw UUIDs, JWTs, refresh tokens, OTPs, and internal Supabase errors are not shown or logged in normal product UI.

## Risks / Trade-offs

- Existing installations have no binding. → Use current session plus compatible outbox evidence for one-time legacy binding; with missing/ambiguous evidence, remain recovery-required rather than guessing.
- Email linking behavior and templates vary by Supabase project configuration. → Inspect the installed SDK definitions and live Auth settings, use only documented APIs, and keep the success check UUID-based.
- SQLite and Auth storage can disappear independently on web. → Treat the local binding as authoritative evidence and pause remote work whenever the session is missing.
- A user may continue making offline writes while locked. → Keep those intents owned by the existing binding and flush only after the correct identity returns.
- Native callback/deep-link environments may be unavailable. → The core state machine and OTP path are tested without real email; native infrastructure gaps are recorded as environment evidence.

## Migration Plan

1. Audit the current auth/bootstrap, outbox, restore, settings, and live Supabase Auth configuration; record the exact baseline in the ExecPlan.
2. Add the app-meta owner key, centralized data inspection, pure account-state decisions, and coordinator/provider integration without changing domain-row ownership.
3. Add Supabase API wrappers for session inspection, email protection, OTP recovery, verification, and safe error normalization; retain existing anonymous/local-only behavior.
4. Add Settings protection/recovery UI and restore-after-recovery orchestration with duplicate/cooldown guards.
5. Add state-machine, auth-flow, real-SQLite restart/outbox, restore, E2E, simulation, and focused security regression coverage.
6. Run affected and full QA, inspect/apply only required live Auth configuration, perform a disposable canary if safe, update docs and artifacts, then commit and push only `main` and verify GitHub CI.

## Rollback / Recovery

Application rollback is additive: remove the account coordinator/UI integration while retaining the app-meta key and outbox rows; no domain or remote ownership rows are rewritten. If Auth configuration is changed, restore the previous documented setting through the Dashboard/Management mechanism after capturing its prior value. Local data, binding, and outbox are never cleared as rollback steps.
