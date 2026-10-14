# W17 — Release-candidate manifest (Frontend V3 W12–W17)

> **Post-W17 correction note (2026-10-14, change
> `frontend-v3-post-w17-correction`).** Candidate identity below is the W17
> closure record. `1177ac2` was `main` at handoff, not the current head
> (docs-only `bf09c0d` followed it; the correction runs on
> `frontend-v3-post-w17-adversarial-correction`). Specific stale claims are
> corrected inline as `[Post-W17 correction: …]`; historical run records and
> counts stay on the revisions that produced them. Current status lives in
> `docs/ui-ux/v3-audit/post-w17-correction/`.

## Candidate identity

| Field                  | Value                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| Branch                 | `frontend-v3-w12-w17-integration`                                                                  |
| Pre-W17 integrated SHA | `d04793bd327a385396337e3a2ef353ad96c15b86` (W16 published)                                         |
| W17 fix SHAs           | `3aaca2a` → `af8eeda` → `b9e775f` → `1177ac2` (ladder run + Codex fixes + plan closure + docs)     |
| Base                   | `1f23da4defd7fa45c679261e0db5fade1374bbd5` = `origin/main` (W11.5.1)                               |
| Tree state             | clean for tracked files; only the preserved foreign `.tmp-ios36423379932/` is untracked by policy  |
| Wave commits           | W12 `1d54b70`, W13 `b1569f0`, W14 `c6937b5`, W15 `42d1c20`, W16 `d04793b`, W17 `3aaca2a`…`1177ac2` |
| Pull request           | #76 (`W12–W13` title; body extended with W13) on the campaign branch                               |

**Published:** PR #76 merged to `main` as `3f2a847`; the W15 visual-lane closure (PR #77) merged as `b80233d`; the final documentation commit is `1177ac2`. `origin/main` = `1177ac2` at handoff, working tree clean (only the preserved foreign evidence directory remains untracked by policy). `[Post-W17 correction: “the final documentation commit” held only until docs-only `bf09c0d`landed on`main`on top of`1177ac2`; the post-W17 correction branch follows. “At handoff” remains accurate for the `origin/main` claim.]`

## Build and artifacts

| Artifact       | Command                                                       | Identity                                                                                                                                                                                                                                                                                                                                                          |
| -------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web/PWA export | `npm run build:e2e`                                           | `dist/`, 0 `supabase.co` hosts                                                                                                                                                                                                                                                                                                                                    |
| Visual goldens | `e2e/__screenshots__/visual-regression.spec.ts/*.png`         | 30 PNGs, set hash `0676368d…` stable across two runs `[Post-W17 correction: `0676368d…`is the historical W15 two-run-proof hash; the set shipped in this candidate (3 goldens regenerated in`e70ccc7`, reviewed) hashes `f19261d5d676ac1ef10cc526a4fb19d41e0edbf1a6e3ebd87fcb437c50dcdeaa`, method `sha256sum e2e/**screenshots**/visual-regression.spec.ts/*.png | sha256sum`] |
| Android APK    | `node scripts/qa-native-provision.mjs --serial emulator-5594` | source `b50034d`, SHA-256 `AA89D9FE84AC3B33ADBE75455EB31A6BC09247F39E7B89E35BA945D60EEC2E0E`, 0 remote hosts                                                                                                                                                                                                                                                      |

The Android APK was built at `b50034d`. W17's changes are:

- `tests/agentDocConsistency.test.ts` (test-only),
- `tests/maestroCommandCenterFlowGuards.test.ts` (test-only),
- `.maestro/flows/command-center-v2.yaml` (a comment moved; the asserted block is unchanged).

None affects native runtime code, so the W16 APK certification remains valid for
the W17 SHA **for the native lanes it covers**. W17 did not re-run the native
device matrix; that limitation is recorded in the verification matrix and the
handoff rather than being silently inherited. `[Post-W17 correction: the list
above enumerates `3aaca2a`'s files only. The W17 fix chain continued through
`af8eeda`, which changed user-facing feature source (`features/activity/_`,
`features/weekly-review/_`), so “None affects native runtime code” is false for
the full chain: the `b50034d`APK certification does not extend past`3aaca2a`and covers neither`1177ac2`/`bf09c0d` nor the correction branch.]`

## Environment

| Field      | Value                                                                               |
| ---------- | ----------------------------------------------------------------------------------- |
| Node / npm | v24.3.0 / 11.4.2 (repo pins Node 22.23.2 for some lanes; `nvmrc` honored in CI)     |
| OS         | Windows 11                                                                          |
| Browser    | pinned Chromium via Playwright `^1.58.2`                                            |
| Timezone   | `Asia/Manila` (pinned in `playwright.config.ts`)                                    |
| E2E server | `scripts/serve-e2e.js` on :8086 (owned, terminated after each lane)                 |
| Android    | emulator 37.1.11.0, AVD `Nitro_API_36` (API 36, x86_64), `-gpu host`, Maestro 2.9.0 |

## CI status

| Field               | Value                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Hosted quality gate | Baseline (`1f23da4`) and every wave head fail **only** `Audit runtime dependencies` on the two inherited advisories |
| Hosted e2e/nightly  | skipped behind that gate (not passed)                                                                               |
| Local equivalent    | every quality step reproduces green locally, including the audit-step output                                        |

## Known limits of this candidate

1. **Android certification is at `b50034d`, not the W17 SHA.** W17's diff is
   test/docs only, but the strict claim is not re-earned at `3aaca2a`.
   `[Post-W17 correction: “W17's diff is test/docs only” holds through
`3aaca2a`only —`af8eeda`(later in the chain) changed user-facing`features/activity/_`and`features/weekly-review/_`. The strict claim is
not re-earned at `3aaca2a`or any later revision; only`b50034d` is
Android-certified.]`
2. **iOS is owner-deferred** and unclaimed.
3. **Two dependency advisories** remain (no upstream fix; build-time tooling
   only; absent from both bundles) — recorded, not waived.
4. Hosted `e2e`/`nightly` have not run since the baseline; local lanes are the
   evidence.
