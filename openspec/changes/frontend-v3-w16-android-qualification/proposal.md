---
schema: spec-driven
created: 2026-10-14
---

## Why

W12–W15 are complete on `frontend-v3-w12-w17-integration`. Frontend V3
tasks §16 requires **current-source** Android smoke on `Nitro_API_36` across the
shell, navigation, all six sections, capture, one modal and one keyboard form,
plus the broader current-source validation the impact map demands (`16.1`), with
`16.2` carrying the full validation ladder and residual classification into W17.

This host has the tooling (`Nitro_API_36` AVD, Android SDK with the API-36
x86_64 system image, Java 17, Maestro 2.9.0, `adb`), so W16 must make a real
on-device attempt from a clean committed source state and record
source-authenticated provenance — or, if a step genuinely cannot run, record a
precise `BLOCKED_EXTERNAL` with the exact unblock condition. It must not
substitute web success for native evidence, and must not certify an old APK.

## What Changes

- An exact-source, credential-free `e2e-test`-equivalent Android APK built from
  a clean committed tree, with recorded provenance (source SHA, profile, API/ABI,
  package id, version, APK SHA-256) so the installed artifact provably matches
  the integrated W12–W15 source.
- Execution of the repository's native lanes — smoke, persistence, lifecycle,
  reward, backup-v2 and portable-backup as the impact map requires — against the
  verified API-36 x86_64 target.
- Native UX corrections only where an on-device defect is reproduced, each with
  a new exact-source APK and a repeat of the affected flow.
- An honest native result matrix and, for anything that cannot run, an explicit
  external blocker with the required condition and resume command.

## Capabilities

### New Capabilities

- `android-current-source-qualification`: the contract for how an Android
  native result is proven — exact-source provenance, the executed flow matrix,
  the platform-specific UX checks, and the rule that an unavailable capability
  is classified rather than reported as a pass.

### Modified Capabilities

None. Native UX corrections, if any, change presentation or bridge behaviour
only; no domain, persistence, sync or backup contract is modified.

## Impact

- `.maestro/**` flow selectors only where the current W12–W15 source changed an
  accessible label (never weakening a flow).
- `docs/ui-ux/v3-audit/w16/*`, `docs/testing/native-e2e.md`,
  `docs/testing/known-gaps.md`.
- Any file a reproduced native defect traces to (narrow, tested fix).
- No `core/*` semantics, schema, migration, dependency or security-policy
  change; no production Supabase mutation; no app-store action.
