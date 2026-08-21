/**
 * Adapter AUTH: FE ⇄ BE thật.
 * - Login bằng `username` (KHÔNG phải email). Access/refresh token nằm trong cookie httpOnly
 *   BE set qua Set-Cookie (đi qua proxy same-origin, xem next.config.mjs) - FE không đọc/ghi
 *   token trực tiếp, chỉ nhận về user profile.
 * - Lấy user đầy đủ qua GET /auth/me (BE không trả user trong login).
 * - Refresh/hết hạn phiên được xử lý tự động trong `core/http.ts` (interceptor 401) —
 *   file này chỉ expose các lời gọi API thô, không tự quản lý vòng đời token.
 * - normalizeUser() (utils) map roles[] (RBAC N-N) → role phẳng cho FE cũ.
 */
import { http } from './core/http';
import type { BeUserProfile, LoginCredentials } from '../types/auth';

/** LoginPage gọi hàm này. Cookie được BE set như side-effect của POST /auth/login. */
export async function loginUser(credentials: LoginCredentials): Promise<{ user: BeUserProfile }> {
  const username = credentials.username ?? credentials.email; // tương thích chỗ gọi cũ
  await http.post('/auth/login', { username, password: credentials.password });

  const user = await http.get<BeUserProfile>('/auth/me');
  return { user };
}

/** AuthContext gọi lúc khôi phục phiên (F5) — trả user thô BE, normalizeUser sẽ map. */
export async function getProfile(): Promise<BeUserProfile> {
  return http.get<BeUserProfile>('/auth/me');
}

/**
 * Thu hồi refresh token hiện tại ở BE (cookie refresh_token tự đính kèm, BE clear cookie qua
 * Set-Cookie). Best-effort: AuthContext.logout() gọi hàm này rồi xoá state cục bộ ngay, không
 * chặn UI chờ kết quả.
 */
export async function logoutUser(): Promise<void> {
  await http.post<void>('/auth/logout');
}
