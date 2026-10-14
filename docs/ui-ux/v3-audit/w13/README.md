# W13 — Settings / Command Center / Achievements: rendered evidence and defect register

Source: branch `frontend-v3-w12-w17-integration`, W13 commits on top of W12
`1d54b70` (which descends from `1f23da4` = `origin/main`).

Hermetic build: `unset EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY
&& npm run build:e2e` → PASS, Supabase leak guard reports 0 hosts in `dist/`.

Capture command (both states):

```bash
VISUAL_AUDIT=1 VISUAL_AUDIT_OUTPUT_DIR=docs/ui-ux/v3-audit/w13/before \
  E2E_PORT=8086 npx playwright test e2e/secondary-surface-w13-audit.spec.ts --project=chromium
VISUAL_AUDIT=1 VISUAL_AUDIT_OUTPUT_DIR=docs/ui-ux/v3-audit/w13/after \
  E2E_PORT=8086 npx playwright test e2e/secondary-surface-w13-audit.spec.ts --project=chromium
```

## Measured change (read from the inspected captures)

| Metric                                                   | Before                                                                           | After                                                        |
| -------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Times the theme value is narrated in one viewport        | **4** (pill + `Current selection` row + `Current behavior` row + sentence)       | **2** (pill selected state + one `Current appearance` row)   |
| Always-visible prose paragraphs in a settings section    | one per row (mandatory `description`)                                            | 0 by default; one `Details +` disclosure per row             |
| Settings heading blocks before the first control         | icon tile + eyebrow + 20px title + subtitle                                      | eyebrow + short title                                        |
| First controllable preference in the Settings first fold | below a heading block + `Back` row                                               | theme pills visible at 390×844                               |
| `CURRENT SECTION` panel in the Command Center            | full-width bordered panel, first element                                         | removed — one caption line                                   |
| Command Center blocks above the input                    | 2 (context panel + `Command input` header/subtitle)                              | 0                                                            |
| Example/suggestion surfaces rendered while typing        | 2 (`Suggestions` chips + bordered `Supported examples` panel, the latter always) | 0 (chips render only while the field is empty)               |
| Achievement stat tiles                                   | 3 (Total XP, Best streak, Badges) for 2 distinct facts                           | 2 (Total XP, Badges); best streak moved to Streak protection |
| Always-visible badge tiles                               | up to 12, unchanged treatment                                                    | earned tiers inline; full collection behind `All badges`     |

## Defect register (W13)

| ID     | Surface           | Class         | Sev | Cause                                                                                                                                                                   | Fix                                                                                          | Retest                                                                                                | Screenshot                                                     |
| ------ | ----------------- | ------------- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| W13-01 | Settings          | PRODUCT_UX    | S2  | `Current selection` + `Current behavior` rows restated the same preference the pills already showed (`SUR-08`)                                                          | One value authority: pills + one `Current appearance` row                                    | `e2e/secondary-surface-w13.spec.ts` first test asserts both old labels have count 0                   | `before/390-settings-top.png` → `after/390-settings-top.png`   |
| W13-02 | Settings          | DENSITY       | S2  | `SettingsRow.description` was a required prop, so every setting narrated itself                                                                                         | `value` (always visible) + optional `explanation` behind an accessible disclosure            | same spec: `Show details for Current appearance` toggles `aria-expanded`                              | `after/390-settings-mid.png`                                   |
| W13-03 | Settings          | HIERARCHY     | S2  | Icon tile + eyebrow + 20px title + subtitle preceded the first control                                                                                                  | Quiet eyebrow + short title                                                                  | inspected after-captures at 390/1280                                                                  | `after/390-settings-top.png`                                   |
| W13-04 | Command           | HIERARCHY     | S2  | A full bordered `CURRENT SECTION` panel led the overlay (`SUR-11`)                                                                                                      | One caption line: `From Overview · …`                                                        | `e2e/secondary-surface-w13.spec.ts` asserts both `CURRENT SECTION` and `Current section` have count 0 | `before/390-command-empty.png` → `after/390-command-empty.png` |
| W13-05 | Command           | VISUAL_TASTE  | S3  | `Command input` header + two-sentence implementation subtitle (`SYS-14`)                                                                                                | One caption beside the field                                                                 | same spec asserts the header has count 0 and the caption is visible                                   | `after/390-command-empty.png`                                  |
| W13-06 | Command           | DENSITY       | S3  | `Supported examples` panel always visible, duplicating `Suggestions`                                                                                                    | Chips rendered only while the field is empty                                                 | same spec: example chips count 0 after typing                                                         | `after/390-command-typed.png`                                  |
| W13-07 | Achievements      | PRODUCT_UX    | S3  | 3 stat tiles for 2 facts; `Best streak` repeated the hero chip                                                                                                          | 2 tiles; current/best streak moved into Streak protection                                    | `e2e/gamification.spec.ts` 4/4                                                                        | `after/390-achievements-top.png`                               |
| W13-08 | Achievements      | DENSITY       | S3  | Earned and locked tiers in one undifferentiated block (`SUR-13`)                                                                                                        | Earned inline; locked behind one `All badges` disclosure with exposed state                  | `e2e/gamification.spec.ts` updated to the new contract (disclosure `aria-expanded`)                   | `after/390-achievements-top.png`                               |
| W13-09 | Shared `PillChip` | ACCESSIBILITY | P1  | `accessibilityState={{ selected }}` is **not** mapped to the DOM by this react-native-web version, so no chip toggle exposed its state to web assistive tech (or tests) | Emit `aria-pressed={active}` (the attribute `HabitDayStrip`/`HabitEditorChoice` already use) | W13 spec asserts `aria-pressed` flips; habits/theming/planning/todos specs all still pass             | n/a (attribute)                                                |

`SUR-08`, `SYS-14`, `SUR-11` and `SUR-13` in `docs/ui-ux/15-v3-defect-ledger.md`
are marked **VERIFIED-FIXED (W13)**.

## Verification executed

| Command                                                                                                  | Result                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npx tsc --noEmit`                                                                                       | 0 errors                                                                                                                                                                 |
| `npx eslint <changed files> --max-warnings 0`                                                            | 0 errors / 0 warnings                                                                                                                                                    |
| `npm run qa:fast`                                                                                        | 2,259 passed / 1 — the documented Windows-CRLF `agentDocConsistency` ENVIRONMENT residual                                                                                |
| `npm run qa:integration`                                                                                 | 419 passed / 2 skipped                                                                                                                                                   |
| `npm run qa:timezones`                                                                                   | 105 passed across 5 zones                                                                                                                                                |
| `e2e/secondary-surface-w13.spec.ts`                                                                      | 5/5 PASS                                                                                                                                                                 |
| `e2e/secondary-surface-w13-audit.spec.ts`                                                                | 5/5 before + 5/5 after                                                                                                                                                   |
| `e2e/gamification.spec.ts`                                                                               | 4/4 PASS                                                                                                                                                                 |
| `e2e/theming.spec.ts`                                                                                    | 4/4 PASS (real regression caught and fixed during the wave)                                                                                                              |
| `e2e/settings.spec.ts` + `e2e/command.spec.ts` + `e2e/portable-backup.spec.ts` + `e2e/habits-w7.spec.ts` | 28/28 PASS                                                                                                                                                               |
| `e2e/planning-w12.spec.ts` + `e2e/weekly-review.spec.ts`                                                 | 7/7 PASS (shared `PillChip` unaffected)                                                                                                                                  |
| `E2E_PORT=8086 npm run e2e:journeys:p0`                                                                  | 25/25 PASS                                                                                                                                                               |
| `e2e/journeys/settings-ripple.spec.ts`                                                                   | 1 passed / 1 failed — the `Goal 2,400` Calories-ripple step fails **identically on the W12 baseline with every W13 change stashed** → pre-existing, not a W13 regression |
| `npm run openspec:validate`                                                                              | 81/81 PASS                                                                                                                                                               |

## Preserved contracts (verified unchanged)

- Theme/motion/reward-feedback preferences persist (`theming.spec.ts` 4/4,
  `gamification.spec.ts` reward-feedback reload test).
- `savePomodoroSettings` / `setCalorieGoal` validation, Save affordance and
  error surfaces unchanged.
- Backup/restore and portable flows: `e2e/settings.spec.ts` 2/2,
  `e2e/portable-backup.spec.ts`, and the new-phone settings-failures journey
  pass with their SQLite/outbox oracles intact.
- Command parse → review → preview → confirm → outcome, the execution token,
  ambiguity resolution and `canConfirm` unchanged: `e2e/command.spec.ts` 9/9
  and the `command-center-v2` P0 journeys pass.
- Gamification award idempotency and the local reward ledger unchanged:
  `e2e/gamification.spec.ts` replay test passes.
- `command.executor.ts`, `command.review.ts`, `gamification.domain.ts` and
  `gamification.data.ts` were **not modified**.

## Not covered / limitations

- The `settings-ripple` Calories-ripple failure is pre-existing and tracked
  (W11.5 recorded the `settings-ripple` baseline failure); W13 does not close
  it, and W14 owns whole-app convergence.
- One invalid test assertion was written during the wave
  (`aria-selected` on a `role=button` chip) and corrected to the real
  `aria-pressed` contract; no product behaviour was weakened to satisfy it.
- No native settings-persistence or permission lane was run (W16 owns native).
- The visual instrument never asserts pixels; W15 owns persistent baselines.
