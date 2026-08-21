# Exploratory Missions — SuperHabits

Human-run, time-boxed exploratory missions for the areas automation cannot reach, or where unknown-unknowns are likely. These complement the deterministic journey suite (`e2e/journeys/`) and the integration level: a journey asserts a scripted expectation, a mission looks for what nobody thought to script.

Each mission states the objective, starting state, area, realistic behaviours to try, risks, and what to observe — **without prescribing every interaction**. The point is to explore like a user, not to follow a script. Recommended time-boxes are included; a mission that runs out of time should be stopped, not rushed. If the mission finds nothing, that is a valid result — record it as such.

Sections and screens are named as they appear in the app: **Overview, Todos, Habits, Focus (Pomodoro), Workout, Calories**, plus the **Settings** drawer and the experimental **Command Center** overlay.

- **Quoted drop-downs and labels** are the app's own text; where a label is not yet known, the mission says "the label/control for X" rather than guessing.
- These missions are **manual**. They run on a real device (iOS/Android) or a real browser tab, not Playwright. The same mission may uncover a reproducible defect — that is the desired outcome, and it is recorded per the convention in [Recording findings](#recording-findings).

## How to run a mission

1. Read the mission's objective and starting state.
2. Set up the starting state (it is always stated explicitly; most missions start from a clean install or a `TYPICAL`-shaped dataset).
3. Time-box yourself to the stated duration. Do not script every tap — behave like the persona indicated, and deviate when the app invites you to.
4. Keep a scratch note of what you tried, in what order, and what happened. At the end, classify each finding per [Recording findings](#recording-findings).
5. When a mission ends, write the result into the findings log (see [Recording findings](#recording-findings)) — even a "no findings" run.

---

## M1 — Native notifications and `Alert.alert`

- **Objective:** Verify that notification delivery and confirmation dialogs behave correctly on a real native device, which the web export cannot exercise.
- **Area:** Focus (Pomodoro) notifications, `expo-notifications`; delete/confirm paths that use `Alert.alert` (e.g. habit delete, restore prompt).
- **Persona:** P1 — Maya, the Daily Driver.
- **Starting state:** Clean install on a physical iOS or Android device. Notifications permission granted. Focus timer defaults set to a short duration (e.g. 1 minute) so a session completes quickly.
- **Realistic behaviours to try:**
  - Start a Focus session and let it complete while the app is in the foreground, backgrounded, and fully locked.
  - Force-quit the app and complete a session; verify whether the notification still arrives and what the badge/notification traffic looks like.
  - Delete a habit (the path that needs `Alert.alert`) and confirm/cancel; verify the dialog appears and the outcome matches the choice.
  - Trigger the restore prompt on a fresh install and dismiss it.
- **Risks to investigate:** Notifications arriving late, not at all, or multiple times; a notification that opens the wrong section; `Alert.alert` that never appears on a given platform, or appears behind the modal/sheet; notification permission prompts that block the app's first use.
- **What to observe:** Whether a completed Focus session always produces exactly one notification, whether confirmation dialogs reliably appear and cancel cleanly, and whether the app remains usable after the platform asks for notification permission.
- **Time-box:** 30 minutes.

## M2 — Real-device multi-day usage

- **Objective:** Use the app as a real daily user across several days, crossing the midnight boundary repeatedly with the app mounted, and observe day-rollover behaviour on a real device.
- **Area:** All six sections; day-scoped data (date keys, streaks, Overview day aggregates).
- **Persona:** P1 — Maya, the Daily Driver.
- **Starting state:** Clean install. Add a few habits and todos on day 1, leave the app open. (If the companion `fix-day-rollover-refresh` has landed, this mission also validates the refresh behaviour; if not, it validates the documented gap CG-1.)
- **Realistic behaviours to try:**
  - Leave the app open overnight and return in the morning; check whether each section still shows the correct day's data.
  - Tick a habit shortly after midnight and confirm the completion lands on the new day.
  - Switch between sections across the boundary and confirm inactive sections show fresh data when activated.
  - Close and reopen the app on a later day and confirm streaks and aggregates reflect the actual history.
- **Risks to investigate:** A section still labelling yesterday "Today"; a habit tick written to the wrong day; Overview aggregates that disagree with the section they summarise; streak resets that should not have happened.
- **What to observe:** Whether the day boundary is handled gracefully on a real device, whether any stale-day labels appear, and whether the app's six permanently-mounted sections stay consistent across the rollover.
- **Time-box:** Spread across 3–5 real days; ≤ 10 minutes of active exploration per day.

## M3 — Swipe-gesture conflicts with list scroll and drag reorder

- **Objective:** Verify that horizontal swipe navigation between sections does not fight with vertical list scrolling or drag-to-reorder gestures.
- **Area:** Horizontal swipe (`Gesture.Pan`) between sections; list scroll in Todos/Calories/Workout; drag reorder in Todos.
- **Persona:** P3 — Priya, the Power User.
- **Starting state:** A `TYPICAL`-shaped dataset with enough todos to scroll and a few to reorder. On a real device or a touch-capable browser.
- **Realistic behaviours to try:**
  - Scroll a long list vertically and notice whether the horizontal swipe ever fires mid-scroll.
  - Drag a todo to reorder it and confirm the drag is not swallowed by the horizontal swipe.
  - Start a swipe from near the screen edge (the 40px dead zones) and from the middle of the screen; compare.
  - Swipe quickly versus slowly; note the threshold (`width/3` or velocity 500) behaviour.
- **Risks to investigate:** A vertical scroll that triggers a section change; a drag-reorder that cannot start; a section change that drops the list's scroll position; gestures that feel too sensitive or too dead.
- **What to observe:** Whether each gesture stays in its lane, whether reorder survives a reload, and whether any accidental section switches occur during normal scrolling.
- **Time-box:** 30 minutes.

## M4 — All 14 themes for legibility

- **Objective:** Verify every one of the 14 registered themes is legible and usable across all six sections, not just the default themes.
- **Area:** Theme picker (Settings → Appearance), all `core/theme/` themes (`light`, `dark`, `midnight-blue`, `forest-green`, `ocean-teal`, `royal-purple`, `crimson-red`, `sunset-orange`, `rose-pink`, `cyberpunk-neon`, `nord-arctic`, `solarized`, `emerald-dark`, `coffee-brown`).
- **Persona:** anyone; themes are a personalisation surface.
- **Starting state:** A `TYPICAL`-shaped dataset so every section has content to render. Any device.
- **Realistic behaviours to try:**
  - Switch to each theme in turn and open every section, plus Settings and the Command Center, checking text contrast against its background.
  - Check the theme in bright light (high ambient light) and, for dark themes, in a dark room.
  - Check section accent colours against their own theme background — the per-tab `sectionColors` palette must remain distinguishable.
  - Reload the app under each theme and confirm the theme persists (AsyncStorage `superhabits.theme.mode` / `superhabits.theme.slots.v2`).
- **Risks to investigate:** Text that is unreadable against a themed background; a section accent that blends into the theme; a theme that breaks the `data-theme` attribute or `<meta name="theme-color">`; a theme that fails to persist across reload.
- **What to observe:** For each theme, whether any text, button, chip, or chart becomes illegible, and whether the theme survives a reload and restart.
- **Time-box:** 45 minutes (roughly 3 minutes per theme).

## M5 — Command Center with the flag enabled

- **Objective:** Exercise the Command Center overlay with the experiment flag enabled (`COMMAND_EXPERIMENT_ENABLED === true`), including its interaction with a running Focus timer.
- **Area:** Command Center overlay (`GlobalCommandCenterHost`), its floating launcher, parse/edit/confirm flow; suppression during an active Pomodoro session.
- **Persona:** P3 — Priya, the Power User.
- **Starting state:** Clean install with the flag enabled (current default). Open the Command Center from the floating launcher.
- **Realistic behaviours to try:**
  - Create a todo and a habit via natural language; edit the draft before confirming; confirm.
  - Open the Command Center while a Focus timer is running and verify the launcher is suppressed (per `useCommandLauncherSuppressed('pomodoro-active-session', …)`).
  - Open it while Settings is open and verify the launcher is hidden.
  - Enter garbage input and observe the `unsupported` / `unavailable` outcomes.
- **Risks to investigate:** The launcher appearing during an active session; the overlay covering the section it is meant to complement; a confirmed command that does not land in the right section; the overlay not closing cleanly.
- **What to observe:** Whether the overlay is usable, whether the launcher suppression behaves as documented, and whether a confirmed command is reflected in the owning section and the Overview aggregate.
- **Time-box:** 30 minutes.

## M6 — PWA install and offline shell

- **Objective:** Verify the PWA-install flow and the offline shell: install, relaunch, and use the app with no network.
- **Area:** PWA install prompt, service worker (`public/sw.js`, cache `superhabits-shell-v3`), offline behaviour.
- **Persona:** P5 — Alex, the Commuter.
- **Starting state:** A clean browser profile. `npm run build:web` output served over HTTPS or localhost; the install prompt available.
- **Realistic behaviours to try:**
  - Install the PWA and relaunch it from the home screen / start menu.
  - Load the app once online, then go fully offline and reload; verify the shell loads and the app opens.
  - With the app open offline, create a todo and a calorie entry; verify they persist locally and the outbox grows (data is not lost).
  - Bring the network back and confirm the queued records flush.
- **Risks to investigate:** Install failing; the offline shell serving a stale cache or a blank screen; offline writes that do not persist; the service worker cache version mismatch (`superhabits-shell-v3`).
- **What to observe:** Whether the installed app launches and works offline, whether offline writes persist and sync on reconnect, and whether the bootstrap gate ("Unable to start") appears only when it should.
- **Time-box:** 30 minutes.

## M7 — Heavy-data feel on a low-end device

- **Objective:** Judge the _felt_ performance of the app with a heavy dataset on a low-end device, matching the user-perceptible thresholds the journeys assert (cold Overview ≤ 5s, section switch ≤ 800ms, list input ≤ 500ms).
- **Area:** All sections with a `HEAVY`-shaped dataset (≥200 todos, ≥600 calorie entries, ≥120 pomodoro sessions, ≥40 workout logs, ≥15 saved meals).
- **Persona:** P2 — Tom, the Weekend Returner.
- **Starting state:** A low-end physical device (or an emulated throttled device) loaded with a `HEAVY` seed. Cold start.
- **Realistic behaviours to try:**
  - Cold-launch the app and time until the Overview is interactive and populated.
  - Switch between all six sections after they are all mounted; note the delayed section switch.
  - Scroll and filter the 200+ todo list and the 600+ calorie diary; type into the search/filter.
  - Navigate the heatmap and open the diary across past days.
- **Risks to investigate:** A cold start that exceeds 5s; a section switch that janks; list input that lags; a heatmap or chart that stutters; memory pressure that forces a reload.
- **What to observe:** Whether the app feels usable on the low-end device, where the first perceptible stall is, and whether any stall is a real defect (to be filed as a performance defect, not a raised threshold).
- **Time-box:** 45 minutes.

## M8 — Recovery from a corrupted OPFS database

- **Objective:** Verify the app survives a corrupted Origin Private File System (OPFS) SQLite database without a blank screen or a permanent brick.
- **Area:** OPFS SQLite persistence, the `getDatabase()` bootstrap path, the "Unable to start" gate.
- **Persona:** any (robustness edge).
- **Starting state:** A working install with data. Deliberately corrupt the OPFS database (e.g. truncate or overwrite `superhabits.db` in the origin's OPFS storage) before reloading.
- **Realistic behaviours to try:**
  - Corrupt the DB file and reload the app; observe whether the app shows a usable error or a blank screen.
  - Attempt to recover: clear the corrupted files and reload, and confirm the app bootstraps fresh.
  - Confirm a second tab on the same origin still shows the intentional bootstrap gate rather than a silent break.
- **Risks to investigate:** A blank screen or an unhandled rejection on bootstrap; the app getting stuck in a loop; partial recovery that leaves the DB half-initialised; the user having no clear path to recover.
- **What to observe:** Whether the app surfaces a recoverable state, whether clearing the corrupted files restores the app, and whether no data-corruption path leaves the app unusable.
- **Time-box:** 30 minutes.

## M9 — Long-session memory behaviour

- **Objective:** Assess whether a long session (six permanently-mounted screens, timers, listeners) degrades over time — accumulation of listeners/intervals, memory growth, stale state.
- **Area:** All six mounted sections; Repeated section switching; Focus timer; scroll positions; input state.
- **Persona:** P1 — Maya, the Daily Driver / P3 — Priya, the Power User.
- **Starting state:** A `TYPICAL`-shaped dataset. A real browser or device.
- **Realistic behaviours to try:**
  - Keep the app open for an hour or more, switching between sections frequently, starting/stopping Focus sessions, scrolling lists, and opening Settings.
  - Observe memory growth (DevTools memory timeline) and any degradation in responsiveness.
  - Check that leaving and returning to a section does not cascade duplicate `visibilitychange` listeners or duplicate intervals.
  - Check that a long-held scroll position and in-progress form input survive section switches.
- **Risks to investigate:** Memory that grows monotonically; intervals that fire more than once after repeated switches; a Focus timer that drifts after many switches; stale aggregate counts that never refresh.
- **What to observe:** Whether the app stays responsive over a long session, whether state survives section switches, and whether memory returns to baseline after a reload.
- **Time-box:** 60–90 minutes (can be a low-attention background session with periodic checks).

## M10 — First-run through a real restore

- **Objective:** Walk a brand-new user through the first-run restore flow on a real device against a real backup, and verify the eligibility lifecycle and the local-only-data disclosure.
- **Area:** Restore v1 (`core/sync/restore.coordinator.ts`), the restore prompt, Settings restore eligibility, `INSERT OR REPLACE` import.
- **Persona:** P6 — Jordan, the New Device Migrator.
- **Starting state:** A second device (or cleared origin) with a backup available from a previously-used device. This is the one mission that needs a real Supabase project (or a genuinely reachable backup) — all other missions use injected fakes.
- **Realistic behaviours to try:**
  - Fresh install → restore prompt appears → dismiss it ("Not now") → reload → confirm it does not re-appear for the same backup signature.
  - Add a todo after dismissing, open Settings, and confirm restore is now blocked with the local-data-present message.
  - On a second clean pass, accept the restore and verify imported counts, the disclosures shown, and — critically — what did **not** come back (habit completions, saved meals, pomodoro sessions, workout logs) so streaks read zero.
- **Risks to investigate:** The restore prompt appearing when it should not; a restore that resurrects a locally-deleted todo (the CG-2 defect); a dismissed restore re-prompting; streaks that read non-zero after a restore when the local-only data is absent.
- **What to observe:** The full eligibility lifecycle, whether the disclosures match the actual restore result, and whether the user's expectation of "my data came back" is met honestly.
- **Time-box:** 45 minutes.

---

## Recording findings

A mission result is only useful if it becomes a durable artifact. Follow this convention so nothing a mission finds evaporates into a conversation or a scratch note.

1. **Every finding is classified into exactly one of two outcomes:**
   - **An automated regression test** — if the finding is a reproducible, deterministic behaviour (including a _correct_ behaviour worth locking in), file a regression test in the appropriate level: a pure-logic case goes to `tests/`, a real-SQLite constraint case to `tests/integration/**`, a cross-section/reload/offline case to `e2e/journeys/**`. Write the test against the _desired_ behaviour.
   - **A filed defect** — if the finding is a reproducible defect (or a decided-contract gap the application does not yet satisfy), file it as a defect. If it is a decided contract gap, follow the [contract-gap protocol](known-gaps.md#contract-gaps): write the test against the decided contract, quarantine it with a comment naming the companion change, and add it to the known-gap register.
2. **Record enough reproduction detail to re-run it.** The record must let a developer re-create the exact state and actions: the mission and step, the starting state, the exact taps, the observed result, and — where it matters — the underlying SQLite rows or network traffic. A finding that cannot be reproduced is not a finding; it is a note.
3. **A "no findings" result is still recorded** — as a one-line note in the findings log for that mission, so it is clear the area was explored and not merely skipped.
4. **Never weaken an assertion to make a finding pass.** If the behaviour does not match the decided contract, the resolution is a filed defect and a quarantined test — never an assertion loosened to match current behaviour. (This is the standing rule in the [known-gap register](known-gaps.md#standing-rule).)

The findings log itself can live in the change's follow-up notes, a defect tracker, or the mission's own file — the convention is that the finding _becomes_ a test or a defect, not that it is merely described in prose.
