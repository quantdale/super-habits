# ExecPlan: Release Readiness Refresh V1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

`docs/release/app-store-readiness.md` is the release contract, and its own
first instruction is "update this file when a release actually ships rather
than letting it drift". It had drifted materially: it still reported the native
persistence lane as 2/11, two duplicate stale "E2E result" sections claiming
1–2 failures that are now fixed, and an open "Android notification icon"
deliverable that no longer existed. Two concrete release-readiness items were
therefore outstanding: an accurate release state and the missing Android
notification icon.

Observable success: the release document matches measured, current gate
results; a dedicated notification icon exists, is wired through the
`expo-notifications` config plugin, and is verifiably emitted into Android
resources by a prebuild; a release-notes draft exists; the changes are
committed and pushed.

## Context

- Baseline: `main == c04cceb`, tree clean; four campaigns completed this
  session (native lane closure, Pop type + UI defect sweep with production
  deploy, baseline failure repair, OpenSpec lifecycle reconciliation).
- The release doc's stale rows: native persistence `2/11`, two "### E2E
  result" headings (135/1 and 134/2), and "Android notification icon … still
  missing".
- Measured current gates: typecheck/lint clean; `npm test` 2055/196;
  chromium 136 passed / 7 skipped / 0 failed; journeys 104 / 6 / 0;
  simulation 3 passed; `web:verify` PASS (64.7s); `validate:themes` 140;
  `openspec validate --all` 57/57; `agent:plan:validate:all` all PASS; native
  persistence lane 11/11 at `2c1594b` (APK `A4C3C900…`); production
  https://super-habits.vercel.app verified.
- `expo-doctor` reports 10 SDK patch bumps held by pinned `patches/*.patch`
  (documented, deliberate).
- `pngjs` is present transitively (no new dependency added);
  `assets/android-icon-monochrome.png` (432², alpha silhouette) is the source
  for the notification icon. `expo-notifications`' plugin supports `icon` and
  `color` and emits 24dp icons per density plus manifest meta-data.

## Scope

1. Generate `assets/notification-icon.png` (96×96, white-on-transparent) from
   the app's monochrome mark, without adding a dependency.
2. Wire the `expo-notifications` plugin with `icon` + brand `color`, then
   verify with `npx expo prebuild --platform android` that the drawable
   densities, colour resource, and manifest meta-data are emitted.
3. Refresh `docs/release/app-store-readiness.md` to the measured current state,
   collapse the duplicate stale E2E sections, mark the notification-icon item
   delivered, and record the deployment probe.
4. Add `docs/release/release-notes-1.0.0.md` (the doc's open item 5 draft).
5. Gates and closure: typecheck, lint, format on changed files; commit and
   push.

## Non-Goals

- No app-code behavior change; the icon is a build asset and config only.
- No version tag or store submission (the user's release decision), no store
  account/screenshot work, no localization.
- No new runtime or dev dependency.
- No claim in the doc that is not backed by a command run in this campaign or
  the immediately preceding ones.

## Current Checkpoint

- Current milestone: COMPLETE — icon delivered and prebuild-verified, release
  doc refreshed with measured results, release-notes draft added, gates green;
  closure commit/push pending.
- Completed: icon generation + verification; plugin wiring + prebuild evidence;
  `expo-doctor`; `web:verify`; release doc rewrite; release-notes draft;
  typecheck/lint clean; plan validated.
- In progress: closure commit/push.
- Important modified files: `app.json`, `assets/notification-icon.png`, the two
  `docs/release/` files, this plan.
- Last successful validation: see the Validation Ledger.
- Current failures: none.
- Relevant quarantines: known-gap 15; CI billing blocker (external).
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: none for this plan.
- Remaining definition of done: none for this plan.

## Progress

- [x] WS1 — notification icon generated
- [x] WS2 — plugin wired and prebuild-verified
- [x] WS3 — release doc refreshed; release notes drafted
- [x] WS4 — gates green (typecheck/lint clean); closure commit/push next

## Surprises & Discoveries

- 2026-09-14 — the release doc still told readers the native lane was 2/11 and
  that two suites were failing, so its "release state" was materially wrong;
  the drift came from campaign fixes that never updated the contract.
- 2026-09-14 — the notification icon can be derived losslessly from the app's
  monochrome adaptive mark with `pngjs` (already present), so no new dependency
  or hand-drawn art was needed.

## Decision Log

- 2026-09-14 — derive the icon from the shipped monochrome mark rather than
  inventing art: it preserves the brand mark and keeps the repo dependency set
  unchanged.
- 2026-09-14 — verify the wire-up with a real prebuild (not just config
  parsing) because the plugin writes resources through a dangerous mod.
- 2026-09-14 — refresh the release doc with only measured results, and mark the
  notification-icon row delivered rather than deleting it.

## Validation Ledger

- 2026-09-14 — `npm run web:verify` → PASS, 64.7s, HTTP 200, COOP/COEP,
  shell probe, port released.
- 2026-09-14 — `npx expo-doctor` → 19/20 (10 SDK patch bumps held by pinned
  patches).
- 2026-09-14 — icon generation probe → 96×96, all 2531 opaque pixels pure
  white, coverage 27.5%, no non-white pixels.
- 2026-09-14 — `npx expo prebuild --platform android` → emitted
  `drawable-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/notification_icon.png`,
  `colors.xml` `notification_icon_color #6D28D9`, and both
  `default_notification_icon`/`_color` meta-data pairs.
- 2026-09-14 — FINAL: `npm run typecheck` clean, `npm run lint` clean
  (`--max-warnings 0`), `agent:plan:validate` PASS for this plan.

## Changed Files / Areas

- `assets/notification-icon.png` — new release asset.
- `app.json` — `expo-notifications` plugin props.
- `docs/release/app-store-readiness.md` — refreshed release contract.
- `docs/release/release-notes-1.0.0.md` — release-notes draft.
- `.agent/execplans/release-readiness-refresh-v1.md` — this plan.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan.
2. `git status --short`; reconcile with the checkpoint (Git wins).
3. Re-verify the icon wire-up with `npx expo prebuild --platform android` and
   inspect `android/app/src/main/res/**/notification_icon*`.
4. Continue from the exact next action.

## Outcomes & Retrospective

- Status: Completed (2026-09-14).
- Summary: the release contract is truthful again and the one missing release
  asset ships. The Android notification icon was derived from the app's own
  monochrome mark and wired through the `expo-notifications` plugin, verified
  by a real prebuild (five densities, colour resource, and both FCM and local
  manifest meta-data). The readiness document now records measured results —
  including the production deployment and the 11/11 native lane — instead of
  the stale 2/11 and duplicate failing E2E sections, and the store release
  notes have a draft.
- Proof: `web:verify` PASS (64.7s); `expo-doctor` 19/20; prebuild resource
  evidence; icon probe (96×96, 2531 white opaque pixels, 0 non-white);
  typecheck/lint clean; `agent:plan:validate` PASS.
- Follow-up: the remaining submission items are store-account work (screenshots,
  feature graphic, Data safety/Nutrition labels, age ratings, localization) and
  the release tag, all of which need the owner's release decision.
