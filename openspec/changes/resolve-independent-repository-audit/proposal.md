## Why

The independent audit of `main` at `fb10d6ccfe66b54613c6fd22cb82da7dd7626e4f` established 20 defects and one conditional native-test isolation concern. Ownership, recoverable backups, session recovery, and validation can fail despite passing helper-level tests. This change provides one bounded resolution campaign and a durable handoff for a separate implementation session.

## What Changes

- Close SH-01 through SH-21 using the finding IDs and evidence in [audit-baseline.md](audit-baseline.md), with regression acceptance in [validation-matrix.md](validation-matrix.md).
- Protect imported ownership on every adoption path; correct per-record sync failure accounting, backfill races, and capped verification.
- Preserve published backup generations independently of mutable uploads, with an atomic publication boundary and compatible legacy restore readers.
- Preserve unsaved workout recovery, exercise identity, elapsed Focus time, retryable startup, coherent associations, idempotent parent/rule saves, atomic rescheduling, quest payment identity, and distinct notification occurrences.
- Generate service-worker revisions from exported shell content and prove a real old-to-new upgrade.
- Make simulation expectations fail closed and route API legs through the production data layer in an isolated test build.
- Resolve or explicitly retain dependency-security blockers; enforce hermetic cloud native builds and keep unavailable native/cloud validation visible.
- Reuse independently revalidated fixes already on PR #79/#80. Do not merge those PRs merely to obtain their source.
- **BREAKING (remote protocol, if selected):** immutable generation publication introduces a new remote storage/capability contract. It must not silently reinterpret existing V1/V2 manifests, mutable tables, Scope-6/7 payloads, or Portable V1 files. No production migration is authorized by this proposal.

This turn creates planning artifacts only. Product implementation begins only when the owner starts the resolution session using [START-HERE.md](START-HERE.md). That invocation reactivates this campaign's local engineering scope, not unrelated frozen work or release/deployment authority.

## Capabilities

### New Capabilities

- `published-backup-generations`: owner-scoped immutable recovery generations, bounded verification, safe staging, publication and retry invariants.
- `durable-user-operation-boundaries`: precise failure/retry/restart contracts for imported ownership, sessions, linked effects, associations, composed saves, rewards and notifications.
- `verification-evidence-integrity`: executable expectations, production-path simulation, content-derived PWA upgrades, hermetic native builds, and honest security/release evidence.

### Modified Capabilities

None. Existing requirements remain binding, particularly `backup-completeness-v2`, `productivity-expansion-hardening`, `gym-training-system`, `ui-ux-mass-wave-hardening`, and `user-simulation-platform`. The added specifications make the newly demonstrated boundary conditions explicit; they do not weaken existing contracts.

## Impact

Affected areas include `core/auth`, `core/sync`, `core/backup`, `core/portable`, `core/linked-actions`, notification dispatch, feature data/domain/screen orchestration, PWA export, simulation, dependencies, and native CI configuration. A new local migration is permitted only if justified after inspecting the chosen implementation base; migrations remain append-only. Remote schema changes are developed and verified only against an isolated disposable backend until separately authorized.

Implementation proceeds through the dependency-ordered packages in [design.md](design.md) and [tasks.md](tasks.md). [execplan.md](execplan.md) is the sole living campaign checkpoint. Completion requires a finding-by-finding evidence packet for independent review; successful planning or a green subset of tests is not resolution certification.
