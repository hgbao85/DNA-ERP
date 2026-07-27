/**
 * Adapter AUTH: FE ⇄ BE thật.
 * - Login bằng `username` (KHÔNG phải email). Response chỉ có { accessToken, refreshToken }.
 * - Lấy user đầy đủ qua GET /auth/me (BE không trả user trong login).
 * - normalizeUser() (utils) map roles[] (RBAC N-N) → role phẳng cho FE cũ.
 */
import { http } from './http';

interface LoginTokens { accessToken: string; refreshToken: string }

/** LoginPage gọi hàm này. Trả { accessToken, user } để giữ nguyên AuthContext.login(token, user). */
export async function loginUser(
  credentials: { username?: string; email?: string; password: string },
): Promise<{ accessToken: string; user: unknown }> {
  const username = credentials.username ?? credentials.email; // tương thích chỗ gọi cũ
  const tokens = await http.post<LoginTokens>('/auth/login', { username, password: credentials.password });

  // Lưu token trước để GET /auth/me có Bearer (http.ts đọc từ localStorage).
  if (typeof window !== 'undefined') {
    localStorage.setItem('access_token', tokens.accessToken);
    localStorage.setItem('refresh_token', tokens.refreshToken);
  }

  const user = await http.get('/auth/me');
  return { accessToken: tokens.accessToken, user };
}

/** AuthContext gọi lúc khôi phục phiên (F5) — trả user thô BE, normalizeUser sẽ map. */
export async function getProfile(): Promise<unknown> {
  return http.get('/auth/me');
}
