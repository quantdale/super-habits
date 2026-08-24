# SuperHabits workstation bootstrap

This is the repository-native setup path for a fresh development computer. It
reconstructs the environment from Git and the lockfile; it does not transfer
machine caches, emulator images, credentials, or Codex conversation state.

## Prerequisites

### Required for web development and repository QA

- Git.
- Node.js 22.22.1 through 22.x. The checked-in `.nvmrc` selects the exact
  CI/dev baseline and matches the `javascript-node:1-22-bookworm` image.
- npm compatible with the selected Node.js release.
- A Chromium installation managed by Playwright.

The lockfile currently resolves Expo SDK `55.0.11`, React Native `0.83.4`,
Expo Router `55.x`, TypeScript `5.9.x`, Vitest `3.2.7`, and Playwright `1.59.1`.
Use repository-local CLIs through `npx`; do not depend on globally installed
Expo, TypeScript, Vitest, or Playwright versions.

Python is not an application runtime prerequisite: the app uses Node.js
scripts and TypeScript tooling. However, the lockfile includes the
`better-sqlite3` integration-test dependency, whose native `node-gyp` build can
run during `npm ci`. On Windows, install Python 3.x and the Visual Studio C++
Build Tools workload before `npm ci`; this is a dependency-build prerequisite,
not an application language requirement.

### Optional native/cloud capabilities

- Android local builds: Android Studio, Android SDK Platform Tools (`adb`), an
  emulator or USB device, and JDK 17 LTS or a newer JDK compatible with the
  generated Expo/Gradle project. Set `ANDROID_HOME` or `ANDROID_SDK_ROOT`.
- iOS local builds: macOS, Xcode, and an iOS simulator. Windows does not claim
  local iOS execution; use the EAS native workflow when appropriate.
- Maestro for the focused native flows. The repository expects a built
  `e2e-test` app installed on the target; Maestro does not build or install it.
- EAS CLI `>=18.5.0` for cloud/native builds. `npx eas-cli@18.5.0` is a
  reproducible invocation; global EAS installation is not required.
- Supabase CLI only for Edge Function deployment or the guarded disposable
  backend lane. It is not required for local-only web development.

## Clone and install

```bash
git clone https://github.com/quantdale/super-habits.git
cd super-habits
npm ci
npx playwright install chromium
npm run dev:doctor
```

`npm ci` runs the repository `postinstall` hook, including `patch-package` and
the checked-in patches under `patches/`. If a local environment is needed,
copy the safe template and edit only the ignored copy:

```bash
cp .env.example .env.local
```

On PowerShell, use `Copy-Item .env.example .env.local`. Do not commit either
`.env` or `.env.local`.

## Web development

Start Metro/Expo web development with HMR:

```bash
npm run web
```

The web SQLite runtime requires `crossOriginIsolated === true`, provided by
COOP/COEP headers in the Metro config and static deployment config. For a
production-shaped static export:

```bash
npm run build:web
```

The default development server uses port `8081`. Playwright uses a static
export served by `scripts/serve-e2e.js`, not the Metro HMR server. If `8081` is
occupied, use an isolated port (the E2E server starts on that port):

```bash
E2E_PORT=8091 npm run e2e:journeys:p0
```

PowerShell equivalent:

```powershell
$env:E2E_PORT = '8091'
npm run e2e:journeys:p0
```

The sync-boundary lane intentionally uses the separately generated
`dist-sync/` export on port `8082`:

```bash
npm run build:sync
npm run e2e:sync
```

The dummy Supabase values used by `build:sync` are placeholders and must never
be replaced with production credentials.

## Testing and validation

Use the impact resolver before choosing an expensive gate:

```bash
npm run qa:impact:validate
npm run qa:affected
```

Core gates:

```bash
npm run qa:fast
npm run qa:integration
npm run qa:journeys
npm run qa:simulation
npm run qa:timezones
npm run openspec:validate
```

Run the full deterministic regression when the impact map requests it:

```bash
npm run qa:full
```

`npm run qa:full` builds the web app and runs the full E2E/simulation path; it
is intentionally more expensive than the fast/affected gates.

## Playwright

Install the repository-compatible browser after `npm ci`:

```bash
npx playwright install chromium
```

On Linux CI or a minimal Linux workstation where browser OS libraries are not
already present, use:

```bash
npx playwright install --with-deps chromium
```

Then build the static app before E2E:

```bash
EXPO_NO_DOTENV=1 npm run build:web
npm run e2e
```

PowerShell equivalent:

```powershell
$env:EXPO_NO_DOTENV = '1'
npm run build:web
Remove-Item Env:EXPO_NO_DOTENV
npm run e2e
```

Use `EXPO_NO_DOTENV=1` for the ordinary local-only export so ignored
`.env.local` values cannot be bundled accidentally. Configure the optional
Supabase environment deliberately only for a remote-boundary or internal
parser lane.

Reports and failure artifacts are written to ignored output paths under
`.cursor/playwright-output/`, `playwright-report/`, and `test-results/`.

## Native Android and Maestro

Local Android development needs Android Studio/SDK, platform tools, an
emulator or device, and JDK 17 LTS (or a compatible newer JDK). Verify the
target before running native QA:

```bash
java -version
adb version
adb devices
```

The generated `android/` directory and Gradle caches are machine-local and are
not migration artifacts. `npm run android`/`npx expo run:android` can generate
the native project on the new workstation when needed; EAS native builds use
the checked-in app configuration and do not require copying the old generated
directory.

Install and verify Maestro using its official installer for the target OS,
then run:

```bash
maestro --version
npm run qa:native:android
```

The runner selects the documented API-36 x86_64 target and automatically
provisions the current credential-free local equivalent when the package is
missing or its source/provenance is stale. To provision explicitly (or to get
the build/install diagnostics before the lane), run:

```bash
npm run qa:native:provision -- --serial <serial>
```

The provisioner performs Expo prebuild, assembles the Android release APK,
installs it on the verified serial, and records package/version/source-SHA
metadata under the ignored `simulation-output/native/` directory. Missing
Maestro, `adb`, a booted target, an unsupported API/ABI, or a build/install
failure remains an `ENVIRONMENT` blocker with a replay command; it is not a
native pass. The EAS cloud build remains available when local native validation
is not possible:

```bash
npx eas-cli@18.5.0 build -p android --profile e2e-test
```

The native flow catalog and cloud path are documented in
[`native-e2e.md`](../testing/native-e2e.md). Windows cannot run the local iOS
lane; use a macOS simulator or the explicit `.eas/workflows/native-e2e.yml`
workflow.

## Environment variables and secure transfer

The default app is local-only and needs no secrets. Names and purposes:

- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` — optional client
  backup/restore configuration. These are bundled into the client; keep them in
  ignored local env files and use only the intended project values.
- `EXPO_PUBLIC_AI_COMMAND_PARSE_MODE`,
  `EXPO_PUBLIC_AI_COMMAND_INTERNAL_ROLLOUT`,
  `EXPO_PUBLIC_AI_COMMAND_BACKEND_HOST`,
  `EXPO_PUBLIC_AI_COMMAND_SUPABASE_FUNCTION_NAME`,
  `EXPO_PUBLIC_AI_COMMAND_PROXY_URL` — optional internal command-parser config.
- `E2E_COMMAND_INTERNAL_EVAL`, `E2E_COMMAND_INTERNAL_OBSERVATION` — opt-in
  internal E2E switches; the standard suite leaves them disabled.
- `EAS_TOKEN` or `EXPO_TOKEN` — optional non-interactive Expo/EAS auth, if the
  organization uses one of these names.
- `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_ORG_ID`,
  `SUPABASE_REGION`, `SUPABASE_DISPOSABLE_MARKER_PREFIX`,
  `SIMULATION_PRODUCTION_SUPABASE_HOSTS` — optional guarded Supabase/deploy
  tooling configuration.
- `SUPABASE_SERVICE_ROLE_KEY` — server/admin-only credential when required;
  never expose it to Expo public env or client bundles.
- `OPENAI_API_KEY`, `AI_COMMAND_MODEL`, `OPENAI_BASE_URL` — Supabase
  `parse-ai-command` function secrets/config.
- `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `AI_ASK_MODEL` — Supabase
  `user-ai-ask` function secrets/config.
- `VERCEL_OIDC_TOKEN` — optional Vercel CLI/deployment authentication.
- `GITHUB_PERSONAL_ACCESS_TOKEN` — optional GitHub MCP authentication if that
  server is enabled for Codex.

Secure-transfer checklist:

1. Transfer needed values through a password manager, secret manager, or
   provider dashboard; never through Git, chat, screenshots, or committed docs.
2. Recreate ignored `.env.local` only on Nitro and verify that `.gitignore`
   still excludes it.
3. Re-authenticate Nitro separately with EAS, Supabase, Vercel, and GitHub MCP
   as needed; do not copy Predator's auth caches or `~/.codex` wholesale.
4. Configure Supabase function secrets in the Supabase project, not in the
   repository or Expo public environment.
5. Rotate any credential that was ever printed, pasted into a command history,
   or accidentally included in a diff.

## Codex and repository configuration

The clone contains repository-scoped instructions in `AGENTS.md`, `.agent/`,
`.agents/`, `.codex/`, `.cursor/`, `docs/codex-workflow.md`, and the OpenSpec
artifacts. `.mcp.json` contains command names only; MCP servers may still need
their own auth on Nitro. Do not copy Predator's conversation history, user
caches, or absolute home-directory settings.

## Final workstation proof

At minimum, a web-ready Nitro workstation should finish with:

```bash
npm ci
npx playwright install chromium
npm run dev:doctor
npm run qa:impact:validate
npm run openspec:validate
npm run typecheck
npm run lint
npm test
npm run build:web
npx playwright test --list
```

Native readiness is separate and is proven only by an actual installed app,
booted device/emulator, Maestro, and the relevant `npm run qa:native:*` command.
