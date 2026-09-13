# Design — Backup V2 closure: owner-scoped saved-meal uniqueness, transactional checkpoint coherence, settings-integrity-bound atomic restore

## 1. Finding 1 — saved-meal uniqueness

Local product semantic (authoritative): `saved_meals` has
`CREATE UNIQUE INDEX idx_saved_meals_food_name ON saved_meals
(food_name COLLATE NOCASE)` — case-insensitive uniqueness on food name, per
device. The remote V2 table declared `CONSTRAINT saved_meals_food_name_unique
UNIQUE (food_name)` — global across owners; RLS cannot make a uniqueness
constraint owner-scoped.

Remediation (new additive migration; the applied V2 migration is never
rewritten):

```sql
ALTER TABLE public.saved_meals
  DROP CONSTRAINT saved_meals_food_name_unique;
CREATE UNIQUE INDEX IF NOT EXISTS uq_saved_meals_owner_food_name
  ON public.saved_meals (user_id, lower(food_name));
```

`lower(food_name)` matches the local `COLLATE NOCASE` semantic for the ASCII
range (both fold A–Z); document that as the agreed semantic. The owner column
is already `NOT NULL DEFAULT auth.uid()` — an owner is always present, so the
expression index is total.

Sync semantics are unchanged and stay consistent: the generic adapter upserts
saved-meal rows by `onConflict: 'id'`; the local upsert coalesces per-device
by `(food_name COLLATE NOCASE)`, so one owner can never legitimately hold two
rows whose `lower(food_name)` collide — normal save/update evolution cannot
produce an owner-scoped upsert conflict. Hard delete/recreate uses a new id
and the same owner, so it cannot conflict either. The restore-time duplicate
check already enforces case-insensitive food-name uniqueness per backup (one
owner per backup), matching the new remote contract.

RLS stays the security boundary (4 owner policies, authenticated only, no
anon/PUBLIC); the uniqueness constraint only prevents same-owner duplicates.

## 2. Finding 2 — transactional checkpoint coherence

Old timeline (defective):

```
flush → queue empty? → compute snapshot → queue empty? → [GAP]
→ transaction { save pending manifest; clear dirty; enqueue manifest }
→ flush manifest
```

A mutation committing in `[GAP]` leaves remote data newer than the manifest
hashes with `dirty` cleared.

New timeline:

```
1. ensure backfill
2. flush current data queue (outside transaction; failure → stop, previous
   manifest stays)
3. open ONE serialized/exclusive SQLite transaction and inside it:
   a. re-read durable outbox → non-empty ⇒ abort publication (defer)
   b. verify backup.dirty
   c. compute canonical per-entity snapshot (counts + SHA-256)
   d. re-read durable outbox → non-empty ⇒ abort publication (defer)
      (defense-in-depth + deterministic test barrier)
   e. capture settings snapshot (SQLite app_meta + AsyncStorage theme read)
   f. persist backup.pending_manifest (with settingsMetadata) and
      backup.pending_settings
   g. enqueue user_backup_settings record, then backup_manifest record
   h. clear backup.dirty — ONLY as part of this coherent transition
4. commit
5. flush (settings pushed before manifest; manifest push re-verifies the
   pending settings checksum and upserts settings before the manifest)
6. on confirmed remote push: record backup.last_complete_generation
```

No network I/O ever happens inside the transaction. On native,
`withExclusiveTransactionAsync` blocks concurrent writers; on web the shared
per-db transaction tail serializes all transactional writers — the in-
transaction rechecks are the portable guarantee. Any abort leaves the
previous remote manifest intact, `dirty` untouched, and the new manifest
record absent — retry happens on the next cycle. Crash after commit before
remote push leaves the manifest record durable in the outbox; the next cycle
flushes it. Crash after remote push before the local last-complete marker is
reconciled by the cycle (pending manifest generation > recorded generation ⇒
record it).

## 3. Finding 3 — settings restore atomicity

### 3.1 Fetch order

Restore V2 performs ALL remote material fetching — manifest, every entity
page, AND `user_backup_settings` — before any local write. A new helper
`fetchRemoteRecoverableSettings(ownerUserId)` returns the single owner-scoped
settings row and treats every PostgREST `{ error }` (including
`{ data: null, error: {...} }`) as a restore failure.

### 3.2 Settings validation matrix (pre-transaction)

| Condition                                                        | Result                                                              |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| manifest settingsVersion/`settingsMetadata` present, row missing | `invalid` — incomplete backup                                       |
| settings query `{ error }`                                       | `invalid` — fetch_failed                                            |
| `settings_version` unsupported                                   | `invalid` — unsupported version                                     |
| payload fails runtime normalization/boundedness                  | `invalid` — validation_failed                                       |
| canonical checksum ≠ manifest `settingsMetadata.checksum`        | `invalid` — integrity_mismatch                                      |
| v2 manifest without `settingsMetadata`                           | `invalid` — incomplete manifest (no settings integrity certifiable) |

Legacy V1 (no manifest) keeps the V1 path — unchanged.

### 3.3 Settings integrity contract

`backup_manifest` gains `settings_metadata JSONB` =
`{ version: number, checksum: string }` (additive migration column).
`settings_version` remains. `BACKUP_SCHEMA_VERSION` stays 2: live production
holds ZERO manifest/settings rows (verified), so this is a safe additive
extension of the v2 wire contract; the app treats a v2 manifest without
`settingsMetadata` as incomplete.

Checksum: canonicalize the normalized allowlisted payload
(`canonicalizeSettingsPayload` in `lib/checksum.ts`): fixed allowlist shape,
explicit null defaults for absent keys, sorted object keys, `undefined` →
`null`, JSON-stringify, SHA-256 via the existing pure-TS implementation —
deterministic across node/web/native. `user_id`, remote `updated_at`, auth
and sync data are excluded by construction (only the allowlisted contract is
hashed). JSONB key-order normalization on the remote is neutralized because
both capture and verify re-canonicalize parsed objects.

### 3.4 Generation-bound settings upload

Settings are snapshotted at enqueue time into app_meta `backup.pending_settings`
(continuous saves and checkpoint capture both do this). The adapter pushes
`user_backup_settings` from the stored snapshot, never a fresh read. In the
checkpoint flush the settings record precedes the manifest record; the
manifest push verifies the pending snapshot's checksum equals the manifest's
certified checksum and (re)upserts settings immediately before the manifest
upsert — settings-G remote before manifest-G authoritative. A newer settings
save after capture changes the pending snapshot; the manifest push then
defers (record stays queued) until a later checkpoint certifies the newer
settings, so a manifest never certifies a settings payload that was not
uploaded for that generation.

### 3.5 No network inside the restore transaction

Once the Restore V2 import `withSQLiteTransaction` starts, no
`supabase.from(...)` / `fetch(...)` / network client call executes inside the
mutation callback. All remote material (including settings) is already
fetched and validated; identity is reverified immediately before the
transaction; inside the transaction only durable local state is read/written
(owner binding, emptiness, app_meta) exactly as today.

### 3.6 Cross-store settings recovery (theme / AsyncStorage)

SQLite settings (calorie goal, pomodoro defaults) participate directly in the
import transaction. Theme (mode + slots, AsyncStorage) cannot be
transactional with SQLite: inside the import transaction the validated theme
payload is written to app_meta `backup.pending_theme_apply`
(`{ mode, slots, signature }`). After commit, `applyPendingThemeApplication()`
writes AsyncStorage and clears the marker only on success. If it fails
(crash, storage error), the marker remains durable; AppProviders bootstrap
maintenance retries until complete. This is explicit two-phase durable
reconciliation — not a fire-and-forget claim of cross-store atomicity.

## 4. Schema validator

`scripts/validate-supabase-schema.mjs` additionally asserts:

- the remediation migration drops `saved_meals_food_name_unique` and creates
  the owner-scoped `(user_id, lower(food_name))` unique index;
- no migration after the ownership fence reintroduces global
  `saved_meals` food-name uniqueness;
- the remediation migration adds `backup_manifest.settings_metadata`;
- `simulation/backend/schema.sql` mirrors both;
- RLS/grants contract unchanged (the previous bad DDL now fails validation).

## 5. Test matrix

Unit: settings canonicalization vectors, manifest parsing with
`settingsMetadata`, version compatibility. Integration (real SQLite +
recording/stub Supabase): checkpoint race matrix A–H; settings fetch
error/missing/malformed/checksum/version failure → zero imported rows;
theme-apply failure → durable pending marker → restart retry; no-network
inside transaction (assert zero `supabase.from` calls between transaction
start and commit via a throwing stub); cross-owner saved-meal reproduction at
the data contract level; full source→restore semantic equivalence with
settings integrity. Web E2E: restore blocked on settings fetch error and
checksum mismatch; V2 restore completes with settings; new-phone-v2 journey
stays green. Simulation: LONG-TERM USER disaster-recovery scenario now covers
settings integrity.
