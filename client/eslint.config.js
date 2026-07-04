//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'
import pluginQuery from '@tanstack/eslint-plugin-query'
import eslintConfigPrettier from 'eslint-config-prettier/flat'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  {
    name: 'client/ignores',
    ignores: ['eslint.config.js', 'prettier.config.js', 'src/routeTree.gen.ts'],
  },
  {
    name: 'client/linter-options',
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
  },
  ...tanstackConfig,
  reactHooks.configs.flat.recommended,
  ...pluginQuery.configs['flat/recommended'],
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
]
