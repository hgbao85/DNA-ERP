/**
 * HTTP client tối giản (fetch) để FE gọi API BE thật.
 * - Base URL lấy từ env NEXT_PUBLIC_API_BASE_URL (mặc định localhost BE).
 * - Tự gắn Authorization: Bearer <access_token> (cùng key AuthContext đang lưu).
 * - Gỡ envelope chuẩn của BE: { success, data, ... } -> trả thẳng `data`.
 * - Chuẩn hoá lỗi: message có thể là string HOẶC mảng string (validation) -> gộp về 1 chuỗi.
 *
 * Chỉ dùng cho các module đã cắt sang BE (hiện: users). Phần còn lại vẫn chạy mock.
 */

// BE chạy port 3001, prefix /api, API v1 tại /api/v1.
const BASE_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE_URL) ||
  'http://localhost:3001/api/v1';

function authHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const json = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const msg = json?.message;
    throw new Error(Array.isArray(msg) ? msg.join(', ') : (msg ?? `HTTP ${res.status}`));
  }

  // BE bọc envelope { success, data } — trả thẳng data; nếu 204/không envelope thì trả nguyên.
  return (json && typeof json === 'object' && 'data' in json ? json.data : json) as T;
}

export const http = {
  get:   <T>(path: string) => request<T>('GET', path),
  post:  <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del:   <T>(path: string) => request<T>('DELETE', path),
};

export const API_BASE_URL = BASE_URL;
