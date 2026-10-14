## Context

Baseline verified 2026-10-15: local `main` and `origin/main` are `fb10d6ccfe66b54613c6fd22cb82da7dd7626e4f`. No commits after PR #78. Foreign stash `pre-recovery-local-changes` and untracked `.tmp-ios36423379932/` stay untouched. Implementation lives in worktree `D:/Documents/tryPython/superhabits-overnight` on `frontend-v3-post-w17-overnight-successor`.

Native failure artifacts are in the correction worktree's gitignored `simulation-output/native/`, not in this checkout. They were read, not modified.

## Goals / Non-Goals

**Goals:**

- Make the next recovery pointer true.
- Prove the over-goal Calories grammar in the standard Playwright lane.
- Fix the reproduced native navigation/scroll misses at the layer the artifacts support.
- Leave the security gate red and documented if no upstream fix exists.

**Non-Goals:**

- Redesigning W12–W17, regenerating goldens, or waiving advisories.
- Claiming iOS, notification-tray, or hosted e2e/nightly certification.
- Rebuilding an Android APK unless a product change must be device-proven and an emulator is usable without disturbing unrelated sessions.

## Decisions

### D1 — Habit save moves to the modal footer

The 2026-10-14 `habit-reminder-disable` failure screenshot shows Edit Habit open, reminder already off, and Save changes still below the fold after 24.6s of `scrollUntilVisible` (`visibilityPercentage` 100). The button lived inside the Linked Actions card. The modal already has a footer slot used by Calories. Moving Create/Save there keeps the labels and handlers and makes the primary action visible without that scroll.

Alternative considered: only change the Maestro swipe. Rejected as the sole fix because the screenshot shows the primary action is not on screen for a user who has not scrolled past optional linked actions, and the same scroll helper already failed to move the sheet.

### D2 — Workout flake is a harness gesture, not a lost row

`commands.json` for `…T111149074Z` shows Routine name and New routine name commands COMPLETED, then `scrollUntilVisible` Add routine FAILED. The tap bounds were `[82,2199][1000,2325]` on a 2400px display — under the floating tab bar, whose center control is Quick capture. The failure hierarchy contains the Plan sheet (`Save Plan`, `Plan for 2026-10-14`) and no Add routine. The flow now lifts the field with an edge swipe, asserts the typed name, and reveals Add routine from the screen edge. It does not claim a product persistence defect was reproduced.

### D3 — Security stays failed-unremediated unless versions move

`npm view` on 2026-10-15: `braces` latest `3.0.3`, `node-forge` latest `1.4.0`. No safe bump. The audit script and CI gate are not edited.

### D4 — One successor plan, not six

Campaigns A–F stay milestones of this change. A separate OpenSpec slice is not created for each small fix.
