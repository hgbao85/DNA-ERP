/**
 * Nguồn sự thật DUY NHẤT cho key lưu ở localStorage liên quan tới phiên đăng nhập BE thật.
 * CHỈ còn user_info (không nhạy cảm - tên/role hiển thị, giữ để paint nhanh lúc load trang).
 * Access/refresh token KHÔNG còn lưu ở đây từ 2026-08-21 - đã chuyển sang cookie httpOnly do
 * BE set (xem services/core/http.ts) để giảm bán kính ảnh hưởng nếu có XSS ở bất kỳ trang nào.
 */
const KEYS = {
  userInfo: 'user_info',
} as const;

const isBrowser = () => typeof window !== 'undefined';

export const tokenStorage = {
  getUser<T>(): T | null {
    if (!isBrowser()) return null;
    const raw = localStorage.getItem(KEYS.userInfo);
    return raw ? (JSON.parse(raw) as T) : null;
  },

  setUser<T>(user: T): void {
    if (!isBrowser()) return;
    localStorage.setItem(KEYS.userInfo, JSON.stringify(user));
  },

  clearUser(): void {
    if (!isBrowser()) return;
    localStorage.removeItem(KEYS.userInfo);
  },
};
