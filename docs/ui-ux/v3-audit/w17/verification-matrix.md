# W17 — Verification matrix

Source: W17 fix SHA `3aaca2a`. Every number below is from the lane's own run on
this revision. `Not run` means exactly that.

## Summary

| Lane                        | Source SHA    | Run command                                             |   Executed |    Passed | Failed | Skipped | Blocked / Not run       | Classification                     |
| --------------------------- | ------------- | ------------------------------------------------------- | ---------: | --------: | -----: | ------: | ----------------------- | ---------------------------------- |
| Static / contracts          | `3aaca2a`     | `npm run typecheck`                                     |          1 |         1 |      0 |       0 | —                       | PASS                               |
| Lint                        | `3aaca2a`     | `npm run lint`                                          |          1 |         1 |      0 |       0 | —                       | PASS                               |
| Themes                      | `3aaca2a`     | `npm run validate:themes`                               |        140 |       140 |      0 |       0 | —                       | PASS                               |
| OpenSpec contracts          | `3aaca2a`     | `npm run openspec:validate`                             |         86 |        86 |      0 |       0 | —                       | PASS                               |
| Versioned ExecPlans         | `3aaca2a`     | `npm run agent:plan:validate:all`                       |          — |       all |      0 |       — | —                       | PASS                               |
| Release-profile guard       | `3aaca2a`     | `npm run release:profiles:guard`                        |          3 |         3 |      0 |       0 | —                       | PASS                               |
| Unit + integration (Vitest) | `3aaca2a`     | `npm test`                                              |      2,693 | **2,691** |  **0** |       2 | —                       | PASS (first fully-green run)       |
| Integration project only    | `3aaca2a`     | `npm run qa:integration`                                |        421 |       419 |      0 |       2 | —                       | PASS                               |
| Timezone / clock            | `3aaca2a`     | `npm run qa:timezones`                                  |        105 |       105 |      0 |       0 | —                       | PASS (5 zones)                     |
| P0 journeys                 | `3aaca2a`     | `npm run e2e:journeys:p0`                               |         25 |        25 |      0 |       0 | —                       | PASS                               |
| Full Chromium battery       | `3aaca2a`     | `npx playwright test --project=chromium`                |        245 |   **245** |      0 |       0 | —                       | PASS                               |
| Visual regression goldens   | `3aaca2a`     | `npm run visual`                                        |         30 |        30 |      0 |       0 | —                       | PASS                               |
| Accessibility instrument    | `3aaca2a`     | `npx playwright test e2e/a11y.spec.ts`                  |         10 |        10 |      0 |       0 | —                       | PASS                               |
| Deterministic simulation    | `3aaca2a`     | `npm run qa:simulation`                                 | 1 scenario |         1 |      0 |       0 | —                       | PASS                               |
| Android API-36 native       | **`b50034d`** | `node scripts/qa-native.mjs --platform android --tag …` |         23 |        23 |      0 |       0 | —                       | PASS at that SHA (see limit 1)     |
| Dependency security audit   | `3aaca2a`     | `node scripts/audit-runtime-deps.mjs`                   | 2 findings |         0 |      2 |       — | —                       | **FAIL (inherited, unremediated)** |
| Hosted CI (GitHub Actions)  | various       | `gh run list`                                           |          — |         — |      — |       — | `e2e`/`nightly` skipped | Blocked behind the audit gate      |

## Lane detail

### Lane 1 — Static and contract integrity

- `tsc --noEmit`: 0 errors.
- `eslint . --max-warnings 0`: 0 errors, 0 warnings.
- `validate:themes`: **140/140** contrast checks across all themes.
- `openspec:validate`: **86/86** (was 81 at the W11.5.1 baseline; +5 from the W12–W17 slices).
- `agent:plan:validate:all`: all versioned plans PASS.
- `release:profiles:guard`: 3 release-candidate profiles carry no test-only reminder flag; only `e2e-test` does.
- `git diff` on the W17 SHA: no production schema, sync, dependency or security mutation.

### Lane 2 — Unit, domain and real-SQLite integration

- `npm test`: **2,702 executed, 2,700 passed, 0 failed, 2 skipped**.
  - The two skips are pre-existing opt-in lanes (disposable cloud).
  - **This is the first fully-green run of the campaign.** Every prior wave
    (W7–W16, including pristine `main`) recorded exactly 1 failure,
    `tests/agentDocConsistency.test.ts`, described as a "Windows-CRLF
    ENVIRONMENT residual". W17 proved that classification wrong (see the defect
    register, defect R-1) and fixed it.
- `qa:integration`: 421 executed / 419 passed / 2 skipped, real better-sqlite3.
- Direct checks in this run include date keys, next-week application,
  review/goal/project links, rejected writes and retries, backup/outbox
  consistency, settings persistence, command write safety and gamification
  idempotence (per-suite, unchanged from their owning waves).

### Lane 3 — Web/PWA functional journeys

- P0 journeys: **25/25**.
- Full Chromium battery: **245 passed / 0 failed / 0 flaky** in 23.8m.
- The battery includes the W12 (`planning-w12`), W13
  (`secondary-surface-w13`), W14 workflow and W15-lane-adjacent specs.
- Service-worker/offline and two-tab behaviour are covered by the existing
  PWA project and journeys (not re-run in this lane; see not-run notes).

### Lane 4 — Timezone, clocks and lifecycle

- `qa:timezones`: **105 passed** under Asia/Manila, UTC, America/New_York,
  Pacific/Honolulu, Pacific/Kiritimati.
- Includes the W11.5.1 UTC→Manila crossover regression and the
  `browserDate.ts` fixtures.

### Lane 5 — Deterministic simulation and performance

- `qa:simulation`: 1 gate scenario, 24 steps, all passed.
- Performance budgets (D14) were exercised inside the Chromium battery
  (`boundary`, `three-months-in`); no ceiling was raised or bypassed in W12–W17.

### Lane 6 — Visual and accessibility

- W15 curated goldens: **30/30**, hash `0676368d…` (two-run stability proven in W15).
- `a11y.spec.ts`: **10/10**.
- The W14 sweep inspected 247 captures across 7 widths and both themes; the W12
  and W13 waves inspected 40 and 44 before/after captures respectively; the W16
  wave inspected the on-device captures.

### Lane 7 — Android/iOS and external services

- Android (at `b50034d`): smoke 2/2, persistence 11/11, lifecycle 6/6,
  reward 1/1, backup-v2 1/1, portable-backup 2/2 — **23/23**.
- iOS: **NOT RUN** (owner-deferred). No cloud/EAS Maestro access was verified.
- Live Supabase round-trip: **NOT RUN** (the disposable-backend lane requires
  `SUPABASE_ACCESS_TOKEN`; production is never touched).

## Not run — explicit

| Item                                                                    | Reason                                                                    |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Hosted `e2e` / `nightly` jobs                                           | Gated behind the failing dependency audit at the baseline; not passed     |
| PWA project + sync (`journeys-sync`) lane                               | Not executed in W17; covered by W15/W16 evidence and the standard battery |
| Android matrix at the W17 SHA                                           | W17 changed only tests/docs; the APK is certified at `b50034d`            |
| iOS simulator/cloud                                                     | Owner-deferred; no authorized environment                                 |
| Live Supabase / RLS round-trip                                          | Requires explicit authorization and a disposable project                  |
| Native notification-tray delivery, `Alert.alert`, system offline toggle | Documented capability gaps (unchanged)                                    |

## Counting rules applied

- Vitest project totals are reported per project; the 2,691 figure is the
  combined unit+integration run, not a sum of the two rows.
- Playwright totals are per project; the 245 is the chromium project only.
- The Android figure is 23 flows across six tag lanes, each counted once.
- No lane's tests are counted twice as separate coverage.
