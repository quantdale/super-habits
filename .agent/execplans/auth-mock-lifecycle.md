# ExecPlan: Wave 2 — Auth-Mock Lifecycle Automation

Plan-Version: 2
Status: ACTIVE

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

- Current milestone: implementation starting (audit complete, plan opened).
- Completed: audit (mock protocol, flow tags/order, env vars, provisioner
  shape, provenance constraints).
- In progress: live proof — auth lane via `--auth-mock` on Nitro.
- Important modified files: `scripts/native-avd.mjs`
  (`parseMockLog`, `assertMockProof`, `addCleartextAttr`,
  `reverseSpecPresent`), `tests/nativeAuthMock.test.ts` (new, 6
  tests), `scripts/qa-native-provision.mjs` (`--mock-auth-url`,
  TEST-ONLY env + cleartext patch, separate mock metadata file),
  `scripts/qa-native.mjs` (`--auth-mock/--auth-mock-port/
--build-metadata`, owned mock child + bounded readiness +
  stale-port refusal, per-target reverse lifecycle, per-target
  log-slice proof, TEST-ONLY records, finally-level teardown).
- Important modified files: none yet.
- Last successful validation: Wave 1 closure (Nitro + CRBABot 2/2 @45dc256).
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: Commit mock-fidelity + URL fixes, push,
  rerun auth lane via `--auth-mock` on Nitro ×2 with full proof
  (signup/PUT/UID/verify).
- Remaining definition of done: helpers tested; provisioner + runner
  extended; auth 3/3 ×2 with per-run proof on Nitro; no stale mock/
  reverse/emulator left; ledger + commit/push; plan COMPLETED.

## Progress

- [x] Workstream plan opened; audit complete.
- [x] Pure helpers + unit tests (6/6 + 8/8 green; typecheck 0).
- [x] Provisioner `--mock-auth-url` + mock metadata + cleartext patch.
- [x] Runner `--auth-mock` lifecycle + proof + TEST-ONLY records.
- [ ] Auth 3/3 ×2 with proof on Nitro; hygiene verified.
- [ ] Plan validated; committed/pushed; COMPLETED.

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

- Status: Active.
- Summary: audit done; implementing.
- Follow-up: none yet.
