/**
 * Đồng bộ `m` (URL) -> phân hệ đang mở ở trang chính (src/app/page.tsx).
 *
 * 19/11/2026: chỉ nhận theo URL khi CHÍNH `m` vừa đổi (điều hướng từ ngoài: bấm thông báo, nút Back của trình
 * duyệt). Trước đây effect chạy cả khi phân hệ đang mở đổi: bấm nút về trang chọn phân hệ thì state đã về null
 * nhưng URL còn `m` cũ (router.replace chưa áp) -> effect kéo lại phân hệ cũ, Giám đốc kẹt trong phân hệ.
 *
 * Trả về phân hệ cần mở theo URL, hoặc `undefined` = giữ nguyên.
 */
export function moduleToAdoptFromUrl(args: {
  /** `m` lần trước đã xét (khi đã có user). */
  prevUrlModule: string | null
  urlModule: string | null
  activeModule: string | null
  isDirector: boolean
  /** Phân hệ mặc định của tài khoản (resolveDefaultModule). */
  defaultModule: string | null
}): string | undefined {
  const { prevUrlModule, urlModule, activeModule, isDirector, defaultModule } = args
  if (urlModule === prevUrlModule) return undefined
  if (!urlModule || urlModule === activeModule) return undefined
  // Chỉ tin URL khi Giám đốc (chọn phân hệ tự do) hoặc đúng phân hệ duy nhất của tài khoản thường.
  if (isDirector || urlModule === defaultModule) return urlModule
  return undefined
}
