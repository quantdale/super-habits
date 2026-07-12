// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", ".expo/*", "supabase/functions/*"],
  },
  {
    // Type-aware rules for app TypeScript. The Deno edge function and plain
    // JS configs are excluded above (different runtime / no tsconfig entry).
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // Unawaited promises silently swallow errors; require explicit `void`.
      // 14 pre-existing hits at adoption time — ratchet to "error" once the
      // dedicated fix pass lands.
      "@typescript-eslint/no-floating-promises": "warn",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    // Root-level configs and scripts are CommonJS run by Node.
    files: ["*.js", "scripts/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: require("globals").node,
    },
  },
]);
