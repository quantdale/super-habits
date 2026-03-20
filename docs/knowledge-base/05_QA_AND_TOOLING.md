# 05_QA_AND_TOOLING.md

## Scope

This document covers **automated quality checks**, **tests**, **CI**, **devcontainer**, **dependency patches**, **npm scripts**, and **root build/style configuration** (`vitest`, `babel`, `metro`, `tailwind`, `global.css`, TypeScript). Related static web assets **`public/sw.js`** are included here as tooling-adjacent PWA shell code (registration is in `core/pwa/` — see `02_CORE_INFRA.md`).

---

## Purpose

**What it does:** Standardizes how the project is **typechecked**, **unit-tested**, **bundled** (Metro + Babel + NativeWind), and **validated in CI**; optional **Dev Container** for a reproducible editor environment; **`patch-package`** reapplies local fixes to `node_modules` after install.

**Problem it solves:** Catches TS errors and regressions in pure logic before merge; keeps Expo/RN/Metro + Tailwind pipeline consistent across machines.

---

## Tech stack (tooling)

| Tool | Version / source | Role |
|------|------------------|------|
| **TypeScript** | `~5.9.2` (`package.json` devDependencies) | `tsc --noEmit` |
| **Vitest** | `^3.2.4` | Unit tests, Node environment |
| **patch-package** | `^8.0.1` | `postinstall` applies `patches/*.patch` |
| **Babel** | `babel-preset-expo`, `nativewind/babel`, Reanimated plugin | Transpile for Metro |
| **Metro** | via `expo/metro-config` + `nativewind/metro` | Bundler; COOP/COEP middleware; `wasm` asset ext |
| **Tailwind CSS** | `^3.4.19` + NativeWind preset | `tailwind.config.js` + `global.css` |
| **cross-env** | `^10.1.0` | Sets env vars on Windows for `npm run web` |
| **GitHub Actions** | `actions/checkout@v4`, `actions/setup-node@v4` | CI on push/PR |

**Not found in repo root:** `eslint.config.*`, `.eslintrc*`, `prettier` config files (VS Code extensions for ESLint/Prettier are suggested in `.devcontainer` only).

---

## Architecture pattern

**Single-package Node project:** one `package.json`, scripts orchestrate Expo CLI + `tsc` + Vitest; **no** monorepo tooling (Nx/Turborepo).

---

## Entry points (commands)

| Command | Definition | Effect |
|---------|------------|--------|
| `npm run start` | `expo start` | Dev server (Metro). |
| `npm run android` | `expo start --android` | |
| `npm run ios` | `expo start --ios` | |
| `npm run web` | `cross-env EXPO_UNSTABLE_HEADLESS=1 expo start --web` | |
| `npm run typecheck` | `tsc --noEmit` | Typecheck only. |
| `npm run test` | `vitest run` | Single test run. |
| `npm run test:watch` | `vitest` | Watch mode. |
| `postinstall` | `patch-package` | Applies patches after `npm install` / `npm ci`. |

---

## Folder / file structure

| Path | Role |
|------|------|
| `tests/` | Vitest specs (`*.test.ts`). |
| `.github/workflows/ci.yml` | GitHub Actions workflow. |
| `.devcontainer/devcontainer.json` | Dev Container spec. |
| `patches/` | `patch-package` patch files for `node_modules`. |
| `vitest.config.ts` | Vitest config + `@` alias. |
| `babel.config.js` | Babel presets/plugins. |
| `metro.config.js` | Metro + NativeWind + resolver/middleware tweaks. |
| `tailwind.config.js` | Tailwind content globs + `brand` palette. |
| `global.css` | Tailwind directives for NativeWind input. |
| `tsconfig.json` | Extends `expo/tsconfig.base`, strict, `@/*` paths. |
| `public/sw.js` | Service worker script (cache shell, fetch handler). |
| `.gitignore` | Ignores `node_modules`, `.expo`, `dist`, local env, etc.; **`expo-env.d.ts` ignored**. |

---

## API surface (HTTP)

**Not found** — tooling does not expose HTTP APIs. **Metro dev server** serves the bundle in development (not documented here as a public API).

---

## Data models

**Not found** — tests use minimal `{ calories }` objects where needed (`tests/calories.domain.test.ts`).

---

## Config & environment variables

| Variable / file | Where | Notes |
|-----------------|-------|-------|
| `EXPO_UNSTABLE_HEADLESS` | Set only in `npm run web` via `cross-env` | Used for web dev script. |
| `.env*.local` | Gitignored (`.gitignore`) | **Not present** in repo; local-only. |
| `expo-env.d.ts` | Listed in `.gitignore` | Generated/ignored; `expo-env.d.ts` in repo has `/// <reference types="expo/types" />` per file header. |

---

## Inter-service communication

**Not found** — CI talks only to npm registry for `npm ci`.

---

## Auth & authorization

**Not found** in tooling configs.

---

## Key “business” logic (tooling)

| Unit | Behavior |
|------|----------|
| `vitest.config.ts` | Resolves `@` → repo root (mirrors `tsconfig` paths for tests). |
| `metro.config.js` | Adds `wasm` to `assetExts`; sets **COOP/COEP** headers on Metro middleware (aligns with `app.json` plugin headers); wraps config with **`withNativeWind`** input `./global.css`. |
| `public/sw.js` | On **install**: cache `"/"`, `"/index.html"`; **activate**: `clients.claim()`; **fetch**: cache-first GET, populate cache from network. |
| `patches/metro-file-map+0.83.3.patch` | Extends `isIgnorableFileError` to treat **`EACCES`** like ignorable errors (in addition to `ENOENT` / Win `EPERM`). |

---

## Background jobs / scheduled tasks

**Not found** — CI runs on **push** and **pull_request** only; no cron schedules in `.github/workflows`.

---

## Error handling

| Location | Behavior |
|----------|----------|
| CI | Fails the job if `npm ci`, `typecheck`, or `test` exits non-zero. |
| `public/sw.js` | `cache.addAll` / `cache.put` failures caught and resolved to avoid rejecting install/fetch handlers. |

---

## Testing

### Framework & environment

- **Vitest** 3, **`environment: "node"`** — no Jest, no RN Testing Library in `devDependencies` at time of writing.
- **Path alias:** `@` → project root (same as app `tsconfig`).

### Test files (inventory)

| File | Describes |
|------|-----------|
| `tests/habits.domain.test.ts` | `calculateHabitProgress` |
| `tests/pomodoro.domain.test.ts` | `nextPomodoroState` |
| `tests/calories.domain.test.ts` | `caloriesTotal`, `kcalFromMacros` (`features/calories/calories.domain`) |
| `tests/calories.data.STUB.test.ts` | Skipped placeholder — reserved for SQLite / `calories.data` tests (TODO) |

### Coverage strategy

**Not found** — no `coverage` script, no Vitest coverage config, no coverage thresholds in repo.

### Gaps (observed)

- No tests for `app/`, `core/db`, feature `*.data.ts` SQLite code, or screens.

---

## Deployment

| Mechanism | Finding |
|-----------|---------|
| **Docker** | **Not found** |
| **IaC** (Terraform, etc.) | **Not found** |
| **GitHub Actions** | **CI only** — no deploy/release workflow files observed |
| **EAS / app store** | **Not found** in `.github` or root configs reviewed |

---

## Patches (`patches/`)

| Patch file | Observed change (from diff content) |
|------------|--------------------------------------|
| `metro-file-map+0.83.3.patch` | **`FallbackWatcher`**: `isIgnorableFileError` also returns true for **`error.code === "EACCES"`** (file access errors). |
| `@react-native+community-cli-plugin+0.83.2.patch` | Diff content is **exclusively** `old mode 100644` → `new mode 100755` across many files under that package — **no** line-level source edits visible in the patch body. |

---

## Quirks

1. **`tests/calories.data.STUB.test.ts`** is intentionally a skipped stub until DB mocking exists; domain coverage lives in **`tests/calories.domain.test.ts`**.
2. **`expo-env.d.ts`**: `.gitignore` ignores it, but a committed `expo-env.d.ts` exists at repo root with a comment saying it should be gitignored — potential duplication/confusion for contributors.
3. **Node version mismatch:** CI uses **Node 20**; Dev Container image is **Node 22** — tests/typecheck may behave differently if version-sensitive.
4. **Second patch file:** If it only adjusts executable bits, **`patch-package`** may behave differently across OSes or be redundant — **not** verified beyond reading the patch file.
5. **`.vscode/`:** Directory may exist empty (no workspace settings committed).

---

## Open questions

1. Whether **ESLint/Prettier** are enforced anywhere (CI only runs `tsc` + `vitest`) — **no** config files found at root.
2. Intended **production** build/deploy path (EAS, static web export, stores) — **not** defined in files covered here.
