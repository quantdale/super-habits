# Store assets checklist — dimensions/spec (for owner capture)

Companion to `store-data-declarations.md` §4 and `app-store-readiness.md`
items 1–2. This file is the **verifiable spec only** — no screenshot or
feature-graphic image binaries ship in this pass. Capture itself is
device-bound and stays `[OWNER ACTION]`.

> Store specs drift. Re-verify every size, count, and format in
> App Store Connect / Play Console at submission time before capture.
> Spec version at this draft: 1.0.0 (`package.json`, `app.json`
> `expo.version`), iOS `buildNumber 1`, Android `versionCode 1`.

## 1. Apple App Store — required sets

Tablet support is on (`app.json` iOS tablet support), so iPad sets are
required alongside iPhone. Provide portrait captures; add landscape only
if the submission uses landscape frames. Export at the device-native
pixel size (no upscaling, no alpha-channel tricks, JPEG or PNG as
Connect accepts).

| Set (this submission)                      | Portrait (px) | Landscape (px) | Count                       |
| ------------------------------------------ | ------------- | -------------- | --------------------------- |
| 6.7" iPhone (required)                     | 1290 × 2796   | 2796 × 1290    | 1–10 per size; fill the set |
| 6.1" iPhone (required)                     | 1179 × 2556   | 2556 × 1179    | 1–10 per size; fill the set |
| 12.9" iPad (required)                      | 2048 × 2732   | 2732 × 2048    | 1–10 per size; fill the set |
| 13" iPad (required where Connect shows it) | 2064 × 2752   | 2752 × 2064    | 1–10 per size; fill the set |

Notes:

- 6.7" covers the iPhone 14 Pro Max / 15 Pro Max class
  (1290 × 2796). Do not substitute the older 1242 × 2688 class unless
  Connect explicitly accepts it for the submission.
- 6.1" covers the iPhone 15 / 15 Pro class (1179 × 2556). The older
  6.1" class (1170 × 2532) is accepted only where Connect says so —
  capture at the real device's native size and verify.
- 12.9" iPad Pro class is 2048 × 2732. The 13" iPad Pro (M4) class
  is 2064 × 2752. Where Connect merges them, one exact-native set
  plus verification is enough — never stretch one size into the other.
- Use the same six surfaces (§3) in every set so iPhone and iPad tell
  the same story.

## 2. Google Play — feature graphic + screenshots

| Asset                                                           | Spec                                                                                                              | Count / rules                                    |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Feature graphic                                                 | 1024 × 500 px, JPEG or PNG (no transparency), no essential text or logo near the edges (keep a clear safe margin) | 1, required for the listing                      |
| Phone screenshots                                               | 320–3840 px per side, 16:9 or 9:16 aspect, JPEG or PNG (no transparency)                                          | Min 2, max 8; same six surfaces preferred        |
| 7" / 10" tablet screenshots (recommended, tablet support is on) | Same pixel rules as phone (native tablet frame, 16:9 or 9:16 where the Console accepts it)                        | Optional but recommended; reuse the six surfaces |

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

- Current `1.0.0` build (`package.json 1.0.0`, `app.json 1.0.0` +
  `buildNumber 1` + `versionCode 1`).
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

- [ ] `[OWNER ACTION]` App Store 6.7" iPhone set (1290 × 2796) — six surfaces, acceptance §4 met.
- [ ] `[OWNER ACTION]` App Store 6.1" iPhone set (1179 × 2556) — six surfaces, acceptance §4 met.
- [ ] `[OWNER ACTION]` App Store 12.9" iPad set (2048 × 2732) — six surfaces, acceptance §4 met.
- [ ] `[OWNER ACTION]` App Store 13" iPad set (2064 × 2752) where Connect shows it — six surfaces, acceptance §4 met.
- [ ] `[OWNER ACTION]` Play feature graphic 1024 × 500 — safe margins kept, no transparency.
- [ ] `[OWNER ACTION]` Play phone screenshots (≥ 2, same six surfaces preferred) — pixel/aspect rules §2 met, acceptance §4 met.

## 6. Framing don'ts

- Do not fabricate, upscale, stretch, or mock up frames — capture real
  pixels from the `1.0.0` build only.
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
