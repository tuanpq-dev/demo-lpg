import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke test trình duyệt (`npm run test:e2e`): chạy trên bản BUILD (`vite preview`, `VITE_AUTH=off` – không cần backend).
 * CI: job `e2e` trong `.gitlab-ci.yml` (image Playwright cùng phiên bản `@playwright/test` – đổi phiên bản thì đổi cả hai).
 * Máy dev chưa cài trình duyệt Playwright: `PW_CHROMIUM_PATH=/usr/bin/brave-browser npm run test:e2e` (hoặc Chrome/Edge),
 * hoặc `npx playwright install chromium`.
 */
const PORT = 4317;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['junit', { outputFile: 'e2e-results/junit.xml' }]] : 'list',
  outputDir: 'e2e-results/artifacts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    reducedMotion: 'reduce',
    launchOptions: {
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
      // WebGL phần mềm cho bản đồ 3D / Editor khi chạy headless không GPU.
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1565, height: 900 } } }],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
