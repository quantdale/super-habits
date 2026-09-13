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

- Current milestone: WS2 — all three deterministic flow defects found in the
  rested lane run are fixed and verified standalone; official lane re-run next.
- Completed: gym `Target load` low-anchor/margin swipe (`48cee09`, 3/3);
  habit-schedule post-create top-of-Anytime reachability (`d5dfd8f`, 4/4);
  calories `Logged today` low-anchor pre-scroll + `Native breakfast` poll
  (`d5dfd8f`, 8/8, artifacts in `simulation-output/native/cal-dbg-*`).
- In progress: official `npm run qa:native:targeted -- --avd Nitro_API_36`
  re-run on a rested owned boot.
- Important modified files: `.maestro/flows/*` (committed), this plan.
- Last successful validation: standalone volumes above; emulator booted for
  the lane; only the unrelated emulator-5560 remains after.
- Current failures: none known in the three repaired flows.
- Relevant quarantines: known-gap 15/16 (unchanged), 17 (repaired), 18 (this
  plan).
- Blockers: None for the lane.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: read the lane outcome; on PASS update
  `docs/testing/known-gaps.md` (delete gap 18, mark gap 17 fully closed),
  commit/push, mark this plan COMPLETED. On recurrence, classify the failing
  step from its artifacts before any further edit.
- Remaining definition of done: lane report PASS at current source; register
  updated; commits pushed; no owned emulator left running.

## Progress

- [x] WS1 — plan committed/pushed (`b08b443`); lane launched
- [x] WS1b — first rested lane run diagnosed; gym fixed (`48cee09`)
- [x] WS1c — habit-schedule + calories flow defects fixed (`d5dfd8f`)
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
- 2026-09-13 — **habit-schedule failure is a deterministic reachability bug.**
  The habit IS created (`1 habits across your daily routine`, tile with
  `Mon / Wed / Fri`), but it lands at the top of the Anytime group while the
  screen is still scrolled to the bottom add tile; the flow's DOWN scroll
  could never reach it. Fix: return to top with side-margin swipes, then the
  scoped scroll.
- 2026-09-13 — **calories is a reproducible starvation/reachability flap, not
  host-load environment.** Standalone: 2/5 then 3/5 failures; a probe flow
  showed the saved section absent from the on-screen a11y tree right after
  the 8 s settle; `uiautomator` point probing showed two center swipes at
  (540,1200) move nothing while a swipe from y=1900 reveals the section
  immediately; the final diary step's UP scroll pushed a visibly rendered
  chip (`Native breakfast` at y1409) off-screen during the diary rebuild.
  Fixes: low-anchor (80% height) pre-scroll before each `Logged today` scroll
  and a poll (no directional scroll) for the diary chip. 8/8 standalone.

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
