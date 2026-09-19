# Store data declarations + listing drafts (for owner review)

Companion to `privacy-policy.md`. Recommended answers for the Apple privacy
nutrition label and the Google Play Data safety form, plus Play listing copy
drafts and the remaining visual-asset checklist. All answers describe the app
**as implemented** (evidence in `privacy-policy.md` §§1–6 and the Context
section of the plan
`.agent/execplans/app-store-privacy-artifacts-v1.md`).

> Owner must confirm these answers in App Store Connect / Play Console before
> submission. They are good-faith disclosures, not legal advice.

## Key conditional (read first)

- **Backup unused (default local-only use):** nothing leaves the device —
  "Data Not Collected" / "No data collected" is accurate.
- **Backup enabled by the user:** user content + an account identifier (+ an
  optional email) are stored in the developer's Supabase backend. Store forms
  are answered for the app as a whole, so the declarations below **include
  the backup path**. This is why Apple gets a label (not "Data Not
  Collected") and Play gets declared types with "optional / user-initiated"
  handling.

## 1. Apple — App Privacy label (recommended)

- **Tracking:** No (no tracking, no ad SDKs, no cross-app identifiers).
- **Data linked to the user** (purpose: **App Functionality**; not used for
  tracking; collection is user-initiated via backup/recovery features):
  - **Contact Info → Email Address** — only when the user attaches a recovery
    email (Recoverable Account V1). Users who never do this transmit no email.
  - **User Content** (other user content / app-activity equivalents as
    prompted by the form) — todos, habits + completions, focus sessions,
    workouts + history, body weight, meals + calorie entries, plans, reviews,
    linked-action rules, allowlisted settings — only inside the optional
    backup payload.
  - **Identifiers → User ID** — the anonymous per-account backup owner id.
- **Data not linked to the user:** none declared.
- **Data Not Collected** does **not** apply once the optional backup path
  ships, because backup stores user content server-side. (If a future build
  removed remote backup entirely, the label could revert to Data Not
  Collected.)
- Privacy policy URL: `[OWNER ACTION]` — deploy `public/privacy.html` with the web build (served at `/privacy.html`) and paste that URL in App Store Connect (required for every app). Source of truth stays `docs/release/privacy-policy.md`.

## 2. Google Play — Data safety (recommended)

Answer per data type, accounting for the optional backup path:

| Question                            | Answer                                                                                                                                                                                                         |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data collected?                     | Yes — when the user enables backup/recovery (otherwise nothing leaves the device).                                                                                                                             |
| Data shared with third parties?     | No — the backend is the developer's own Supabase project; no SDK, advertiser, or broker access.                                                                                                                |
| Types (when backup used)            | Personal info the user types (tasks, habits, notes), app activity (completions, sessions, plans), account id, optional email. Fitness-adjacent content (workouts, body weight, meals) as user-entered content. |
| Purposes                            | App functionality (backup + restore + account recovery) only.                                                                                                                                                  |
| Optional vs required / user control | Collection is optional and user-initiated; in-app deletion propagates to the backup store; full erasure on request via the support contact in the policy.                                                      |
| Encrypted in transit?               | Yes (HTTPS).                                                                                                                                                                                                   |
| Users can request data deletion?    | Yes — in-app deletion plus support-contact erasure (30 days), per policy §8.                                                                                                                                   |
| Families / children                 | General audience; no distinct child-directed collection; default posture is on-device-only.                                                                                                                    |
| Privacy policy URL                  | `[OWNER ACTION]` — deploy `public/privacy.html` (`/privacy.html`) and paste that URL — required.                                                                                                               |

Security-practices notes for the form: local data protected by OS controls;
backup isolated per account with a local owner binding that pauses remote
work on session mismatch instead of rebinding silently.

## 3. Google Play — listing copy (drafts)

**Short description (≤ 80 chars):**

> Offline-first habits, tasks, focus, workouts & meals. No account needed.

**Full description (draft, ≤ 4000 chars):**

> SuperHabits is a calm, offline-first companion for your whole day: a Today
> dashboard, To Do with projects and recurring tasks, Habits with streaks and
> a 52-week heatmap, a Focus timer with presets, a full Gym workout workspace
> with planning and guided sessions, and Calories with Form/Diary views,
> macros, and saved meals.
>
> Private by design: everything lives in a database on your device, the app
> works fully offline, and there is no account to create, no analytics, no
> ads, and no tracking. An optional one-way backup can protect your data to
> a private per-account store for restore on an empty device, and a portable
> export file moves your data between devices on your terms. Rewards (XP,
> streaks, badges) are a fun local-only layer — never uploaded or backed up.
>
> First release (1.0.0). Interface in English.

contact email for the listing: `[OWNER ACTION]`.

## 4. Remaining visual assets (verifiable spec + device-bound capture)

Spec is **delivered 2026-09-19** in `docs/release/store-assets-checklist.md`
— Apple pixel sizes/counts (§1), Play feature-graphic + screenshot rules
(§2), six-surface → file mapping (§3), acceptance criteria (§4), and
framing don'ts (§6). No image binaries ship (needs a real seeded
device/emulator — must not fabricate PNGs). Capture itself stays
device-bound:

- [ ] App Store: 6.7" (1290 × 2796) + 6.1" (1179 × 2556) iPhone sets;
      12.9" (2048 × 2732) / 13" (2064 × 2752) iPad sets (tablet support
      is on). Six surfaces: Today, Habits, Focus, Workout session,
      Calories diary, Level & Achievements. No real personal data in frames.
- [ ] Play: feature graphic 1024×500 (no essential text near edges), ≥ 2
      phone screenshots, same six surfaces preferred.
- [ ] Acceptance: current `1.0.0` build, default or clearly-shown theme,
      English UI, seeded demo content only, status bar neutral.

See the full checklist for exact dimensions, counts, surface → file
mapping, and `[OWNER ACTION]` capture boxes.

## 5. What changed vs the old readiness note

`app-store-readiness.md` item 3 previously read "Data Not Collected / No
data collected / No data shared" unconditionally. That is now corrected to
the conditional above: true only with backup unused; declarations in §§1–2
cover the backup-enabled path. The underlying product behavior is unchanged.
