## Purpose

Define a recoverable, owner-preserving account boundary for the offline-first
SQLite dataset and its optional Supabase backup.

## ADDED Requirements

### Requirement: Anonymous use remains local-first and recoverable

The application MUST continue to allow ordinary anonymous or local-only use without forcing email protection. Remote authentication or network failure MUST NOT prevent ordinary local reads and writes. When Supabase is not configured, the account surface MUST explain that remote backup is unavailable without throwing or requiring account setup.

#### Scenario: Empty install uses an anonymous owner when remote backup is configured

- **WHEN** the local dataset is empty, there is no owner binding, and Supabase is configured
- **THEN** the application MAY create one anonymous session and bind the empty dataset to that session without prompting for a permanent identity.

#### Scenario: Remote outage does not block local use

- **WHEN** Supabase authentication or the network is unavailable
- **THEN** local features remain readable and writable, while remote backup is reported as unavailable or recovery-required.

### Requirement: Fresh anonymous installations claim ownership provisionally

A pristine device whose dataset is still empty MUST claim the dataset for the current temporary anonymous session as a REPLACEABLE (provisional) owner as soon as anonymous authentication succeeds. The FIRST meaningful local user content — in any user-owned table, including local-only tables such as pomodoro sessions, workout history, habit completions, saved meals, or linked-action rules — MUST promote that claim to a permanent owner binding. A provisional claim MUST be replaceable by Recover Existing ONLY while the dataset is pristine (no user content, no pending outbox); a promoted binding MUST NOT be replaceable.

#### Scenario: Pristine install binds a replaceable provisional owner

- **WHEN** a fresh configured install authenticates an anonymous session A and the dataset has no content
- **THEN** the dataset is bound to A as a provisional owner, Recover Existing remains available, and no outbox row is ever created ownerless.

#### Scenario: First meaningful local content promotes the claim

- **WHEN** the user commits ANY first meaningful local state (for example a pomodoro session) on a provisionally bound device
- **THEN** the binding is durably promoted to permanent and Recover Existing is no longer offered or allowed for that dataset.

#### Scenario: Local-only-first activity cannot strand later synced writes

- **WHEN** the user's first activity is local-only (pomodoro, workout history, habit completion, saved meal, or linked-action rule) and a synced write follows
- **THEN** the synced outbox record MUST be owned by the original anonymous UID and remote flush MUST succeed under that UID without an ownerless queue.

#### Scenario: Session loss before any content starts a fresh temporary anonymous session

- **WHEN** a pristine provisionally bound device loses its session
- **THEN** the application MAY create a fresh temporary anonymous session and replace the provisional claim, because a pristine device has no remote rows under the old temporary UID; a populated dataset MUST NOT be treated this way.

### Requirement: The first synced write is never ownerless on a configured install

On a normal configured fresh anonymous installation, the first synced entity write MUST carry a real durable owner (the provisional or promoted anonymous owner) in its outbox record. The application MUST NOT emit `owner_user_id = NULL` outbox work on such an install, and MUST NOT assign a new anonymous identity to populated data after session loss.

#### Scenario: First Todo owns its outbox record

- **WHEN** a fresh anonymous install creates its first Todo
- **THEN** the outbox record and dataset binding both belong to the anonymous UID and the sync adapter accepts the flush.

### Requirement: Account protection validates ownership, not dataset immutability

Protection verification MUST validate immutable identity/ownership facts only: the final verified UID equals the captured original UID; the account is no longer anonymous; the local dataset owner remains the original UID; every non-null durable outbox owner equals the original UID; and remote rows visible to the user remain owned by the original UID. Protection MUST NOT require the pending outbox count, remote row counts, or updated timestamps to stay frozen while the OTP is pending: legitimate user writes, linked-action cascades, and background sync MUST NOT invalidate a successful identity conversion.

#### Scenario: New local writes while the code is pending do not invalidate protection

- **WHEN** the user creates synced content while protection is pending and then verifies the correct code with the same UID
- **THEN** protection succeeds and every new outbox record remains owned by the original UID.

#### Scenario: Background sync while the code is pending does not invalidate protection

- **WHEN** the outbox drains and remote row counts grow while protection is pending and the correct code is then verified
- **THEN** protection succeeds because ownership evidence is unchanged.

#### Scenario: A foreign owner appearing while pending fails closed

- **WHEN** any outbox or remote owner other than the original UID appears while protection is pending
- **THEN** protection MUST fail closed, the unsafe session MUST be cleared, and no owner MUST be rewritten.

#### Scenario: Post-verification terminal failures clear the pending record

- **WHEN** identity conversion succeeded remotely but a post-verification ownership check fails (or evidence cannot be fetched)
- **THEN** the pending protection record MUST be terminated (never left as a stale unverified loop across restart), a diagnostic record is preserved, and the local dataset keeps its original owner.

### Requirement: Native auth sessions persist durably across restarts

On Android and iOS the Supabase Auth client MUST persist sessions in durable native storage (AsyncStorage or another deliberately chosen supported native store), MUST auto-refresh tokens, and MUST restore the SAME user identity after a process restart. Storage selection MUST be platform-first: the platform abstraction decides native vs web, and a browser-window check applies only within the web platform to distinguish an in-browser session from the static export/SSR build. The static export MUST never touch native-only or browser-only storage APIs at runtime.

#### Scenario: Native process restart restores the same anonymous session

- **WHEN** a native app establishes anonymous session A, is force-stopped, and relaunched
- **THEN** the app restores session A without creating a second anonymous user and the account coordinator reports the same owner state.

#### Scenario: Static web export stays storage-safe

- **WHEN** the web app is statically exported or server-rendered without a browser or native runtime
- **THEN** the Auth client uses an SSR-safe no-op storage and does not crash on missing `window` or `localStorage`.

### Requirement: The local dataset has one durable owner binding

The application MUST persist a local-only binding between the SQLite dataset and one Supabase user UUID. The binding MUST NOT be synced as user-editable data, and account protection MUST NOT require rewriting local entity rows.

#### Scenario: A healthy bound session remains healthy across restart

- **WHEN** the persisted owner is A and the verified current session is A
- **THEN** the coordinator reports a healthy remote state and retains the binding and durable outbox records unchanged.

#### Scenario: Local data is not rebound to a new anonymous UUID

- **WHEN** a populated dataset has an owner binding but its session disappears
- **THEN** the application MUST NOT create or bind a new anonymous user to that dataset.

### Requirement: Account bootstrap decisions are evidence-based

The application MUST inspect all user-owned local tables, the owner binding, and durable sync-outbox owner IDs through one deterministic account-data inspection path. The inspection MUST include at least todos, habits, habit completions, pomodoro sessions, workout routines and nested workout/session rows, workout logs, calorie entries, saved meals, linked-action rules/events/executions, active/deleted data semantics, pending outbox count, and outbox owner IDs. Infrastructure-only metadata MUST NOT be treated as user content.

#### Scenario: Legacy data with a compatible session is bound once

- **WHEN** user data exists, no binding exists, a verified session A exists, and every durable outbox owner is empty or A
- **THEN** the coordinator MAY establish binding A without changing local entity rows or outbox owners.

#### Scenario: Multiple historical owners fail closed

- **WHEN** the binding is absent and the durable outbox contains owner IDs A and B
- **THEN** the coordinator MUST report an account conflict and MUST NOT guess a binding or create a new anonymous owner for the dataset.

#### Scenario: No evidence remains unresolved

- **WHEN** user data exists, no binding exists, and no current session or compatible outbox owner exists
- **THEN** the coordinator MUST report legacy-owner recovery required and MUST NOT silently bind a new session.

### Requirement: Session loss pauses remote work without destroying local state

When meaningful local data or a durable owner binding exists and no verified session is available, the application MUST enter a recovery-required state. It MUST preserve local rows, the owner binding, and all pending outbox rows; it MUST allow offline local mutations; and it MUST prevent remote flush and Restore V1 until the correct account returns.

#### Scenario: A new offline Todo remains owned by the previous account

- **WHEN** owner A is bound, the session is absent, and the user creates a synced Todo offline
- **THEN** the outbox record MUST retain owner A and MUST remain pending until session A is restored.

#### Scenario: Correct recovery resumes the queue

- **WHEN** the verified session returns as A and the binding is A
- **THEN** recovery-required status clears, the durable queue is retained, and remote sync MAY resume without an ownership migration.

### Requirement: Owner mismatch fails closed

If meaningful local data or a binding for A exists while the verified current session is B, the application MUST report owner mismatch. It MUST keep local reads/writes available, MUST pause remote flush and Restore V1, MUST NOT rewrite the binding or outbox owner IDs, and MUST explain that the user should sign back into the account that owns the device backup. Raw UUIDs MUST remain hidden from normal UI.

#### Scenario: A populated device cannot silently become account B

- **WHEN** the local dataset belongs to A and a session for B is presented
- **THEN** the app remains locally usable but no local mutation is assigned to B remotely and no account merge or deletion is offered.

#### Scenario: Outbox owner mismatch blocks flush

- **WHEN** a pending outbox record is owned by A and the verified session is B
- **THEN** flush MUST be denied explicitly, the record MUST remain durable, and its owner MUST remain A.

### Requirement: Anonymous account protection preserves identity and ownership

For a current anonymous user with a compatible local owner binding, the application MUST offer protection by linking a verified email identity using the supported Supabase Auth flow. It MUST capture the original UUID, require verification, and after completion require that the resulting UUID equals the original UUID. Existing backup row owners, local binding, and outbox owner IDs MUST remain unchanged.

#### Scenario: Anonymous account is protected successfully

- **WHEN** an anonymous user submits a valid new email, completes verification, and Supabase returns the original UUID
- **THEN** the account is shown as protected/recoverable and all existing backup ownership remains on that same UUID.

#### Scenario: Unexpected UUID change fails closed

- **WHEN** the post-verification user UUID differs from the captured original UUID
- **THEN** protection MUST fail closed, remote sync MUST remain paused, and no binding or outbox owner MUST be rewritten.

#### Scenario: Email conflict does not switch accounts

- **WHEN** anonymous user A attempts to protect with an email already belonging to permanent user B
- **THEN** the app MUST show an explicit conflict, remain on A, and MUST NOT sign into B, merge data, transfer rows, or rewrite ownership.

### Requirement: Recover Existing does not create accounts

The existing-account passwordless request MUST use the current Supabase equivalent of `shouldCreateUser: false` and MUST treat unknown or mistyped email addresses as safe failures. The UI MUST use bounded input, in-flight guards, resend cooldown/expiration messaging, generic account-not-found-safe errors, and MUST NOT log OTPs, JWTs, refresh tokens, or raw auth internals.

#### Scenario: Unknown email does not create a permanent user

- **WHEN** an empty device requests recovery for an unknown email
- **THEN** no new permanent user is created and the user receives a retryable generic failure or non-enumerating response.

#### Scenario: Invalid or expired OTP does not mutate local state

- **WHEN** the user enters an invalid or expired six-digit OTP
- **THEN** no recovered session or owner binding is established, and retry remains available without changing local data.

### Requirement: Successful recovery binds the existing account and preserves Restore V1 guards

After successful existing-account authentication, the application MUST bind the empty local dataset to the recovered verified UUID, recheck identity before remote access, query only owner-scoped backup data, and invoke the existing Restore V1 preview/import safeguards. Restore MUST remain empty-device-only and MUST import only its currently supported entity scope.

#### Scenario: Recovered account exposes its owner-scoped backup

- **WHEN** an empty device authenticates as protected account A
- **THEN** the local binding becomes A, the Restore V1 preview can see only A's backup, and the existing empty-device import flow remains in control.

#### Scenario: Restore cannot overwrite newly populated local data

- **WHEN** local data appears after authentication but before restore import
- **THEN** Restore V1 MUST recheck emptiness and refuse the import without deleting or overwriting local data.

### Requirement: Account UI communicates remote identity safely

Settings MUST expose Account/Backup protection state inside the existing Backup / Sync / Restore bucket, including unprotected, protected, recovery-required, owner-mismatch, remote-disabled, and not-configured distinctions where applicable. Normal UI MUST not expose raw UUIDs, tokens, service-role material, or sensitive provider internals.

#### Scenario: Recovery-required state gives actionable guidance

- **WHEN** a bound dataset has no matching session
- **THEN** Settings explains that the local data belongs to a protected/previous backup account, pauses remote backup, and offers sign-in to recover without offering account switching or data deletion.

### Requirement: Existing owner-scoped remote security remains intact

The client MUST continue to use the authenticated Supabase session for remote operations, and remote backup rows MUST remain constrained by the existing `auth.uid() = user_id` RLS contract. This feature MUST NOT weaken RLS, transfer ownership rows, or require a separate profile/account mapping table.

#### Scenario: Protection leaves remote owners unchanged

- **WHEN** an anonymous account is protected and the UUID-preservation checks pass
- **THEN** pre-existing remote rows retain their original `user_id`; row COUNTS are mutable diagnostics (they may grow or shrink through legitimate sync) and MUST NOT be treated as a security fingerprint.

## MODIFIED Requirements

### Requirement: Existing-account recovery is empty-device-only

The Recover Existing flow MUST inspect local account data before authentication and MUST proceed only when there is no meaningful user data and no pending outbox. A replaceable provisional owner binding on a pristine device does NOT block recovery; any promoted (permanent) binding or any committed content DOES. It MUST NOT delete local data, merge datasets, or provide a sign-in-anyway bypass on a populated device.

#### Scenario: Empty device can start recovery

- **WHEN** the local dataset has no meaningful user data, the outbox is empty, and any owner binding is provisional/replaceable
- **THEN** the user may request recovery of an existing protected account, and after verified authentication the provisional owner is replaced by the recovered account.

#### Scenario: Populated device cannot replace its account

- **WHEN** meaningful local data or pending outbox work exists
- **THEN** Recover Existing MUST be blocked before session replacement with copy that account switching and merging are not supported.
