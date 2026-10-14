# W17 — Correction handoff (next-session bounded repair packet)

Campaign state at handoff: **CONDITIONAL / NEAR-COMPLETE**.
Source: `frontend-v3-w12-w17-integration` at `3aaca2a` (W17 fix SHA).
Read `docs/ui-ux/v3-audit/w17/README.md` first, then this file.

This packet is bounded: each item names a reproduction, the expected treatment,
the acceptance test and a runnable command. Nothing here requires re-auditing the
application or redoing a completed wave.

---

## Top next action

**Resolve the `settings-ripple` Calories marker mismatch (C-3).**

```text
Repro:  E2E_PORT=8086 npx playwright test e2e/journeys/settings-ripple.spec.ts --project=journeys
File:   e2e/journeys/settings-ripple.spec.ts:145
Oracle: the step asserts page.getByText('Goal 2,400') on the Calories section
        after changing the daily goal in Settings.
Accept: decide whether the W10 logging-first Calories hero is *supposed* to
        render a 'Goal 2,400' surface, then either restore that string in
        features/calories/CaloriesScreen.tsx (with a Calories regression) or
        update the journey assertion to the current hero text
        (e.g. '2,400 kcal left' / the goal control) — without weakening the
        SQLite goal-persistence oracle that follows it.
```

It is currently classified as pre-existing: the failure reproduces identically
at W12 `1d54b70` with every later change stashed. It is not a W12–W17 regression,
but it is a real red journey that has been carried since W11.5.

---

## 0. Resolved this session (do not re-open)

All three PR #76 Codex P2 findings were reproduced, fixed and pinned in
`af8eeda`; their threads are replied to and resolved.

| ID  | Finding                                                                                  | Fix                                                                                      | Regression                                                      |
| --- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| R-3 | Calorie timeline rows rendered a fabricated clock time from a date-only key              | `hasClockTime()` domain guard; the view formats a time only for timestamp-backed sources | `tests/activityTimeline.test.ts` +3                             |
| R-4 | Unfinished/planned-but-unrecorded weeks were described as "Nothing scheduled this week." | `weekHasAnyScheduledOrRecordedActivity()` covers every schedule-bearing count            | `tests/weeklyReview.domain.test.ts` +6                          |
| R-5 | "Review saved" was announced while a new commitment had failed                           | Partial-failure heading, warning tone, per-commitment titles, retry retained             | `e2e/weekly-review.spec.ts` 2/2, `e2e/planning-w12.spec.ts` 5/5 |

## 1. P0 / P1 — none outstanding

No P0 or P1 defect remains untriaged on the integrated web/PWA surface. The last
P1-class findings were fixed in their waves:

- W13-09 — `PillChip` exposed no selected state to web assistive tech → fixed
  (`aria-pressed`).
- W14-01 — new Settings/Weekly-Review disclosures were 32/36/40pt, below the
  44pt interactive contract → fixed and pinned in
  `tests/uiTouchTargetContract.test.ts`.
- W16 N-1 — native bottom-nav labels clipped → fixed and re-verified on-device.

## 2. P2 — grouped by owner

### 2.1 Test infrastructure

| ID  | Item                                | Evidence                                                               | Treatment                                        | Acceptance                                                   |
| --- | ----------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------ |
| C-3 | `settings-ripple` `Goal 2,400` step | `e2e/journeys/settings-ripple.spec.ts` fails on every wave since W11.5 | Decide the Calories goal-string contract (above) | Journey green with its `app_meta.calorie_goal` oracle intact |

### 2.2 Documentation consistency

| ID  | Item                                                                                                               | Evidence                                   | Treatment                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1 | `docs/testing/known-gaps.md` still lists the Windows-CRLF `agentDocConsistency` failure as an environment residual | W17 R-1 fixed it; the suite is fully green | Remove/annotate that residual and record the fix (`tests/agentDocConsistency.test.ts`). `tests/agentDocConsistency.test.ts` itself pins several guidance strings, so update both together |
| D-2 | `docs/PROJECT_STRUCTURE_MAP.md` / `AGENTS.md` baselines quote stale test counts                                    | counts drift every wave                    | Re-derive from `npx vitest list` / `npx playwright test --list`                                                                                                                           |
| D-3 | W16 `native-android-build.json` describes `b50034d`, not the W17 SHA                                               | W17's diff is test/docs only               | Either re-provision at the RC SHA to re-earn the native claim, or keep the explicit limit                                                                                                 |

## 3. P3 — polish (optional, non-blocking)

| ID  | Item                                                                                                                             | Value                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| P-1 | W15 golden coverage could add Focus-running and active-session states                                                            | Protects the two most motion-heavy screens; currently covered behaviourally only |
| P-2 | W12 `review-step1` dark golden lacks a `plan`/`reflect` step golden                                                              | Small; the light step-1 golden and the behavioural spec carry the contract       |
| P-3 | `docs/ui-ux/15-v3-defect-ledger.md` still shows `SYS-14`/`SUR-08`/`SUR-11`/`SUR-13` as one-line entries with long appended notes | Cosmetic readability                                                             |

## 4. Native / external

| ID  | Missing capability                                                                        | Exact command once available                                                                                                            | Source identity needed                                           |
| --- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| C-4 | iOS simulator/device or the EAS cloud lane                                                | `npm run qa:native:ios` (simulator) or dispatch `.eas/workflows/native-e2e.yml`                                                         | The RC SHA, installed app build id                               |
| C-7 | Hosted `e2e` + `nightly`                                                                  | Push the branch, then `gh run watch` on the `e2e` job                                                                                   | Requires C-1/C-2 resolved or an accepted local-ladder substitute |
| —   | Re-earn the Android claim at the RC SHA                                                   | `node scripts/qa-native-provision.mjs --serial <serial>` then `--tag smoke\|persistence\|lifecycle\|reward\|backup-v2\|portable-backup` | Boot `Nitro_API_36` with `-gpu host`                             |
| C-5 | Notification-tray delivery, long-horizon recurrence, `Alert.alert`, system offline toggle | Not automatable in this repo's lanes                                                                                                    | —                                                                |

## 5. Security (do not waive)

| ID  | Item                             | Exact command                         | Acceptance                                                                                                                                                                                                                                  |
| --- | -------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-1 | `braces` GHSA-vfj7-8cjw-p6xm     | `node scripts/audit-runtime-deps.mjs` | Zero undocumented high/critical. Requires an upstream patched release, or removing the tooling that resolves it (`tailwindcss → chokidar/micromatch`) — then re-run the full ladder                                                         |
| C-2 | `node-forge` GHSA-86w9-cpqp-85rv | same                                  | As above; the chain is `expo → @expo/cli → @expo/code-signing-certificates`. Do **not** add an allowlist entry to pass — the policy permits only dated, narrowly-scoped documentation, and neither advisory currently qualifies as resolved |

Both are already at their latest published versions with advisory range `*`, and
neither ships in the web bundle or the APK (see the defect register for the
bundle-scan evidence).

## 6. Regression infrastructure

| ID  | Item                          | Expected proof                                                                                                                            |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| —   | W15 goldens are Chromium-only | If a supported Linux CI runner renders differently, pin the runner rather than relaxing `maxDiffPixels: 0`                                |
| P-1 | Additional goldens (see §3)   | Add with `npm run visual:update` locally, inspect previous/proposed/diff, record in the baseline manifest, and re-prove two-run stability |

## 7. Acceptance gates for the next session

Run these after any change from §1–§6:

```bash
npm run typecheck
npm run lint
npm test                      # expect 2,691 passed / 2 skipped / 0 failed
npm run qa:integration
npm run qa:timezones
npm run validate:themes
npm run openspec:validate
npm run agent:plan:validate:all
npm run build:e2e
E2E_PORT=8086 npm run e2e:journeys:p0     # 25/25
E2E_PORT=8086 npm run visual              # 30/30, hash 0676368d…
E2E_PORT=8086 npx playwright test --project=chromium   # 245/245
node scripts/audit-runtime-deps.mjs       # currently red — C-1/C-2
```

After a change that touches native code or the Android flows, also re-provision
and re-run the six Android tag lanes (§4).

## 8. What must not be redone

- Do not re-implement W12–W16. Their designs, modules and evidence are complete;
  this packet only closes the items above.
- Do not re-research the Calm Momentum design system or the W12/W13 grammars.
- Do not run the whole campaign again to fix one journey.
