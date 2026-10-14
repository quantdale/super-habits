# ExecPlan: W16 — Android API-36 current-source native qualification

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Establish a source-authenticated Android result on the real API-36 x86_64
target for the integrated W12–W15 application, or record a precise external
blocker. The deliverable is either a verified native matrix with any necessary
fixes, or a maximally complete native-readiness package — never an unearned
native pass.

## Context

- Integrated source: `frontend-v3-w12-w17-integration`. Certification was run
  from a detached worktree at the exact verified SHA.
- Slice: `openspec/changes/frontend-v3-w16-android-qualification/`.
- Tooling present: Android SDK, `Nitro_API_36` (API 36 / x86_64 system image),
  Temurin JDK 17, Maestro 2.9.0, `adb`, `gh`.
- Runners reused (not rebuilt): `scripts/qa-native.mjs`,
  `scripts/qa-native-provision.mjs`, `scripts/native-{avd,provenance,qa-utils}.mjs`,
  `.maestro/flows/*`.
- Inherited residuals: two dependency advisories (hosted audit red only),
  Windows-CRLF ENVIRONMENT failure, the pre-existing `settings-ripple` step,
  D14 host-load headroom. iOS owner-deferred.

## Scope

- Exact-source APK provenance; the mandatory native matrix; narrow product fixes
  for reproduced native-only defects; flow corrections for stale markers;
  W16 evidence and records.

## Non-Goals

- No `core/*` semantics change; no schema, migration, dependency or
  security-policy change; no production Supabase mutation; no app-store action.
- No rebuilding of the native test platform or the app's Android architecture.
- No iOS work (owner-deferred); no iOS inference from Android or web.

## Current Checkpoint

- Current milestone: W16 lanes complete and evidence written; pending commit.
- Completed: slice; AVD boot diagnosis and the `-gpu host` resolution; clean
  certification worktree; exact-source APK provenance; all six lanes green
  (smoke 2/2, persistence 11/11, lifecycle 6/6, reward 1/1, backup-v2 1/1,
  portable-backup 2/2); two product defects fixed and re-verified; nine flow
  corrections; `docs/ui-ux/v3-audit/w16/README.md` + archived reports.
- In progress: final records and the W16 commit.
- Important modified files: `app/index.tsx` (nav label),
  `features/workout/WorkoutScreen.tsx` (week-strip a11y label),
  `.maestro/flows/*` (9 flows), `docs/ui-ux/v3-audit/w16/**`.
- Last successful validation: typecheck 0; eslint 0/0; smoke 2/2;
  persistence 11/11; lifecycle 6/6; reward/backup-v2/portable-backup 1/1/2.
- Current failures: the inherited Windows-CRLF ENVIRONMENT residual and the
  pre-existing `settings-ripple` step (web; unrelated to W16).
- Relevant quarantines: None added.
- Blockers: None. iOS remains owner-deferred and is not claimed.
- Condition required to unblock: None for Android.
- Exact resume action after unblock: None.
- Exact next action: None — task complete. Commit W16, then begin W17 — the integrated release-
  candidate verification ladder, security/native reconciliation and handoff.
- Remaining definition of done: Complete — the exact-source Android matrix passed and the evidence is recorded; iOS remains owner-deferred.

## Progress

- [x] 1.x Preflight and slice
- [x] 2.x Exact-source target and provenance
- [x] 3.x Mandatory native matrix
- [x] 4.x Product fixes and flow corrections, re-verified
- [x] 5.1–5.4 Evidence and adversarial review
- [x] 5.5 Commit and publish
- [x] 5.6 Worktree cleanup and port hygiene

## Surprises & Discoveries

- 2026-10-14 — The `Nitro_API_36` AVD segfaults with `swiftshader_indirect`,
  `gpu off` and `auto` (`Failed to load opengl32sw`), and a freshly created AVD
  from the same system image reproduces it, so the AVD itself is fine. It boots
  with `-gpu host`, the mode the host's working API-35 AVD uses.
- 2026-10-14 — The native lanes were almost entirely stale-marker failures,
  not product failures: nine flows asserted copy removed by W6–W13. Two
  asserted date-dependent list text where a date-independent detail view
  existed. Both runner guards (API/ABI, installed-vs-HEAD provenance) fired
  during the wave, which is what makes the final PASS source-authenticated.
- 2026-10-14 — A genuine native-only product defect: the bottom nav's six
  labels clipped on Android (`Tod…`, `Worko…`, `Calori…`) inside a measured
  55.6dp slot, while the accessible names stayed complete and web rendered them
  in full.

## Decision Log

- 2026-10-14 — Certify from a detached worktree at the exact SHA (the campaign
  worktree legitimately holds an untracked foreign evidence directory the
  runner's cleanliness guard rejects).
- 2026-10-14 — Fix `TabButton` (product) rather than shortening labels or
  hiding them: the label text, size, destinations and touch targets are the
  contract; only the available width was wrong.
- 2026-10-14 — Prefer the habit detail modal's Settings tab as the
  schedule/reminder oracle: it is date-independent, so it is strictly stronger
  than the list row the flows previously asserted.

## Validation Ledger

- 2026-10-14 — `npx tsc --noEmit` — PASS — 0 errors.
- 2026-10-14 — `npx eslint app/index.tsx features/workout/WorkoutScreen.tsx` — PASS — 0/0.
- 2026-10-14 — `node scripts/qa-native-provision.mjs --serial emulator-5594` — PASS — source `b50034d`, APK SHA-256 `AA89D9FE…`, 0 remote hosts.
- 2026-10-14 — `… --tag smoke …` — PASS — 2/2.
- 2026-10-14 — `… --tag persistence …` — PASS — 11/11 in 17m24s.
- 2026-10-14 — `… --tag lifecycle …` — PASS — 6/6 in 8m59s.
- 2026-10-14 — `… --tag reward …` — PASS — 1/1.
- 2026-10-14 — `… --tag backup-v2 …` — PASS — 1/1.
- 2026-10-14 — `… --tag portable-backup …` — PASS — 2/2.
- 2026-10-14 — on-device captures — INSPECTED — nav truncation reproduced then fixed (`native-02-navbar-crop.png` → `native-11-navbar-light.png`).

## Changed Files / Areas

- `app/index.tsx` — nav label width fix (N-1).
- `features/workout/WorkoutScreen.tsx` — week-strip assignment a11y label (N-2).
- `.maestro/flows/*` — nine flows corrected to current-source markers.
- `docs/ui-ux/v3-audit/w16/**` — evidence and reports.
- `openspec/changes/frontend-v3-w16-android-qualification/*` — this slice.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, the master plan, then this file.
2. Recreate the certification worktree at the recorded SHA:
   `git worktree add --detach ../superhabits-w16-native <sha>`.
3. Boot the target: `emulator -avd Nitro_API_36 -no-snapshot -gpu host`.
4. `node scripts/qa-native-provision.mjs --serial <serial>` then the tag lanes.
5. Reconcile with Git and the rendered state, update the checkpoint, resume from
   `Exact next action`.

## Outcomes & Retrospective

- Status: Completed.
- Summary: W16 established a source-authenticated Android PASS at `b50034d` on the real API 36 / x86_64 `Nitro_API_36` target: a credential-free exact-source APK with recorded provenance, and 23/23 flows across smoke, persistence, lifecycle, reward, backup-v2 and portable-backup. It found and fixed two product defects (native nav-label truncation; an unlinked weekly-plan day/assignment a11y pair) and corrected nine stale flow markers. iOS remains owner-deferred.
- Follow-up: None for Android. Re-earn the claim at the RC SHA if native code changes; evidence in docs/ui-ux/v3-audit/w16/.
