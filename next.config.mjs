/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // /flowdonhang, /flowdinhmuc đọc thẳng file trong docs/ lúc request (xem
  // src/app/_lib/serveDocPage.ts) - docs/ không nằm trong public/ nên phải khai báo tường minh
  // để build tracing (deploy dạng serverless) đóng gói kèm theo, không bị cắt khỏi bundle.
  outputFileTracingIncludes: {
    '/flowdonhang': ['./docs/**'],
    '/flowdinhmuc': ['./docs/**'],
  },
};

export default nextConfig;
