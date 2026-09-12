# App Store / Play Store readiness

Snapshot of release state for SuperHabits 1.0.0 (schema 25). Update this file
when a release actually ships rather than letting it drift.

## What ships

| Area          | State                                                                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sections      | Today, To Do, Habits, Focus, Workout, Calories (single-page shell), plus Settings / Plan / Weekly Review / Add / Level & Achievements overlays                 |
| Persistence   | SQLite (OPFS on web, WAL on native), schema 25, append-only migrations                                                                                         |
| Backup        | One-way push backup (Backup Completeness V2 + Restore V2) and Portable Backup V1                                                                               |
| Gamification  | Local-only reward ledger: XP/levels, streaks + freezes, 3 rotating daily quests, 36 badge tiers, celebration overlay, haptics + synthesized tones              |
| Themes        | 14 registered themes (6 light / 8 dark), WCAG AA verified                                                                                                      |
| Design system | **Pop**: Nunito type via `core/ui/Text`, bottom tab bar / wide-screen side rail shell, per-section hues, tactile motion (`docs/ui-ux/12-pop-design-system.md`) |
| Targets       | Web PWA (Vercel), iOS, Android                                                                                                                                 |

## Verification run for this release

| Gate                     | Command                                                                                             | Result                                                                                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types                    | `npm run typecheck`                                                                                 | clean                                                                                                                                                                                  |
| Lint                     | `npm run lint` (`--max-warnings 0`)                                                                 | clean                                                                                                                                                                                  |
| Unit + integration       | `npm test`                                                                                          | 2055 passed / 196 files                                                                                                                                                                |
| E2E                      | `npm run e2e`                                                                                       | see "E2E result" below                                                                                                                                                                 |
| Web bundle               | `npm run build:web`                                                                                 | exported to `dist/`, 4 bundles + static routes                                                                                                                                         |
| Expo config              | `npx expo-doctor`                                                                                   | 19/20 (see known constraints)                                                                                                                                                          |
| Theme contrast           | `npm run validate:themes`                                                                           | 140 checks pass                                                                                                                                                                        |
| Reward loop              | `npx playwright test e2e/gamification.spec.ts`                                                      | 4 passed: XP award, replay-idempotency, achievements overlay, feedback-preference persistence                                                                                          |
| Rollover journeys        | `npx playwright test --project=journeys --grep "past-midnight"`                                     | 8 passed (J2a writes + J2b freshness)                                                                                                                                                  |
| P0 journeys              | `npm run e2e:journeys:p0`                                                                           | 25 passed                                                                                                                                                                              |
| Deterministic simulation | `npm run qa:simulation -- --all --mode deterministic`                                               | 23/23 scenarios passed                                                                                                                                                                 |
| Live web probe           | `npm run web:verify`                                                                                | PASS (fresh export, COOP/COEP, shell probe, ports released)                                                                                                                            |
| Visual regression audit  | temporary Playwright harness (10 scenarios)                                                         | PASS 10/10: six sections + overlays + modals at 360/390/412/768/1024/1280/1440/1920, populated/empty/stress/dark; ~20 defects fixed                                                    |
| Native smoke             | `node scripts/qa-native.mjs --platform android --tag smoke --avd Nitro_API_36`                      | PASS 2/2 flows on credential-free APK from clean source `d9c17f5` (SHA-256 `B9FC4ED1…`), canonical Nitro_API_36 x86_64                                                                 |
| Native persistence       | `node scripts/qa-native.mjs --platform android --tag persistence --avd Nitro_API_36 --no-provision` | 2/11 — `calories-persistence` + `settings-persistence` PASS; 9 flow-selector failures classified `TEST_BUG` (pre-redesign flow assumptions), registered as known-gap 17 with artifacts |

### E2E result

Final Chromium feature battery on the shipped `dist/` (2026-09-12):
**135 passed, 1 failed, 7 skipped**. The single failure is
`habits.spec.ts:222` "target edits keep a prior completed date complete" — the
intermittent modal-close-vs-commit race registered in
`docs/testing/known-gaps.md` §3. It passed standalone in a 46-test focused
batch and fails intermittently under battery load; the register's rule stands:
re-verify before touching the habit-edit save path.

### E2E result

Final Chromium feature battery on the shipped `dist/` (2026-09-12):
**134 passed, 2 failed, 7 skipped**. Both failures were root-caused:

- `portable-backup.spec.ts:116` — the test helper typed the todo title
  char-by-char; the heavier redesigned modal dropped the trailing character
  ("Alpha tas"), so the exact-title assertion found nothing when the test ran
  after its sibling exports. Fixed by committing the value in one event
  (`fill()`), assertions unchanged; the portable and settings files then pass
  **8/8**.
- `habits.spec.ts:222` — the intermittent modal-close-vs-commit race registered
  in `docs/testing/known-gaps.md` §16; it passes standalone on the same tree
  and remains a documented flake (re-verify before touching the habit-edit
  save path).

## Store metadata registered in `app.json`

- **Display name**: `SuperHabits`; slug `superhabits`; scheme `superhabits`.
- **Version**: `1.0.0`; iOS `buildNumber: 1`; Android `versionCode: 1`.
  EAS `production` profile has `autoIncrement: true`, so CI increments these.
- **Icons**: `assets/icon.png` (1024×1024), Android adaptive set
  (`android-icon-foreground.png` 512², `android-icon-background.png`, and
  `android-icon-monochrome.png` 432² for themed icons), web `favicon.png`
  plus PWA `public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`.
- **Splash**: `assets/splash-icon.png` (1024²), `resizeMode: contain`,
  `backgroundColor: #ffffff`, with a dark variant (`#0a0f1a`).
- **iOS**: bundle id `com.dale16.superhabits`, tablet support on,
  `ITSAppUsesNonExemptEncryption: false` (no non-exempt crypto in the app).
- **Android**: package `com.dale16.superhabits`, predictive back off,
  declared permissions `POST_NOTIFICATIONS`, `VIBRATE`,
  `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`.
- **Notifications**: 5 runtime channels — General, Habit reminders,
  Todo reminders, Daily plan reminders, Weekly review reminders.
  iOS/Android permission prompts themselves are system-localized; the app
  ships no custom permission copy that needs translation.

## Remaining metadata before submission

1. **App Store screenshots**: 6.7" and 6.1" iPhone sets, plus 12.9"/13" iPad
   (tablet support is on). Capture from a seeded device — Today dashboard,
   Habits, Focus timer, Workout session, Calories diary, Level & Achievements.
2. **Play Store assets**: feature graphic (1024×500), phone screenshots
   (min 2), short/full description, and the Data safety form (answers below).
3. **Privacy nutrition labels / Data safety**: this build collects nothing —
   accounts are optional and only used for backup, data lives in local SQLite,
   and analytics are absent. Declare "Data Not Collected" on iOS and
   "No data collected / No data shared" on Play, with encryption in transit
   for the optional backup path.
4. **Android notification icon**: `expo-notifications` falls back to the app
   icon; a dedicated 96×96 white-on-transparent PNG (and its plugin config)
   is still missing.
5. **Version tagging + release notes**: tag `v1.0.0`, write the store release
   notes, and confirm the EAS `submit.production` profile has credentials.
6. **Age rating questionnaires** (iOS 4+, Play "Everyone") and the EU DSA
   trader declaration.
7. **Localization**: the UI ships English-only. Android channel names and the
   `app_name` string would need `values-<locale>/strings.xml` entries before
   claiming additional store locales.

## Known constraints (deliberate, not blockers)

- **Expo SDK patch drift**: `expo-doctor` reports 10 packages behind the
  SDK-recommended _patch_ versions. Upgrading is blocked by the pinned
  `patches/*.patch` files (e.g. `expo-sqlite+55.0.18.patch`,
  `expo-modules-core+55.0.25.patch`): those patches apply to exact versions,
  so an SDK patch bump must land together with regenerated patches in the
  same change. `expo-audio`, `expo-asset`, and `expo-haptics` were added for
  reward feedback and are on their SDK-matched versions.
- **Sync wording**: remote backup stays "one-way push backup", never "full
  two-way sync".
- **Gamification is local-only**: no reward state is synced or backed up, so a
  restore starts rewards from the activity that survived. See
  `docs/knowledge-base/gamification.md`.
- **`android/` is a local prebuild output** (`/android` is gitignored), so
  native splash/permission resources are regenerated from `app.json` at build
  time — never hand-edit them expecting the change to persist.
