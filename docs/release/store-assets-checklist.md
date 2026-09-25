# Store assets checklist — current capture requirements (for owner capture)

Companion to `store-data-declarations.md` §4 and `app-store-readiness.md`
items 1–2. This file is the **verifiable spec only** — no screenshot or
feature-graphic image binaries ship in this pass. Capture itself is
device-bound and stays `[OWNER ACTION]`.

> Rechecked against the [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications)
> and [Google Play preview-asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151)
> on 2026-09-25. Re-verify the available device classes and upload fields in
> the actual consoles at submission time before capture.
> Spec version at this draft: 1.0.0 (`package.json`, `app.json`
> `expo.version`), iOS `buildNumber 1`, Android `versionCode 1`.

## 1. Apple App Store — required display classes

Tablet support is on (`app.json` iOS tablet support), so an iPad set is
required alongside an iPhone set. Apple accepts **one to 10** JPEG/PNG
screenshots per supplied set, without transparency. Capture from a genuine
release build at the device's native pixel size; do not resize an older image
to fit a new class. App Store Connect can scale the highest-resolution
required set to smaller devices, so extra sets are optional.

| Display class / status                               | Accepted portrait examples (px)       | Capture decision                                                                 |
| ---------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------- |
| 6.9" iPhone — primary iPhone set                     | 1290 × 2796; 1260 × 2736; 1320 × 2868 | Capture one native size from the matching genuine build.                         |
| 6.5" iPhone — fallback if no 6.9" set                | 1284 × 2778; 1242 × 2688              | Apple lists this as required only when a 6.9" set is absent.                     |
| 6.3" iPhone — optional additional set                | 1179 × 2556; 1206 × 2622              | The old checklist mislabeled 1179 × 2556 as a required 6.1" set.                 |
| 6.1" iPhone — optional additional set                | 1170 × 2532; 1125 × 2436; 1080 × 2340 | Capture only if useful for the listing.                                          |
| 13" iPad — required because `supportsTablet` is true | 2064 × 2752 or 2048 × 2732            | Use the exact native size of the matching iPad build; one accepted set suffices. |
| 12.9" iPad — optional legacy set                     | 2048 × 2732                           | Apple scales from the 13" set if this set is omitted.                            |

Notes:

- Apple's current table lists 1290 × 2796 under 6.9", 1179 × 2556 under
  6.3", and both 2048 × 2732 and 2064 × 2752 under the required 13"
  iPad class. These are accepted pixel dimensions, not a request to upscale.
- Use the same six surfaces (§3) in the required iPhone and iPad sets so
  the two listings tell the same story. Extra sets may use the same sequence.

## 2. Google Play — feature graphic + screenshots

| Asset                       | Spec                                                                                                        | Count / rules                                                                                                                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Feature graphic             | 1024 × 500 px, JPEG or 24-bit PNG (no transparency); keep essential content away from edges                 | One required for the listing.                                                                                                                                                                          |
| Phone screenshots           | JPEG or 24-bit PNG, no alpha; each dimension 320–3840 px and the longer side no more than twice the shorter | Min 2 across supported device types, max 8 per type; use at least two real phone captures for this listing. Four phone captures at 1080 px or more in 9:16/16:9 are recommended for broader placement. |
| 7" / 10" tablet screenshots | Native tablet captures; follow the live large-screen upload requirements                                    | Optional for this listing, but recommended with tablet support; Play recommends at least four when supplied.                                                                                           |

Notes:

- The launcher / store icon set is already registered in `app.json`
  (`assets/icon.png` 1024 × 1024 plus Android adaptive and PWA icons)
  and is not recaptured here.
- Do not reuse Apple-status-bar frames for Play and vice versa; capture
  each store's screenshots on the matching OS chrome.

## 3. Six preferred surfaces → real screens

The app is a single-page shell (`app/index.tsx` renders all six
sections behind `NavigationContext.activeSection`; there are no
per-feature routes). Navigate with the bottom tab bar (narrow) or the
left side rail (wide). Section labels below are the verbatim
`NAV_ITEMS` labels in `app/index.tsx`.

| #   | Preferred surface    | Section / overlay           | Real file(s)                                                                                                                                                    | How to reach it                                     |
| --- | -------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | Today                | `overview` (Today)          | `features/overview/OverviewScreen.tsx` via `app/index.tsx` `SECTION_SCREENS.overview`                                                                           | Tap Today in the tab bar / rail                     |
| 2   | Habits               | `habits` (Habits)           | `features/habits/HabitsScreen.tsx` via `SECTION_SCREENS.habits`                                                                                                 | Tap Habits                                          |
| 3   | Focus                | `pomodoro` (Focus)          | `features/pomodoro/PomodoroScreen.tsx` via `SECTION_SCREENS.pomodoro`                                                                                           | Tap Focus                                           |
| 4   | Workout session      | `workout` (Workout)         | `features/workout/WorkoutSessionScreen.tsx` (guided session) reached from `features/workout/WorkoutScreen.tsx` via `SECTION_SCREENS.workout`                    | Tap Workout, open a routine into its guided session |
| 5   | Calories diary       | `calories` (Calories)       | `features/calories/CaloriesScreen.tsx` Diary mode (`CaloriesDiaryView`, remembers `superhabits.calories.viewMode`) via `SECTION_SCREENS.calories`               | Tap Calories, switch Form → Diary                   |
| 6   | Level & Achievements | Achievements drawer overlay | `features/gamification/AchievementsScreen.tsx` (with `LevelHero`) opened as the "Level & Achievements" drawer `Modal` in `app/index.tsx` (`isAchievementsOpen`) | Open Level & Achievements from the app shell        |

Do not invent routes: `app/` holds only `_layout.tsx` + `index.tsx`;
Settings is a full-screen modal and the Command Center is a global
overlay — neither is one of the six store surfaces.

## 4. Capture acceptance criteria

Every frame in every set must meet all of these:

- Genuine native `1.0.0` build for that platform, with its source SHA,
  artifact ID/hash, and resolved iOS build number or Android version code
  recorded. `app.json` starts at `buildNumber 1` / `versionCode 1`, while
  the EAS production profile uses remote version state and auto-increment;
  the actual binary's values must be checked before capture.
- English UI (the app ships English-only; see readiness item 7).
- Seeded demo content only — the same neutral demo dataset in every
  frame, no real user data.
- No real PII in frames: no real names, emails, photos, locations, or
  recovery addresses. Demo names only.
- Status bar neutral: full signal/wifi/battery glyphs, neutral time,
  no carrier personalization, no incoming-call / low-battery /
  notification icons.
- Default or clearly-shown theme: default light theme unless the set
  is explicitly a dark-theme set; never mix themes inside one set
  without labeling.
- No dev chrome: no Metro bundler, no Expo dev menu, no debug banners,
  no red-box errors, no half-rendered skeletons.

## 5. Device-bound capture boxes (owner)

No image binaries ship in this pass. Capture each box on a real seeded
device or emulator and verify pixel sizes before upload.

- [ ] `[OWNER ACTION]` App Store 6.9" iPhone native set (for example, 1290 × 2796) or the accepted 6.5" fallback — six genuine-build surfaces, acceptance §4 met.
- [ ] `[OWNER ACTION]` App Store required 13" iPad native set (2048 × 2732 or 2064 × 2752 from its matching device) — six genuine-build surfaces, acceptance §4 met.
- [ ] `[OWNER ACTION]` Additional iPhone/iPad sets only where the actual console asks for them or the owner elects to supply them; capture each from the matching build, never stretch another set.
- [ ] `[OWNER ACTION]` Play feature graphic 1024 × 500 — safe margins kept, no transparency.
- [ ] `[OWNER ACTION]` Play phone screenshots (≥ 2 real captures, same six surfaces preferred) — pixel rules §2 met, acceptance §4 met.

## 6. Framing don'ts

- Do not fabricate, upscale, stretch, or mock up frames — capture real
  pixels from the identified `1.0.0` native build only.
- Do not pass simulator bezels, browser chrome, or dev tools as store
  screenshots.
- Do not put essential feature-graphic text or logos near the
  1024 × 500 edges (cropping varies by surface).
- Do not ship real personal data, real recovery emails, or real backup
  account identifiers in any frame.
- Do not claim extra store locales: the UI is English-only.

## 7. What this pass does not ship

- No PNG/JPEG screenshot or feature-graphic binaries (needs a real
  seeded device/emulator — device-bound by design).
- No App Store Connect / Play Console upload or credential work.
- No icon regeneration (icons already registered in `app.json`).
