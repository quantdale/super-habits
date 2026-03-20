# 05_QA_AND_TOOLING.md

## Tests (`tests/`)

### Runner

- **Command:** `npm test` → `vitest run`
- **Config:** `vitest.config.ts` — `environment: "node"`, `resolve.alias["@"]` → project root
- **TypeScript:** `tsconfig.json` includes `"types": ["vitest/globals"]` — tests import explicitly from `"vitest"` in practice

### `tests/habits.domain.test.ts`

| Suite | `it` | Input | Assertion |
|-------|------|-------|-----------|
| `calculateHabitProgress` | exceeds target | `(4, 3)` | `1` |
| `calculateHabitProgress` | partial | `(1, 4)` | `0.25` |

**Not tested:** `targetPerDay === 0` branch (returns 0).

### `tests/pomodoro.domain.test.ts`

| Suite | `it` | Assertion |
|-------|------|-----------|
| `nextPomodoroState` | zero | `(0, true)` → `"finished"` |
| `nextPomodoroState` | running | `(300, true)` → `"running"` |
| `nextPomodoroState` | idle | `(300, false)` → `"idle"` |

**Not tested:** Negative `remainingSeconds` (still `"finished"` by `<= 0`).

### `tests/calories.domain.test.ts`

| Suite | `it` | Detail |
|-------|------|--------|
| `caloriesTotal` | sums | `[{calories:100},{calories:250}]` → `350` |
| `kcalFromMacros` | formula | Multiple `expect` lines covering 0, protein, fat, fiber/clamp cases |

### `tests/calories.data.STUB.test.ts`

- `describe.skip` — **0 tests**; comment: DB mocking not set up.
- Filename marks STUB — **not** SQLite coverage.

### Counts

| Metric | Value |
|--------|-------|
| **Passing tests** | **7** |
| **Files** | 3 active + 1 skipped file |

---

## CI (`.github/workflows/ci.yml`)

| Key | Value |
|-----|--------|
| **name** | `CI` |
| **on** | `push` to all branches (`["**"]`); `pull_request` |

### Job `quality`

| Step | Detail |
|------|--------|
| `runs-on` | `ubuntu-latest` |
| 1 | `actions/checkout@v4` |
| 2 | `actions/setup-node@v4` with `node-version: 20`, `cache: npm` |
| 3 | `npm ci` |
| 4 | `npm run typecheck` (`tsc --noEmit`) |
| 5 | `npm run test` |

**Failure isolation:**

- **Typecheck fails** → step 4 exits non-zero; **tests do not run**.
- **Tests fail** → step 5 fails after typecheck passed.

**Env vars:** None set in workflow file.

---

## Patches (`patches/`)

### `@react-native+community-cli-plugin+0.83.2.patch`

- **Purpose:** Injects `unstable_experiments: { enableStandaloneFuseboxShell: false }` into dev middleware creation in `runServer.js` (Fusebox shell toggle).
- **Noise:** Many file mode changes (100644 → 100755) in diff — substantive code change is the `enableStandaloneFuseboxShell` block.

### `metro-file-map+0.83.3.patch`

- **Purpose:** `isIgnorableFileError` also returns true for `error.code === "EACCES"` (in addition to `ENOENT` and Windows `EPERM`).
- **Why:** Reduces Metro watcher crashes on permission-denied paths (notably on some Windows setups).

**Apply:** `postinstall` runs `patch-package`.

---

## `public/sw.js` (service worker)

**Not in `core/`** — lives under `public/` for web static hosting.

### Cache name

- `superhabits-shell-v1`

### `install`

- `caches.open("superhabits-shell-v1").then(cache => cache.addAll(["/", "/index.html"]).catch(() => Promise.resolve()))`
- `skipWaiting()`

**Pre-cached URLs:** `/`, `/index.html` (errors on add swallowed).

### `activate`

- `event.waitUntil(self.clients.claim())` — take control of open clients.

### `fetch` (GET only)

- Non-GET → no `respondWith`.
- Flow: `caches.match(request)` → if hit, return cached.
- Else `fetch(request)` → on success clone response, `cache.put(request, cloned)` (errors on put swallowed), return response.
- On fetch failure, `.catch(() => cached)` — **returns undefined if no cache** (edge case: offline first navigation).

**Strategy label:** Cache-first for GET, with network population on miss.

**Registration:** `core/pwa/registerServiceWorker.ts` uses Workbox to register `/sw.js`.

---

## Root configs

### `package.json`

| Key | Value / note |
|-----|----------------|
| `main` | `expo-router/entry` |
| `scripts` | `start`, `android`, `ios`, `web` (`cross-env EXPO_UNSTABLE_HEADLESS=1 expo start --web`), `typecheck`, `test`, `test:watch`, `postinstall` → `patch-package` |

### `babel.config.js`

| Option | Value |
|--------|--------|
| `presets` | `babel-preset-expo`, `nativewind/babel` |
| `plugins` | `react-native-reanimated/plugin` (**must stay last** per Reanimated docs) |

### `metro.config.js`

| Customization | Detail |
|---------------|--------|
| `withNativeWind(config, { input: "./global.css" })` | Wraps Metro for Tailwind CSS processing |
| `config.resolver.assetExts.push("wasm")` | Allows `expo-sqlite` WASM on web |
| `config.server.enhanceMiddleware` | Sets `Cross-Origin-Embedder-Policy: credentialless` and `Cross-Origin-Opener-Policy: same-origin` on **every** Metro server response |

**Interaction:** Same COOP/COEP pair as `app.json` expo-router plugin headers — supports `SharedArrayBuffer` / sqlite web.

### `tailwind.config.js`

| Option | Value |
|--------|--------|
| `presets` | `nativewind/preset` |
| `content` | `./app/**`, `./features/**`, `./core/**` — `*.{js,jsx,ts,tsx}` |
| `theme.extend.colors.brand` | See brand table below |

#### Brand palette (hex + usage)

| Token | Hex | Typical usage |
|-------|-----|----------------|
| `brand-50` | `#eef4ff` | (available) |
| `brand-100` | `#dbe8ff` | (available) |
| `brand-500` | `#4f79ff` | Primary buttons, focused tabs, habit accents (`Button` primary, `NavItem` focused, category chips) |
| `brand-700` | `#355fe4` | (available) |
| `brand-900` | `#1d356e` | (available) |

**Other Tailwind:** Slate/rose/white classes used directly without extending (default palette).

### `global.css`

- Tailwind directives only: `@tailwind base/components/utilities`.

### `tsconfig.json`

| Option | Value |
|--------|--------|
| `extends` | `expo/tsconfig.base` |
| `strict` | `true` |
| `baseUrl` | `.` |
| `paths` | `@/*` → `./*` |
| `types` | `vitest/globals` |

### `app.json` (Expo)

| Area | Notes |
|------|--------|
| `plugins` | `expo-router` with COOP/COEP headers; `expo-notifications`; `expo-sqlite` |
| `web` | `bundler: metro`, `output: static` |
| `experiments.typedRoutes` | `true` |

---

## `.devcontainer/devcontainer.json`

| Field | Value |
|-------|--------|
| Image | `mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm` |
| Forward port | `8081` (Expo) |
| `postCreateCommand` | `npm install` |

**vs CI:** Node 22 in container vs Node 20 in GitHub Actions.

---

## README.md (root)

- Scripts list, architecture bullets, manual smoke checklist — **not** a substitute for this KB.

---

## Tooling gaps

| Gap | Notes |
|-----|--------|
| ESLint / Prettier | No committed root config in repo; CI does not lint |
| Coverage | Vitest coverage not configured |
| DB tests | Only skipped stub for calories data |
