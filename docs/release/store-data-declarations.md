# Store data declarations + listing drafts (for owner review)

Companion to `privacy-policy.md`. Working answers for the Apple privacy
nutrition label and Google Play Data safety form, plus Play listing copy
drafts and the remaining visual-asset checklist. Technical basis:
`core/auth/accountCoordinator.ts`, `lib/supabase.ts`,
`core/providers/AppProviders.tsx`, the two AI Edge Functions, and the policy
draft. The 2026-09-19 version described backup as user-initiated; this
2026-09-25 revision records configured automatic Auth/backup and possible
AI-provider processing.

> Owner must inspect the exact release build's Supabase and AI configuration,
> provider/subprocessor terms and retention, and the live App Store Connect /
> Play Console forms before filing. These are technical drafts, not a legal
> conclusion or evidence that a store form has been submitted. See
> [Apple's app-privacy instructions](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)
> and [Play's Data safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469).

## Key conditional (read first)

- **No Supabase configuration in a build:** local data remains on the device;
  Supabase Auth, remote backup, and the Edge Function AI routes are unavailable.
- **Supabase-configured build:** the app can establish anonymous Auth at
  startup and automatically push eligible local writes to backup when its
  owner checks pass. There is no in-app backup opt-in switch. Recovery email
  remains optional.
- **AI route enabled and used:** Ask can send a question and bounded retrieved
  facts through an Edge Function to a model provider. Remote command parsing
  has separate internal rollout gates. Prompt processing is conditional on
  the route and deployed provider configuration, not on whether backup was
  manually selected.

For a configured release, do not select "Data Not Collected" or "No data
collected" on the assumption that the user has not opened Backup settings.
Store forms describe the app's actual release behavior across its users and
platforms, including conditional paths.

## 1. Apple — App Privacy label (recommended)

- **Tracking draft:** No advertising or cross-app tracking is implemented;
  the owner must verify every deployed provider's terms and the exact build.
- **Data linked to the user** (purpose: **App Functionality**; subject to
  owner review of the final build and Apple definitions):
  - **Contact Info → Email Address** — only when the user attaches a recovery
    email (Recoverable Account V1). Users who never do this transmit no email.
  - **User Content / App Activity** (choose the form's precise categories) —
    todos, habits + completions, focus sessions, workouts + history, body
    weight, meals + calorie entries, plans, reviews, linked-action rules,
    allowlisted settings in configured backup; AI questions, selected
    conversation context, and retrieved facts when an AI route is enabled
    and used.
  - **Identifiers → User ID** — the anonymous per-account owner id can be
    created during configured startup, before the user enters backup settings.
- **Data not linked to the user / transient processing:** owner to determine
  from actual Auth, AI-provider and logging behavior. `store: false` in a
  model call does not by itself prove Apple's retention threshold is met.
- **Data Not Collected** is not a supported draft answer for a configured
  build with automatic Auth and backup.
- Privacy policy URL: `[OWNER ACTION]` — deploy `public/privacy.html` with the web build (served at `/privacy.html`) and paste that URL in App Store Connect (required for every app). Source of truth stays `docs/release/privacy-policy.md`.

## 2. Google Play — Data safety (recommended)

Answer per data type, accounting for configured backup and any enabled AI path:

| Question                            | Answer                                                                                                                                                                                                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data collected?                     | Yes for a Supabase-configured release: anonymous Auth can occur at startup and eligible content can back up automatically. Enabled AI requests can also leave the device.                                                                                             |
| Data shared with third parties?     | **Owner decision after provider review.** Supabase hosts Auth/backup; enabled AI requests can reach a model provider. Determine whether each recipient qualifies for Play's service-provider exception before selecting Yes/No.                                       |
| Types                               | Account identifier, optional email, user-entered content and app activity in backup; question/command text and selected retrieved facts when AI is enabled and used. Confirm the exact form categories, including health/fitness prompts, in Console.                 |
| Purposes                            | App functionality: ownership, backup/restore/recovery, and any enabled AI request. Confirm provider secondary uses and logging before filing.                                                                                                                         |
| Optional vs required / user control | Auth and backup can run automatically in a configured build; recovery email and AI request submission are optional. Most in-app item removals leave a remote tombstone with content; full erasure needs the owner-approved support procedure in the policy draft.     |
| Encrypted in transit?               | Yes (HTTPS).                                                                                                                                                                                                                                                          |
| Users can request data deletion?    | **Owner decision pending.** In-app item deletion exists, but full account erasure needs a verified support procedure for anonymous and email-protected owners. Confirm the final Play answer only after that procedure and the policy response timeline are approved. |
| Families / children                 | General audience and not designed for children. Owner must review configured Auth/backup/AI behavior against the final target-audience form.                                                                                                                          |
| Privacy policy URL                  | `[OWNER ACTION]` — deploy `public/privacy.html` (`/privacy.html`) and paste that URL — required.                                                                                                                                                                      |

Security-practices notes for the form: local data protected by OS controls;
backup isolated per account with a local owner binding that pauses remote
work on session mismatch instead of rebinding silently. Play's form includes
even ephemeral off-device processing; the owner must assess the final
provider route and retention rather than assuming AI requests are exempt.

## 3. Google Play — listing copy (drafts)

**Short description (≤ 80 chars):**

> Offline-first habits, tasks, focus, workouts & meals. No signup needed.

**Full description (draft, ≤ 4000 chars):**

> SuperHabits is a calm, offline-first companion for your whole day: a Today
> dashboard, To Do with projects and recurring tasks, Habits with streaks and
> a 52-week heatmap, a Focus timer with presets, a full Gym workout workspace
> with planning and guided sessions, and Calories with Form/Diary views,
> macros, and saved meals.
>
> Your entries are stored in a database on your device, and the app works
> offline without a registration step. A build connected to our backup
> service can create an anonymous account and back up your data to a private
> per-account store for restore on an empty device. A portable
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

- [ ] App Store: one accepted 6.9" iPhone set (for example 1290 × 2796,
      with 6.5" fallback) and one required 13" iPad set (2048 × 2732 or
      2064 × 2752 native capture; tablet support is on). Six surfaces:
      Today, Habits, Focus, Workout session, Calories diary, Level &
      Achievements. No real personal data in frames.
- [ ] Play: feature graphic 1024×500 (no essential text near edges), ≥ 2
      phone screenshots, same six surfaces preferred.
- [ ] Acceptance: current `1.0.0` build, default or clearly-shown theme,
      English UI, seeded demo content only, status bar neutral.

See the full checklist for exact dimensions, counts, surface → file
mapping, and `[OWNER ACTION]` capture boxes.

## 5. What changed vs the old readiness note

`app-store-readiness.md` item 3 once treated backup as an optional user
action and "Data Not Collected" as a per-user default. Source inspection
shows automatic anonymous Auth and backup in configured builds; the Ask
route can also process submitted data through a model provider. The filed
answers remain an owner action until the exact build and provider terms are
reviewed. This revision changes documentation, not product behavior.
