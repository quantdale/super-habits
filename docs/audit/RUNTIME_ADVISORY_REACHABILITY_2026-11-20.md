# Runtime advisory reachability — 2026-11-20

Follow-up to PR #225's audit report residual: "report-only under policy, not waived
or fixed" → "advisory reachability / compatible upstream fixes".

Scope: the **production** dependency tree (`npm audit --omit=dev --json`) plus the
repo's own gate (`scripts/audit-runtime-deps.mjs`). Dev-only findings, and
high/critical findings (already zero), are out of scope.

## Current state

| Tree                            | moderate | low | high | critical | prod deps |
| ------------------------------- | -------- | --- | ---- | -------- | --------- |
| `origin/main` (fresh npm cache) | 13       | 0   | 0    | 0        | 779       |
| this branch (fresh npm cache)   | 11       | 0   | 0    | 0        | 779       |
| `origin/main` (warm npm cache)  | 26       | 0   | 0    | 0        | 779       |
| this branch (warm npm cache)    | 24       | 0   | 0    | 0        | 779       |

The two counts for the _same_ lockfile differ because npm's meta-vulnerability
aggregation depends on its local advisory/metadata cache (`npm audit` with a
cold `npm_config_cache` drops meta-parents whose evidence sits in an
`--omit=dev` subtree). Leaf advisories and their dependency paths are identical
across both runs, so this document classifies by **leaf advisory + dependency
path**, which is cache-independent.

PR #225 quoted "~32 moderate / 2 low". No low advisory is reported on this tree
by either run: the installed `deepmerge@4.3.1`, `node-forge@1.4.3` and
`postcss-selector-parser@6.1.6` return nothing from the registry bulk advisory
endpoint, so the two low findings are gone rather than merely hidden by
`--omit=dev`. 32 vs 26 is the cache effect above plus the A30 patch bumps that
landed after PR #225's capture.

Advisory set (fresh cache, `origin/main`): 3 leaf advisories — `glob`,
`minimatch`, `uuid` — and 10 pure meta-propagation entries
(`@expo/cli`, `@expo/config`, `@expo/config-plugins`, `@expo/fingerprint`,
`@expo/local-build-cache-provider`, `@expo/metro-config`,
`@expo/prebuild-config`, `expo`, `expo-sharing`, `xcode`). Meta entries carry no
advisory of their own; they disappear when their leaf is fixed.

## Reachability method

`npm run build:e2e` (hermetic web export → `dist/`), then token search across
`dist/_expo/static/js/web/*.js` for identifiers that only exist in the affected
package code:

| Token                                                                                | Hits in web export                                           |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `GlobWalker`, `globSync`, `hasMagic`, `minipass` (glob)                              | 0                                                            |
| `assertValidPattern`, `globParts` (minimatch)                                        | 0                                                            |
| `PBXFileReference` (xcode)                                                           | 0                                                            |
| `v1ToV6` (uuid ≥ 11 only) / `node_modules/uuid` path marker                          | 0                                                            |
| `Uuidv5Namespace`                                                                    | 1 (expo-modules-core's own shim, not the `uuid` npm package) |
| `xcode/ccache-clang.sh` (react-native script **name** strings, not xcode the module) | present — a filename list, not a dependency                  |

None of the three vulnerable packages is bundled. They are host-side build
tooling (`@expo/cli` prebuild/metro/prebuild-config, `react-native` codegen,
`chromium-edge-launcher`, babel/istanbul coverage), which never ships to the
client bundle — matching the gate's "build-time-only" classification.

## Findings

| #    | Advisory                                                    | Package (resolved)                                                                                                                                                                  | Path                                                                                                                                                                                                                                                                                                                                                                           | Reachable from web bundle? | Action                                               |
| ---- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- | ---------------------------------------------------- |
| 1    | GHSA-3g3m-2fjr-6pw4 (glob, CWE-400, `>=9.0.0 <=14.0.1`)     | `glob@9.3.5` (`node_modules/glob`)                                                                                                                                                  | `@expo/cli`/`@expo/config`/`@expo/config-plugins`/`@expo/fingerprint`/`@expo/metro-config` ← `expo`; `@react-native/codegen` ← `react-native`, `babel-preset-expo`; `rimraf@3` ← `chromium-edge-launcher` ← `@react-native/dev-middleware` ← `@react-native/community-cli-plugin` ← `react-native`; `test-exclude@6` ← `babel-plugin-istanbul` ← `babel-jest` ← `react-native` | No                         | **Not fixed — no compatible fix** (see G1)           |
| 2    | GHSA-g3hv-75wg-m249 (minimatch, CWE-405, `>=7.0.0 <11.0.1`) | `minimatch@10.2.5` (hoisted) and `minimatch@8.0.7` (nested under `glob@9`)                                                                                                          | `@expo/fingerprint` (`^10.2.2` → 10.2.5); `glob@9` (`^8.0.2` → 8.0.7) ← the #1 path                                                                                                                                                                                                                                                                                            | No                         | **Not fixed — no compatible fix** (see G2)           |
| 3    | GHSA-w5hq-g745-h8pq (uuid, CWE-787/CWE-1285, `<11.1.1`)     | `uuid@7.0.3` → **`uuid@11.1.1`** (`node_modules/uuid`)                                                                                                                              | `xcode@3.0.1` ← `@expo/config-plugins` ← `expo`, `expo-sharing`                                                                                                                                                                                                                                                                                                                | No                         | **Fixed** via `overrides.xcode.uuid` (see U1)        |
| 4    | GHSA-w5hq-g745-h8pq (meta parent)                           | `xcode@3.0.1`                                                                                                                                                                       | same as #3                                                                                                                                                                                                                                                                                                                                                                     | No                         | **Fixed** with #3 — entry disappears                 |
| 5–13 | none of their own (meta of #1/#2)                           | `@expo/cli`, `@expo/config`, `@expo/config-plugins`, `@expo/fingerprint`, `@expo/local-build-cache-provider`, `@expo/metro-config`, `@expo/prebuild-config`, `expo`, `expo-sharing` | inherit #1/#2                                                                                                                                                                                                                                                                                                                                                                  | No                         | **Not fixed** — they can only clear when #1/#2 clear |

Warm-cache-only meta parents (`@jest/transform`, `babel-jest`, `babel-plugin-istanbul`,
`test-exclude`, `rimraf`, `chromium-edge-launcher`, `react-native`,
`@react-native/codegen`, `@react-native/dev-middleware`,
`@react-native/community-cli-plugin`, `@react-native/babel-plugin-codegen`,
`@react-native/babel-preset`, `babel-preset-expo`) add **no** new leaf advisory:
every one of them resolves to #1/#2.

## Applied fix (uuid)

```json
"overrides": {
  "xcode": { "uuid": "11.1.1" }
}
```

Nested, not flat: a bare `"uuid": "11.1.1"` would silently force a major onto
_every_ future `uuid` consumer in the tree. This form rewrites only
`xcode@3.0.1`'s `uuid: ^7.0.3`, keeping the upstream range visible in the
lockfile as the trigger for regular review.

Why it is compatible:

- `xcode@3.0.1` calls exactly one uuid API — `uuid.v4()` in
  `lib/pbxProject.js:90` — and `uuid.v5`/`v3` are unused.
- The advisory (GHSA-w5hq-g745-h8pq) covers a missing `buf` bounds check in
  `v3`/`v5`/`v6` when a caller-supplied buffer is passed. That code is unreachable
  from `xcode` (it passes no buffer and never calls v3/v5/v6).
- `uuid@11` keeps the `v4()` contract `xcode` relies on (lowercase hyphenated
  string; `xcode` strips hyphens and upper-cases). Verified on the installed
  tree: `project.generateUuid()` → `D3D9CBFE3ED744E784535448` (24 uppercase hex
  characters, uniqueness-checked against the project's existing IDs, exactly as
  before).
- `uuid@11.1.1` declares ESM + CJS + browser entry points, so `xcode`'s CommonJS
  `require('uuid')` still resolves (`dist/cjs/index.js`).
- The 7.0.3 copy was itself npm-deprecated ("uuid@10 and below is no longer
  supported"), so this removes a deprecation warning as well as an advisory.

## Gaps (documented, not waived, not forced)

### G1 — `glob` GHSA-3g3m-2fjr-6pw4

`first_patched_version` is **14.0.2**; the vulnerable range starts at 9.0.0, so
every affected line's only fix is a semver-major jump. The tree resolves one
hoisted `glob@9.3.5`, and the hoisting is deliberate: the flat
`"glob": "^9.3.5"` override (2026-04-07) exists to keep the deprecated
`inflight` chain out of the tree. Consumers and their declared ranges:

| Consumer                                                                                       | Declares  |
| ---------------------------------------------------------------------------------------------- | --------- |
| `@expo/cli`, `@expo/config`, `@expo/config-plugins`, `@expo/fingerprint`, `@expo/metro-config` | `^13.0.0` |
| `@react-native/codegen` (×2), `react-native`                                                   | `^7.1.1`  |
| `rimraf@3` (via `chromium-edge-launcher`)                                                      | `^7.1.3`  |
| `test-exclude@6` (via `babel-plugin-istanbul`)                                                 | `^7.1.4`  |

`glob@14` removes the API these oldest consumers use: the default export is no
longer callable, and the callback form is gone (`glob@9` is the last callable
line — measured: `typeof require('glob')` is `function` for 9.3.5 and `object`
for 10.4.5/13.0.7/14.0.6). Reproduction of the breakage in an isolated
consumer repo with `"overrides": { "glob": "^14.0.3" }`:

```
rimraf@3 + glob@14  -> UNCAUGHT: TypeError: glob is not a function
                       remaining files: a.js,b.js,c.txt   (nothing deleted)
test-exclude@6 + glob@14 -> TypeError: The "original" argument must be of type
                       function. Received an instance of Object.
```

Forcing `glob@14` therefore trades a build-time-only, unreachable advisory for
real breakage in `rimraf`-based cleanup and istanbul coverage on the host
toolchain. Bumping `@expo/cli`/`@expo/metro-config`/`react-native` to versions
that declare `glob@14` is a major Expo/RN upgrade — explicitly out of scope.
Left open, documented, and visible (no allowlist entry: the gate keeps printing
it as report-only).

### G2 — `minimatch` GHSA-g3hv-75wg-m249

`first_patched_version` is **11.0.1**; vulnerable range `>=7.0.0 <11.0.1`. The
tree has two copies in the production graph:

- `minimatch@10.2.5`, requested as `^10.2.2` by `@expo/fingerprint`
- `minimatch@8.0.7`, requested as `^8.0.2` by `glob@9`

A nested `overrides.glob.minimatch = 11.0.1` is not compatible: `glob@9` uses
`minimatch`'s minimatch-class API, and minimatch 11 rewrote brace matching. Measured
in an isolated `glob@9.3.5` + `minimatch@11.0.9` tree:

```
glob.sync('**/*.js')       -> OK
glob.sync('src/**/*.js')   -> OK
glob.sync('**/*.{js,ts}')  -> TypeError: (0 , brace_expansion_1.default) is not a function
```

`glob` is the package that consumes minimatch, so breaking it here reproduces
exactly the G1 failure mode. Forcing `minimatch@11` under `@expo/fingerprint`
(a declared `^10.2.2` caret bump to a new major) is likewise a silent contract
violation on the Expo prebuild path. Left open, documented.

## Verification

| Gate                                                      | Result                                                                                                                                                                                                                       |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/runtimeAdvisoryOverrides.test.ts` (new)            | on `origin/main` manifest/lock: 3 of 4 fail (`expected undefined to deeply equal { uuid: '11.1.1' }`, `expected '7.0.3' to be '11.1.1'`, report file missing); with the fix: **4 passed**                                    |
| `npm run typecheck`                                       | 0 errors                                                                                                                                                                                                                     |
| `npm run lint`                                            | 0 errors / 0 warnings                                                                                                                                                                                                        |
| `npm run test:unit`                                       | 196 files / 4465 tests passed (0 failed)                                                                                                                                                                                     |
| `npm ci` (postinstall `patch-package`)                    | all 8 patches apply (`@react-native/community-cli-plugin`, `expo-modules-core`, `expo-sqlite`, `metro-file-map`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-screens`, `react-native-worklets`) |
| `npm ls --all`                                            | exit 0 — only pre-existing `UNMET OPTIONAL DEPENDENCY` lines                                                                                                                                                                 |
| `npm run build:e2e` (hermetic)                            | OK — 0 Supabase hosts in `dist/`; shell revision `sha-f4a0a9cb58c4dea1`                                                                                                                                                      |
| Playwright `e2e/infrastructure.spec.ts` (`E2E_PORT=8125`) | 10 passed (12.5s) — crossOriginIsolated, SharedArrayBuffer, COEP/COOP, service worker, stale-cache, OPFS lock, clean DB init                                                                                                 |
| `node scripts/audit-runtime-deps.mjs`                     | exit 0 — 0 high/critical, report-only moderate                                                                                                                                                                               |

`postinstall` prints `[ERROR], Was not able to set git hooks` in this worktree
because `.git` is a file (linked worktree), so `simple-git-hooks` cannot create
`.git/hooks`. Pre-existing environment noise, unrelated to this change; npm and
patch-package exit 0.

## Residual

11 moderate production-tree advisories remain (2 leaf + 9 meta), all
build-time-only, none reachable from the web bundle, none fixable without a
major upgrade of the Expo/React Native build toolchain or of `rimraf`/`test-exclude`.
Zero low advisories. The gate stays green on high/critical and keeps these visible
as report-only findings.
