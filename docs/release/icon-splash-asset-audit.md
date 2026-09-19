# Icon / splash / notification asset audit — measured PNG headers (read-only)

Companion to `app-store-readiness.md` ("Store metadata registered in
`app.json`") and `store-assets-checklist.md` §2 (icons already registered
in `app.json`, not recaptured as screenshots). This file is **measured
evidence only** — every size below was read from the existing binaries
via PNG IHDR bytes on 2026-09-19. No PNG was created, regenerated,
re-encoded, resized, or screenshotted in this pass.

> Store and OS specs drift. Re-verify every size and requirement in
> App Store Connect / Play Console and the Expo SDK docs at submission
> time before shipping. Spec version at this audit: 1.0.0
> (`package.json`, `app.json` `expo.version`), iOS `buildNumber 1`,
> Android `versionCode 1`.

## 1. `app.json` / manifest → file mapping

| Config key                                     | File                                 | Role                                            |
| ---------------------------------------------- | ------------------------------------ | ----------------------------------------------- |
| `expo.icon`                                    | `assets/icon.png`                    | Store / launcher icon source (1024)             |
| `expo.splash.image` + `expo.splash.dark.image` | `assets/splash-icon.png`             | Splash image, `resizeMode: contain`             |
| `expo.android.adaptiveIcon.foregroundImage`    | `assets/android-icon-foreground.png` | Adaptive foreground (512 as configured)         |
| `expo.android.adaptiveIcon.backgroundImage`    | `assets/android-icon-background.png` | Adaptive background (512 as configured)         |
| `expo.android.adaptiveIcon.monochromeImage`    | `assets/android-icon-monochrome.png` | Themed-icon monochrome (432 as configured)      |
| `expo-notifications` plugin `icon`             | `assets/notification-icon.png`       | Notification icon (96, white-on-transparent)    |
| `expo.web.favicon`                             | `assets/favicon.png`                 | Web favicon (48, registered, not a store asset) |
| `public/manifest.json` `icons[0]`              | `public/icon-192.png`                | PWA icon 192 (`purpose: any`)                   |
| `public/manifest.json` `icons[1]`              | `public/icon-512.png`                | PWA icon 512 (`purpose: any`)                   |
| `public/manifest.json` `icons[2]`              | `public/icon-maskable-512.png`       | PWA icon 512 (`purpose: maskable`)              |

## 2. Measured IHDR dimensions (2026-09-19)

Method: read each file's PNG signature (bytes 0–7 =
`89 50 4E 47 0D 0A 1A 0A`) then IHDR width (bytes 16–19, big-endian)
and height (bytes 20–23, big-endian), plus bit depth (byte 24) and
colour type (byte 25). No image libraries, no decoding, no writes.
Reproduce with the guard test
(`tests/icon-splash-asset-audit.test.ts`) or any reader that checks
the same byte offsets.

Colour-type legend: `2` = truecolor (no alpha), `3` = indexed,
`6` = truecolor + alpha. Alpha-present means colour type `4` or `6`
(indexed transparency would need a `tRNS` chunk and is not relied on
here).

| File                                 | Expected (as configured) | Measured (W × H) | Header detail             | Disposition                                                                                   |
| ------------------------------------ | ------------------------ | ---------------- | ------------------------- | --------------------------------------------------------------------------------------------- |
| `assets/icon.png`                    | 1024 × 1024              | 1024 × 1024      | depth 8, type 2, no alpha | PASS — size matches; no-alpha matches the no-transparency store-icon rule at the header level |
| `assets/splash-icon.png`             | 1024 × 1024              | 1024 × 1024      | depth 8, type 3 (indexed) | PASS — size matches as configured (`contain`, light `#ffffff` / dark `#0a0f1a`)               |
| `assets/android-icon-foreground.png` | 512 × 512                | 512 × 512        | depth 8, type 6, alpha    | PASS — size matches as configured                                                             |
| `assets/android-icon-background.png` | 512 × 512                | 512 × 512        | depth 8, type 6, alpha    | PASS — size matches as configured                                                             |
| `assets/android-icon-monochrome.png` | 432 × 432                | 432 × 432        | depth 8, type 6, alpha    | PASS — size matches as configured                                                             |
| `assets/notification-icon.png`       | 96 × 96                  | 96 × 96          | depth 8, type 6, alpha    | PASS on size + alpha channel; artwork colour stays `[OWNER ACTION]` (§4)                      |
| `assets/favicon.png`                 | 48 × 48                  | 48 × 48          | depth 8, type 6, alpha    | PASS — registered favicon size matches                                                        |
| `public/icon-192.png`                | 192 × 192                | 192 × 192        | depth 8, type 2           | PASS — matches `manifest.json` `192x192` (`any`)                                              |
| `public/icon-512.png`                | 512 × 512                | 512 × 512        | depth 8, type 2           | PASS — matches `manifest.json` `512x512` (`any`)                                              |
| `public/icon-maskable-512.png`       | 512 × 512                | 512 × 512        | depth 8, type 2           | PASS — matches `manifest.json` `512x512` (`maskable`)                                         |

No missing files, no wrong sizes at audit time. If any row above ever
reads differently, the owner must replace that binary from a real
source export — never upscale, stretch, or re-encode a wrong-size file
into compliance.

## 3. What the header guard proves (and does not prove)

Proves:

- Every `app.json` / manifest-registered path exists and is a valid PNG
  with the expected width and height.
- The store icon carries no alpha channel at the header level
  (colour type 2), consistent with the no-transparency submission rule.
- The notification icon carries an alpha channel (colour type 6),
  consistent with the transparent-background requirement at the header
  level.
- The PWA manifest `sizes` strings agree with the on-disk binaries.

Does not prove (stays `[OWNER ACTION]`, §4):

- Artwork content: notification white-silhouette artwork, monochrome
  themed-icon legibility, splash safe-area / `contain` cropping,
  maskable safe-zone padding, or launcher-icon visual quality.
- Submission-time policy: rounded-corner / transparency enforcement,
  adaptive-icon safe-zone rendering on device, or PWA installability
  screenshots.

## 4. Owner visual checks (owner)

No binaries ship in this pass. Confirm each box by inspecting the real
asset on device / in the store console; replace from a real source
export if anything fails.

- [ ] `[OWNER ACTION]` Notification artwork is a white silhouette on transparent background at 96×96 (`assets/notification-icon.png` has the alpha channel; confirm the pixels are white-only by visual inspection).
- [ ] `[OWNER ACTION]` Monochrome themed icon stays legible at 432×432 (`assets/android-icon-monochrome.png`; confirm on an Android themed-icons launcher).
- [ ] `[OWNER ACTION]` Splash `contain` layout has no unwanted cropping or letterbox banding on small and large phones (`assets/splash-icon.png` on light `#ffffff` and dark `#0a0f1a` backgrounds).
- [ ] `[OWNER ACTION]` Maskable PWA icon keeps essential content inside the maskable safe zone (`public/icon-maskable-512.png`; confirm install prompt + splash rendering).
- [ ] `[OWNER ACTION]` Store-icon submission check: 1024×1024 source has no transparency and no pre-rounded corners at upload time (header already shows no alpha; confirm the submission preview).

## 5. What this pass does not ship

- No PNG creation, regeneration, re-encoding, resizing, or screenshot /
  feature-graphic binaries (see `store-assets-checklist.md` for the
  device-bound capture spec).
- No App Store Connect / Play Console upload or credential work.
- No `v1.0.0` tag, no EAS submit credentials, no contact email / URL /
  owner-identity invention.

## 6. Re-verify note

Re-run `tests/icon-splash-asset-audit.test.ts` after any asset
replacement and before every submission. If Expo, Android, iOS, or PWA
icon requirements change, update the expected sizes in the test and
this table together — never one without the other.
