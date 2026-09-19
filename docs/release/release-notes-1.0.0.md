# SuperHabits 1.0.0 — release notes (store-ready)

> Source of truth for `1.0.0` store copy. The paste-ready blocks in
> "Store What's New" fit their store limits (Apple ≤ 4000 chars, Play
> ≤ 500 chars); the full draft below them is the long-form reference.
> Guarded by `tests/release-notes.test.ts`.

## Store What's New (paste-ready)

### Apple App Store — What's New (≤ 4000 chars)

```text
Welcome to SuperHabits 1.0.0 — your calm, offline-first companion for habits, tasks, focus, workouts, and nutrition.

• Today dashboard, To Do with projects and recurring tasks, Habits with streaks and 52-week heatmap
• Focus timer with presets, Gym workout workspace with guided sessions, Calories with Form/Diary views
• Private by design: on-device database, works offline, no account, no analytics, no ads
• Optional one-way backup + portable export; local-only rewards (XP, badges)

First public release. English UI.
```

### Google Play — Release notes (≤ 500 chars)

```text
SuperHabits 1.0.0 — first release. Offline-first habits, tasks, focus timer, gym workouts & calories. Private by design: on-device, no account, no analytics. Optional backup + export. English UI.
```

## What it is

SuperHabits is a calm, offline-first companion for daily habits, tasks, focus
sessions, workouts, and nutrition. It runs as a Progressive Web App and as a
native Android/iOS app from one codebase. There is no account to create, no
feed, and no advertising.

## Highlights in 1.0.0

- **Today dashboard** — one screen that shows what is due, your next best
  action, momentum, and a quick look at every section.
- **To Do** — quick add, projects and goals, recurring tasks, drag-to-reorder,
  and linked actions (completing one item can complete another).
- **Habits** — scheduled habits with per-day targets, rule history, streaks,
  a 52-week heatmap, and optional reminders with Mark-complete / Snooze
  actions on Android and iOS.
- **Focus** — a Pomodoro timer with custom presets, session notes, task
  association, and focus-history insights.
- **Workout** — a full Gym V2 workspace: built-in and custom exercises, typed
  set prescriptions, weekly planning with date overrides, guided sessions
  across strength/timed/bodyweight/cardio modalities, body-weight tracking,
  and progression.
- **Calories** — a Form/Diary split with macro targets, saved meals, day
  copy, and yearly trends.
- **Local rewards** — XP and levels, streaks with freezes, rotating daily
  quests, 36 badge tiers, and a celebration overlay. Rewards are intentionally
  local-only: they are never uploaded, backed up, or tied to an account.
- **Design** — the Pop visual system: Nunito type throughout, chunky rounded
  surfaces, a colour per section, tactile motion that honours reduced motion,
  and 14 verified themes (6 light / 8 dark).

## Your data

- Everything is stored in a local SQLite database on your device; the app is
  fully usable offline.
- **Backup is optional and one-way.** If you choose to protect a backup with
  an email address, your data is pushed to a private per-account store in
  Supabase and can be restored on an empty device. It is not a two-way sync.
- **Portable data** lets you export a complete file and import it on another
  device.
- No analytics, no tracking, and no data collection. See the store privacy
  declarations.

## Known limitations in this release

- The interface ships in English only.
- Remote backup is push-and-restore, not continuous two-way sync; conflicting
  edits are not merged.
- Local rewards restart from whatever activity survived a restore, because
  reward state is deliberately not backed up.
- Native reminders depend on the operating system's notification permissions
  and battery policies.

## Upgrade notes

First public release; there is no earlier version to upgrade from. Databases
are migrated forward automatically and migrations are append-only.

## Version + tag checklist (release-time; do not run yet)

Confirm these before tagging `v1.0.0` (all values current at this draft):

- [ ] `package.json` `version` is `1.0.0`.
- [ ] `app.json` `expo.version` is `1.0.0`, `ios.buildNumber` is `1`,
      `android.versionCode` is `1` (`eas.json` `production.autoIncrement`
      stays `true`, so CI increments builds after this release).
- [ ] `docs/release/app-store-readiness.md` item 5 references this file.
- [ ] Pre-tag gates pass: `npm run typecheck`, `npm run lint`,
      `npm test`, `npm run build:web`, `npm run web:hygiene`.
- [ ] `[OWNER ACTION]` EAS submit credentials: `eas.json`
      `submit.production` is currently `{}` — configure App Store Connect /
      Play Console submit credentials before `eas submit -p ios` /
      `eas submit -p android`.
- [ ] `[OWNER ACTION]` hosted privacy URL: deploy `/privacy.html` with the
      production web build and paste that URL in both store listings.
- [ ] Tag only with explicit release intent:
      `git tag -a v1.0.0 -m "SuperHabits 1.0.0" && git push origin v1.0.0`.
      Do not create the tag in a routine readiness pass.
