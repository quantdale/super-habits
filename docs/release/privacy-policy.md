# SuperHabits — Privacy Policy (draft for owner review)

**Effective date:** 2026-09-19 (draft — owner to confirm at release time)

**Applies to:** SuperHabits 1.0.0 — web (PWA), Android, and iOS builds from
this repository.

> Status: release draft. It describes the app's actual behavior as implemented
> in this repository (local-first SQLite, optional one-way backup, no
> analytics). Before submission, the app owner must fill the `[OWNER ACTION]`
> placeholders below, host this text at a public URL, and link that URL in
> the App Store and Play Store listings.

## The short version

- SuperHabits works fully offline. Your tasks, habits, workouts, meals, and
  settings live in a database **on your device**.
- We collect nothing by default: **no account, no analytics, no tracking,
  no advertising, no third-party SDKs receiving your data.**
- An **optional backup** (off by default in the sense that nothing leaves the
  device until you use it) pushes an encrypted-in-transit copy of your data
  to a private per-account store so you can restore it on an empty device.
- An **optional email** is used only to protect and recover that backup.
- Rewards (XP, streaks, badges) never leave your device and are never backed
  up.

## 1. Data stored on your device

Everything you create in the app — todos, projects, goals, habits and their
completions, focus sessions, workout routines and history, body-weight
entries, calorie entries, saved meals, plans, reviews, linked-action rules,
and settings — is stored in a local SQLite database on your device. The app
is fully usable without a network connection, and with backup features
unused, **no personal data ever leaves your device**.

## 2. Optional backup (one-way push, not sync)

If you choose to back up, the app pushes a copy of your recoverable data to
a private per-account store hosted on Supabase infrastructure:

- **What is included:** todos, habits, habit completions, focus (Pomodoro)
  sessions, saved meals and calorie entries, the full workout structure and
  history (routines, exercises, sets, weekly plans, date overrides, body
  weight), linked-action rules, planning entities (projects, goals, daily
  plans, weekly reviews), and an allowlist of settings, plus an integrity
  manifest used to verify restores.
- **What is NOT included:** your rewards state (XP, levels, streaks, quests,
  badges) is intentionally local-only and is never uploaded or backed up. A
  restore starts rewards from the activity that survived.
- **Direction:** backup is a **one-way push plus restore**, not continuous
  two-way sync. Conflicting edits are not merged. Restore only runs onto a
  completely empty device and never replays historical side effects.
- **Protection in transit:** backup traffic uses encrypted HTTPS connections.
  **At rest:** your backup store is isolated per account and is not shared
  with, sold to, or processed by any third party for any purpose.

Using backup requires a lightweight anonymous account created on-device
(see §3). If you never use backup, restore, or portable import, none of §2
applies to you.

## 3. Account and recovery email (optional)

- **Anonymous account:** when backup is used, the app creates an anonymous
  account identifier so your backup has a private owner. A local owner
  binding on your device prevents a lost or mismatched sign-in session from
  silently attaching your data to the wrong account; in that case local use
  continues and remote backup/restore simply pauses.
- **Email (optional):** you may attach a verified email address to protect
  an anonymous backup and to recover it later. The email is used only for
  ownership verification and one-time recovery codes. Recovering an existing
  account is only possible on an empty device (or for the dataset's
  already-bound owner), and recovery never creates an account implicitly.
- We send no marketing email. There is no newsletter and no mailing list.

## 4. Portable data (your file, your control)

The app can export a complete portable backup file and import it on another
device. The file is created on your device at your explicit request; what
you do with that file (store it, send it, delete it) is entirely under your
control.

## 5. Notifications

Reminders (habits, todos, daily plans, weekly reviews) are scheduled
**on your device** by the operating system. Notification content does not
leave your device, and the app uses no remote push-messaging service.

## 6. What we do not do

- No analytics or usage tracking of any kind.
- No advertising, no ad SDKs, no cross-app tracking.
- No sale, rental, or sharing of personal data with third parties.
- No data brokers, no profiling, no automated decision-making.
- The interface ships in English only; using the app does not depend on your
  locale or any locale data leaving the device.

## 7. Children

SuperHabits is a general-purpose productivity app with no age gate and no
content aimed specifically at children. Because the default posture is
on-device-only with no collection, there is nothing distinct to declare for
younger users; where the optional backup or email is used, a parent or
guardian should supervise as with any account-backed feature.

## 8. Retention and deletion

- **On-device data** lives as long as you keep it; deleting items in the app
  removes them from your lists, and uninstalling the app removes the local
  database subject to your OS's app-data policies.
- **Backup data:** deletions made in the app propagate to your backup store
  (including hard-delete propagation for the small set of entities the app
  deletes outright, such as saved meals). To request complete erasure of
  your remote backup store, contact `[OWNER ACTION: support email]` from the
  address associated with the backup; requests are honored within 30 days.
- **Recovery email:** removing the email from your backup settings stops
  future use of that address; contact the same address above to request
  deletion of the stored address.

## 9. Security

Local data is protected by your device's own access controls (lock screen,
encrypted storage where your OS provides it). Backup traffic is encrypted in
transit; backup storage inherits the access controls of the hosting
platform. No method of transmission or storage is perfectly secure, so avoid
storing information in the app that you would not want disclosed in the
unlikely event of a device or account compromise.

## 10. Changes to this policy

Material changes will be published with a new effective date, and the policy
is versioned alongside the app (`docs/release/privacy-policy.md` in the
source repository). Continued use of the app after a change takes effect
constitutes acceptance of the updated policy for data handled from that
point forward.

## 11. Contact

Questions about this policy or requests relating to your backup data:

- `[OWNER ACTION: support email]`
- `[OWNER ACTION: public policy hosting URL — required for both store listings]`

## 12. Change history

- 2026-09-19 — v1.0.0 draft: initial policy for the first public release
  (local-first SQLite; optional one-way backup + restore; optional recovery
  email; local-only rewards; no analytics/ads/sharing).
