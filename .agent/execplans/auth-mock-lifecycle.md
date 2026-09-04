# ExecPlan: Wave 2 — Auth-Mock Lifecycle Automation

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Replace manual auth-lane shell choreography (mock start, lifetime, reverse,
mock-URL build, cleartext patch, env, lane, proof, teardown) with one owned
finite command: `qa-native.mjs --auth-mock` extended in place, so the auth
lane is reproducible with per-run mock-request proof and no stale processes.

## Context

- Mock: `scripts/native-auth-mock-server.mjs` (port default 4545, OTP
  123456, `[mock]` log lines, no external I/O). No `/health`; readiness =
  `GET /rest/v1/` → 200.
- Lane: `--tag auth-persistence` (01-first clearState → killApp,
  02-restart, 03-protect; filename order is the contract).
- App reads `EXPO_PUBLIC_SUPABASE_URL`/`_ANON_KEY` (`lib/supabase.ts`);
  device URL `http://localhost:<port>` + `adb reverse` keeps traffic on
  device loopback. Anon key: `mock-anon-key-for-tests-only` (mock ignores
  it; predecessor proved opaque mock tokens work).
- Provisioner self-executes on import: pure helpers live in
  `scripts/native-avd.mjs` (importable/testable), never in the provisioner.
- Provenance separation is load-bearing: mock builds write
  `native-android-build-mock.json` (`buildKind: 'test-only'`) and NEVER
  touch the canonical file; canonical mode NEVER accepts a test-only
  build (enforced in `metadataMatches`).
- Predecessor manual proof per green run: exactly 1 signup, same UID,
  verify preserves UID, 0 unauthenticated checks.

## Scope

- `native-avd.mjs`: `parseMockLog`, `assertMockProof`,
  `addCleartextAttr` (pure) + unit tests.
- Provisioner: `--mock-auth-url` (mock env, test-only cleartext patch in
  gitignored `android/`, mock metadata file, loud TEST-ONLY logging).
- Runner: `--auth-mock`, `--auth-mock-port`, `--build-metadata`;
  owned mock child + bounded readiness + stale-port refusal; per-target
  reverse/verify/remove; mock-aware provision + metadata selection;
  per-target log-slice proof; TEST-ONLY records with mockState;
  finally-level teardown (reverse removed, mock dead, port closed).
- Certification: auth lane 3/3 with mock proof, at least twice, on Nitro.

## Non-Goals

Multi-target+mock composition beyond sequential reuse (works by
construction; certified single-target); disposable-backend/real-Supabase
coverage; changing mock protocol or app auth code without new evidence.

## Current Checkpoint

- Current milestone: COMPLETE — `--auth-mock` productized, auth
  3/3 ×2 with full proof on Nitro, install-only verified live,
  provenance separation audited clean.
- Completed: audit + all implementation + verification (see
  Progress and Validation Ledger).
- In progress: none.
- Important modified files: `scripts/native-avd.mjs`
  (`parseMockLog`, `assertMockProof`, `addCleartextAttr`,
  `reverseSpecPresent`), `tests/nativeAuthMock.test.ts` (new, 6
  tests), `scripts/qa-native-provision.mjs` (`--mock-auth-url`,
  TEST-ONLY env + cleartext patch, separate mock metadata file),
  `scripts/qa-native.mjs` (`--auth-mock/--auth-mock-port/
--build-metadata`, owned mock child + bounded readiness +
  stale-port refusal, per-target reverse lifecycle, per-target
  log-slice proof, TEST-ONLY records, finally-level teardown).
- Last successful validation: Wave 1 closure (Nitro + CRBABot 2/2 @45dc256).
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- 2026-09-04 — self-review catch before the fix even ran: the
  committed `ensureInstalled` kept an early trust return when
  build+installed both matched, preserving the exact staleness
  hole (proven by the next dead run skipping install-only
  entirely). Corrected to always (re)install the verified host
  APK when the host build matches; only `--no-provision` keeps
  legacy trust-the-device behavior.
- Remaining definition of done: Complete — see Progress; plan
  validated; commits pushed.

## Progress

- [x] Workstream plan opened; audit complete.
- [x] Pure helpers + unit tests (6/6 + 8/8 green; typecheck 0).
- [x] Provisioner `--mock-auth-url` + mock metadata + cleartext patch.
- [x] Runner `--auth-mock` lifecycle + proof + TEST-ONLY records.
- [x] Auth 3/3 ×2 with proof on Nitro (install-only, APK
      5642673B, reports 051734202Z + 052007449Z,
      signup=1/put=1/unauth=0/same-UID/verify); hygiene verified
      (adb empty, ports closed, tree clean, canonical metadata
      untouched).
- [x] Plan validated; committed/pushed; COMPLETED.

## Surprises & Discoveries

- 2026-09-04 — First live `--auth-mock` run (Nitro) built the
  TEST-ONLY APK correctly (BUILD SUCCESSFUL, cleartext patch,
  separate mock metadata) but exposed two runner bugs before any
  lane ran: (1) `buildKindOk` was a stale pre-provision const, so
  the fresh test-only build was rejected as identity-mismatched —
  moved inside `metadataMatches()`; (2) `ChildProcess.exitCode`
  polling under event-loop-blocking sleeps never observes exits,
  so mock teardown always reported failure (the kill itself
  worked; port closed, pid gone) — replaced with synchronous
  OS-level `isPidAlive` probes (tasklist / kill -0) + unit tests.
  Reverse establish/remove, owned emulator stop, and the empty
  mock-proof honesty path all behaved correctly in the same run.

## Decision Log

- 2026-09-04 — Extend `qa-native.mjs` with `--auth-mock` (no separate
  auth script): single owned command, reuses boot/lane/stop/provenance,
  composes with `--avd` sequentially (prompt Wave 1 + Wave 5 rule).

## Validation Ledger

- 2026-09-04 — `vitest run --project unit
tests/nativeAuthMock.test.ts tests/nativeAvd.test.ts` — 14/14
  PASS; `typecheck` 0; `--help` probes for both scripts PASS.
- 2026-09-04 — first live `--auth-mock` (Nitro): TEST-ONLY build
  PASS (APK D86B7B97 @9bbd48c, mock metadata file), reverse +
  emulator cleanup correct, proof honestly empty (no lane ran);
  BLOCKED by the two runner bugs above (both fixed, 15/15 tests).
- 2026-09-04 — second live run: lifecycle fully owned (mock +
  reverse + TEST-ONLY build DE74F582 + lane + teardown with port
  closed); 01/02 PASS, 03 FAILED at the OTP sheet with
  signup=1/unauth=0/same-UID but no verify and no PUT/OTP in the
  mock log. Root-caused to mock infidelity (PUT /user silently
  swallowed as `{}`) compounded by `localhost`-vs-`127.0.0.1`
  nondeterminism vs predecessor's proven literal URL. Fixes:
  device URL → 127.0.0.1; explicit PUT handler returning the
  user; universal request logging; PUT gate in the proof
  (16/16 tests).
- 2026-09-04 — diag run with zero mock traffic (not even bootstrap
  getUser): `reverse --list` proves the forward EXISTS, not that
  bytes flow. Added device-side curl connectivity probe to
  `ensureAuthReverse` (one re-establishment, then fail with
  reason) + `interpretDeviceProbe` unit tests (17/17). If the
  next lane still fails at 03 with PUT logged, the remaining
  suspect is app-side state derivation, with full request logs
  now available.
- 2026-09-04 — dead-forward boots (~3 occurrences: 2 diag + 1
  lane): reverse listed but zero bytes flow; app silently stays
  local-only. Device has neither curl nor /dev/tcp, so no
  device-side probe is possible; instead the orchestrator now
  retries a zero-traffic non-pass ONCE on the same target with a
  fresh mock session (bounded, logged, both attempts recorded,
  superseded excluded from summary). Prophylactic `reverse
--remove-all` on owned targets. `mockSliceTouched` +
  signup-line counting + record attempt/superseded fields +
  summary filtering (20/20 tests).
- 2026-09-04 — FORENSIC ROOT CAUSE for the dead boots (live
  `dumpsys package` on a dead-state emulator): the booted device
  holds an APK with lastUpdateTime 2026-09-03 10:42 +
  firstInstallTime 2026-08-10 — a snapshot-reverted stale binary
  — while host metadata claims the current mock build. `pm
path` + equal versionName/Code cannot distinguish canonical
  vs mock builds, so provision-skip trusted it (every skip-run
  dead, every rebuild-run green, 7/7). The dead-forward/retry
  machinery stays as honest defense-in-depth; the fix is
  `--install-only`: reinstall the hash-verified host APK
  whenever the host build matches (validateInstallOnlyMetadata
  - tests), full rebuild only when the host build is stale.
    Serial/AVD pinning removed from the match (one APK installs
    anywhere; install target recorded per verified install).
- 2026-09-04 — correction: the PUT + healthy-session evidence
  plus the Resend-peeking-at-top screenshots point at the SAME
  below/above-fold assertion class as Wave 1 (the verify form
  renders above the viewport after the form swap + keyboard
  dismissal; hierarchy dumps prune above-viewport nodes). The
  `localhost` and PUT-fidelity fixes stand on their own evidence
  (predecessor URL precedent; silent-{} session corruption in
  supabase-js `_updateUser`); the diag-run zero-traffic mystery
  is attributed to dead-forward boots (`--list` without bytes),
  now gated by a curl-free /dev/tcp device probe (with one honest
  retry). 03 flow gains scroll-UP-to-code before waiting.

## Changed Files / Areas

- `scripts/native-avd.mjs` — mock-log proof + cleartext +
  reverse-spec pure helpers.
- `tests/nativeAuthMock.test.ts` — 6 unit tests.
- `scripts/qa-native-provision.mjs` — `--mock-auth-url`.
- `scripts/qa-native.mjs` — `--auth-mock` lifecycle.

## Recovery / Resume Instructions

1. Read AGENTS.md, .agent/PLANS.md, ACTIVE prompt Waves 0–2, this plan.
2. Run `npm run agent:resume -- --plan .agent/execplans/auth-mock-lifecycle.md`.
3. Inspect `git status -s`, `git diff --stat`, `git diff --name-only`.
4. Run `npm run web:hygiene`; `adb devices` must be empty; no `node
native-auth-mock-server` process may persist (kill only exact owned
   PIDs); `adb reverse --list` (per serial) must be empty of our spec.
5. Continue only from `Exact next action` in Current Checkpoint.

## Outcomes & Retrospective

- Status: Completed.
- Summary: `qa-native.mjs --auth-mock` owns the full auth-lane
  lifecycle (mock spawn/readiness/stale-refusal, per-target
  reverse with remove-all prophylaxis, mock-aware TEST-ONLY
  provision into a separate metadata file, per-target log-slice
  proof, bounded same-target retry on zero-traffic attempts,
  finally-level teardown). Supporting work: faithful mock PUT
  handler + universal request logging, deterministic 127.0.0.1
  device URL, `--install-only` hash-verified reinstall (closes
  the snapshot-revert staleness hole for all lanes),
  serial/AVD depinning, per-target Wave 6 records with attempt
  - mockState. Proof: auth 3/3 ×2 on Nitro with
    signup=1/put=1/unauth=0/same-UID/verify; 21/21 + 9/9 unit
    tests; typecheck 0. Incidental finding fixed en route: the
    03-protect verify field sits above the viewport after the form
    swap (scroll-UP-to-code in the flow, same class as Wave 1).
- Follow-up: multi-target+mock composition certified on demand;
  install-only reuse statistics belong to Wave 5/8 reporting.
