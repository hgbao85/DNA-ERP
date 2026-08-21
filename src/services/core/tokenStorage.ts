/**
 * Nguồn sự thật DUY NHẤT cho các key lưu ở localStorage liên quan tới phiên đăng nhập BE thật.
 * Trước đây 'access_token' / 'refresh_token' / 'user_info' bị lặp lại dạng string literal ở
 * nhiều file (http.ts, auth-api.ts, AuthContext.tsx, auth-guard.ts) — gộp về đây để đổi 1 chỗ.
 */
const KEYS = {
  accessToken: 'access_token',
  refreshToken: 'refresh_token',
  userInfo: 'user_info',
} as const;

const isBrowser = () => typeof window !== 'undefined';

export const tokenStorage = {
  getAccessToken(): string | null {
    return isBrowser() ? localStorage.getItem(KEYS.accessToken) : null;
  },

  getRefreshToken(): string | null {
    return isBrowser() ? localStorage.getItem(KEYS.refreshToken) : null;
  },

  setTokens(accessToken: string, refreshToken: string): void {
    if (!isBrowser()) return;
    localStorage.setItem(KEYS.accessToken, accessToken);
    localStorage.setItem(KEYS.refreshToken, refreshToken);
  },

  setAccessToken(accessToken: string): void {
    if (!isBrowser()) return;
    localStorage.setItem(KEYS.accessToken, accessToken);
  },

  getUser<T>(): T | null {
    if (!isBrowser()) return null;
    const raw = localStorage.getItem(KEYS.userInfo);
    return raw ? (JSON.parse(raw) as T) : null;
  },

  setUser<T>(user: T): void {
    if (!isBrowser()) return;
    localStorage.setItem(KEYS.userInfo, JSON.stringify(user));
  },

  clear(): void {
    if (!isBrowser()) return;
    localStorage.removeItem(KEYS.accessToken);
    localStorage.removeItem(KEYS.refreshToken);
    localStorage.removeItem(KEYS.userInfo);
  },
};
