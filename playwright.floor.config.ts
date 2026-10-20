import { defineConfig, devices } from '@playwright/test'
import { API_BASE, FE_ORIGIN, FE_PORT, LAN_HOST } from './e2e/floor/env'

/**
 * Bài thử ĐIỆN THOẠI công nhân (QR tại máy): mở app công nhân trên 3 loại điện thoại giả lập, chạy cả luồng đăng nhập PIN → báo → xác nhận,
 * mất mạng / mất phản hồi / 429 / lỗi 500, ngoài mạng công ty, khoá PIN, kích thước nút, axe. Changelog BE mục 42.
 *
 * KHÔNG chạy với DB thật: bài tạo công nhân, báo sản lượng, nhận sắt. Chạy trên BẢN SAO DB dev + một BE riêng cổng 3002:
 *   1. docker exec dna-erp-be-postgres-1 sh -c "createdb -U erp_user dna_erp_e2e && pg_dump -U erp_user -Fc dna_erp | pg_restore -U erp_user -d dna_erp_e2e --no-owner"
 *   2. UPDATE system_config SET "floorAllowedIps" = ARRAY['10.88.0.0/16'];          -- trong bản sao
 *   3. (trong D:\DNA-ERP-BE)  DATABASE_URL=<bản sao> PORT=3002 TRUST_PROXY_HOPS=1 CORS_ORIGIN=http://<IP Wi-Fi>:3100 node dist/main.js
 *   4. npx playwright install chromium webkit        -- lần đầu
 *   5. npx playwright test -c playwright.floor.config.ts [--project=pixel7]
 * FE do Playwright tự build + chạy ở cổng 3100 (thư mục build riêng .next-e2e, không đụng `npm run dev` đang chạy). Sửa code FE thì tắt
 * server cổng 3100 đang chạy để nó build lại (reuseExistingServer).
 */
export default defineConfig({
  testDir: './e2e/floor',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 1, // 1 lần thử lại: lần hỏng đơn lẻ (vd trang trắng khi máy chủ mới build xong) hiện là "flaky" trong báo cáo thay vì làm hỏng cả lần chạy
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-floor' }], ['json', { outputFile: 'test-results-floor/results.json' }]],
  outputDir: 'test-results-floor',
  use: {
    baseURL: FE_ORIGIN,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
  },
  projects: [
    // Android đời mới (Chrome)
    { name: 'pixel7', use: { ...devices['Pixel 7'] } },
    // iPhone (WebKit ≈ Safari iOS; không phải Safari thật nhưng cùng bộ máy hiển thị)
    { name: 'iphone14', use: { ...devices['iPhone 14'] } },
    // Android rẻ tiền ngoài xưởng: Moto G4 + CPU chậm gấp 4 + mạng chậm (chỉ Chromium làm được - xem fixtures.ts)
    { name: 'android-yeu', use: { ...devices['Moto G4'] }, metadata: { weak: true } },
  ],
  webServer: {
    command: 'npx next build && npx next start -p ' + FE_PORT + ' -H 0.0.0.0',
    url: `${FE_ORIGIN}/login`,
    reuseExistingServer: true,
    timeout: 360_000,
    env: {
      NEXT_PUBLIC_API_BASE_URL: API_BASE,
      NEXT_DIST_DIR: '.next-e2e',
      DEV_ALLOWED_ORIGINS: LAN_HOST,
    },
  },
})
