# Post-W17 correction — evidence index

Change: `frontend-v3-post-w17-correction`
Branch: `frontend-v3-post-w17-adversarial-correction`
Baseline: `bf09c0d50ca35a23bcc9df2582ea8398124d1038`
Correction commits (this branch): `d0a6fdc` (planning) → `2c1fe99` (C-3) →
`b0d5d0c` (visual fail-closed) → `76f0fa6` (date keys) → `47a9686`
(provenance docs) → `52a10d0` (OpenSpec checkpoint) → `eb718ca` (native flow
fix) → evidence-pack commit(s).

Every number below was produced at this branch's tree by the command shown.
Historical W12–W17 run counts keep their original revisions and are not
repeated here as current (see `findings.md` H03/H07).

## Counts at the correction tree (recomputed, not copied)

| Inventory               | Command                      | Result                                                               |
| ----------------------- | ---------------------------- | -------------------------------------------------------------------- |
| Vitest enumerated tests | `npx vitest list`            | 2,700 entries                                                        |
| Vitest executed         | `npm test`                   | **2,702 executed — 2,700 passed / 2 skipped / 0 failed** (265 files) |
| Playwright inventory    | `npx playwright test --list` | **501 tests in 56 files**                                            |

## Web / harness evidence

| Lane                                    | Command                                                                               | Result                                                                                                                                                               | Revision       |
| --------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Hermetic export                         | `npm run build:e2e`                                                                   | OK — `dist/`, 0 Supabase hosts                                                                                                                                       | baseline tree  |
| settings-ripple PRE-fix (reproduction)  | `npx playwright test --project=journeys e2e/journeys/settings-ripple.spec.ts` (:8081) | **FAIL** at `settings-ripple.spec.ts:145` — `Goal 2,400` not found; failure snapshot shows W10 grammar                                                               | `d0a6fdc`+tree |
| settings-ripple POST-fix                | same (:8081)                                                                          | **6/6 PASS** — `app_meta.calorie_goal` = {2400,150,200,65}, reload check, 2-row entry-count oracle held                                                              | `2c1fe99`      |
| settings-ipple re-run at correction SHA | same                                                                                  | **6/6 PASS**                                                                                                                                                         | `52a10d0`      |
| Visual readiness controls PRE-fix       | `npx playwright test --project=visual -g "capture readiness self-checks"`             | **3 failed / 1 passed** — old `settle()` fail-open proven on all three branches                                                                                      | `d0a6fdc`+tree |
| Visual readiness controls POST-fix      | same                                                                                  | **4/4 PASS** — named `section readiness unmet` / `required font load failed — Nunito_700Bold`; strict comparison: settled capture matches golden, perturbation fails | `b0d5d0c`      |
| Visual full suite (run 1)               | `npx playwright test --project=visual` (:8081)                                        | **34/34** (30 goldens + 4 self-checks)                                                                                                                               | `b0d5d0c`+tree |
| Visual full suite (run 2)               | `npx playwright test --project=visual` (:8089)                                        | **34/34**                                                                                                                                                            | same           |
| Golden-set hash before/after both runs  | `sha256sum e2e/__screenshots__/visual-regression.spec.ts/*.png \| sha256sum`          | `f19261d5d676ac1ef10cc526a4fb19d41e0edbf1a6e3ebd87fcb437c50dcdeaa` — unchanged; historical W15 hash `0676368d…` preserved separately                                 | same           |
| Date-key boundary PRE-fix (H08 probe)   | five specs + `NODE_OPTIONS` Date shim (host date − 1 day)                             | **16 failed / 25 passed**                                                                                                                                            | `d0a6fdc`+tree |
| Date-key control (no shim)              | five specs                                                                            | 41/41                                                                                                                                                                | same           |
| Date-key boundary POST-fix              | five specs + shim                                                                     | **41/41**                                                                                                                                                            | `76f0fa6`      |
| Date-key control POST-fix               | five specs                                                                            | **41/41**                                                                                                                                                            | `76f0fa6`      |
| P0 journeys                             | `npm run e2e:journeys:p0`                                                             | **25/25**                                                                                                                                                            | `52a10d0`      |
| Timezone matrix                         | `npm run qa:timezones`                                                                | **111 passed** across Asia/Manila, UTC, America/New_York, Pacific/Honolulu, Pacific/Kiritimati                                                                       | `52a10d0`      |

## Static / contract gates (task 6.1)

| Gate                | Command                                            | Result                                                                                                                                                                                                                                                                                     |
| ------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Typecheck           | `npm run typecheck`                                | 0 errors                                                                                                                                                                                                                                                                                   |
| Lint                | `npm run lint` (`--max-warnings 0`)                | 0 errors, 0 warnings                                                                                                                                                                                                                                                                       |
| Themes              | `npm run validate:themes`                          | 140/140 contrast checks                                                                                                                                                                                                                                                                    |
| OpenSpec            | `npm run openspec:validate`                        | 87/87                                                                                                                                                                                                                                                                                      |
| Versioned ExecPlans | `npm run agent:plan:validate:all`                  | all PASS (parent Calm Momentum `ACTIVE`)                                                                                                                                                                                                                                                   |
| Impact map          | `npm run qa:affected`                              | matched rules: calories, workout-gym-v2, e2e-and-simulation-infrastructure, agent-workflow-and-documentation; full ladder required — the minimum contracted gates (6.1/6.2) plus the broad native lanes were executed; `e2e:sync`/`qa:full` remain nightly-class (see release-convergence) |
| Doc consistency     | `npx vitest run tests/agentDocConsistency.test.ts` | 11/11 (doc pins intact after annotations)                                                                                                                                                                                                                                                  |

## Native evidence (exact source)

Provisioning (hermetic, credential-free) at the correction app source:

| Field                | Value                                                              |
| -------------------- | ------------------------------------------------------------------ |
| Command              | `NATIVE_ANDROID_SERIAL=emulator-5594 npm run qa:native:provision`  |
| Target               | AVD `Nitro_API_36` (API 36, x86_64), `emulator-5594`               |
| Source               | `52a10d01a4d73394a699880766a612c009fc0cd8`                         |
| APK SHA-256          | `65558DFEEA587E11124CE3D4920564EE8938236A7CC37EA731EE0F91156E4D0D` |
| Bundle scan          | 1 JS entry, 0 Supabase hosts                                       |
| Remote configuration | none configured (local-only)                                       |
| Provenance           | `simulation-output/native/native-android-build.json`               |

| Lane                     | Command                                                      | Result                                                 | Report                                                         |
| ------------------------ | ------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------- |
| smoke                    | `npm run qa:native:android`                                  | **2/2**                                                | `native-android-smoke-Nitro_API_36-2026-10-14T100218821Z.json` |
| persistence run 1        | `npm run qa:native:targeted`                                 | 10/11 — `habit-reminder-disable` FLAKY_TEST            | `…T102936199Z.json`                                            |
| persistence run 2        | `npm run qa:native:targeted`                                 | 10/11 — `workout-gym-v2-persistence` FLAKY_TEST        | `…T111149074Z.json`                                            |
| persistence run 3        | `npm run qa:native:targeted`                                 | **11/11**                                              | `…T120044699Z.json`                                            |
| lifecycle                | `npm run qa:native:lifecycle`                                | **6/6**                                                | `…T113824608Z.json`                                            |
| reward                   | `node scripts/qa-native.mjs --platform android --tag reward` | **1/1**                                                | `…T120247481Z.json`                                            |
| backup-v2                | `… --tag backup-v2`                                          | **1/1**                                                | `…T120358069Z.json`                                            |
| portable-backup PRE-fix  | `… --tag portable-backup`                                    | 1/2 (×2) — reproducible off-screen assert (`TEST_BUG`) | `…T120655749Z.json`, `…T121321014Z.json`                       |
| portable-backup POST-fix | `… --tag portable-backup`                                    | **2/2**                                                | `…T122819798Z.json`                                            |

Flake replays (standalone, preserved): `habit-reminder-disable` 3/3 green after
its single lane failure; `workout-gym-v2-persistence` mixed 2/4 across runs at
two different steps, green in two full-lane runs. Classification and debug
artifacts under `simulation-output/native/debug-android-*`.

**Native total at the correction app source: 23/23 flows across the six W16
tag lanes** (with the two `FLAKY_TEST` incidents and the `TEST_BUG` flow fix
recorded above). The flow fix commit `eb718ca` touched only
`.maestro/flows/portable-backup.yaml`, so the installed APK's app source equals
`52a10d0`.

**iOS: NOT RUN** — Windows host, no authorized simulator/cloud lane
(`npm run qa:native:ios` never executed; no iOS claim in this pack).

## Security evidence

| Command     | `node scripts/audit-runtime-deps.mjs`                                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Result      | **FAIL — 2 undocumented HIGH** (`braces` GHSA-vfj7-8cjw-p6xm, `node-forge` GHSA-86w9-cpqp-85rv); 3 documented `brace-expansion` entries unchanged                        |
| Disposition | UNREMEDIATED — exposure limited (build-time chains, absent from both bundles); no upstream fix (installed = latest, range `*`); nothing waived, allowlisted, or softened |
| Unchanged   | `package.json`, `package-lock.json`, `scripts/audit-runtime-deps.mjs` untouched by this change                                                                           |

Hosted `e2e`/`nightly` skip behind this gate and are recorded as **not run**.

## Artifact map

- Findings and dispositions: `docs/ui-ux/v3-audit/post-w17-correction/findings.md`
- Release convergence + verdict: `docs/ui-ux/v3-audit/post-w17-correction/release-convergence.md`
- Native reports + debug trees: `simulation-output/native/`
- Playwright failure artifacts (pre-fix reproduction, preserved):
  `.cursor/playwright-output/e2e-failures/`
- Golden manifest history: `docs/ui-ux/v3-audit/w15/golden-manifest.md`
  (change-log records the `e70ccc7` three-golden regeneration)
