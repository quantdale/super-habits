# WINDOWS-FIRST SUCCESSOR CAMPAIGN — FINAL REPORT (2026-10-17)

Campaign plan: `.agent/execplans/windows-first-successor-campaign-v1.md` (COMPLETED).
Branch: `frontend-v3-post-w17-overnight-successor` (PR #79, base `main` `fb10d6c`).

## 1. Commits

| Commit    | Campaign                                                        |
| --------- | --------------------------------------------------------------- |
| `f601226` | **Start** (pre-campaign head; the un-certified iOS input patch) |
| `2468216` | Campaign 0 — iOS deferral disposition + campaign plan opened    |
| `cd25edd` | Campaign 1 — workout input/persistence reliability              |
| `6b23b6e` | Campaign 2 — local-first write integrity                        |
| (final)   | Adversarial-review response + atomic duplication + this report  |

## 2. Campaigns executed

1. **Campaign 0 — Recovery & disposition.** Verified HEAD/state, baseline
   gates green at `f601226`, recorded `IOS_QUALIFICATION_DEFERRED_BY_OWNER`
   (`NATIVE-CERTIFICATION.md` §I). No 13/13 claim; release never green on iOS.
2. **Campaign 1 — Workout input & persistence reliability.** Three defects
   found and reproduced in-browser at `f601226` (3/3 designed failures), plus
   a fourth root cause found by focus/blur tracing.
3. **Campaign 2 — Local-first reliability.** Two parallel read-only audits
   (UI silent-write audit + local-first invariant audit) → four demonstrated
   missing invariants fixed at source, five divergence-class UI sites closed.
4. **Campaign 3 — Windows/web product quality.** Screenshot sweep (24 frames)
   - machine-checkable axes re-verified green.
5. **Adversarial review round.** Independent review of `f601226..6b23b6e`;
   its A1–A4 findings confirmed and fixed same-session (see §4).

## 3. Root causes and fixes

**RC-1 — Web keystroke loss (product, reproduced).** RNW `ScrollView`
calls `dismissKeyboard()` on **every** scroll event when
`keyboardDismissMode="on-drag"`, and `core/ui/Modal.tsx` +
`core/ui/Screen.tsx` set it unconditionally. A save-on-change refresh reflow
fired a scroll event → `blurTextInput` blurred the focused input (blur stack:
`blurTextInput ← _handleScroll`) → remaining keystrokes landed on `BODY`.
Focus tracing captured `focusout INPUT → key '2' -> BODY` deterministically.
Fix: Platform-gate the prop (`'none'` on web — no soft keyboard to dismiss —
`'on-drag'` kept on native). This is also what made the iOS-era bug plausible
for real users, and it is the mechanism behind the "char-by-char type() drops
characters" note previously documented in `e2e/helpers/forms.ts`.

**RC-2 — Echo clobber (product, reproduced).** Save-on-change builder fields
bound their display to re-fetched entity rows; a refresh echo landing
mid-typing reset the field (run 38941052793: `42`→`2`; browser: `42`→`4`). The
`f601226` `defaultValue` fix proved insufficient on web. Fix: all 26
save-on-change builder fields (notes, superset, progression, set timings and
prescriptions) now render through synchronous-draft components
(`features/workout/DraftTextField.tsx`, `DraftNumberField.tsx`); the stepper
`+` button also clamps to `min` (was `1` on an empty `min=5` field).

**RC-3 — Silent rejected saves (product, demonstrated).** Queued builder
writes dropped rejections (unhandled, no feedback, UI/DB divergence); the
add-exercise name field kept stale text so a repeat Add duplicated the row
(the `f601226` `defaultValue` flip regressed a local-state field). Fix:
queued writes + add/rename/move/delete-exercise handlers surface errors and
re-sync; `newExerciseName` restored to controlled local state; the same class
closed at the five divergence-class UI sites (todos drag-reorder + editor
save, habits editor save, calorie goal save, Pomodoro duration save).

**RC-4 — Local-first write integrity (product, demonstrated).**
`rescheduleWorkoutDate` was two transactions (a failed destination leg left
the workout "moved to nowhere"); `duplicateRoutine` was N+1 transactions (a
mid-copy failure left a half-built routine); `updateRoutine` /
`updateCustomExercise` / `updateBodyWeightEntry` read-merged outside the
transaction (stale-snapshot sibling clobber); `addSet` numbered sets outside
the transaction (collisions after concurrent adds / mid-list deletes);
`runBackupMutation` could commit row writes while silently dropping their
sync intents (`changed:false` after `enqueue` — held off by convention only).
Fixes: one-transaction move and copy (per-row intents), in-transaction
read-merge-write and `MAX(set_number)+1`, fail-closed intent contract
(rollback + named error). Plus out-of-order `refresh()` snapshots guarded by
`lib/snapshotSequencer.ts`.

## 4. Adversarial review findings (independent agent) and response

- **A1** (real bug, introduced by this campaign): `rescheduleWorkoutDate`
  lost `isValidDateKey` calendar validation in the extraction → **fixed**
  (validation restored + rejection oracle).
- **A2** (real gap): `moveExercise`/`handleDeleteExercise` were the only
  builder mutations bypassing error surfacing (optimistic reorder stuck +
  unhandled rejection) → **fixed**.
- **A3**: `handleRenameRoutine`'s `onRenamed` await escaped the new
  try/catch → **fixed**.
- **A4**: the fail-closed guard comment overclaimed its enforcement →
  **fixed** (honest wording in code and test).
- **B2/B3/B4** (sticky error banner; WorkoutScreen move/assign silent
  failures; COUNT-based set numbering) → **fixed**.
- **B1/B5/B6/B7** (drafts keep rejected/normalized text; assertion-order
  change on missing rows; transient flicker vs optimistic reorder; double
  tap on newly async save buttons) → accepted trade-offs, recorded.
- **C1–C6** confirmed: no legitimate mutate trips the guard (audited 50+
  sites), extraction parity, in-transaction merges correct, sequencer sound,
  and the new integration tests + e2e tests 1 & 3 genuinely pin their claims
  (fail on pre-fix code) — see §5 for the precise per-test evidence notes.

## 5. Tests and actual results

**Final QA matrix (closure source, 2026-10-17):**

| Gate                                            | Result                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                             | 0 errors                                                                                                      |
| `npm run lint --max-warnings 0`                 | 0 errors, 0 warnings                                                                                          |
| `npm run qa:affected`                           | matched workout-gym-v2, e2e/simulation infra, native UI/persistence, agent workflow rules — ladder executed   |
| `npm run qa:fast`                               | **182/182 unit files** + journey-label / quarantine-register / release-profile guards OK                      |
| `npm run qa:integration`                        | **84 passed / 1 skipped** files (real SQLite)                                                                 |
| `npm run qa:timezones`                          | PASS ×5 zones (Asia/Manila, UTC, America/New_York, Pacific/Honolulu, Pacific/Kiritimati)                      |
| Full Vitest (`npm test`)                        | **2736 passed / 2 skipped** tests (267 passed / 1 skipped of 268 files)                                       |
| `openspec validate --all`                       | PASS                                                                                                          |
| `agent:plan:validate:all`                       | PASS                                                                                                          |
| Hermetic `build:e2e`                            | OK, 0 Supabase hosts                                                                                          |
| **Full Playwright (one quiet-host run)**        | **373 passed / 86 skipped / 0 failed** (459 tests, 40.7 min; chromium + journeys + simulation + pwa + visual) |
| Security audit `scripts/audit-runtime-deps.mjs` | exit 1 — 2 undocumented HIGH (correctly red, no waiver)                                                       |

- **New tests:** `e2e/workout-editor-input-reliability.spec.ts` (3: add-field
  state, rapid TextInput keystrokes, rapid stepper keystrokes + persistence +
  SQL row oracle) — 3/3 **failed as designed** pre-fix, 9/9 across 3 repeats
  post-fix; `tests/snapshotSequencer.test.ts` (6 — new-code coverage of the
  ordering primitive); `tests/integration/
workoutMutationIntegrity.data.test.ts` (8 real-SQLite: move atomicity with
  failure injection, successful-move parity, impossible-date rejection,
  fail-closed guard with rollback proof, atomic duplicate with deterministic
  fault injection, concurrent-field merge, set-number race, and post-delete
  numbering). The integration suite and e2e tests 1 & 3 fail on pre-fix code;
  e2e test 2's pre-fix failure was timing-dependent (the keystroke-loss race
  it reproduces is inherently timing-based); the sequencer tests pin the
  primitive, not its wiring.
- **Full Playwright disposition:** the historical **368 passed / 86 skipped /
  4 failed** run (at `cd25edd`, under background load) was reviewed artifact
  by artifact: 3 HEAVY timeouts and the habits-w7 800ms check-in ceiling
  (measured 1029/1049 ms) — each re-verified green in isolation or quiet-host
  re-runs, matching the documented CG-4/CG-5 host-load class. The one final
  full run on a quiet host at the closure source passed **373 / 86 / 0 in a
  single run** (no retry assembly; the four historical failures pass
  in-suite), which closes the classification. No assertion was weakened; the
  only harness change is an evidence-based 30s `beforeAll` hook budget in
  `tests/restore.coordinator.test.ts` (its heavy module-mock setup measured
  ~7s standalone but exceeded Vitest's 10s hook default 3× under full-suite
  parallelism — setup budget only, no test semantics touched).
- **Full Vitest:** 2707 passed | 20 skipped (265→268 files as tests grew); at
  final state 266 files passed | 1 skipped. The only failures ever seen were
  host-load 5s/10s subprocess/hook timeouts, each re-passed serially
  (`auditRuntimeDeps`, `nativeAuthMock`, `qaNativeProvision`,
  `restore.coordinator`) — flake class documented, no assertion weakened.
- **Playwright:** pre-fix repro 3/3 designed failures; post-fix targeted
  lanes 47/47 then 95/95; full battery at `cd25edd` **368 passed / 86 skipped
  / 4 host-load-class misses** (3 HEAVY timeouts pass alone; the habits-w7
  800ms check-in ceiling passes 3/3 on a quiet host — same class as the
  documented CG-4/CG-5 host variance); final workout lanes 40/40; visual
  lane 34/34 (one achievements-overlay capture flake passed in isolation and
  in the full re-run).
- **Other gates:** `qa:fast` OK (incl. journey-label, quarantine-register,
  release-profile guards), `qa:integration` 84 files OK, `qa:timezones`
  (Asia/Manila, UTC, America/New_York, Pacific/Honolulu, Pacific/Kiritimati)
  OK, `openspec validate --all` PASS, `agent:plan:validate:all` PASS,
  `typecheck` 0, `lint --max-warnings 0` 0 throughout.

## 6. Real-SQLite verification

All data-layer claims were verified against real SQLite via the
`tests/integration/**` harness (better-sqlite3 running the app's actual
bootstrap DDL + migrations): atomic move with injected destination failure
(neither day changes, zero intents), atomic duplicate with injected mid-copy
failure (no half-built rows survive the rollback), the fail-closed intent
contract (rollback proof: row and intent both absent), concurrent-field
merge, set-number race/dedupe, plus the pre-existing 84-file integration
corpus (outbox torture, backup checkpoint/restore, delete-sync atomicity,
habit concurrency, workout save integrity) re-run green at every milestone.

## 7. Browser / visual evidence

- Pre-fix failures captured (screenshots + traces under
  `.cursor/playwright-output/e2e-failures/`, facts in the plan's Validation
  Ledger): add-name stale text, `42`→`4` keystroke loss, stepper revert +
  unclamped `+`.
- Root-cause traces: MutationObserver probe (same node, value regresses) and
  focus/blur trace (`focusout INPUT → key -> BODY` with the
  `blurTextInput ← _handleScroll` stack) — throwaway probes since deleted;
  evidence recorded in the plan.
- **Closure geometry inspection (browser-based, all six surfaces × phone /
  desktop × light / dark = 24 states):** zero horizontal overflow, zero
  truncated text, zero tiny targets, zero out-of-viewport dialogs. 10 tap-
  center occlusions by the floating bottom tab bar at initial scroll were
  measured and **all 10 clear on scroll** (`tap-occluded-but-reachable`, zero
  `tap-TRAPPED-unreachable`) — the standard floating-nav underlap pattern,
  not a defect. No material layout defect found by mechanical inspection.
- **`OWNER_VISUAL_REVIEW_PENDING`** — the 24 Phase-3 screenshots
  (`simulation-output/phase3/`) cover phone/desktop × light/dark × six
  surfaces. The agent cannot view images (model limitation), so aesthetics
  (typography feel, spacing taste, color harmony, iconography) remain
  explicitly **pending human review**. Machine-checkable accessibility,
  visual-golden, and geometry checks do NOT constitute human visual approval.

## 8. Security disposition

`SECURITY_UNREMEDIATED` — unchanged and re-verified 2026-10-17:
`braces` GHSA-vfj7-8cjw-p6xm and `node-forge` GHSA-86w9-cpqp-85rv remain the
only undocumented HIGHs in the production tree; registry latest is still
3.0.3 / 1.4.0 (no published patch). `node scripts/audit-runtime-deps.mjs`
exits 1 (gate correctly red). No waiver, no allowlist change, no scan skip,
no reclassification. **PR #79 stays OPEN and must not merge while red.**

## 9. Remaining externally blocked work

- **iOS qualification** — `IOS_QUALIFICATION_DEFERRED_BY_OWNER`. Last device
  evidence: run 38941052793 @ `c05860e` = 12 PASS / 1 FAIL; the `f601226`
  patch is NOT device-certified (and this campaign's fixes ride on top of
  it, equally un-certified on device). 13/13 is never claimed. Re-opens only
  with a Mac/iOS runner.
- **Android qualification** — `ENVIRONMENT_BLOCKED` (foreign `emulator-5594`
  adbd wedge on the shared adb server; owner-action remediation documented
  in `NATIVE-CERTIFICATION.md` §A). No foreign emulator was disturbed.
- **Security release gate** — blocked on upstream patches or an explicit
  owner security-policy governance decision (not standing engineering
  authorization).
- **Hosted `e2e`/`nightly` lanes + `e2e:sync`** — CI-owned; `e2e:sync`
  needs the disposable-backend nightly lane.

## 10. Prioritized successor backlog (classified)

Final independent review (closure round, `f601226..22b59d8`) confirmed the
substantive claims and closed its own findings (§13). The registered
candidates below were classified; **none blocks closure**: no P0/P1 remains,
and every candidate is either architectural, a design decision, or a
low-severity polish item.

| Candidate                                                                                                                                                     | Severity           | Reproducibility                               | Data-loss risk                                            | Implementation risk                                                             | Validation available           | Needed for closure                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------- |
| Tier-2 silent-no-op UI writes (task toggle/delete, habit pause/archive, project/goal link-unlink, pomodoro notes/presets, daily-plan / weekly-review deletes) | P3 UX              | Deterministic on write failure (rare trigger) | None (no divergence — DB unchanged, no feedback)          | Low (mechanical catch + surface at ~15 sites)                                   | E2E failure injection per site | No                                      |
| F4 linked-action dispatch crash window (source commit → `processSourceAction`)                                                                                | P2                 | Crash-timing only                             | Low (one rule effect lost; no row corruption)             | Medium-high (needs a durable dispatch marker + startup sweeper — architectural) | Crash-injection integration    | No                                      |
| F5 outbox revision no-op guard                                                                                                                                | P3                 | Only after a hydrate failure (narrow)         | Low (stale remote row + blocked outbox)                   | Medium (must not break legitimate coalescing)                                   | Integration with hydrate fault | No                                      |
| F7 settings backup snapshot gap (value committed before its snapshot intent; no drift repair)                                                                 | P3                 | Crash between two writes                      | Low (remote snapshot stale; restore returns old settings) | Medium (needs a repair/drift design decision)                                   | Crash-injection + drift test   | No                                      |
| F8 reward backfill window (backdated check-ins older than yesterday)                                                                                          | P3                 | Deterministic for >1-day backdates            | None (local-only reward layer, under-earn only)           | Low                                                                             | Integration with backdate      | No                                      |
| `snapshotSequencer` wiring regression pin (unit tests cover the primitive, not the `refresh()` call site)                                                     | P3 maintainability | Refactor-dependent                            | None today                                                | Low-medium (needs component-level test infra, which this repo lacks)            | Component tests (new infra)    | No                                      |
| Owner visual review of the 24 `simulation-output/phase3/` screenshots                                                                                         | —                  | —                                             | —                                                         | —                                                                               | Human eyes                     | **Yes — `OWNER_VISUAL_REVIEW_PENDING`** |

## 11. Exact repository recovery instructions

```bash
cd D:/Documents/tryPython/superhabits-overnight   # campaign worktree
npm run agent:resume -- --plan .agent/execplans/windows-first-successor-campaign-v1.md
git status --short && git rev-parse HEAD          # expect clean; HEAD = final report commit
npm run qa:fast && npm run qa:integration         # fast + real-SQLite gates
npm run build:e2e && npx playwright test e2e/workout-editor-input-reliability.spec.ts --project=chromium
```

- Do not pop stash `pre-recovery-local-changes`; do not delete
  `.tmp-ios36423379932/` (iOS evidence) in either worktree; do not disturb
  `emulator-5570` / `emulator-5594`.
- The main checkout `D:/Documents/tryPython/superhabits` stays on `main`
  (`fb10d6c`); all campaign work lives in the overnight worktree.
- Never start iOS builds; never merge PR #79 while the audit gate is red.

## 12. Verdicts (kept separate)

| Verdict                       | State                                                                                                                                                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Engineering completion**    | **COMPLETE for the Windows-verifiable scope** — three workstreams + adversarial-review round, every fix reproduction-backed, all local gates green at the final head.                                                |
| **Product release readiness** | **BLOCKED** — mandatory security gate red (2 unremediated HIGH, no upstream patch), iOS device certification deferred by owner (the newest fixes un-certified on device), Android qualification environment-blocked. |

## 13. Closure round — final independent review findings and resolutions

Final adversarial review of the complete campaign diff (`f601226..22b59d8`)
reported **no P0/P1**; the atomicity, sync-intent, in-transaction merge,
numbering, and draft-input claims all survived direct attack (remount
semantics, `void onCommit` swallow contract, sequencer interactions, and
guard false-positive audit all verified sound). Findings and resolutions in
the closure commit:

- **P2-1** — "Use as template (duplicate)" dropped `duplicateRoutine`
  rejections (silent no-op + unhandled rejection), an inconsistency with the
  campaign's own rejected-write invariant. **Fixed**: the button surfaces the
  error in the routine dialog's banner.
- **P2-2** — the new e2e spec's fixed `waitForTimeout(1200)` could pass
  vacuously on a slow host. **Fixed**: the settle is now proven by an
  observable echo (the exercise summary re-renders with the refreshed set
  values) before the no-clobber re-assertion; no timing sleeps remain.
- **P3-1** — test-count claims disagreed across docs (5/7 vs actual 8).
  **Fixed** everywhere.
- **P3-2** — "the new tests genuinely pin their claims" was overbroad.
  **Fixed** with precise per-test evidence notes.
- **P3-3** — `WorkoutScreen`'s reschedule `.catch` could mislabel a post-move
  refresh failure as a failed move. **Fixed** (two-argument `then`).
- **P3-4** — `handleStartWorkout`'s comment overpromised ("never start from a
  stale configuration" — true only for pending, not rejected, writes).
  **Fixed** (honest contract wording).
- **P3-5** — `duplicateRoutine` binds `set_number ?? 0`; unreachable for
  NOT NULL rows. **Noted**, no change.
- **P2-3** — `snapshotSequencer`'s wiring is not directly regression-pinned
  (only the pure primitive is). **Registered** as a maintainability backlog
  item (§10); component-level test infra does not exist in this repo.
- Closure flake fix: `tests/restore.coordinator.test.ts`'s heavy `beforeAll`
  exceeded Vitest's 10s hook default 3× under full-suite parallelism (each
  serial re-run passed). Given an evidence-based 30s setup budget (no
  assertion touched) — **verified**: `qa:fast` 182/182 and the final full
  Vitest run are clean in-suite.
