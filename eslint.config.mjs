import expoConfig from 'eslint-config-expo/flat.js';
import tseslint from '@typescript-eslint/eslint-plugin';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  // Global ignores
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'web-build/**',
      '.expo/**',
      'expo/**',
      '.claude/**',
      '**/*.js',
      '**/*.jsx',
      '*.config.js',
      '*.config.mjs',
      'scripts/**/*.mjs',
      'supabase/functions/**',
      '.vercel/**',
      '.cursor/**',
      '.playwright-mcp/**',
      'test-results/**',
      'playwright-report/**',
      'package/**',
      'coverage/**',
    ],
  },

  // Expo preset (core + TypeScript + React + Expo rules)
  ...expoConfig,

  // TypeScript recommended type-checked rules
  ...tseslint.configs['flat/recommended-type-checked'],

  // React Refresh
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-refresh/only-export-components': 'warn',
    },
  },

  // Project-specific rules
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.d.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/strict-boolean-expressions': 'off',
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },

  // Tests and e2e specs use mock `any` values and vitest helpers intentionally;
  // keep type-safety noise low without touching test logic.
  {
    files: [
      'tests/**/*.ts',
      'tests/**/*.tsx',
      'core/**/__tests__/**/*.ts',
      'core/**/__tests__/**/*.tsx',
      'e2e/**/*.ts',
      'e2e/**/*.tsx',
    ],
    rules: {
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/unbound-method': 'off',
      'prefer-const': 'off',
    },
  },

  // Prettier must be last to override conflicting stylistic rules
  eslintConfigPrettier,
  eslintPluginPrettierRecommended,
];
