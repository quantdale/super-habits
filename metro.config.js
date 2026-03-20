const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// expo-sqlite web: resolve .wasm and allow SharedArrayBuffer
config.resolver.assetExts.push("wasm");
config.server = config.server || {};
config.server.enhanceMiddleware = (metroMiddleware) => {
  return (req, res, next) => {
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    return metroMiddleware(req, res, next);
  };
};

module.exports = withNativeWind(config, { input: "./global.css" });
