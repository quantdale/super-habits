const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const { createSimBridgeResolver } = require('./scripts/metro-sim-bridge-resolver');

const config = getDefaultConfig(__dirname);

// expo-sqlite web: resolve .wasm and allow SharedArrayBuffer
config.resolver.assetExts.push('wasm');
config.server = config.server || {};
config.server.enhanceMiddleware = (metroMiddleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    return metroMiddleware(req, res, next);
  };
};

const exported = withNativeWind(config, { input: './global.css' });

// Build-time module isolation for the simulation data bridge (AUD-SH19-B).
//
// AppProviders statically imports `installSimulationDataBridge` from
// `@/core/simulation/dataBridge`, so the real mutation module (and the
// `__shDataBridge` global it installs) would otherwise be bundled into EVERY
// export — including production. The production guard
// (scripts/build-dist-web.mjs) aborts when the `__shDataBridge` identifier
// reaches dist/, and the minifier leaves that identifier in the artifact even
// when the bridge is unarmed, so substring scanning alone cannot prove a
// production export is bridge-free.
//
// This resolver excludes the mutation module from every build EXCEPT an
// explicitly authorized hermetic simulation build (SH_SIM_BRIDGE === 'armed',
// set only by scripts/build-dist-e2e.mjs for `npm run build:e2e:sim`). All other
// builds resolve the specifier to core/simulation/dataBridge.stub.ts, which
// installs nothing and exposes no mutation API. Production builds additionally
// set SH_SIM_BRIDGE='disabled' explicitly (scripts/build-dist-web.mjs), so an
// ambient/`.env` simulation flag cannot arm the module: Metro sees the stub
// regardless, and the `__shdatabridge` guard stays a fail-closed backstop.
// See scripts/metro-sim-bridge-resolver.js for the tested decision logic.
exported.resolver.resolveRequest = createSimBridgeResolver({
  projectRoot: __dirname,
  shSimBridge: process.env.SH_SIM_BRIDGE,
  priorResolveRequest: exported.resolver.resolveRequest,
});

module.exports = exported;
