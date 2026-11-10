import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const RED = {
  bare: 'Chữ đỏ dùng `text-danger-text` (tương phản AA). `text-danger` chỉ cho icon – ghi eslint-disable-next-line kèm lý do.',
  strong:
    '`text-danger-strong` chỉ cho CHỮ LỚN (≥ 24px / ≥ 18.66px đậm) hoặc icon – ghi eslint-disable-next-line kèm lý do; chữ thường dùng `text-danger-text`.',
  alpha: 'Không làm mờ chữ đỏ (`text-danger*/NN` dưới 4.5:1) – dùng `text-danger-text` và tạo thứ bậc bằng cỡ/độ đậm/gạch chân.',
};
const redRule = (re, message) => [
  { selector: `Literal[value=${re}]`, message },
  { selector: `TemplateElement[value.raw=${re}]`, message },
];
/** Bộ luật màu chữ đỏ (export để test dùng lại). */
export const DANGER_TEXT_RULES = [
  ...redRule('/(^|[\\s:"\'])text-danger(?![\\w/-])/', RED.bare),
  ...redRule('/(^|[\\s:"\'])text-danger-strong(?![\\w/-])/', RED.strong),
  ...redRule('/(^|[\\s:"\'])text-danger(-strong|-text|-solid)?\\/\\d+/', RED.alpha),
];

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
      // Chữ đỏ (CLAUDE.md mục 3/7, GUIDE 4g – mục đích 4 token đỏ):
      //  - chữ thường dùng `text-danger-text` (#DC6D79, ≥ 4.5:1);
      //  - `text-danger` trần: chỉ cho ICON tô bằng currentColor;
      //  - `text-danger-strong`: chỉ cho CHỮ LỚN WCAG (≥ 24px thường / ≥ 18.66px đậm – số KPI, đồng hồ quá hạn) hoặc icon;
      //  - cấm độ mờ trên chữ đỏ (`text-danger*/NN`) – thứ bậc dùng cỡ/độ đậm/gạch chân thay vì làm mờ.
      // Ngoại lệ phải ghi rõ: `// eslint-disable-next-line no-restricted-syntax -- icon` / `-- chữ lớn 28px đậm`.
      // Test: src/test/colorRules.test.ts.
      'no-restricted-syntax': ['error', ...DANGER_TEXT_RULES],
    },
  },
  // Phân lớp (CLAUDE.md mục 5 "Dữ liệu"): logic, component, nối router và trang KHÔNG import dữ liệu mẫu – đọc qua
  // `src/data/*` (lớp dữ liệu, chỗ thay API); kiểu dữ liệu ở `src/features/<miền>/types.ts`. Ngoại lệ: playground
  // (trưng bày component với dữ liệu mẫu) và test.
  {
    files: [
      'src/features/**/*.{ts,tsx}',
      'src/components/**/*.{ts,tsx}',
      'src/app/**/*.{ts,tsx}',
      'src/lib/**/*.{ts,tsx}',
      'src/pages/**/*.{ts,tsx}',
    ],
    ignores: ['src/pages/playground/**', '**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/mocks', '@/mocks/*'],
              message: 'Không import src/mocks ngoài lớp dữ liệu – đọc qua src/data/*, kiểu ở src/features/<miền>/types.ts.',
            },
          ],
        },
      ],
    },
  },
  // Test được nhắc tới các class bị cấm (kiểm tra class / mã mẫu cho chính luật này). Fixture của colorRules.test.ts
  // lint với tên file thường (không phải *.test.*) nên luật vẫn áp dụng ở đó.
  { files: ['**/*.test.{ts,tsx}'], rules: { 'no-restricted-syntax': 'off' } },
);
