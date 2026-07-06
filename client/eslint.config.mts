import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tanstackConfig } from '@tanstack/eslint-config'
import pluginQuery from '@tanstack/eslint-plugin-query'
import pluginRouter from '@tanstack/eslint-plugin-router'
import eslintConfigPrettier from 'eslint-config-prettier/flat'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url))
export default defineConfig([
  globalIgnores(['src/routeTree.gen.ts'], 'client/ignores'),
  {
    name: 'client/linter-options',
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
  },
  ...tanstackConfig,
  {
    name: 'client/typescript-parser-options',
    files: ['**/*.{ts,tsx,mts}'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir,
      },
    },
  },
  reactHooks.configs.flat['recommended-latest'],
  ...pluginQuery.configs['flat/recommended-strict'],
  ...pluginRouter.configs['flat/recommended'],
  {
    name: 'client/local-overrides',
    rules: {
      'import/no-cycle': 'off',
      'import/order': 'off',
      'sort-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
      'pnpm/json-enforce-catalog': 'off',
    },
  },
  eslintConfigPrettier,
])
