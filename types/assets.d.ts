/**
 * Static asset imports used by application source.
 *
 * Metro (native/web build) resolves an imported asset to a numeric asset id;
 * Vite (Vitest) resolves it to a URL string. Both are accepted by
 * `expo-audio`'s `AudioSource`, so the declaration keeps the union.
 */
declare module '*.wav' {
  const asset: number | string;
  export default asset;
}
