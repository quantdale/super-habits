# Design — Portable V1 closure: imported-owner recovery, native pre-read size bound, export/import size contract

## 1. Finding 1 — imported-owner recovery

### 1.1 The dead end

After an owner-backed portable import on an unclaimed device:

- local user data exists (`hasUserData === true`);
- local owner binding is `null` (provisional anonymous binding dropped);
- import-origin fingerprint `portable.last_import_owner_fingerprint = FP(A)`;
- a temporary anonymous Auth session T may still be signed in.

`decideAccountState()` already fails closed (import-origin gate blocks any
nonmatching verified account and reports the imported-origin message), but
`canRecoverExisting` requires a pristine replaceable device and
`canRecoverOwner` requires a permanent binding — so
`AccountCoordinator.requestRecovery()` rejects the only correct action.

### 1.2 Imported-owner state and eligibility

New explicit capability `canRecoverImportedOwner` (option A; not an overload
of `canRecoverOwner`, which means permanent-owner sign-back-in). Narrow
eligibility, ALL of:

1. `local.hasUserData === true`;
2. `local.ownerBinding === null`;
3. import-origin owner fingerprint exists (`readPortableImportOriginFingerprint()`
   returns a non-null value — the literal `'null'` storage encoding of a
   local-only source file maps to `null` and is therefore excluded);
4. fingerprint is a valid 64-hex string;
5. no owner-bound outbox rows exist (`outboxOwnerIds.length === 0`) — no
   conflicting outbox state;
6. the dataset was produced by validated Portable Import V1 (the durable
   fingerprint key IS that proof; it is only written inside the import
   transaction).

This is NOT generic populated-device account switching. It never applies to:
arbitrary legacy unbound local data (no fingerprint key), local-only portable
imports (stored `'null'`), populated owner-B devices, conflicting outbox
state, or any other populated device.

### 1.3 Pending recovery contract

`PendingRecovery` gains `expectedOwnerFingerprint: string | null` alongside
`expectedOwnerUserId`. Exactly one is set:

- owner recovery → `expectedOwnerUserId = local.ownerBinding`;
- imported-owner recovery → `expectedOwnerFingerprint = FP(A)`;
- pristine fresh recovery → both null.

The persisted record survives restart, and `reconcile()` keeps surfacing
`sign_in_pending` while the record matches the current eligible state.

### 1.4 requestRecovery rule

`requestRecovery(email)` accepts the imported-owner state:

- `importedOwnerEligible` computed from the same narrow invariants;
- bypasses the "device must be empty" rule ONLY when eligible;
- `expectedOwnerUserId` stays null; `expectedOwnerFingerprint = FP(A)`;
- the temporary-session remote-footprint gate applies (same as fresh
  recovery, because there is no permanent binding): if the current verified
  session has remote backup rows → `account_conflict`; if the remote check
  fails → retryable `remote_unavailable`; if no session → no gate.
  This gate never applies to the file import itself (import stays
  offline-capable); it runs only when the user later authenticates A.

### 1.5 Verification rule (CRITICAL)

After OTP authentication obtains the VERIFIED Supabase UID:

```
portableOwnerFingerprint(verifiedUid) === pending.expectedOwnerFingerprint
```

- EXACT match → bind the populated imported dataset permanently
  (`bindLocalDatasetOwner(db, verifiedUid, { adoptUnownedOutbox: true })`),
  clear the pending record, trigger `ensureBackupBackfill()` (best-effort)
  so the imported state is enqueued under A; status `protected`.
- MISMATCH → sign out the newly authenticated session, leave local data
  untouched, leave owner unbound, preserve the source fingerprint, return
  `owner_mismatch`. Never rewrite the fingerprint, never attach imported
  data to B, never clear the dataset, never merge.
- Pre-OTP and post-OTP re-checks mirror the request-time eligibility; any
  drift (dataset changed, owner appeared, outbox conflict) signs out and
  fails closed.

### 1.6 Fingerprint is not authentication

The portable file checksum/fingerprint is NOT a digital signature and never
authenticates anyone. Authentication happens only when Supabase verifies the
account. The binding decision is: verified UID → deterministic fingerprint →
compare with the imported fingerprint. The file can never set
`account.owner_user_id`.

### 1.7 Temporary anonymous session T

Before switching from T to A, the existing Recoverable Account safety rule is
preserved: if T has remote backup rows, the switch is an `account_conflict`
(no silent orphan/merge); if T has no rows, authentication of A is allowed;
if the remote cannot be queried, a retryable `remote_unavailable` is
returned. Portable import itself never requires this check.

### 1.8 Post-bind cloud backup

Import already reset the V2 backfill markers and set `backup.dirty = 1`
(never claiming completeness). After a successful matching bind, the
coordinator triggers `ensureBackupBackfill()`: the imported rows + settings
are durably enqueued under A, and a fresh V2 checkpoint can only record
completeness after an actual remote push.

### 1.9 Import-origin metadata lifecycle

`portable.last_import_owner_fingerprint` is RETAINED after a successful
matching bind as diagnostics. It is inert once bound: every fingerprint-gated
branch in `decideAccountState()` runs only while `local.ownerBinding ===
null`. Retention is simpler than an atomic clear and cannot interfere with
future state.

### 1.10 Settings UX

`SettingsAccountCard` exposes a recovery action when
`canRecoverImportedOwner`:

- Title: "Imported backup account required".
- Body: "This dataset was imported from another device and belongs to a
  protected Super Habits backup account. Sign in with the account that
  created the portable backup to enable cloud backup."
- Input: "Protected account email"; button "Send sign-in code".
- No raw UUID or fingerprint is shown; it is never called account merging.

## 2. Finding 2 — native pre-read size bound

Verified against installed SDK 55 type definitions (not memory):

- `expo-document-picker` `DocumentPickerAsset.size?: number` — document size
  in bytes from the picker result;
- `expo-file-system` `File.size` (read-only property) and
  `File.info(): FileInfo` with `size: number` (0 when the file does not
  exist or cannot be read) — metadata only, no body read.

Native pipeline becomes:

```
DocumentPicker
→ asset.size known and > max?       → reject WITHOUT reading the body
→ else File(asset.uri).size/info()  → size > max? → reject WITHOUT reading
→ size unverifiable (0/throws)?     → conservative typed rejection
→ file.text()                       → bounded by the pre-read checks
→ actual UTF-8 byteLength > max?    → post-read rejection (2nd defense)
→ continue
```

A valid portable backup is never empty (the envelope JSON alone is hundreds
of bytes), so an unverifiable/zero metadata size is a safe conservative
failure, never an unlimited read. The post-read actual UTF-8 verification
remains because metadata may under-report.

## 3. Finding 3 — export/import round-trip size contract

One shared constant `PORTABLE_V1_MAX_BYTES = 100 * 1024 * 1024` replaces
`PORTABLE_IMPORT_MAX_BYTES` everywhere (web import, native import, export
eligibility, tests, UI copy). The 100 MB value is retained: the measured
long-term fixture is ~5.15 MB for 18,127 rows (decades of heavy use), the
import path already bounds transient memory to ~2× file size, and the new
pre-read guards prevent unbounded allocation.

Export flow: serialize → UTF-8 byte length → `byteLength <=
PORTABLE_V1_MAX_BYTES` → success; otherwise a typed result
`{ ok: false, reason: 'too_large', byteLength, maxBytes, error }` with UI
copy "Your dataset is larger than Portable Backup V1 can safely package."
(current/supported size as optional secondary detail). No file is presented;
no data is truncated or omitted; cloud backup is unaffected.
