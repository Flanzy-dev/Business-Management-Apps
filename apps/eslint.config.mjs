// A small, deliberate rule set — not "recommended + everything". The codebase
// already carries `eslint-disable react-hooks/exhaustive-deps` comments, each
// with a reason; those only mean something if the rule is actually running.
// What is enforced here is what finds real bugs: hooks called conditionally,
// effects and memos with a stale dependency list, and dead variables.
//
// Not type-aware (no parserOptions.project): `npx tsc --noEmit` already does
// the type work, and a type-aware lint pass is several times slower.
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: ['dist/**', 'dist-electron/**', 'dist-server/**', 'release/**', 'node_modules/**', 'coverage/**', 'scripts/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    linterOptions: {
      // A disable comment for a problem that no longer exists hides the next one.
      reportUnusedDisableDirectives: 'warn',
    },
    plugins: {
      'react-hooks': reactHooks,
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      // A hook called conditionally, or after an early return, breaks React.
      'react-hooks/rules-of-hooks': 'error',
      // A stale dependency list is the classic "works until it doesn't" bug.
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-debugger': 'error',
    },
  }
)
