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
        },
      },
    ],
  },
});
