import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
import arusiq from './eslint-rules/index.js';

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'node_modules', 'tools/__fixtures__']),

  // --- Application source: type-aware, accessible, token-only ---------------
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      // Type-aware rules. The README recommends this for production apps, and
      // half the value of a typed domain layer is lost without it.
      tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      // D6 NFR Accessibility targets Lighthouse >= 90 and "status never
      // colour-only". Shipping without this plugin is indefensible.
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { arusiq },
    rules: {
      'arusiq/require-provenance-prop': 'error',
      'arusiq/no-hardcoded-jsx-text': 'error',
      'arusiq/no-raw-value-in-style-prop': 'error',

      // D7 §12 / ADR-0007 — charts go through the wrappers in src/patterns,
      // which hard-code the dashed baseline, the text alternative and the
      // disabled entrance animation. A direct import bypasses all of it.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'recharts',
              message:
                'Import a chart wrapper from src/patterns instead. Recharts defaults break D7 §12 (green series, 12px grey axes, entrance animation, fixed widths).',
            },
          ],
        },
      ],
    },
  },

  // The chart wrappers are the one place Recharts may be imported.
  {
    files: ['src/patterns/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': 'off' },
  },

  // Tests may hardcode strings — fixtures are not shipped UI.
  {
    files: ['src/**/*.{test,spec}.{ts,tsx}', 'src/**/__tests__/**'],
    rules: {
      'arusiq/no-hardcoded-jsx-text': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },

  // --- Node-side tooling: no type-aware rules, node globals ----------------
  {
    files: ['tools/**/*.mjs', 'eslint-rules/**/*.js', '*.config.{js,ts}'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
]);
