## Why

Gym / Workout V2 is complete, but its implementation currently lives on a
separate branch from newer repository-governance changes. The next release
candidate needs one canonical source tree whose runtime contracts, recovery
compatibility, native qualification path, and certification evidence all agree
with the shipped Gym behavior.

## What Changes

- Converge the completed Gym V2 branch onto the current `main` lineage without
  rewriting either historical branch or dropping planner/executor governance.
- Establish one current-runtime contract for schema v23, next migration slot
  24, Backup Scope 7, and frozen Scope-6 compatibility while preserving
  independent backup schema versioning and the existing owner/restore rules.
- Reconcile current guides, maps, QA impact metadata, Supabase reference
  schemas, and OpenSpec/ExecPlan records with source-of-truth code while
  retaining historical Scope-6 and earlier campaign statements where they are
  intentionally historical.
- Add a portable Android `e2e-test` build/install/identity path that preflights
  the documented emulator, diagnoses failures, and never reports an absent
  target as a pass.
- Add focused native Gym V2 persistence and durable-session lifecycle coverage
  using semantic Maestro interactions and current-source build identity.
- Re-prove Gym V2 backup, portable, restore, owner-binding, and Supabase
  contracts, investigate timing-sensitive browser/sync failures without
  weakening their assertions, and record exact-source local/remote evidence.

## Capabilities

### New Capabilities

- `release-contract-convergence`: Canonical runtime metadata, frozen recovery
  compatibility, and release evidence must agree across source, docs, backup,
  portable, Supabase, and validation tooling.
- `native-release-qualification`: An Android-capable workstation can build,
  install, identify, and run the current `e2e-test` app, including focused Gym
  V2 persistence and durable-session flows.

### Modified Capabilities

- None. Existing Gym V2 and recovery requirements remain the historical
  contracts being integrated and certified; this change adds release-level
  convergence and native qualification requirements around them.

## Impact

- Git branch history and OpenSpec/ExecPlan artifacts.
- `core/db`, `core/backup`, `core/portable`, `core/sync`, Supabase reference
  migrations/schema validation, and recovery integration tests.
- `scripts/qa-native*.mjs`, `.maestro/`, native QA documentation, and the QA
  impact map.
- Current-runtime documentation and CI/release evidence; no new production
  secrets, two-way sync, or unrelated product surface.
