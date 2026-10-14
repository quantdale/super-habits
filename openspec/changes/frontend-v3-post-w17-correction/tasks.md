# Post-W17 correction tasks

## 1. Worktree and living plan

- [ ] 1.1 Confirm the correction worktree is `D:/Documents/tryPython/superhabits-post-w17-correction` on `frontend-v3-post-w17-adversarial-correction`, and that the user's main checkout still has no staged campaign edits
- [ ] 1.2 Install dependencies in that worktree only, then record Node version and `git rev-parse HEAD` in the ExecPlan
- [ ] 1.3 Keep `execplan.md` at Plan-Version 2 and `ACTIVE`, with one exact next action, before the first production or test edit

## 2. Calories settings ripple

- [ ] 2.1 Build a hermetic web export and run `e2e/journeys/settings-ripple.spec.ts` on an owned free port; save the failure or pass output before editing
- [ ] 2.2 If the title, consumed-of-goal line, and `app_meta.calorie_goal` row already match `specs/calorie-goal-settings-propagation/spec.md`, retarget only the stale `Goal 2,400` assertions and keep the SQL, reload, and entry-count oracles
- [ ] 2.3 If the saved goal does not reach Calories or the durable row, fix that product path and add a regression at the layer that failed
- [ ] 2.4 Re-run the settings-ripple journey and record the SHA, port, and result in the ExecPlan

## 3. Visual capture readiness

- [ ] 3.1 Add a negative control that keeps an inactive hidden section opaque through the settle deadline and expects a named failure
- [ ] 3.2 Add a negative control that rejects a required font-face load and expects a failure naming that family
- [ ] 3.3 Confirm both controls fail on the current helper, then make capture fail closed without raising `maxDiffPixels` or masking goldens
- [ ] 3.4 Re-run the curated visual suite twice from a fresh state and record the current golden-set hash separately from the historical W15 hash

## 4. Plan and provenance truth

- [ ] 4.1 Replace the parent Calm Momentum Current Checkpoint and Recovery text so the next action is not "author W12", and leave that plan `ACTIVE`
- [ ] 4.2 Annotate present-tense W17 README, matrix, manifest, and handoff lines that call `1177ac2` or `3aaca2a` the current head, without moving historical run counts onto a later SHA
- [ ] 4.3 State that Android qualification at `b50034d` does not cover later `features/` edits, and that slice `tasks.md` checkbox counts are not current authority
- [ ] 4.4 Update the current-runtime sentence in the release-contract delta only after confirming migration 25 is still the last applied block
- [ ] 4.5 Remove or annotate unqualified present-tense known-gap claims that still call the fixed CRLF parser failure an environment residual

## 5. Independent probes

- [ ] 5.1 Reproduce or reject host-local calendar keys in the planning-hub, calories, calories-day-navigation, and workout-w9 specs across a UTC/Manila date boundary
- [ ] 5.2 Probe weekly-review commitment-create failure and decision-update throw behavior; add a regression only where the visible result or durable rows disagree with the existing partial-failure contract
- [ ] 5.3 Sample keyboard focus, 44pt targets, and one narrow/dark theme path on surfaces touched by any product fix; do not regenerate the 247-capture matrix unless a shared primitive changes
- [ ] 5.4 Run the dependency audit and record each high finding's chain, version, and fix availability without editing the allowlist
- [ ] 5.5 If `Nitro_API_36` is available, qualify the correction SHA with the credential-free provisioner; otherwise record `BLOCKED_EXTERNAL` and the last valid APK SHA

## 6. Validation and review

- [ ] 6.1 Run typecheck, lint, theme validation, OpenSpec validation, plan validation, and `npm run qa:affected` for the files actually changed
- [ ] 6.2 Run unit and integration tests, plus timezone and the corrected journey, at the correction SHA
- [ ] 6.3 Have a reviewer who did not write the patch try the old failure, a sibling date boundary, and a double-submit or rejected-write case for every product fix
- [ ] 6.4 Publish through a normal pull request, then record the merged `origin/main` SHA separately from the pre-merge evidence

## 7. Evidence pack

- [ ] 7.1 Write `docs/ui-ux/v3-audit/post-w17-correction/` with findings, evidence index, and release convergence, using the verdict taxonomy in `specs/post-w17-correction-evidence/spec.md`
- [ ] 7.2 Fill the ExecPlan Outcomes section only after the verdict's unresolved lanes are named, and set its next action to a no-op only if no in-scope implementation remains
