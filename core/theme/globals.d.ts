// Metro/Expo (and vitest, via `define` in vitest.config.ts) replace `__DEV__`
// with a literal boolean at build time. This ambient declaration just gives
// TypeScript the type; no runtime value is provided here.
declare let __DEV__: boolean;
