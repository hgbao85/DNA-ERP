import { defineConfig, devices } from '@playwright/test';

// Repo BE nằm ngoài checkout FE này (D:\DNA-ERP-BE) — override qua E2E_BACKEND_DIR nếu chạy trên
// máy khác. reuseExistingServer: true trong cả 3 entry nên nếu BE/FE/solver-stub đã chạy sẵn
// (dev thường ngày), Playwright dùng luôn, không khởi động lại.
const backendDir = process.env.E2E_BACKEND_DIR ?? 'D:\\DNA-ERP-BE';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'node e2e/solver-stub.js',
      url: 'http://localhost:18080/',
      reuseExistingServer: true,
      timeout: 15_000,
    },
    {
      command: 'pnpm start:dev',
      cwd: backendDir,
      url: 'http://localhost:3001/api/health',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
