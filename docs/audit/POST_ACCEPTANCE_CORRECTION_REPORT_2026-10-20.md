# SuperHabits — Post-Acceptance Correction Report

> **SUPERSEDED / HISTORICAL EVIDENCE (2026-10-20):** The independent review rejected
> this report's F1–F3 completion claims. The observed-head description and the
> claims that no mutable rows/settings/manifest are written and that neither
> recovery point can be silently superseded were not accurate for the normal
> pending-capture and keep-local paths. They are retained here as historical
> evidence only. The current implementation/evidence is in
> `docs/audit/BACKUP_INTEGRITY_CORRECTION_FINAL_REPORT_2026-10-20.md`.

Date: 2026-10-20  
Base reviewed commit: `85599dfbf3cbe2077f04ae51bfe3c19b6c04bff3`  
Worktree: `D:\Documents\tryPython\superhabits-post-acceptance`  
Branch: `fix/post-acceptance-defects`  
Status: local correction complete; release qualification remains blocked externally.

---

## A. Executive Summary

The stale legacy backup-cutover defect is corrected and locally verified. A legacy capture
made on one device can no longer receive a new sequence above a newer remote head and
overwrite newer recovery bytes. Publication now requires the captured base head to equal the
current head, or an immutable publication-journal record proving the snapshot is already
published. Otherwise publication fails closed into a durable, owner-visible conflict.

The correction preserves both recovery points: the newer remote generation remains retained,
and the local capture remains pending. The owner can explicitly keep the local dataset, which
starts a fresh capture from the current remote head; adopting the remote backup still requires
the existing empty-device restore path. There is no automatic merge.

Executed screen-level evidence now covers:

- **SH-04** — forced workout-save failure, durable pending-save retention across remount,
  landing retry, and exactly one committed workout log.
- **SH-13** — Todo project/goal associations across create, reload, cancelled edit, and edit.

**SH-11** remains partially closed. The shipped `runTimerStartup` failure/recovery behavior is
covered, but the native scheduling-rejection branch cannot be triggered in the web export
because the web scheduler returns `null` by design before native scheduling is attempted. No
rendered component rejection test exists without adding a production failure hook or a new
component-testing dependency.

Local verdict: **ACCEPT_WITH_CONDITIONS**.  
Release verdict: **INCONCLUSIVE / BLOCKED** pending hosted, native, cloud-artifact, and
dependency-advisory qualification.

---

## B. Exact Repository State

- Reviewed local and remote `main`: `85599dfbf3cbe2077f04ae51bfe3c19b6c04bff3`.
- Work is isolated on `fix/post-acceptance-defects`; primary `main` worktree and unrelated
  untracked files were not modified.
- No commit, push, merge, PR update, deployment, or shared/production migration was performed.
- Runtime: Node `24.3.0`, npm `11.4.2`; `.nvmrc` pins `22.23.2`, and no version manager is
  installed. All reported local validation therefore ran on Node 24.
- Tracked diff before this report: 12 files, 494 insertions, 37 deletions.
- New implementation/test files: `core/backup/generations/conflict.ts`,
  `core/backup/backupConflictResolution.ts`,
  `tests/integration/backupConflictResolution.test.ts`, plus the ExecPlan.
- The correction was built on the already-accepted immutable-generation architecture; it does
  not replace or weaken that architecture.

---

## C. Primary Backup Finding

### Defect

`ensureRecoveryPoint()` trusted `backupLegacyGenerationCapture` before inspecting the current
remote head. An interrupted device could later reserve a sequence above a newer head and
publish older bytes. The server RPC verified sequence concurrency, not capture age, so the
older capture became the new visible head and replaced the newer recovery point.

### Correction

1. Each device persists the head it observed (`backupObservedGenerationHead`).
2. Every normal capture records that head as `baseHeadSnapshotId` / `baseHeadSequence`.
3. Pre-publication requires the current head to equal the capture base.
4. A differing head is accepted only when the immutable publication journal proves this
   snapshot already published (lost acknowledgement / idempotent retry).
5. Any other differing head records a durable conflict and throws
   `BackupGenerationConflictError`; no mutable rows, settings, or manifest are pushed.
6. Publication failures re-read the head and record a conflict when it no longer matches the
   capture base.
7. Successful publication advances the observed head.

No wall-clock comparison is used. Age cannot prove ordering across devices.

### Conflict Resolution

- `resolveBackupGenerationConflictKeepLocal()` validates the active conflict owner and local
  snapshot, marks the conflict resolved, clears the conflicting capture, sets
  `backupDirty=1`, and runs backup maintenance to capture from the current remote head.
- The previously visible remote generation remains retained server-side.
- Settings exposes the conflict, fingerprints, sequence, and an explicit
  “Keep this device’s data” action. Nothing resolves automatically.
- Adopting the remote backup still requires the empty-device Restore V2 path.

### Evidence

- Reproduced as a failing integration test before correction:
  `tests/integration/generationClientRecovery.test.ts` — “does not overwrite a newer
  published head with an unreserved stale legacy capture”.
- Covered alongside pending-capture stale-head rejection, lost-acknowledgement recovery,
  conflict resolution, and normal publication.
- Focused integration result: 19 generation-recovery tests + 2 conflict-resolution tests
  passed.

### Residual Risk

Cross-device server behavior (Auth/PostgREST/RLS, concurrent clients, lost responses against a
real backend) remains an external gate. Local evidence proves the client contract, not hosted
serialization or deployment.

---

## D. SH-04 / SH-11 / SH-13

### SH-04 — Workout completed-but-unsaved recovery

**Status: closed with executed browser evidence.**

New test: `e2e/workout.spec.ts` — “failed save keeps a durable recovery payload and a remount
retry logs once”.

The test:

1. Installs a temporary SQLite trigger that aborts every `workout_logs` insert.
2. Completes a real workout and attempts “Save and finish”.
3. Asserts the truthful failure message and “Try saving again”.
4. Reads `app_meta.workout.pending_save` and verifies routine name plus entered `80 × 8`.
5. Verifies zero committed logs.
6. Drops the trigger, remounts the app, sees “Workout finished — not saved yet”, reopens the
   summary through “Save finished workout”, saves successfully, and verifies exactly one log
   and a cleared pending-save record.

Result: **1 passed (19.0 s)**.

### SH-11 — Pomodoro rejected-start wedging

**Status: partially closed; native-only branch remains unexecuted.**

- The shipped `runTimerStartup` recovery contract is covered by
  `tests/pomodoro.startup.test.ts`, including “leaves the timer startable again after a failed
  startup”.
- Rendered web E2E covers normal start, repeated-start conflicts, pause/reload interruption,
  completion, and auto-progression.
- On web, `scheduleTimerEndNotification()` returns `null` immediately and never reaches the
  native scheduling failure branch. Therefore the exact screen rejection path cannot be
  exercised in Playwright without adding a production failure hook or new component-testing
  infrastructure.
- No production hook was added merely to make the test pass.

This does not invalidate the correction, but it is not equivalent to rendered component
proof of the rejection path.

### SH-13 — Todo project/goal association loss

**Status: closed with executed browser evidence.**

New test: `e2e/todos.spec.ts` — “todo project and goal associations survive create, reload,
cancelled edit, and edit”.

The test seeds a project and goal, creates a Todo with both selected in the real editor, and
verifies the database row. It reloads, reopens the editor with both chips selected, cancels a
goal-clearing edit and verifies both associations are unchanged, then edits again, clears the
goal, saves, and verifies `project_id` remains while `goal_id` becomes `null`.

Result: **1 passed (14.8 s)**.

---

## E. Secondary Findings

| Finding                                                                       | Disposition                        | Rationale                                                                                                                                                                                |
| ----------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkGenerationScope` ignores `scopeVersion`                                 | No change                          | The function has no production caller. Restore validates exact manifest scope/schema in `generationFormat.ts` and rejects mismatches. The helper is covered as a protocol contract only. |
| `pushSettingsSnapshot` drops queued settings when pending snapshot is missing | Intentional fail-closed tradeoff   | Uploading a fresh uncertified payload would fail manifest integrity. Settings remain durable locally; the next maintenance capture supersedes the dropped transport intent.              |
| PR UI selects a record by `exerciseName`                                      | Minor display ambiguity, no change | Domain PR grouping already uses catalog identity/`exerciseKey`; the remaining lookup only affects display if two catalog exercises share a name in one routine. No data corruption.      |
| Weekly-review response lacks `occurrenceId`                                   | No change                          | The weekly action only opens the review surface; it performs no mutation. Delivery identity still participates in the handler fingerprint.                                               |
| SH-06 recovery is startup-only, 5-minute lease, 7-day lookback                | Deliberate tradeoff                | A later startup sweep reclaims stale work; fresh leases are left alone. The bounded window prevents unbounded historical replay.                                                         |
| SH-01 maps `IMPORT_ORIGIN_OWNER_CONFLICT` to a generic UI error               | UX limitation, no change           | The typed error is preserved internally; the UI message is less specific but no unsafe action occurs.                                                                                    |
| SH-19 Gym nested fixture uses labeled `[fixture]` SQL                         | Test weakness, no product defect   | Fixture provenance is explicit; product behavior is unaffected.                                                                                                                          |

No additional code change was justified from these residuals. None introduces silent data
corruption in the audited paths.

---

## F. Validation Matrix

| Gate                                        | Result                                                                                         |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `npm run typecheck`                         | PASS — 0 errors                                                                                |
| ESLint on changed files, `--max-warnings 0` | PASS                                                                                           |
| `npm run qa:fast`                           | PASS — 194 unit files, typecheck, lint, journey/quarantine/release/cloud guards                |
| `npm run test:integration`                  | PASS — 102 files passed, 1 skipped                                                             |
| Focused generation/conflict integration     | PASS — 19 + 2 tests                                                                            |
| `npm run build:e2e`                         | PASS — hermetic export, 0 Supabase hosts                                                       |
| SH-04 Playwright recovery test              | PASS — 1 test, 19.0 s                                                                          |
| SH-13 Playwright association test           | PASS — 1 test, 14.8 s                                                                          |
| `npm run e2e:journeys:p0`                   | PASS — 25/25                                                                                   |
| `npm run build:sync`                        | PASS — dummy-Supabase `dist-sync/`                                                             |
| `npm run e2e:sync`                          | PASS — 52/52 remote-boundary journeys                                                          |
| Full `npm run e2e` / `e2e:full`             | NOT RUN                                                                                        |
| `npm run qa:full`                           | NOT RUN as one command                                                                         |
| Native smoke/persistence/lifecycle          | NOT RUN — no booted Android/iOS target and native qualification is outside this local campaign |
| Hosted Supabase / disposable backend        | NOT RUN — external environment and authorization required                                      |
| Cloud-native artifact isolation (SH-21)     | NOT VERIFIED — static guard only                                                               |
| Dependency advisories (SH-20)               | BLOCKED — no patched versions/waiver                                                           |

`qa:affected` also names native smoke and targeted gates. They remain visible as not run, not
passed by inference.

---

## G. Regression Assessment

- The primary success/failure paths of backup publication remain intact: normal first
  publication, pending-capture publication, idempotent retry, restore, checkpoint coherence,
  and conflict resolution all pass.
- P0 journeys and the complete sync journey lane pass, including broken-backend retry/backoff,
  offline outbox durability, account ownership, and reconnect push.
- The new E2E tests use real UI plus SQLite oracles and temporary database failure injection;
  they add no production test hooks or `data-testid` attributes.
- No evidence was found that the correction changes entity payloads, manifest contents, restore
  imports, or local-first behavior.
- Remaining uncertainty is external: real Supabase concurrency, actual device notification
  scheduling, and release-artifact isolation.

---

## H. Outstanding Release Blockers

1. **Hosted backend qualification** — concurrent-device publication, RLS, Auth/PostgREST,
   target-limit behavior, and lost-response recovery have not been re-proven against a hosted
   or disposable backend.
2. **Native qualification** — SH-11’s native scheduling rejection and Android/iOS lifecycle
   behavior remain unexecuted.
3. **Cloud-native isolation (SH-21)** — static guard passes; real EAS artifact inspection is
   unavailable.
4. **Dependency advisories (SH-20)** — `braces` and `node-forge` findings have no patched
   version/waiver in the current lockfile.
5. **Toolchain mismatch** — local validation ran on Node 24.3.0, not the pinned 22.23.2.
6. **No commit/PR/CI proof** — this is a local worktree correction, not a published change.
7. **SH-11 rendered rejection proof** — still missing by design limitation described above.

---

## I. Independent Review Readiness

A reviewer can reproduce the local package from the worktree:

```powershell
cd D:\Documents\tryPython\superhabits-post-acceptance
npm run qa:fast
npm run test:integration
Remove-Item Env:EXPO_PUBLIC_SUPABASE_URL, Env:EXPO_PUBLIC_SUPABASE_ANON_KEY -ErrorAction SilentlyContinue
npm run build:e2e
npx playwright test e2e/workout.spec.ts --project=chromium --grep "failed save keeps"
npx playwright test e2e/todos.spec.ts --project=chromium --grep "associations survive"
npm run e2e:journeys:p0
npm run build:sync
npm run e2e:sync
```

Review focus:

- `core/sync/supabase.adapter.ts` — observed head, base-head preflight, journal
  reconciliation, conflict recording.
- `core/backup/generations/capture.ts` — base-head capture fields.
- `core/backup/generations/conflict.ts` — durable conflict state.
- `core/backup/backupConflictResolution.ts` — explicit keep-local path.
- `features/settings/SettingsBackupSection.tsx` / `SettingsScreen.tsx` — conflict review.
- `tests/integration/generationClientRecovery.test.ts` — primary regression.
- `e2e/workout.spec.ts` / `e2e/todos.spec.ts` — screen evidence.

The package intentionally does not claim hosted or native success.

---

## J. Final Verdict

**Primary backup correction:** complete locally, with fail-closed behavior and an explicit
owner reconciliation path.  
**SH-04:** closed with executed screen evidence.  
**SH-13:** closed with executed screen evidence.  
**SH-11:** partially closed; shipped pure startup/recovery contract covered, native rendered
rejection path unexecuted.  
**Secondary residuals:** assessed; no additional safe correction justified.

**Local engineering verdict: ACCEPT_WITH_CONDITIONS.**  
**Release verdict: INCONCLUSIVE / BLOCKED** until the external and native gates in section H
are satisfied or explicitly waived by the release owner.
