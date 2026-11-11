import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

/**
 * Test (`npm test`): CHỈ logic thuần có rủi ro nghiệp vụ / an toàn (quy trình trạng thái, quyền, điều kiện ký, mất tín
 * hiệu, giờ nhà máy, API client, store) – môi trường node, không test giao diện (kiểm bằng smoke test trình duyệt).
 * Đặt test cạnh module: `foo.ts` → `foo.test.ts`. Danh sách + lý do: docs/guide/app-structure.md "Test".
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'packages/shared/src/**/*.test.ts'],
      restoreMocks: true,
    },
  }),
);
