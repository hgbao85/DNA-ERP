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
  // Proxy same-origin sang BE thật (Next.js server relay, browser không bao giờ gọi thẳng
  // BACKEND_ORIGIN) - bắt buộc để cookie httpOnly access_token/refresh_token hoạt động đúng:
  // FE (Vercel) và BE (Render) khác registrable domain, cookie cross-site SameSite=None bị
  // Safari/iOS (ITP) chặn không ổn định. Route qua proxy này thì browser chỉ thấy 1 origin
  // (chính domain FE) nên Set-Cookie luôn same-site, chạy ổn định mọi trình duyệt.
  async rewrites() {
    const backendOrigin = process.env.BACKEND_ORIGIN || 'http://localhost:3001';
    return [{ source: '/api/v1/:path*', destination: `${backendOrigin}/api/v1/:path*` }];
  },
};

export default nextConfig;
