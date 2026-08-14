## Why

Supabase anonymous authentication gives each installation an owner-scoped backup, but the owner cannot currently recover that identity after a reinstall, cleared storage, sign-out, or device replacement. The bootstrap can therefore create a new anonymous owner while an existing local SQLite dataset remains present, which risks splitting future backup writes across users.

Recoverable Account V1 adds an explicit, fail-closed account boundary: a user may protect the current anonymous owner with a verified email identity, and a genuinely empty device may recover an existing identity without merging or silently reassigning local data.

## What Changes

- Persist a durable local dataset-owner binding and inspect all user-owned SQLite tables plus durable sync-outbox ownership before any account transition.
- Replace unconditional anonymous bootstrap with an account coordinator that distinguishes empty installs, healthy sessions, recovery-required session loss, legacy-owner uncertainty, and owner mismatch.
- Add Settings controls in **Backup / Sync / Restore** to protect an anonymous backup with email and to recover an existing account with email OTP or the supported equivalent.
- Use Supabase Auth identity linking for anonymous-to-permanent protection and verify that the Supabase user UUID and remote row ownership remain unchanged.
- Make existing-account recovery refuse account creation and refuse session replacement when meaningful local data or pending outbox work exists.
- Gate sync flush and Restore V1 on a verified session matching the local dataset owner; preserve outbox owner IDs during auth loss and mismatch.
- Add deterministic unit, real-SQLite integration, web E2E, simulation, and platform QA for session loss, wrong accounts, identity conflicts, recovery, and restore.
- Reconcile the account/backup documentation and record live Supabase Auth configuration and canary limitations without weakening existing RLS.

## Capabilities

### New Capabilities

- `recoverable-account`: Durable local ownership binding, safe anonymous-account protection, empty-device existing-account recovery, session-loss handling, account conflict behavior, and Restore V1 integration.

### Modified Capabilities

- None. Existing backup RLS, durable outbox, and Restore V1 contracts remain authoritative; this change adds the account boundary around them.

## Impact

- `core/auth/` or the repository-consistent account-coordinator location, `lib/supabase.ts`, `core/providers/AppProviders.tsx`, `core/db/appMeta.ts`, and `core/sync/` ownership gates.
- `features/settings/SettingsScreen.tsx` and its restore-preview orchestration, plus account-focused tests, E2E journeys, and deterministic simulation personas.
- No new Supabase data table and no backup-row ownership migration are expected. Live Auth configuration may require manual enabling of email auth/manual linking and approved redirect URLs.
