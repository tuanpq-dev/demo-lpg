import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

/**
 * Test: `npm test` (watch) · `npm run test:run` (một lần, CI) · `npm run test:coverage`.
 * - Test thuần (`*.test.ts`): môi trường node.
 * - Test component (`*.test.tsx`): khai báo `// @vitest-environment jsdom` ở đầu file.
 * Đặt test cạnh module: `foo.ts` → `foo.test.ts`.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['src/test/setup.ts'],
      restoreMocks: true,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        // Chỉ thư mục logic – không đặt mục tiêu % cho UI.
        include: ['src/features/**/*.ts', 'src/data/**/*.ts', 'src/lib/**/*.ts', 'src/app/useTableFilters.ts'],
        exclude: ['**/*.test.ts', 'src/test/**'],
      },
    },
  }),
);
