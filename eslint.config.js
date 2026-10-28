import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'src/routeTree.gen.ts',
    'public/mockServiceWorker.js',
    'playwright-report',
    'test-results',
    'lighthouse/reports',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Permite omitir campos com rest destructuring ({ userId: _u, ...publico }).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { ignoreRestSiblings: true, argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Testes Playwright: `use` é o fixture do Playwright (não um hook React) e as respostas
    // de API são inspecionadas de forma dinâmica.
    files: ['e2e/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // Padrão shadcn: o arquivo do botão exporta também as variantes (usadas em <Link>).
    files: ['src/components/ui/button.tsx'],
    rules: { 'react-refresh/only-export-components': ['error', { allowExportNames: ['buttonVariants'] }] },
  },
  {
    // Arquivos de rota exportam `Route`; o plugin do TanStack Router cuida do HMR deles.
    files: ['src/routes/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
