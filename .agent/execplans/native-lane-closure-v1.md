# ExecPlan: Native Persistence Lane Closure V1

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Close known-gap 18 (native persistence lane starvation on a loaded host) by
running the repaired persistence lane against a **freshly booted, owned,
single** Nitro_API_36 target with canonical rebuilt provenance at current
HEAD, per the gap's documented closing path. If the lane is green, remove
gap 18 and mark gap 17 fully closed; if the same environment-class starvation
reappears on a rested target, apply the documented batch-split remedy with
preserved evidence instead of weakening assertions.

Observable success: a `native-android-persistence-*.json` report at current
source with status PASS (11/11 flows), the known-gap register updated to
match, coherent commits pushed, and no owned emulator left booted.

## Context

- Baseline: `HEAD == origin/main == 5bb090f`, tree clean, no ACTIVE planner
  prompt. Last completed campaign (`.agent/execplans/autonomous-campaign-v1.md`)
  repaired the post-redesign Maestro selectors (gap 17) and left gap 18 as
  its explicit follow-up: `rested-device qa:native:targeted` re-run.
- Gap 18 evidence (docs/testing/known-gaps.md): lane runs produced 7–10/11
  with failures moving between unchanged flows; failure screenshots show the
  asserted content rendered while Maestro's matcher reports "No visible
  element found"; host was running two AVDs + Gradle rebuilds + other heavy
  processes; primary emulator had ~15.7 h guest CPU. Classification:
  ENVIRONMENT (maestro↔device hierarchy starvation), not product/flow defect.
  All 11 flowed individually on the same device/APK, repeatedly.
- Runner: `node scripts/qa-native.mjs --platform android --tag persistence
--avd Nitro_API_36` boots an owned emulator (`-no-boot-anim
-no-snapshot-save`), enforces clean tree + API 36 x86_64 + source-SHA
  provenance, rebuilds/reinstalls when host build SHA ≠ current HEAD, and
  stops the owned emulator at the end. Replay is recorded in the report.
- Current host: `emulator-5560` holds an unrelated `braintraining-ui35` AVD
  (API 35, idle) and the brain-training repo's Expo dev server holds :8081.
  Neither belongs to this repository; do not kill them. Our E2E port is
  overridable via `E2E_PORT`, and the native runner does not need 8081.
- Installed build metadata: source `08e1c6d`, APK `595A7630…`, canonical
  (not mock). Current HEAD differs (docs/flow-only commits since), so the
  runner will rebuild from `5bb090f` — the intended provenance.

## Scope

1. Plan + commit/push before the lane (runner requires a clean tree).
2. Run `npm run qa:native:targeted -- --avd Nitro_API_36` on the rested host
   (fresh owned boot, auto-provisioned current-source APK).
3. On PASS: update `docs/testing/known-gaps.md` (gap 18 closed; gap 17 fully
   closed), record evidence, commit/push.
4. On the same environment-class failure: preserve the report + screenshots,
   classify per taxonomy, and execute the documented remedy — split the
   persistence lane into smaller batches (runner or scripted per-flow
   invocations) and record which batching is stable, without weakening any
   assertion.
5. Final hygiene: no owned emulator left booted; `web:hygiene` state recorded
   (the :8081 owner is external and unrelated).

## Non-Goals

- No product-code changes unless the lane proves a genuine product defect
  (none expected; the same flows pass individually and web equivalents pass).
- No weakening, skipping, or retrying of assertions; no flow edits unless a
  NEW selector/tap defect is proven on-device with evidence.
- No killing unrelated processes/AVDs (brain-training Metro on :8081,
  braintraining-ui35 on emulator-5560).
- No iOS lane (no macOS host), no EAS cloud submission.

## Current Checkpoint

- Current milestone: WS2 — official lane re-running on a rested owned boot;
  diagnosing the two failures from the first rested run while it runs.
- Completed: state reconciliation; first rested lane run (9/11: `calories-
persistence`, `workout-gym-v2-persistence` failed); deterministic on-device
  repro + root cause for the gym failure; gym flow fixed and verified 3/3;
  calories failure isolated to a late-render/hierarchy-starvation race (not
  swipe-swallow) and passed 2/2 standalone; gym fix committed (`48cee09`).
- In progress: `npm run qa:native:targeted -- --avd Nitro_API_36` on a fresh
  owned boot (prior owned emulator shut down first; only unrelated
  emulator-5560 remains).
- Important modified files: `.maestro/flows/workout-gym-v2-persistence.yaml`
  (committed), this plan.
- Last successful validation: gym flow 3/3 PASS on-device; calories flow 2/2
  PASS on-device.
- Current failures: calories lane failure is intermittent and load-correlated;
  see Surprises.
- Relevant quarantines: known-gap 15/16 (host-load flakes, unchanged), 17
  (repaired), 18 (this plan).
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: read the background lane outcome (report under
  `simulation-output/native/native-android-persistence-*`); if 11/11 PASS,
  close gap 18 in `docs/testing/known-gaps.md`, commit/push, mark plan
  COMPLETED; if calories recurs, apply a poll-tolerant reachability step and
  re-run.
- Remaining definition of done: lane outcome recorded with artifacts; gap 18
  closed or batching proven stable; register/plan updated; commits pushed;
  no owned emulator left running.

## Progress

- [x] WS1 — plan committed/pushed (`b08b443`); lane launched
- [x] WS1b — diagnosed first rested-run failures; gym flow fixed and verified
      (`48cee09`)
- [ ] WS2 — official lane outcome recorded (report path, per-flow pass/fail)
- [ ] WS3 — register updated (gap 18 closed or batching evidence recorded)
- [ ] WS4 — commits pushed; hygiene recorded; plan COMPLETED

## Surprises & Discoveries

- 2026-09-13 — **Gym failure is a real, deterministic flow defect, not
  environment flake.** `scrollUntilVisible` anchors its swipes at the screen
  center. At that point in the routine editor the center (540,1200) is the
  focused reps `EditText` (uiautomator: `EditText "5" [405,1126][675,1213]`);
  the field consumes the drag so the parent list never scrolls and `Target
load` stays clipped below the fold (`[117,1908][965,1867]`). Proof: the same
  center swipe moves nothing, while a left-margin swipe (`input swipe 50 1600
50 500 400`) brings `Target load` to `[117,391][965,425]` VISIBLE.
- 2026-09-13 — Calories failure is a **different class**: its Form-view center
  is a plain `ScrollView` (no input), and the failure artifact shows `Logged
today` visible at `[62,1442][1020,1518]` while Maestro logged
  `ElementNotFound` for ~29 s after `tapOn: 'Form view'`. Late render /
  hierarchy starvation under sequential-lane load; absent the lane's device
  churn it passes 2/2 standalone. Root cause for the lane's intermittent
  calories failure is still under test (this re-run).

## Decision Log

- 2026-09-13 — Run the supported `--avd` orchestration instead of a manual
  `adb`/`maestro` loop: it owns boot, provenance, rebuild, and emulator
  cleanup, and records a replay command. The unrelated booted AVD and the
  external :8081 owner are left untouched.
- 2026-09-13 — Native lane closure is the first successor campaign because it
  is the explicit, evidence-backed follow-up of the last COMPLETED campaign
  and is locally executable; OpenSpec lifecycle drift (completed changes
  never archived → capabilities absent from `openspec/specs`, e.g.
  `weekly-review-cadence`) is queued as the next campaign.

## Validation Ledger

- 2026-09-13 — reconciliation (`git status/log`, `agent:plans`,
  `agent:resume`, `gh run list`, `adb devices`, `emulator -list-avds`,
  `web:hygiene`) — see Current Checkpoint; only external owners on :8081 and 5560.

## Changed Files / Areas

- `.agent/execplans/native-lane-closure-v1.md` — this plan.
- `docs/testing/known-gaps.md` — gap 18 closure/batching evidence (pending
  lane outcome).
- `.agent/execplans/autonomous-campaign-v1.md` — cross-reference only if the
  register change needs it (prefer not to rewrite the closed plan).

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan.
2. `git status --short`; reconcile with the checkpoint (Git wins).
3. Inspect `simulation-output/native/` for the newest
   `native-android-persistence-*` report and `debug-*` directories.
4. If the lane ran: read its status and per-flow record; continue from the
   exact next action.
5. Re-run command (if needed): `npm run qa:native:targeted -- --avd
Nitro_API_36` from a clean committed tree.

## Outcomes & Retrospective

- Status: Active.
- Summary: Pending.
- Follow-up: Pending.
