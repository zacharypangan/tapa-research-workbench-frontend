import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Match the legacy modules excluded from tsconfig.app.json.
  globalIgnores([
    'dist',
    'src/components/checkpoint/**',
    'src/components/Catalog.tsx',
    'src/components/ChatInterface.tsx',
    'src/components/ColorPalettePanel.tsx',
    'src/components/DataTable.tsx',
    'src/components/DetailWindow.tsx',
    'src/components/LayerManager.tsx',
    'src/components/LegendPanel.tsx',
    'src/components/NumericFilter.tsx',
    'src/utils/ColorMapper.ts',
    'src/utils/duckdb.ts',
    'src/utils/filterUtils.ts',
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
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])
