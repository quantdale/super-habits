# SuperHabits — Privacy Policy (draft for owner review)

**Effective date:** `[OWNER ACTION: publication date]` (draft revised 2026-09-25)

**Applies to:** SuperHabits 1.0.0 — web (PWA), Android, and iOS builds from
this repository.

> Status: release draft. It describes the app's actual behavior as implemented
> in this repository (local-first SQLite, configured one-way backup, no ad
> analytics). Before submission, the app owner must fill the `[OWNER ACTION]`
> placeholders below, host this text at a public URL, and link that URL in
> the App Store and Play Store listings. The owner must confirm the exact
> release build's remote configuration and provider terms before publication.

## The short version

- SuperHabits works fully offline. Your tasks, habits, workouts, meals, and
  settings live in a database **on your device**.
- No registration step is needed, and there are **no ads or cross-app
  tracking**. A build configured with Supabase may automatically create an
  anonymous account and back up eligible data. See §§2–3.
- When remote AI is enabled, submitting a question or command can send its
  text and selected app context to a model provider. See "AI-assisted
  requests" below.
- An **optional email** is used only to protect and recover that backup.
- Rewards (XP, streaks, badges) never leave your device and are never backed
  up.

## 1. Data stored on your device

Everything you create in the app — todos, projects, goals, habits and their
completions, focus sessions, workout routines and history, body-weight
entries, calorie entries, saved meals, plans, reviews, linked-action rules,
and settings — is stored in a local SQLite database on your device. The app
is fully usable without a network connection. Whether data also leaves
your device depends on the build's remote configuration and the actions
you take. A Supabase-configured build can create an anonymous session and
push eligible records automatically; an enabled AI request can transmit
text and selected local facts. See the sections below.

## 2. Configured backup (one-way push, not sync)

If the build has Supabase configured and remote mode is enabled, the app may
automatically push recoverable data to an account-isolated store hosted by
Supabase after local writes. There is currently no in-app backup opt-in switch.
If the service is not configured or is unavailable, local use continues.

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
  **At rest:** the backup is separated by account owner in the developer's
  Supabase project. Supabase operates the hosted service; the owner must
  confirm its processing and retention terms for the release.

Backup uses an anonymous account identifier (see §3). The account and its
associated network requests may exist before the first user-created item is
backed up.

## 3. Account and recovery email (optional)

- **Anonymous account:** when Supabase is configured, the app may create an
  anonymous session during startup so your backup has a private owner; no
  registration step or email is required. A local owner
  binding on your device prevents a lost or mismatched sign-in session from
  silently attaching your data to the wrong account; in that case local use
  continues and remote backup/restore simply pauses.
- **Email (optional):** you may attach a verified email address to protect
  an anonymous backup and to recover it later. The email is used only for
  ownership verification and one-time recovery codes. Recovering an existing
  account is only possible on an empty device (or for the dataset's
  already-bound owner), and recovery never creates an account implicitly.
- We send no marketing email. There is no newsletter and no mailing list.

## AI-assisted requests (when enabled)

The Ask feature can submit a question to the app's Supabase Edge Function.
If its provider is configured, the function can send the question, selected
conversation turns, local date/time context, and bounded facts retrieved
from your data to a third-party model service to form an answer. The remote
command parser, when separately enabled for internal rollout, can send the
command text and date/time context to a model service. These calls happen
when a user submits a request; they are not required to use the other app
features. Model-backed results are not a replacement for confirming a
mutation before it is executed.

The function source sets `store: false` on model requests, but that setting
alone does not establish provider retention. The owner must
verify which AI paths and providers are enabled in the release build, the
provider/subprocessor terms, logging, retention, and the applicable store
disclosures before publishing this policy. Do not put information in an AI
request that you do not wish to send to its provider.

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

- No advertising, ad SDKs, or cross-app tracking. Remote authentication,
  backup, and AI services can generate operational, quota, and error records.
- No sale of personal data or data-broker use. Supabase hosts account and
  backup services, and enabled AI requests can reach model providers as
  described above.
- The interface ships in English only. AI requests may include locale,
  time zone, and local date context when that path is enabled and used.

## 7. Children

SuperHabits is a general-purpose productivity app with no age gate and no
content aimed specifically at children. A parent or guardian should
supervise use of its account-backed and AI-assisted features.

## 8. Retention and deletion

- **On-device data** lives as long as you keep it; deleting items in the app
  removes them from your lists, and uninstalling the app removes the local
  database subject to your OS's app-data policies.
- **Backup data:** most item removals mark a record deleted and hide it from
  the app while retaining its content in the remote backup record. A small
  set, such as saved meals, is deleted outright from the backup. To request
  complete erasure of
  your remote backup store, contact `[OWNER ACTION: support email]`. Backups
  can be anonymous, so an email address alone cannot identify every account.
  `[OWNER ACTION: publish an ownership-verification and deletion procedure for
anonymous and email-protected backups, including a response timeline]`.
- **Recovery email:** the app currently has no in-app control to remove an
  attached recovery email. Contact the support address above to request
  deletion of the address or associated account; the owner must verify the
  request and the available deletion procedure before promising an outcome.
- **AI requests:** provider-side retention and deletion depend on the
  verified terms of the providers enabled in the release build; contact
  the support address above for a request about a submitted prompt.

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
- 2026-09-25 — draft correction: configured automatic backup, possible
  anonymous Auth bootstrap, and enabled AI-provider requests disclosed;
  effective date and provider terms remain owner review items.
