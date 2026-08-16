import expoConfig from 'eslint-config-expo/flat.js';
import tseslint from '@typescript-eslint/eslint-plugin';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

// React Native UI ecosystem — banned from pure (data/domain) layers.
// Mirrors the AGENTS.md layering rules: data layers are plain TypeScript
// SQLite/sync plumbing, domain layers are pure logic.
// Note: ESLint 9.39 redesigned `no-restricted-imports` — patterns are
// expressed as gitignore-style `group` globs inside the legacy
// `{ paths, patterns }` wrapper (see the rule schema in
// node_modules/eslint/lib/rules/no-restricted-imports.js).
const reactUiImportNames = [
  { name: 'react', message: 'Pure layers must not import React.' },
  { name: 'react-native', message: 'Pure layers must not import react-native.' },
  { name: 'expo-router', message: 'Pure layers must not import expo-router.' },
];

const reactUiImportGroups = [
  {
    group: ['react-native-*'],
    caseSensitive: true,
    message: 'Pure layers must not import react-native packages.',
  },
  {
    group: ['@react-native-community/*'],
    caseSensitive: true,
    message: 'Pure layers must not import @react-native-community packages.',
  },
];

const expoConfigWithProjectReactHooks = expoConfig.map((config) => {
  if (!config.plugins?.['react-hooks']) {
    return config;
  }

  return {
    ...config,
    plugins: {
      ...config.plugins,
      // Keep the project’s React Hooks 7 rules while using the SDK 55 preset.
      'react-hooks': reactHooks,
    },
  };
});

export default [
  // Global ignores
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'expo-env.d.ts',
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
  ...expoConfigWithProjectReactHooks,

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

  // ---- Import-boundary enforcement -------------------------------------
  // Enforces the AGENTS.md layering rules as ESLint boundaries
  // (no-restricted-imports, built-in rule — no new dependencies).
  //
  // 1. Data layers (features/**/*.data.ts + linkedActions.data.ts) are
  //    SQLite/sync plumbing: no React / react-native UI imports.
  {
    files: ['features/**/*.data.ts', 'core/linked-actions/linkedActions.data.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: reactUiImportNames, patterns: reactUiImportGroups },
      ],
    },
  },

  // 2. Domain layers (**/*.domain.ts) are pure logic: no DB, no React,
  //    no core/ modules, no feature data layers or screens/components.
  //    Allowed: lib/, features/shared/activityTypes.ts, other domain files,
  //    local feature types, constants/.
  {
    files: ['**/*.domain.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            ...reactUiImportNames,
            {
              name: 'expo-sqlite',
              message:
                'Domain layers must not import the database directly; keep domain files pure.',
            },
            {
              name: '@/features/shared/GitHubHeatmap',
              message:
                'Only features/shared/activityTypes.ts is pure; UI components do not belong in domain layers.',
            },
          ],
          patterns: [
            ...reactUiImportGroups,
            {
              group: ['@/core/**'],
              caseSensitive: true,
              allowTypeImports: true,
              message:
                'Domain layers must not import core/ (DB, sync, providers, UI); keep domain files pure.',
            },
            {
              group: ['@/app/**'],
              caseSensitive: true,
              message: 'Domain layers must not import app/ routes.',
            },
            {
              group: ['@/features/*/*.data'],
              caseSensitive: true,
              message: 'Domain layers must not import feature data layers; keep domain files pure.',
            },
            {
              group: ['@/features/*/*Screen'],
              caseSensitive: true,
              message: 'Domain layers must not import screens/components; keep domain files pure.',
            },
          ],
        },
      ],
    },
  },

  // 3. lib/ is shared plumbing: no feature, core, or DB imports.
  {
    files: ['lib/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'expo-sqlite',
              message: 'lib/ must not import the database directly; route through core/db/client.',
            },
          ],
          patterns: [
            {
              group: ['@/features/**'],
              caseSensitive: true,
              message: 'lib/ must not import feature modules.',
            },
            {
              group: ['@/core/**'],
              caseSensitive: true,
              message: 'lib/ must not import core/ modules.',
            },
          ],
        },
      ],
    },
  },

  // 4. UI (screens/components) and feature orchestration must go through
  //    feature data layers — never import the DB client directly.
  //    Exclusions (via `ignores`): core/db + core/sync internals,
  //    AppProviders (bootstrap), data layers, domain layers, lib/, and
  //    tests. Domain/lib files are excluded so that rules 2 and 3 above
  //    are not shadowed (in flat config the last config for a rule wins).
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: [
      'core/db/**',
      'core/auth/**',
      'core/sync/**',
      'core/backup/**',
      'core/portable/**',
      'core/providers/AppProviders.tsx',
      'core/linked-actions/linkedActions.data.ts',
      'core/**/__tests__/**',
      'features/**/*.data.ts',
      '**/*.domain.ts',
      'lib/**',
      'tests/**',
      'e2e/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/core/db/client',
              message:
                'UI and feature logic must not import the DB client directly; call the feature data layer (features/*/*.data.ts) instead.',
            },
          ],
        },
      ],
    },
  },

  // Prettier must be last to override conflicting stylistic rules
  eslintConfigPrettier,
  eslintPluginPrettierRecommended,
];
