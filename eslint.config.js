import js from '@eslint/js';
import eslintComments from '@eslint-community/eslint-plugin-eslint-comments';
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
/** Định dạng số (CLAUDE.md mục 5): một quy ước chung `formatNumber` (src/lib/number.ts) – chặn định dạng rải rác. */
const NUMBER_FORMAT_RULES = [
  {
    selector: "CallExpression[callee.property.name='toLocaleString'][arguments.0.value=/^(en|vi)/]:not([callee.object.type='NewExpression'])",
    message: 'Định dạng số dùng `formatNumber` (src/lib/number.ts) – quy ước chung 12,450.5.',
  },
  {
    selector: "CallExpression[callee.property.name='replace'][arguments.0.value='.'][arguments.1.value=',']",
    message: 'Không đổi dấu thập phân sang phẩy – quy ước chung dùng dấu chấm (`formatNumber`).',
  },
];
/** Bộ luật màu chữ đỏ. */
const DANGER_TEXT_RULES = [
  ...redRule('/(^|[\\s:"\'])text-danger(?![\\w/-])/', RED.bare),
  ...redRule('/(^|[\\s:"\'])text-danger-strong(?![\\w/-])/', RED.strong),
  ...redRule('/(^|[\\s:"\'])text-danger(-strong|-text|-solid)?\\/\\d+/', RED.alpha),
];

/**
 * ESLint 9 (flat config): TypeScript (có rule dựa trên type) + React hooks + accessibility (jsx-a11y) + kiểm comment
 * eslint-disable. Format do Prettier lo (`npm run format`), ESLint không có rule định dạng. `npm run lint`.
 */
export default tseslint.config(
  { ignores: ['**/dist', '**/coverage', 'scratch', '**/node_modules', 'public'] },
  // `eslint-disable` không còn tác dụng → báo lỗi (tránh comment chết).
  { linterOptions: { reportUnusedDisableDirectives: 'error' } },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, jsxA11y.flatConfigs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
      // Rule dựa trên type (no-floating-promises, no-misused-promises…) đọc tsconfig gần nhất của từng file.
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'react-hooks': reactHooks, '@eslint-community/eslint-comments': eslintComments },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Biến bắt đầu bằng "_" = cố ý bỏ (destructuring loại khoá).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
      // Promise: không bỏ quên (await / `void`), không truyền hàm async vào chỗ chờ hàm trả void (onClick, onSubmit…).
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      // `!` / `as` thừa (TS đã biết kiểu) – giữ assertion chỉ ở chỗ thật sự cần.
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      // Import kiểu ghi `type` (kiểu inline: `import { X, type Y }`).
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      // Log gỡ lỗi không lọt vào code; console.warn/error (chỉ trong nhánh DEV) được phép.
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
      // Mỗi eslint-disable phải ghi lý do sau `--`.
      '@eslint-community/eslint-comments/require-description': 'error',
      '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
      // Kích thước / độ phức tạp: mức cảnh báo – file/hàm đang vượt là backlog tách nhỏ, code mới không được phình thêm.
      'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 200, skipBlankLines: true, skipComments: true }],
      complexity: ['warn', 20],
      // Cấm tabindex > 0 (thứ tự Tab phải theo DOM).
      'jsx-a11y/tabindex-no-positive': 'error',
      // Vùng cuộn/bản đồ (role="region" có tên) được phép focus để dùng bàn phím (WCAG 2.1.1, axe scrollable-region-focusable).
      'jsx-a11y/no-noninteractive-tabindex': ['error', { roles: ['tabpanel', 'region'], tags: [] }],
      // R3F: thuộc tính three (args, position…) trên phần tử JSX viết thường không phải DOM.
      'react/no-unknown-property': 'off',
      // Chữ đỏ (CLAUDE.md mục 5 – mục đích 4 token đỏ):
      //  - chữ thường dùng `text-danger-text` (#DC6D79, ≥ 4.5:1);
      //  - `text-danger` trần: chỉ cho ICON tô bằng currentColor;
      //  - `text-danger-strong`: chỉ cho CHỮ LỚN WCAG (≥ 24px thường / ≥ 18.66px đậm – số KPI, đồng hồ quá hạn) hoặc icon;
      //  - cấm độ mờ trên chữ đỏ (`text-danger*/NN`) – thứ bậc dùng cỡ/độ đậm/gạch chân thay vì làm mờ.
      // Ngoại lệ phải ghi rõ: `// eslint-disable-next-line no-restricted-syntax -- icon` / `-- chữ lớn 28px đậm`.
      'no-restricted-syntax': ['error', ...DANGER_TEXT_RULES, ...NUMBER_FORMAT_RULES],
    },
  },
  // Dữ liệu mẫu (src/mocks) là bảng dữ liệu tạm – sẽ thay bằng API; giới hạn số dòng chỉ áp cho code.
  { files: ['src/mocks/**/*.{ts,tsx}'], rules: { 'max-lines': 'off' } },
  // Phân lớp (CLAUDE.md mục 5 "Dữ liệu"): logic, component, nối router và trang KHÔNG import dữ liệu mẫu – đọc qua
  // `src/data/*` (lớp dữ liệu, chỗ thay API); kiểu dữ liệu ở `src/features/<miền>/types.ts`.
  {
    files: [
      'src/features/**/*.{ts,tsx}',
      'src/components/**/*.{ts,tsx}',
      'src/app/**/*.{ts,tsx}',
      'src/lib/**/*.{ts,tsx}',
      'src/hooks/**/*.{ts,tsx}',
      'src/pages/**/*.{ts,tsx}',
    ],
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
);
