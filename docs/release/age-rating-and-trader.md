# Age rating + EU trader declaration drafts (for owner review)

Companion to `privacy-policy.md` and `store-data-declarations.md`.
Recommended draft answers for the Apple Age Rating questionnaire, the
Google Play content-rating / Families / ads answers, and the EU DSA
trader declaration. All answers describe the app **as implemented**
(evidence in the product-facts basis below).

> Owner (and counsel where noted) must confirm these answers in
> App Store Connect / Play Console before submission. They are
> good-faith disclosures, not legal advice.

## Product-facts basis (read first)

- **What it is:** offline-first productivity app — Today, To Do, Habits,
  Focus (Pomodoro), Workout (Gym V2), Calories (Form/Diary) — plus
  Settings / Plan / Weekly Review / Add / Level & Achievements overlays.
  Single-page shell (`app/` holds only `_layout.tsx` + `index.tsx`).
- **Storage:** everything the user creates lives in a local SQLite
  database on the device (OPFS on web, WAL on native; schema 25). The app
  is fully usable offline.
- **Backup (optional, user-initiated):** one-way push plus restore to the
  developer's Supabase project, never continuous two-way sync; restore
  runs only onto an empty device. Requires a lightweight anonymous
  account id; a verified email is optional and used only for ownership
  protection and one-time recovery codes. See `privacy-policy.md` §§2–3.
- **Rewards are local-only:** XP/levels, streaks + freezes, rotating daily
  quests, 36 badge tiers, celebration overlay, haptics + synthesized
  tones. Reward state is never uploaded, backed up, or tied to an
  account. There are no stakes, prizes, purchasable loot boxes, or
  real-money play.
- **No user-to-user surface:** no social feed, chat, comments, follows,
  shared profiles, or shared user content in `features/` product code.
  User-entered content (tasks, habits, notes, workouts, meals) stays on
  the device unless that same user enables backup; it is never shown to
  other users, so there is no shared-UGC moderation path to declare.
- **No unrestricted web:** no `WebView`, `expo-web-browser`, or
  `Linking.openURL` in product code; no in-app browser and no
  user-reachable general web search.
- **No gambling, no contests, no prizes:** verified by code search over
  product code (no gambling/casino/betting/lootbox purchasable paths).
- **No ads, no in-app purchases:** no AdMob/AppLovin/attribution SDKs and
  no purchase/billing SDKs in `package.json`; the only `/ad/`-matching
  dependency name is `expo-linear-gradient` (a gradient renderer, not
  advertising).
- **Notifications are on-device:** 5 runtime channels (General, Habit,
  Todo, Daily plan, Weekly review) scheduled by the OS; no remote
  push-messaging service receives user data. Permissions declared:
  `POST_NOTIFICATIONS`, `VIBRATE`, `RECEIVE_BOOT_COMPLETED`,
  `WAKE_LOCK`. iOS `ITSAppUsesNonExemptEncryption: false`.
- **Language:** interface ships in English only.
- **Versions at this draft:** `1.0.0` (`package.json`, `app.json`
  `expo.version`), iOS `buildNumber 1`, Android `versionCode 1`.

If any future build adds shared UGC, chat, an in-app browser,
gambling-like mechanics with stakes, ads, or in-app purchases, every
answer below must be re-taken from scratch.

## 1. Apple — Age Rating questionnaire (recommended: 4+)

Answer every content category as **None** on current product facts. The
expected outcome is **4+** (no objectionable content).

| Category                                                 | Draft answer | Basis                                                                                                                                                                                                                                                              |
| -------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cartoon / fantasy violence                               | None         | Productivity UI only; no characters, combat, or weapons.                                                                                                                                                                                                           |
| Realistic violence                                       | None         | Same as above.                                                                                                                                                                                                                                                     |
| Sexual content / nudity                                  | None         | No sexual content, dating, or nudity in shipped UI or copy.                                                                                                                                                                                                        |
| Profanity / crude humor                                  | None         | No profanity in shipped copy; user-entered text is private to the device and never published to others.                                                                                                                                                            |
| Horror / fear themes                                     | None         | Calm productivity design; no horror imagery.                                                                                                                                                                                                                       |
| Gambling (real, simulated, or loot boxes)                | None         | Local XP/badges are progression only — no stakes, payouts, or purchasable randomized items.                                                                                                                                                                        |
| Alcohol, tobacco, drugs                                  | None         | No depiction, reference, or commerce.                                                                                                                                                                                                                              |
| Medical / treatment advice                               | None claimed | Workout prescriptions, body-weight tracking, and calorie/macro tracking are user-entered self-tracking; the app gives no diagnosis, prescription, or medical advice. `[OWNER ACTION]` — counsel to confirm no extra health disclosure is needed in target locales. |
| Contests / sweepstakes                                   | None         | No contests, no prizes.                                                                                                                                                                                                                                            |
| Messaging / user-to-user communication                   | None         | No chat, no accounts directory, no message exchange.                                                                                                                                                                                                               |
| Shared user-generated content                            | None         | No shared feed or public profiles; user content is private to the device/backup owner.                                                                                                                                                                             |
| Unrestricted web access / user-reachable web search      | None         | No WebView or in-app browser.                                                                                                                                                                                                                                      |
| Location, contacts, or sensors shared with third parties | None         | No tracking SDKs; backup payload contains only the recoverable entities listed in `privacy-policy.md` §2.                                                                                                                                                          |

Filing note: keep the "Made for Kids" / kids-category answer as **No**
(the app has no age gate and no child-directed content set; default
posture is on-device-only — see `privacy-policy.md` §7). The privacy
policy URL for the listing is `[OWNER ACTION]` — deploy
`public/privacy.html` (`/privacy.html`) and paste that URL.

## 2. Google Play — content rating (IARC), Families, ads (recommended)

### Content rating questionnaire (IARC)

Answer to an **Everyone** outcome on current product facts:

- Violence: none (no realistic, fantasy, or implied violence).
- Sexuality: none (no nudity, sexual references, or dating features).
- Language: none in shipped copy; user-entered text is never published.
- Controlled substances: none.
- Gambling: none — local rewards carry no monetary value and no
  randomized purchases (see basis above).
- Social / communication features: none — no chat, no friend/follow
  graph, no shared UGC, no location sharing.
- User interaction / data sharing: user content is stored on-device and,
  only when that same user enables backup, in a private per-account
  store — never shared with other users or third parties (no SDK,
  advertiser, or broker access).

### Families / target audience

- **Designed for children:** No. General-audience productivity app with
  no child-directed content set.
- Where the optional backup or recovery email is used, a parent or
  guardian should supervise as with any account-backed feature (same
  posture as `privacy-policy.md` §7). Default use needs no account and
  collects nothing.

### Ads, purchases, and health prompts

- **Ads:** No — declare "this app has no ads".
- **In-app purchases / subscriptions:** None.
- **Health / fitness prompt (if the console shows one):** the app tracks
  user-entered workouts, body weight, meals, and calories for personal
  productivity; it is not a medical device and provides no diagnosis.
  `[OWNER ACTION]` — owner + counsel to confirm the exact health-apps
  tick-box in Play Console for the launch locales.

## 3. EU DSA trader declaration (draft — owner fills)

The EU Digital Services Act path in Play Console / App Store Connect asks
whether the distributor acts as a **trader** (a natural or legal person
acting for purposes relating to their trade, business, craft, or
profession) and, for traders, requires public contact + identity details
so consumers can reach them.

This repository cannot decide trader status for the owner. The draft
below leaves the decision and every identity field to the owner:

- Trader status: `[OWNER ACTION: trader or non-trader — confirm with counsel; a commercial launch under a business or sole-trader identity is normally "trader"]`.
- Legal name (person or business): `[OWNER ACTION: trader legal name]`.
- Trading / store display name if different: `[OWNER ACTION: trading name]`.
- Principal address (street, city, postcode, country): `[OWNER ACTION: trader address]`.
- Phone number: `[OWNER ACTION: trader phone]`.
- Support email (public): `[OWNER ACTION: support email]` (same address
  as `privacy-policy.md` §§8/11 — fill once, reuse here).
- Trade / company registration number and register: `[OWNER ACTION: registration number + register]`.
- VAT / tax identifier if applicable: `[OWNER ACTION: VAT or tax ID, or "not applicable"]`.
- Authorized representative in the EU/EEA if the trader is outside it and
  one is required: `[OWNER ACTION: representative details or "not applicable — confirm with counsel"]`.

Do not file the declaration until every field above is filled and trader
status is confirmed with counsel. The support email and the hosted policy
URL (`/privacy.html`) must match the values filed in the store listings
and in `privacy-policy.md` §§8/11.

## 4. Owner confirmation checklist (before submission)

- [ ] `[OWNER ACTION]` Confirm every Apple Age Rating answer in
      App Store Connect; expected outcome **4+** on current facts.
- [ ] `[OWNER ACTION]` Confirm every Play content-rating / Families /
      ads answer in Play Console; expected **Everyone**, not
      child-directed, no ads, no purchases.
- [ ] `[OWNER ACTION]` Confirm the health-apps tick-box (if shown) with
      counsel for the launch locales — current posture is self-tracking
      with no diagnosis or medical advice.
- [ ] `[OWNER ACTION]` Decide trader vs non-trader with counsel, fill all
      §3 identity fields, and file the DSA declaration.
- [ ] `[OWNER ACTION]` Keep the English-only claim consistent with
      `app-store-readiness.md` item 7 (no additional locales claimed).
- [ ] Re-take all three questionnaires after any feature that adds shared
      UGC, messaging, an in-app browser, gambling-like stakes, ads, or
      in-app purchases.
