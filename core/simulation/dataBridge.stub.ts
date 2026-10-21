/**
 * Production stub for the simulation data bridge (`AUD-SH19-B`).
 *
 * ## Why this exists
 *
 * `core/providers/AppProviders.tsx` statically imports
 * `installSimulationDataBridge` from `@/core/simulation/dataBridge`, so the real
 * mutation module (and the global it installs) is pulled into EVERY Metro
 * bundle — including production web exports. The production export guard
 * (`scripts/build-dist-web.mjs`) aborts if the bridge identifier reaches
 * `dist/`, and the minifier folds the arming check to `false` while leaving the
 * inert identifier (a string constant plus unreachable dead code) in the
 * artifact. Substring scanning therefore cannot distinguish a genuinely armed
 * bridge from the inert identifier.
 *
 * ## The contract
 *
 * Metro's `metro.config.js` resolves `@/core/simulation/dataBridge` to THIS
 * stub for every build EXCEPT an explicitly authorized hermetic simulation
 * build (`SH_SIM_BRIDGE === 'armed'`, set only by `scripts/build-dist-e2e.mjs`).
 * So a production / ordinary-preview export does not merely leave the bridge
 * unarmed — the mutation module is absent from the artifact entirely. The
 * identifier guard then becomes a sound, fail-closed proof of absence: if the
 * real module ever leaks into a production export (any reason), the guard still
 * aborts.
 *
 * This stub intentionally exposes NO mutation API and NO bridge global, and its
 * source must never contain the bridge identifier — not even in prose — so that
 * its presence in a bundle can never trip (or mask) the guard. It must never
 * grow any.
 */

/**
 * Install the simulation data bridge. Always a no-op in ordinary builds.
 *
 * Mirrors the real module's signature so `AppProviders` compiles and runs
 * unchanged. Returns `false` to signal "no bridge installed", exactly like the
 * real installer's early-return path when the build flag is absent.
 *
 * @returns always `false` — the bridge is never installed in ordinary builds
 */
export function installSimulationDataBridge(): boolean {
  return false;
}

/**
 * Whether the bridge is enabled. Always `false` in ordinary builds.
 */
export function isBridgeEnabled(): boolean {
  return false;
}
