# App Store / Play Store readiness

Snapshot of release state for SuperHabits 1.0.0 (schema 25). Refreshed
2026-09-14 at source `7fa5790` (release-readiness pass at `c04cceb`, then the
accessibility campaign `bcca6ae` and the Settings-overlay contrast closure
`3c5a086`). Update this file when a release actually ships rather than letting
it drift.

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

## Verification run for this release (2026-09-14)

| Gate                    | Command                                                   | Result                                                                                                                                                                 |
| ----------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types                   | `npm run typecheck`                                       | clean                                                                                                                                                                  |
| Lint                    | `npm run lint` (`--max-warnings 0`)                       | clean                                                                                                                                                                  |
| Unit + integration      | `npm test`                                                | 2055 passed / 196 files                                                                                                                                                |
| Accessibility audit     | `npx playwright test --project=chromium e2e/a11y.spec.ts` | 5 passed: six sections in light + dark + an override theme (cyberpunk-neon), Settings semantics + contrast, all zero-defect                                            |
| Chromium E2E            | `npx playwright test --project=chromium`                  | 140 passed / 7 skipped / 0 failed                                                                                                                                      |
| Journey E2E             | `npx playwright test --project=journeys`                  | 98 passed / 6 skipped in the colour-change battery; 2 load-induced failures pass standalone (gap 15 class)                                                             |
| Simulation E2E          | `npx playwright test --project=simulation`                | 3 passed (repro replay, deterministic reproducibility, run-report schema)                                                                                              |
| Web bundle              | `npm run build:web`                                       | exported to `dist/`, 4 bundles + static routes                                                                                                                         |
| Live web probe          | `npm run web:verify`                                      | PASS in 64.7s (fresh export, HTTP 200, COOP/COEP, shell probe, port released)                                                                                          |
| Expo config             | `npx expo-doctor`                                         | 19/20 (10 SDK-recommended patch bumps held by pinned patches — see constraints)                                                                                        |
| PWA update lane         | `npx playwright test --project=pwa`                       | passed                                                                                                                                                                 |
| Theme contrast          | `npm run validate:themes`                                 | 140 checks pass                                                                                                                                                        |
| OpenSpec                | `openspec validate --all`                                 | 57 passed / 0 failed                                                                                                                                                   |
| ExecPlans               | `npm run agent:plan:validate:all`                         | all plans PASS                                                                                                                                                         |
| Native smoke            | `npm run qa:native:android -- --avd Nitro_API_36`         | 2/2 PASS on APK `6CE22FD5…` from source `bcca6ae` (after the colour/token changes)                                                                                     |
| Native persistence lane | `npm run qa:native:targeted -- --avd Nitro_API_36`        | **11/11 PASS** in 11m43s on credential-free APK `A4C3C900…` from source `2c1594b`                                                                                      |
| Production deployment   | `vercel --prod`                                           | https://super-habits.vercel.app — HTTP 200, COOP/COEP, `crossOriginIsolated=true`, 0 non-Nunito text nodes, and a clean DOM-level a11y audit (six sections + Settings) |

### E2E result

Chromium **136 passed / 7 skipped / 0 failed**, journeys **104 / 6 / 0**, and
the simulation lane **3 passed** on the shipped `dist/`. The previously
documented flakes are closed:

- `habits.spec.ts` “target edits keep a prior completed date complete” was a
  test guard firing when the save button entered its loading state, letting the
  SQL oracle abort the in-flight OPFS write; it now waits for the modal title
  (known-gap 16, closed as `TEST_BUG`).
- The native persistence failures (known-gaps 17/18) were deterministic flow
  defects — a center swipe swallowed by a focused `EditText`, a post-create
  habit tile above a still-scrolled screen, and a calories post-save list that
  ignores center-anchored swipes — repaired with scoped swipes/polls and
  verified at 11/11 in the rested single-AVD lane.
- Journey P2/P3/P5 were RN-Web-refactor rot (inline-style geometry check,
  per-character stepper typing racing a focus-stealing re-render, and a stale
  structural XPath); repaired with computed styles, a single-event `fill`, and
  the semantic completion checkbox.

## Store metadata registered in `app.json`

- **Display name**: `SuperHabits`; slug `superhabits`; scheme `superhabits`.
- **Version**: `1.0.0`; iOS `buildNumber: 1`; Android `versionCode: 1`.
  EAS `production` profile has `autoIncrement: true`, so CI increments these.
- **Icons**: `assets/icon.png` (1024×1024), Android adaptive set
  (`android-icon-foreground.png` 512², `android-icon-background.png`, and
  `android-icon-monochrome.png` 432² for themed icons), web `favicon.png`
  plus PWA `public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`.
- **Notification icon**: `assets/notification-icon.png` (96×96
  white-on-transparent, derived from the app's monochrome mark), wired through
  the `expo-notifications` plugin with colour `#6D28D9`. A prebuild emits
  `drawable-{mdpi..xxxhdpi}/notification_icon.png`, `@color/notification_icon_color`,
  and both FCM + local `default_notification_icon` manifest entries.
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
4. ~~**Android notification icon**~~ — **delivered 2026-09-14**
   (`assets/notification-icon.png` + plugin config + prebuild verification).
5. **Version tagging + release notes**: write the store release notes
   (`docs/release/release-notes-1.0.0.md` is the draft) and confirm the EAS
   `submit.production` profile has credentials. Tag `v1.0.0` at release time.
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
