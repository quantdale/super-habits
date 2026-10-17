# Post-W17 overnight successor tasks

## 1. Baseline and living plan

- [x] 1.1 Verify `origin/main` is `fb10d6ccfe66b54613c6fd22cb82da7dd7626e4f` and preserve the foreign stash and `.tmp-ios36423379932/`
- [x] 1.2 Create worktree `frontend-v3-post-w17-overnight-successor` and this Plan-Version 2 ExecPlan
- [x] 1.3 Read the Oct 14 native failure commands, screenshots, and hierarchies before editing flows

## 2. Recovery pointer

- [x] 2.1 Replace the parent recovery sentence that resumes the COMPLETED correction
- [x] 2.2 Validate the parent and this plan with `npm run agent:plan:validate`

## 3. Calories over-goal grammar

- [x] 3.1 Add gated over-by-1, realistic-excess delete-back, and exactly-at-goal Playwright tests with browser-local date keys and SQLite oracles
- [x] 3.2 Run those tests against a hermetic `build:e2e` and record the result — 29/29 chromium on `e2e/calories-w10.spec.ts` + `e2e/habits.spec.ts`

## 4. Native flake root causes

- [x] 4.1 Move habit editor Create/Save into the modal footer and cover viewport reachability on web
- [x] 4.2 Stop the workout persistence flow from tapping a bottom-edge field or center-swiping into the Plan sheet
- [x] 4.3 Re-run the two flows on an exact-source APK if an emulator can be used without disturbing unrelated sessions; otherwise record BLOCKED_EXTERNAL with the artifact-backed classification — BLOCKED_EXTERNAL: attached emulator shells hung; flows classified from the preserved Oct 14 artifacts

## 5. Security and successor sweep

- [x] 5.1 Re-run `node scripts/audit-runtime-deps.mjs` and record installed versus latest versions without a waiver — FAIL, 2 undocumented HIGH, latest = installed
- [x] 5.2 Investigate the next reproduced P0/P1/P2 defect or record that locally executable high-value work is exhausted — the worktree WASM path was a real harness defect and is fixed; no further product P0/P1 was reproduced in the completed local lanes
