# Version / build-number consistency audit — cross-file proof (read-only)

Companion to `app-store-readiness.md` (item 5) and
`release-notes-1.0.0.md` ("Version + tag checklist"). Version truth for
SuperHabits 1.0.0 is spread across five sources — `package.json`,
`app.json`, `eas.json`, the readiness doc, and the release notes — and a
drift between any two of them would ship mismatched store metadata. This
file is **measured evidence only**: every value below was read from the
existing files on 2026-09-19. No version was bumped, no build number was
incremented, no tag was created, and no submit credentials were touched in
this pass.

> Store and EAS behaviour drift. Re-confirm the intended version source
> and the submit-credential state in EAS / App Store Connect / Play
> Console at submission time before shipping. Values at this audit:
> `1.0.0`, iOS `buildNumber 1`, Android `versionCode 1`.

## 1. Source-of-truth value table (2026-09-19)

| Source              | Key                              | Value    | Disposition                                               |
| ------------------- | -------------------------------- | -------- | --------------------------------------------------------- |
| `package.json`      | `version`                        | `1.0.0`  | PASS — matches `app.json` `expo.version`                  |
| `app.json`          | `expo.version`                   | `1.0.0`  | PASS — matches `package.json`                             |
| `app.json`          | `expo.ios.buildNumber`           | `"1"`    | PASS — string `"1"`, first public release                 |
| `app.json`          | `expo.android.versionCode`       | `1`      | PASS — integer `1`, first public release                  |
| `eas.json`          | `cli.appVersionSource`           | `remote` | PASS — as configured; see §3                              |
| `eas.json`          | `build.production.autoIncrement` | `true`   | PASS — CI increments builds after this release            |
| `eas.json`          | `submit.production`              | `{}`     | PASS — empty; credentials stay `[OWNER ACTION]`           |
| `git tag -l v1.0.0` | (no output)                      | —        | PASS — no tag exists; tagging stays `[OWNER ACTION]` (§4) |

No missing keys, no mismatched values at audit time. If any row above
ever reads differently, fix the source file (or the doc quoting it) back
into agreement before tagging — never tag a drifted tree.

## 2. Consistency rules (what the guard proves)

Proves:

- `package.json` `version` equals `app.json` `expo.version` (`1.0.0` in
  both) — the JS package version and the native store version cannot
  drift apart silently.
- `ios.buildNumber` is the string `"1"` and `android.versionCode` is the
  integer `1` — the first-release baseline both stores expect; the guard
  asserts the JSON types too, so `"1"` vs `1` mix-ups fail loudly.
- `eas.json` production posture is exactly `autoIncrement: true` with an
  empty `submit.production` — no submit credentials are committed, and
  post-release build increments stay automatic per the existing readiness
  statement ("EAS `production` profile has `autoIncrement: true`, so CI
  increments these").
- `eas.json` `cli.appVersionSource` is `"remote"` — recorded literally as
  configured; the owner confirms the intended version source at
  submission time (§3).
- The release-notes "Version + tag checklist" names `package.json`,
  `app.json` version/buildNumber/versionCode, `eas.json`
  `production.autoIncrement`, empty `submit.production`, and the exact
  `git tag -a v1.0.0` command — so the human checklist cannot go stale
  without the guard failing.
- Readiness item 5 references `release-notes-1.0.0.md` and pins the same
  `1.0.0` / `buildNumber 1` / `versionCode 1` values — so the two docs
  cannot disagree without the guard failing.
- This audit file exists and marks tagging + submit credentials
  `[OWNER ACTION]` — the automation asserts the owner gates are stated,
  not bypassed.

Does not prove (stays `[OWNER ACTION]`, §4):

- Submission-time EAS behaviour (which version source a production build
  actually resolves, increment sequencing after release).
- Store-side state (App Store Connect / Play Console build trains,
  version holds, or review status).

## 3. `eas.json` posture note (literal config, no behaviour claims)

The file as committed:

- `cli.version`: `>= 18.5.0` (toolchain floor).
- `cli.appVersionSource`: `"remote"`.
- `build.production`: `{ "autoIncrement": true }` — no other production
  overrides.
- `submit.production`: `{}` — no credentials, no profile overrides.

Beyond these literals this pass claims nothing about EAS internals. At
release time the owner confirms in the EAS dashboard / CLI output that
the intended version source is selected and that the first production
build carries `1.0.0` (`1` / `1`) before tagging.

## 4. Owner release-time checks (owner)

No tags, submits, or credential writes ship in this pass. Confirm each
box at release time with explicit intent:

- [ ] `[OWNER ACTION]` EAS submit credentials: `submit.production` is
      currently `{}` — configure App Store Connect / Play Console submit
      credentials before `eas submit -p ios` / `eas submit -p android`.
- [ ] `[OWNER ACTION]` Tag only with explicit release intent:
      `git tag -a v1.0.0 -m "SuperHabits 1.0.0" && git push origin v1.0.0`.
      Do not create the tag in a routine readiness pass.
- [ ] `[OWNER ACTION]` Confirm the EAS production build resolves version
      `1.0.0` with iOS build `1` / Android version code `1` before filing
      the stores.
- [ ] `[OWNER ACTION]` Hosted privacy URL: deploy `/privacy.html` with the
      production web build and paste that URL in both store listings
      (see `release-notes-1.0.0.md` checklist).

## 5. What this pass does not ship

- No version bumps, no build-number or version-code increments, no
  release-intent change.
- No `v1.0.0` tag, no EAS submit credential configuration, no store
  upload.
- No contact email / URL / owner-identity invention, no store-locale
  claims, no legal advice.

## 6. Re-verify note

Re-run `tests/version-build-consistency.test.ts` (plus the existing
`tests/release-notes.test.ts` version pins) after any version, build
number, `eas.json`, readiness, or release-notes edit, and before every
tagging attempt. If the release version ever moves past `1.0.0`, update
the expected values in the test and this table together — never one
without the other.
