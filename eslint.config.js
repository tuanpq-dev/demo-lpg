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
 * Phân lớp (CLAUDE.md mục 3, 5): phụ thuộc chỉ đi XUỐNG
 *   pages → app → data → features → api
 *   pages / app → scene3d → components → hooks → lib ; scene3d → features   (vẽ 3D: R3F, tải lười)
 *   mocks chỉ đọc từ data
 * - Bắt cả alias `@/x` lẫn đường tương đối vượt lớp (`../../x`) – không có thư mục con nào trùng tên lớp.
 * - `@typescript-eslint/no-restricted-imports` chỉ dùng chỗ cần `allowTypeImports` (component đọc KIỂU miền; data dựng
 *   view-model theo KIỂU props của component).
 * Flat config GHI ĐÈ (không gộp) cùng một rule khi nhiều khối khớp một file → mỗi lớp khai đủ trong MỘT khối.
 */
const ban = (dir, message, extra = {}) => ({ regex: `^(@/|(\\.\\./)+)${dir}(/|$)`, message, ...extra });
const MOCKS = ban('mocks', 'Không import src/mocks ngoài lớp dữ liệu – đọc qua src/data/*, kiểu ở src/features/<miền>/types.ts.');
const LAYER_MSG = {
  lib: 'src/lib là tiện ích thuần ở tầng thấp nhất – không phụ thuộc hook, component, dữ liệu hay trang.',
  hooks: 'src/hooks là hook dùng chung – chỉ dựa trên src/lib, không phụ thuộc component, logic miền, dữ liệu hay trang.',
  api: 'src/api là tầng gọi backend – không phụ thuộc UI, lớp dữ liệu hay trang.',
  features:
    'src/features là logic miền thuần – không phụ thuộc component / hook React, lớp vẽ 3D, lớp dữ liệu, nối router hay trang (phần vẽ 3D ở src/scene3d).',
  componentsUp: 'Component thuần – nhận dữ liệu qua props, không đọc lớp dữ liệu, nối router, trang, API hay lớp vẽ 3D (src/scene3d).',
  componentsFeatures: 'Component UI chỉ import KIỂU từ src/features (`import type`); component nghiệp vụ đặt trong components/domain/.',
  dataUp: 'src/data là lớp dữ liệu – không phụ thuộc lớp vẽ 3D, nối router hay trang.',
  scene3d: 'src/scene3d là lớp vẽ 3D – nhận cảnh + số liệu qua props, không đọc lớp dữ liệu, API, nối router hay trang.',
  dataUi: 'src/data chỉ import KIỂU props từ component (`import type`, dựng view-model) – nhãn / hằng số nghiệp vụ đặt ở src/features/<miền>.',
  app: 'src/app nối router với dữ liệu – không import trang (trang import app, không ngược lại).',
};
const restrict = (patterns) => ['error', { patterns }];
const bans = (dirs, message) => dirs.map((d) => ban(d, message));
const LAYER_RULES = [
  {
    files: ['src/lib/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrict([
        MOCKS,
        ...bans(['hooks', 'components', 'features', 'data', 'app', 'pages', 'api', 'scene3d'], LAYER_MSG.lib),
      ]),
    },
  },
  {
    files: ['src/hooks/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrict([MOCKS, ...bans(['components', 'features', 'data', 'app', 'pages', 'api', 'scene3d'], LAYER_MSG.hooks)]),
    },
  },
  {
    files: ['src/api/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': restrict([MOCKS, ...bans(['hooks', 'components', 'data', 'app', 'pages', 'scene3d'], LAYER_MSG.api)]) },
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': restrict([MOCKS, ...bans(['components', 'hooks', 'data', 'app', 'pages', 'scene3d'], LAYER_MSG.features)]) },
  },
  {
    files: ['src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrict([MOCKS, ...bans(['data', 'app', 'pages', 'api', 'scene3d'], LAYER_MSG.componentsUp)]),
      '@typescript-eslint/no-restricted-imports': restrict([ban('features', LAYER_MSG.componentsFeatures, { allowTypeImports: true })]),
    },
  },
  // Component nghiệp vụ (components/domain) được dùng hằng số / hàm thuần của src/features (một chiều).
  { files: ['src/components/domain/**/*.{ts,tsx}'], rules: { '@typescript-eslint/no-restricted-imports': 'off' } },
  {
    files: ['src/scene3d/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': restrict([MOCKS, ...bans(['data', 'api', 'app', 'pages'], LAYER_MSG.scene3d)]) },
  },
  {
    files: ['src/data/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrict(bans(['app', 'pages', 'scene3d'], LAYER_MSG.dataUp)),
      '@typescript-eslint/no-restricted-imports': restrict([ban('components', LAYER_MSG.dataUi, { allowTypeImports: true })]),
    },
  },
  {
    files: ['src/app/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': restrict([MOCKS, ban('pages', LAYER_MSG.app)]) },
  },
  { files: ['src/pages/**/*.{ts,tsx}'], rules: { 'no-restricted-imports': restrict([MOCKS]) } },
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
  ...LAYER_RULES,
);
