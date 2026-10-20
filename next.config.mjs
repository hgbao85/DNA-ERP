/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Bài thử điện thoại (playwright.floor.config.ts) build + chạy bản FE riêng ở cổng 3100: đặt NEXT_DIST_DIR=.next-e2e để không ghi đè `.next`
  // của `npm run dev` đang chạy. Không đặt = `.next` như cũ (build/deploy không đổi).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  typescript: { tsconfigPath: process.env.NEXT_DIST_DIR ? 'tsconfig.e2e.json' : 'tsconfig.json' },
  // /flowdonhang, /flowdinhmuc đọc thẳng file trong docs/ lúc request (xem
  // src/app/_lib/serveDocPage.ts) - docs/ không nằm trong public/ nên phải khai báo tường minh
  // để build tracing (deploy dạng serverless) đóng gói kèm theo, không bị cắt khỏi bundle.
  outputFileTracingIncludes: {
    '/flowdonhang': ['./docs/**'],
    '/flowdinhmuc': ['./docs/**'],
  },
  // CHỈ chế độ dev: thử màn công nhân trên điện thoại qua Wi-Fi nội bộ (http://<IP máy dev>:3000). Next 16 chặn
  // tài nguyên dev (HMR, một số script) từ nguồn khác localhost -> trang kẹt ở "Đang tải…". Khai IP/tên máy dev
  // ở .env: DEV_ALLOWED_ORIGINS=192.168.1.207 (nhiều giá trị ngăn bằng dấu phẩy). Để trống = như cũ. Không ảnh hưởng build/deploy.
  allowedDevOrigins: (process.env.DEV_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};

export default nextConfig;
