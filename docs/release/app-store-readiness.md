# App Store / Play Store readiness

Release preparation is tracked in [submission-package.md](submission-package.md).
It contains the current deduplicated owner-action inventory, copy/asset
handoff, and submission gates. This repository has no store submission or
`v1.0.0` tag authorized by this readiness pass. The historical results below
retain their original SHA context and do not certify a future binary.

Snapshot of release state for SuperHabits 1.0.0 (schema 25). Refreshed
2026-09-14 at source `7fa5790` (release-readiness pass at `c04cceb`, then the
accessibility campaign `bcca6ae` and the Settings-overlay contrast closure
`3c5a086`); privacy-artifact pass 2026-09-19 adds `privacy-policy.md` +
`store-data-declarations.md` and corrects the item-3 conditional; hosted-policy
pass 2026-09-19 ships `public/privacy.html` → `/privacy.html` with a drift-guard
test; release-notes pass 2026-09-19 makes `release-notes-1.0.0.md` store-ready
(Apple/Play What's New + version/tag checklist); age-rating/DSA pass
2026-09-19 adds `age-rating-and-trader.md` (Apple 4+ / Play Everyone /
trader-declaration drafts) with a guard test; store-assets pass
2026-09-19 adds `store-assets-checklist.md` (Apple/Play dimensions, counts,
six-surface file mapping, acceptance, owner capture boxes) with a guard test;
icon/splash audit pass 2026-09-19 adds `icon-splash-asset-audit.md`
(measured PNG-header sizes for every app.json/manifest icon, splash, and
notification asset) with a header-parse guard test; version/build
consistency pass 2026-09-19 adds `version-build-consistency.md`
(cross-file 1.0.0 / buildNumber 1 / versionCode 1 / eas.json posture
proof) with a consistency guard test; gate-table vs E2E-narrative provenance
reconciled 2026-09-22 (production-closure Phase 2 — the table carries the
latest 2026-09-14 per-gate re-runs through the a11y closure, the E2E-result
narrative quotes the original release-readiness battery); exact-HEAD
recertification supersedes all 2026-09-14 numbers at that campaign's release
verdict. Update this
file when a release actually ships rather than letting it drift.

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

## Historical exact-SHA recertification (2026-09-24 overnight live-cloud campaign)

The 2026-09-24 overnight block below is a previous campaign's evidence.
The completed live-cloud ExecPlan records its later code-final Android
ancestor `56259876418674f85e1ca42c87f248fcf12c7d75` separately from
the docs-close HEAD `23ded6e7676f94d6ddf9337ad02d526d85973fcb`.
Neither that battery nor this page certifies an unbuilt store artifact:

- Static/contracts: typecheck · lint (`--max-warnings 0`) · theme tokens (140) · OpenSpec 59/59 · versioned ExecPlans 93/93 · impact rules 13 — PASS
- Unit + integration: **227 files / 2,270 passed** (`npm test`, Node v22.23.2 engines-conformant, local fresh)
- `qa:fast` fresh: 150 files / 1,897 passed · timezones: 94 tests × 5 zones · release guards: **34/34 (7 files)** — age-rating-dsa · icon-splash-asset-audit · privacy-hosting · release-notes · store-assets-checklist · store-declaration-drift · version-build-consistency
- Web: `build:web` PASS · `build:e2e` **hermetic PASS** (`EXPO_NO_DOTENV` + `supabase.co` leak guard, 0 hosts in `dist/`) · `web:verify` PASS · `web:hygiene` PASS
- Full browser E2E + deterministic 23/23 + J8 persona 7/7 (measurement-start root cause; ceiling/floor/guard unchanged): local `qa:full` exit 0 · **CI run `35987777309` @ `8f8c79e` quality+e2e SUCCESS** · `build:sync` + `e2e:sync` 40/6/0 PASS
- Android: exact-source `8f8c79e` → APK SHA-256 `A95C9BC81B537BEAFDB73C5F21EE27146444089681FA98AE47F1B3D67262FB93` · smoke 2/2 + persistence 11/11 + lifecycle 6/6 (**19/19 flows**) · provenance `simulation-output/native/native-android-build.json`
- Expo Doctor **20/20** · `npm audit` **0 critical / 0 high / 14 moderate** (all production; two leaf advisories — override-rejection rationale recorded in the ci.yml advisory comment) · `sim:validate` 23 scenarios
- Intermediate application candidate at this historical checkpoint: `8f8c79e` (CI run `35987777309`); later evidence and the final Android source are recorded in `.agent/execplans/live-cloud-verification-production-integration-v1.md`.

The 2026-09-14 gate table below is **historical** and is superseded for the
campaign verdict by the blocks above; every number here comes from a fresh
execution (commands re-run, not copied), with CI results cited per run/SHA:

- Static/contracts: typecheck · lint (`--max-warnings 0`) · theme tokens (140 checks) · OpenSpec 59/59 · versioned ExecPlans all-valid · impact rules 13 — PASS
- Unit + integration: **223 files / 2,252 passed / 2,252 total** (`npm test`, local fresh); CI quality at certified SHAs: 223 files / 2,247 passed / 1 skipped (run `35814424527` @ `63ff09c`, step log)
- `qa:fast` fresh: 146 files / 1,879 passed · timezones: 94 tests × 5 zones · release guards: 35/35 (7 files)
- Web: `build:web` PASS · `web:verify` PASS (HTTP 200, COOP/COEP, `crossOriginIsolated=true` probe) · `web:hygiene` PASS
- Full browser E2E + deterministic 23/23 + `build:sync` + `e2e:sync` 40/6/0: PASS on CI run `35815411915` @ `cbe9f77` (push runs re-certify each pushed SHA)
- Android: exact-source provision + smoke 2/2 + persistence (10/11 battery + isolated replay) + lifecycle 6/6 + delivery probe VERIFIED — see campaign ExecPlan Phase 4
- Expo Doctor **20/20** · `npm audit` **0 critical / 0 high / 16 moderate** (prod 14; all force-only, framework-owned) · `sim:validate` 23 scenarios
- Application candidate of record: `cc6889a` (CI run `35749583938`); certified head at campaign time: `cbe9f77`; final verdict SHA recorded in `.agent/execplans/production-closure-exact-head-cert-v1.md`

## Verification runs for this release (2026-09-14)

Gate rows show the latest measured result per gate as that day's passes
accumulated (release-readiness `f753769` → a11y closure `3c5a086`/`ccb1474`);
the E2E-result narrative below quotes the original release-readiness battery,
so its chromium/journey totals intentionally differ from the re-run rows here.
Provenance reconciled 2026-09-22 (production-closure Phase 2).

| Gate                    | Command                                                   | Result                                                                                                                                                                 |
| ----------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types                   | `npm run typecheck`                                       | clean                                                                                                                                                                  |
| Lint                    | `npm run lint` (`--max-warnings 0`)                       | clean                                                                                                                                                                  |
| Unit + integration      | `npm test`                                                | 2055 passed / 196 files                                                                                                                                                |
| Accessibility audit     | `npx playwright test --project=chromium e2e/a11y.spec.ts` | 5 passed: six sections in light + dark + an override theme (cyberpunk-neon), Settings semantics + contrast, all zero-defect                                            |
| Chromium E2E            | `npx playwright test --project=chromium`                  | 140 passed / 7 skipped / 0 failed                                                                                                                                      |
| Journey E2E             | `npx playwright test --project=journeys`                  | 98 passed / 6 skipped; 2 load-induced failures pass standalone (known-gap 15 class, colour-change battery)                                                             |
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
the simulation lane **3 passed** in the original release-readiness battery on
the shipped `dist/` (the gate table above records the later 2026-09-14 re-runs
through the a11y closure). The previously
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
  EAS `production` profile has `autoIncrement: true` with remote version
  state, so these are source baselines; verify resolved values on each
  production artifact before the console handoff.
- **Icons**: `assets/icon.png` (1024×1024), Android adaptive set
  (`android-icon-foreground.png` 512², `android-icon-background.png`, and
  `android-icon-monochrome.png` 432² for themed icons), web `favicon.png`
  plus PWA `public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`.
  Measured sizes verified 2026-09-19 in
  `docs/release/icon-splash-asset-audit.md` (guard:
  `tests/icon-splash-asset-audit.test.ts`; read-only IHDR, no binaries
  fabricated).
- **Notification icon**: `assets/notification-icon.png` (96×96
  white-on-transparent, derived from the app's monochrome mark), wired through
  the `expo-notifications` plugin with colour `#6D28D9`. A prebuild emits
  `drawable-{mdpi..xxxhdpi}/notification_icon.png`, `@color/notification_icon_color`,
  and both FCM + local `default_notification_icon` manifest entries.
  Header verified 96×96 with alpha in `icon-splash-asset-audit.md`; white
  artwork itself stays `[OWNER ACTION]`.
- **Splash**: `assets/splash-icon.png` (1024²), `resizeMode: contain`,
  `backgroundColor: #ffffff`, with a dark variant (`#0a0f1a`).
  Header verified 1024² in `icon-splash-asset-audit.md`; safe-area cropping
  stays `[OWNER ACTION]`.
- **iOS**: bundle id `com.dale16.superhabits`, tablet support on,
  `ITSAppUsesNonExemptEncryption: false` (no non-exempt crypto in the app).
- **Android**: package `com.dale16.superhabits`, predictive back off,
  declared permissions `POST_NOTIFICATIONS`, `VIBRATE`,
  `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`.
- **Notifications**: 5 runtime channels — General, Habit reminders,
  Todo reminders, Daily plan reminders, Weekly review reminders.
  iOS/Android permission prompts themselves are system-localized; the app
  ships no custom permission copy that needs translation. Drift guard:
  `tests/store-declaration-drift.test.ts` pins the `app.json` permission set
  and the 5-channel inventory to these declarations.

## Remaining metadata before submission

1. **App Store screenshots**: provide a genuine-build 6.9" iPhone set
   (a 6.5" set is Apple's fallback) and a required 13" iPad set because
   `supportsTablet` is true. The old 6.1" and 12.9" labels were not the
   required current classes; 1179 × 2556 is a 6.3" class. The original
   mapping was **delivered 2026-09-19**; its current source-checked
   requirements are in `docs/release/store-assets-checklist.md` §§1/3–5.
   Capture Today, Habits, Focus, Workout session, Calories diary, and
   Level & Achievements from the matching native build as `[OWNER ACTION]`.
2. **Play Store assets**: feature graphic (1024×500), phone screenshots
   (min 2, same six surfaces preferred), short/full description, and the
   Data safety form. The original spec was **delivered 2026-09-19**; the
   current Play dimensions and capture checks are in
   `docs/release/store-assets-checklist.md` §§2–5. Capture and graphic
   approval stay `[OWNER ACTION]`.
3. **Privacy nutrition labels / Data safety**: configured builds can
   establish anonymous Auth at startup and automatically push eligible
   data to Supabase; enabled AI requests can reach model providers.
   Do not use the historical "Data Not Collected" default claim for a
   configured release. `docs/release/privacy-policy.md`
   (hostable draft, owner to confirm + host; deployable rendering ships as
   `public/privacy.html` → `/privacy.html` with a drift-guard test) and
   `docs/release/store-data-declarations.md` (Apple label + Play Data safety
   answers + Play listing drafts + asset checklist) are **delivered
   2026-09-19** and corrected 2026-09-25. The owner must verify the final
   build and provider terms, select the exact form answers, and publish the
   matching policy; no console declaration is certified by this draft.
4. ~~**Android notification icon**~~ — **delivered 2026-09-14**
   (`assets/notification-icon.png` + plugin config + prebuild verification).
5. **Version tagging + release notes**: `docs/release/release-notes-1.0.0.md`
   is **store-ready 2026-09-19** (paste-ready Apple What's New ≤ 4000 chars
   - Play release notes ≤ 500 chars, guarded by
     `tests/release-notes.test.ts`, plus a version/tag checklist pinning
     `package.json 1.0.0` / `app.json 1.0.0 + buildNumber 1 + versionCode 1`).
     Cross-file proof is **delivered 2026-09-19** in
     `docs/release/version-build-consistency.md` (guard:
     `tests/version-build-consistency.test.ts`; asserts `eas.json`
     `appVersionSource remote` + `production.autoIncrement true` + empty
     `submit.production`, and readiness ↔ release-notes checklist agreement;
     no tag, no version change).
     Remaining release-time owner actions: configure EAS/store credentials
     in the owner-controlled accounts or secure environment while keeping
     `eas.json` `submit.production` `{}`, and create the
     `v1.0.0` tag (`git tag -a v1.0.0 -m "SuperHabits 1.0.0" &&
git push origin v1.0.0`) only with explicit release intent.
6. **Age rating questionnaires** (iOS 4+, Play "Everyone") and the EU DSA
   trader declaration: `docs/release/age-rating-and-trader.md` is
   **delivered 2026-09-19** (Apple all-None → 4+, Play Everyone / not
   child-directed / no ads / no purchases, DSA trader-status + identity
   fields as `[OWNER ACTION]`), guarded by
   `tests/age-rating-dsa.test.ts`. Owner + counsel must still confirm
   the answers against the final AI/provider posture and file the trader
   declaration at submission time.
7. **Localization**: the UI ships English-only. Android channel names and the
   `app_name` string would need `values-<locale>/strings.xml` entries before
   claiming additional store locales.

## Known constraints (deliberate, not blockers)

- **Expo SDK patch alignment**: the 2026-09-23 release-closure update aligned
  the ten SDK 55 packages reported by Expo Doctor with their recommended patch
  versions; `npm run doctor` now passes 20/20. The exact-version patches were
  refreshed with the update: `expo-modules-core@55.0.26`,
  `expo-sqlite@55.0.20`, and `metro-file-map@0.83.8`. Regenerate these patches
  in the same change as any future SDK patch bump. `expo-audio`, `expo-asset`,
  and `expo-haptics` remain on their SDK-matched versions.
- **Sync wording**: remote backup stays "one-way push backup", never "full
  two-way sync".
- **Gamification is local-only**: no reward state is synced or backed up, so a
  restore starts rewards from the activity that survived. See
  `docs/knowledge-base/gamification.md`.
- **`android/` is a local prebuild output** (`/android` is gitignored), so
  native splash/permission resources are regenerated from `app.json` at build
  time — never hand-edit them expecting the change to persist.
