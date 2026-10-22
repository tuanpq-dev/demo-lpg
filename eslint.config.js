import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** ESLint 9 (flat config): TypeScript + React hooks + accessibility (jsx-a11y, mức recommended). `npm run lint`. */
export default tseslint.config(
  { ignores: ['**/dist', '**/coverage', 'scratch', '**/node_modules', 'public'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, jsxA11y.flatConfigs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Biến bắt đầu bằng "_" = cố ý bỏ (destructuring loại khoá).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
      // Cấm tabindex > 0 (thứ tự Tab phải theo DOM).
      'jsx-a11y/tabindex-no-positive': 'error',
      // Vùng cuộn/bản đồ (role="region" có tên) được phép focus để dùng bàn phím (WCAG 2.1.1, axe scrollable-region-focusable).
      'jsx-a11y/no-noninteractive-tabindex': ['error', { roles: ['tabpanel', 'region'], tags: [] }],
      // R3F: thuộc tính three (args, position…) trên phần tử JSX viết thường không phải DOM.
      'react/no-unknown-property': 'off',
    },
  },
);
