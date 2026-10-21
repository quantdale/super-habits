/**
 * Metro resolver helper for simulation data-bridge module isolation (`AUD-SH19-B`).
 *
 * Pure, testable decision logic used by `metro.config.js`. The security property
 * it enforces: the `core/simulation/dataBridge` mutation module is included in a
 * Metro bundle ONLY for an explicitly authorized hermetic simulation build
 * (`SH_SIM_BRIDGE === 'armed'`, set solely by `scripts/build-dist-e2e.mjs` for
 * `npm run build:e2e:sim`). Every other build resolves the specifier to the
 * no-op stub `core/simulation/dataBridge.stub.ts`, which installs nothing and
 * exposes no mutation API — so `__shDataBridge` is absent from the artifact
 * entirely and the production `__shdatabridge` guard is a sound, fail-closed
 * proof of absence.
 */
const path = require('path');

/** Matches the `dataBridge` source specifier (alias, relative, or extensioned). */
const DATA_BRIDGE_SPECIFIER = /(^|[\\/])core[\\/]simulation[\\/]dataBridge(\.(ts|tsx|js|jsx))?$/;

/**
 * Whether the build has explicitly armed the simulation bridge module.
 *
 * @param {string | undefined} shSimBridge value of `SH_SIM_BRIDGE`
 * @returns {boolean} true only for the authorized hermetic simulation build
 */
function isSimBridgeArmed(shSimBridge) {
  return shSimBridge === 'armed';
}

/**
 * Whether a specifier refers to the real mutation module (not the stub).
 *
 * @param {string} moduleName raw specifier Metro is resolving
 * @returns {boolean}
 */
function isDataBridgeSpecifier(moduleName) {
  return DATA_BRIDGE_SPECIFIER.test(moduleName);
}

/**
 * Build the `resolver.resolveRequest` that isolates the mutation module.
 *
 * @param {object} options
 * @param {string} options.projectRoot absolute project root (for the stub path)
 * @param {string | undefined} options.shSimBridge value of `SH_SIM_BRIDGE`
 * @param {null | ((ctx: unknown, name: string, platform: string | null) => unknown)} options.priorResolveRequest
 * @returns {(ctx: unknown, name: string, platform: string | null) => unknown}
 */
function createSimBridgeResolver({ projectRoot, shSimBridge, priorResolveRequest }) {
  const stubPath = path.resolve(projectRoot, 'core', 'simulation', 'dataBridge.stub.ts');
  const armed = isSimBridgeArmed(shSimBridge);
  return (context, moduleName, platform) => {
    if (!armed && isDataBridgeSpecifier(moduleName)) {
      return { type: 'sourceFile', filePath: stubPath };
    }
    return priorResolveRequest
      ? priorResolveRequest(context, moduleName, platform)
      : context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = {
  DATA_BRIDGE_SPECIFIER,
  isSimBridgeArmed,
  isDataBridgeSpecifier,
  createSimBridgeResolver,
};
