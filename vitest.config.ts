import path from 'node:path';
import { defineConfig } from 'vitest/config';

const alias = { '@': path.resolve(__dirname, '.') };

export default defineConfig({
  test: {
    globals: true,
    projects: [
      {
        resolve: { alias },
        define: { __DEV__: 'true' },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/**/*.test.ts', 'core/**/__tests__/**/*.test.ts'],
          exclude: ['e2e/**', 'node_modules/**', 'tests/integration/**'],
          setupFiles: ['./tests/setup.ts'],
        },
      },
      {
        resolve: { alias },
        define: { __DEV__: 'true' },
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          exclude: ['e2e/**', 'node_modules/**'],
          setupFiles: ['./tests/integration/setup.ts'],
          // WM2.4 (CG-9): every integration test bootstraps a real SQLite
          // database (bootstrap DDL + full migrations, 0.3–2.1s each) and
          // some import file-backed databases; under full parallel load
          // these legitimately cross the 5s default (observed flake class:
          // caloriesIntegrity / portableOwnerRecovery failing only in full
          // runs, always green in isolation). 15s keeps genuine hangs
          // caught while removing the load sensitivity — evidence in
          // docs/testing/known-gaps.md CG-9.
          testTimeout: 15_000,
        },
      },
    ],
  },
});
