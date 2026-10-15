/**
 * Adapter AUTH: FE ⇄ BE thật.
 * - Login bằng `username` (KHÔNG phải email). Response chỉ có { accessToken, refreshToken }.
 * - Lấy user đầy đủ qua GET /auth/me (BE không trả user trong login).
 * - Refresh/hết hạn phiên được xử lý tự động trong `core/http.ts` (interceptor 401) —
 *   file này chỉ expose các lời gọi API thô, không tự quản lý vòng đời token.
 * - normalizeUser() (utils) map roles[] (RBAC N-N) → role phẳng cho FE cũ.
 */
import { http } from './core/http';
import { tokenStorage } from './core/tokenStorage';
import type { AuthTokens, BeUserProfile, LoginCredentials } from '../types/auth';

/** LoginPage gọi hàm này. Trả { accessToken, user } để giữ nguyên AuthContext.login(token, user). */
export async function loginUser(
  credentials: LoginCredentials,
): Promise<{ accessToken: string; user: BeUserProfile }> {
  const username = credentials.username ?? credentials.email; // tương thích chỗ gọi cũ
  const tokens = await http.post<AuthTokens>('/auth/login', { username, password: credentials.password });

  // Lưu token trước để GET /auth/me có Bearer.
  tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);

  const user = await http.get<BeUserProfile>('/auth/me');
  return { accessToken: tokens.accessToken, user };
}

/** AuthContext gọi lúc khôi phục phiên (F5) — trả user thô BE, normalizeUser sẽ map. */
export async function getProfile(): Promise<BeUserProfile> {
  return http.get<BeUserProfile>('/auth/me');
}

/**
 * Thu hồi refresh token hiện tại ở BE. Best-effort: AuthContext.logout() gọi hàm này rồi
 * xoá state cục bộ ngay, không chờ/không chặn UI — nếu request lỗi (mạng, token đã hết hạn)
 * thì bỏ qua vì người dùng vẫn coi như đã đăng xuất ở phía FE.
 */
export async function logoutUser(): Promise<void> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) return;
  await http.post<void>('/auth/logout', { refreshToken });
}

/** BE trả message này (403) khi tài khoản công nhân chưa có PIN - FE chuyển sang màn "đặt PIN lần đầu". */
export const PIN_SETUP_REQUIRED = 'PIN_SETUP_REQUIRED';

/**
 * Màn đăng nhập công nhân hỏi trước khi hiện ô PIN: tài khoản đã có PIN (chỉ nhập PIN) hay chưa (phải tự đặt PIN)?
 * BE chống dò tài khoản: tên không tồn tại / không phải công nhân / ngoài mạng công ty đều trả `needsPin: false`.
 * `expired`: đang chờ đặt PIN nhưng đã quá hạn - báo QLSX cho đặt lại.
 */
export async function getPinStatus(username: string): Promise<{ needsPin: boolean; expired: boolean }> {
  return http.post<{ needsPin: boolean; expired: boolean }>('/auth/pin-status', { username });
}

/**
 * Công nhân xưởng tự đặt PIN lần đầu (2026-10-13): BE lưu PIN rồi đăng nhập luôn - trả cùng shape loginUser().
 * QLSX không biết PIN này. Lỗi (PIN dễ đoán, 2 lần không khớp, quá hạn...) là ApiError có message tiếng Việt.
 */
export async function setupWorkerPin(
  username: string,
  pin: string,
  confirmPin: string,
): Promise<{ accessToken: string; user: BeUserProfile }> {
  const tokens = await http.post<AuthTokens>('/auth/pin-setup', { username, pin, confirmPin });
  tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
  const user = await http.get<BeUserProfile>('/auth/me');
  return { accessToken: tokens.accessToken, user };
}
