# SuperHabits 1.0.0 — store submission package (owner handoff)

**Prepared:** 2026-09-25 from the current repository worktree. **Status:**
ready for owner inputs and exact-build verification; no store submission or
`v1.0.0` tag is authorized by this document. The 1.0.0 source baselines are
`package.json` / `app.json` version `1.0.0`, iOS build number `1`, Android
version code `1`. EAS uses remote version state and production auto-increment,
so the submitted binaries must have their resolved identifiers recorded.

## Inventory method and current count

The 2026-09-25 scan of the eight pre-existing Markdown files in
`docs/release/` found **55 lines / 55 occurrences** of the exact owner-action
marker. Counts by source: `age-rating-and-trader.md` 17;
`app-store-readiness.md` 5; `icon-splash-asset-audit.md` 7;
`privacy-policy.md` 6; `release-notes-1.0.0.md` 2;
`store-assets-checklist.md` 6; `store-data-declarations.md` 4;
`version-build-consistency.md` 8. That scan includes explanatory mentions,
repeated placeholders, and repeated checkboxes; it is not a count of distinct
owner decisions. The older "58 across 9 files" inventory is obsolete.

The table below is the **deduplicated action inventory**. Each row names the
information or evidence to provide once, and all source documents that use
it. Rows R10, R12, and R16 also capture release prerequisites that were not
fully represented by the marker scan. Do not fill a row by inventing an email,
legal identity, console status, signing state, or screenshot.

| ID  | Owner action and required evidence                                                                                                                                                                                                                                                                                                                                        | Source documents / handoff                                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R01 | Choose one monitored public support email; establish how backup/AI data requests reach an operator. Define and verify an ownership-check and deletion procedure for both anonymous and email-protected accounts, then set a response timeline before promising erasure or filing Play account-deletion answers. Reuse the address in policy, listings, and trader fields. | [Privacy policy](privacy-policy.md) §§8, 11; [Play listing draft](store-data-declarations.md) §3; [trader draft](age-rating-and-trader.md) §3.                                                                                                                             |
| R02 | Review and approve the policy, choose its effective date, publish the matching `public/privacy.html` at a stable HTTPS URL, verify HTTP 200 and that no owner placeholders remain, then enter the same URL in both stores.                                                                                                                                                | [Privacy policy](privacy-policy.md), [declarations](store-data-declarations.md) §§1–2, [readiness](app-store-readiness.md) item 3, [release notes](release-notes-1.0.0.md), [version audit](version-build-consistency.md) §4, [trader draft](age-rating-and-trader.md) §1. |
| R03 | Inspect the exact build's Supabase/AI configuration and provider terms; approve Apple App Privacy and Play Data safety answers for automatic anonymous Auth/backup and any enabled AI requests. Decide any service-provider exemption, categories, retention/deletion, and health/fitness fields before filing. Record screenshots/export of the filed forms.             | [Declarations](store-data-declarations.md) §§1–2; [privacy policy](privacy-policy.md) §§2–3 and AI section; [readiness](app-store-readiness.md) item 3.                                                                                                                    |
| R04 | Approve the English App Store description, Play short/full descriptions, Apple What's New, and Play release notes against the exact binary. Enter support contact, category, keywords and other listing copy in each console.                                                                                                                                             | Copy below; [Play draft](store-data-declarations.md) §3; [release notes](release-notes-1.0.0.md); [readiness](app-store-readiness.md) items 2, 5, 7.                                                                                                                       |
| R05 | Complete Apple age-rating and Play content-rating, Families, ads, and any health-app questionnaires from the final feature/provider posture. Owner and counsel confirm the health self-tracking answer for launch locales.                                                                                                                                                | [Age-rating draft](age-rating-and-trader.md) §§1–2, 4; [readiness](app-store-readiness.md) item 6.                                                                                                                                                                         |
| R06 | Decide trader/non-trader status with counsel and enter the identity/contact evidence the actual Apple and Play consoles request: legal/trading name, address, phone, email, registration/tax IDs or not-applicable answers, and EU representative if required. Complete console verification.                                                                             | [Trader draft](age-rating-and-trader.md) §§3–4; [Apple DSA guidance](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements).                                                     |
| R07 | Capture and approve real `1.0.0` native-build Apple screenshots: one accepted 6.9-inch iPhone set (or 6.5-inch fallback) and one required 13-inch iPad set; add smaller sets only if requested or desired. Record build and device provenance for every image.                                                                                                            | [Asset checklist](store-assets-checklist.md) §§1, 3–6; [readiness](app-store-readiness.md) item 1.                                                                                                                                                                         |
| R08 | Capture at least two real-build Play phone screenshots and create the 1024 × 500 feature graphic with no transparency. Prefer six actual app surfaces; verify each image's pixels and console preview.                                                                                                                                                                    | [Asset checklist](store-assets-checklist.md) §§2–6; [declarations](store-data-declarations.md) §4; [readiness](app-store-readiness.md) item 2.                                                                                                                             |
| R09 | Inspect notification silhouette, Android themed icon, splash on small/large phones, PWA maskable icon, and 1024-square store icon in actual launchers/consoles. Record visual acceptance or replace a failing source asset.                                                                                                                                               | [Icon/splash audit](icon-splash-asset-audit.md) §4; [readiness](app-store-readiness.md) metadata.                                                                                                                                                                          |
| R10 | Establish Apple/Google developer accounts and signing authority, then produce production-signed iOS and Android artifacts from the intended source SHA. Record build IDs, artifact hashes, resolved version/build numbers, device proof, and who controls credentials. Static EAS configuration is not an iOS runtime result.                                             | [Version audit](version-build-consistency.md) §§3–4; [readiness](app-store-readiness.md); `eas.json`; [native QA guide](../testing/native-e2e.md).                                                                                                                         |
| R11 | Prepare EAS Submit access, App Store Connect API credentials, Google Play service-account/API permissions and any required first manual upload in owner-controlled systems. Keep repository `eas.json` `submit.production` equal to `{}`; do not commit credentials.                                                                                                      | [Release notes](release-notes-1.0.0.md) tag checklist; [version audit](version-build-consistency.md) §4; `eas.json`; [Expo EAS Submit](https://docs.expo.dev/deploy/submit-to-app-stores/).                                                                                |
| R12 | Create/inspect App Store Connect and Play Console app records for `com.dale16.superhabits`; verify app name, English primary language, category, free/paid choice, countries, support contact, review/app-access details, required agreements, and screenshots/declarations before upload. Record console evidence.                                                       | [Readiness](app-store-readiness.md) metadata; [Apple app-record setup](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app); [Play setup](https://support.google.com/googleplay/android-developer/answer/9859454).                       |
| R13 | Match `1.0.0` and the **resolved** iOS build number / Android version code on each actual production artifact to its console release record. Confirm remote EAS version source and auto-increment output; do not infer binary values from `app.json` alone.                                                                                                               | [Version audit](version-build-consistency.md) §§1–4; [release notes](release-notes-1.0.0.md) checklist; [asset checklist](store-assets-checklist.md) §4.                                                                                                                   |
| R14 | Keep the submitted locale list English-only unless localized UI, channel names, store copy, and screenshots are actually available; decide launch countries and country-specific disclosures with counsel.                                                                                                                                                                | [Readiness](app-store-readiness.md) item 7; [age/trader draft](age-rating-and-trader.md) §§2–4.                                                                                                                                                                            |
| R15 | Give explicit final release authorization after reviewing exact-SHA QA, privacy/legal forms, native binaries, images, signing, and console previews. Only then decide whether to create `v1.0.0`, upload, and submit each store. Record final tag, submission IDs, and status separately.                                                                                 | [Release notes](release-notes-1.0.0.md) tag checklist; [version audit](version-build-consistency.md) §4; [readiness](app-store-readiness.md).                                                                                                                              |
| R16 | Decide whether any provider-backed AI route is in the release; require provider evaluation, disclosure/retention review and rollout authorization before advertising or enabling it by default. Check a previously deployed build independently of the local source.                                                                                                      | [Privacy policy](privacy-policy.md) AI section; [declarations](store-data-declarations.md) key conditional; `.agent/execplans/ai-command-center-production-v1.md`.                                                                                                         |

## Copy handoff

- [Play short and full description drafts](store-data-declarations.md) §3.
- [Apple What's New and Play release notes](release-notes-1.0.0.md), both
  within their stated character ceilings and guarded by
  `tests/release-notes.test.ts`.
- **Apple description draft** (owner to approve, then paste into App Store
  Connect):

> SuperHabits brings Today, To Do, Habits, Focus, Workout, and Calories
> together in one offline-first app. Plan your day with projects and recurring
> tasks, track habit streaks, run focus sessions, follow guided workouts, and
> record meals and macros. Your entries live in a local database so the app
> remains useful offline. A connected build can back up recoverable data to
> an account-isolated service for restore on an empty device; portable file
> export and import give you another way to move your data. Rewards such as
> XP and badges stay on your device. No signup step is needed. English UI.

This draft deliberately does not advertise AI or promise that a configured
release keeps every entry on-device. The owner confirms feature availability,
copy limits, and legal/privacy phrasing in the consoles for the submitted
binary.

## Image and binary provenance sheet

Fill one row for each actual build and its derived screenshot set. The
filenames are suggestions, **not image artifacts**. Do not use a browser
mockup, stretched capture, editor-generated screen, or screenshot from a dev
client as store evidence.

| Platform / set                                                | Source SHA | EAS build ID + binary hash | Resolved version / build | Genuine device or simulator + native pixels | Screenshot files / reviewer |
| ------------------------------------------------------------- | ---------- | -------------------------- | ------------------------ | ------------------------------------------- | --------------------------- |
| iOS 6.9-inch iPhone or accepted 6.5-inch fallback             | to record  | to record                  | to record                | to record                                   | to record                   |
| iOS required 13-inch iPad                                     | to record  | to record                  | to record                | to record                                   | to record                   |
| Android phone                                                 | to record  | to record                  | to record                | to record                                   | to record                   |
| Play feature graphic (design source, no device capture claim) | to record  | not a binary screenshot    | not applicable           | 1024 × 500; verify preview                  | to record                   |

The six preferred screenshot subjects and acceptance checks are in the
[asset checklist](store-assets-checklist.md). Existing PNGs in `assets/` are
app icon/splash inputs, not store screenshot proof. No real-build screenshots
or feature graphic are included in this repository package.

## Submission sequence and evidence gate

1. Owner completes R01–R06 and R10–R14. Publish the policy and capture
   console evidence only after its effective date, provider terms, and
   disclosures are approved.
2. Build from the approved SHA, complete native runtime qualification, and
   capture R07–R09 from those builds. Keep resolved identifiers and hashes
   with every image set.
3. Review the exact binary, copy, privacy forms, signing, screenshots,
   countries, and app records together. The owner supplies R15. Do not
   infer release authorization from a passing repository test.
4. Only after R15: perform any tag, upload, and store submission using
   owner-controlled credentials; record each external result. The current
   `eas.json` `submit.production` remains `{}` and there is no `v1.0.0`
   tag or store submission from this preparation pass.
