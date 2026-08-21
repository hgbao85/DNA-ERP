/**
 * HTTP client (axios) dùng cho mọi module đã cắt sang BE thật.
 * - Base URL là path tương đối same-origin (/api/v1) - Next.js proxy relay sang BE thật qua
 *   rewrites() (xem next.config.mjs + biến env BACKEND_ORIGIN, server-only).
 * - Access/refresh token nằm trong cookie httpOnly (BE set qua Set-Cookie) - JS không đọc/ghi
 *   được, không còn Authorization header nào để tự gắn. `withCredentials: true` để browser
 *   đính kèm cookie same-origin vào mọi request.
 * - Response interceptor: gỡ envelope chuẩn của BE ({ success, data, ... } -> data thẳng) và
 *   ném ApiError (message + statusCode + error) thay vì lỗi axios thô.
 * - Interceptor 401: tự động gọi POST /auth/refresh (cookie refresh_token tự đính kèm, BE set
 *   cookie access_token mới qua Set-Cookie) rồi retry lại request gốc. Nhiều request 401 cùng
 *   lúc chỉ trigger đúng 1 lần refresh (dedupe qua `refreshPromise`). Refresh thất bại (refresh
 *   token cũng hết hạn/không hợp lệ) -> phát event SESSION_EXPIRED_EVENT để AuthContext tự
 *   logout và điều hướng về /login.
 */
import axios, { type AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { ApiError } from './apiError';
import { tokenStorage } from './tokenStorage';

const BASE_URL = '/api/v1';

/** Path không được retry-sau-refresh (tránh vòng lặp vô hạn khi chính auth endpoint 401). */
const NO_RETRY_PATHS = new Set(['/auth/login', '/auth/refresh', '/auth/logout']);

export const SESSION_EXPIRED_EVENT = 'auth:session-expired';

interface BeEnvelope<T = unknown> {
  success?: boolean;
  data?: T;
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

// 20s - trước đây không set (axios mặc định 0 = vô hạn), 1 BE treo (deadlock DB, container
// OOM-kill nhưng TCP chưa reset) làm mọi nút hành động chờ vô thời hạn, không có phản hồi lỗi.
const REQUEST_TIMEOUT_MS = 20_000;

const client = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: REQUEST_TIMEOUT_MS,
  withCredentials: true,
});

// Instance riêng cho chính lời gọi refresh — không gắn interceptor 401 ở trên để tránh đệ quy.
const refreshClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: REQUEST_TIMEOUT_MS,
  withCredentials: true,
});

// Gỡ envelope { success, data } ngay khi response thành công -> consumer nhận thẳng `data`.
client.interceptors.response.use((res) => {
  const body = res.data as BeEnvelope | null;
  res.data = body && typeof body === 'object' && 'data' in body ? body.data : body;
  return res;
});

function toApiError(err: AxiosError<BeEnvelope>): ApiError {
  if (err.code === 'ECONNABORTED') {
    return new ApiError('Yêu cầu quá thời gian chờ - kiểm tra kết nối mạng và thử lại', 0, 'Timeout');
  }
  const status = err.response?.status ?? 0;
  const body = err.response?.data;
  const msg = body?.message;
  const message = Array.isArray(msg) ? msg.join(', ') : (msg ?? err.message ?? `HTTP ${status}`);
  return new ApiError(message, body?.statusCode ?? status, body?.error ?? 'Error');
}

function notifySessionExpired(): void {
  tokenStorage.clearUser();
  // Best-effort: cookie access/refresh token có thể đã hết hạn tự nhiên (không phải do logout
  // chủ động) - gọi /auth/logout để BE clear cookie + thu hồi refresh token còn sót, không chặn
  // UI chờ kết quả.
  void refreshClient.post('/auth/logout').catch(() => {});
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
}

// Dedupe: nhiều request 401 đồng thời chỉ gọi /auth/refresh đúng 1 lần. Không còn trả về token
// (cookie refresh_token tự đính kèm, BE set access_token mới qua Set-Cookie) - chỉ cần biết
// refresh có thành công hay không để quyết định retry request gốc.
let refreshPromise: Promise<void> | null = null;

function refreshAccessToken(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post('/auth/refresh')
      .then(() => undefined)
      .catch((err) => {
        throw toApiError(err as AxiosError<BeEnvelope>);
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

client.interceptors.response.use(undefined, async (err: AxiosError<BeEnvelope>) => {
  const original = err.config as RetryableConfig | undefined;
  const path = original?.url ?? '';
  const status = err.response?.status;

  const canRetryAfterRefresh = status === 401 && !!original && !original._retry && !NO_RETRY_PATHS.has(path);

  if (canRetryAfterRefresh && original) {
    try {
      await refreshAccessToken();
      original._retry = true;
      return client.request(original);
    } catch {
      notifySessionExpired();
      throw toApiError(err);
    }
  }

  // Request retry sau refresh vẫn 401 (vd quyền vừa bị thu hồi) -> phiên không còn hợp lệ.
  if (status === 401 && original?._retry) {
    notifySessionExpired();
  }

  throw toApiError(err);
});

async function unwrap<T>(promise: Promise<{ data: T }>): Promise<T> {
  const res = await promise;
  return res.data;
}

export const http = {
  get: <T>(path: string, config?: AxiosRequestConfig) => unwrap<T>(client.get(path, config)),
  post: <T>(path: string, body?: unknown, config?: AxiosRequestConfig) => unwrap<T>(client.post(path, body, config)),
  put: <T>(path: string, body?: unknown, config?: AxiosRequestConfig) => unwrap<T>(client.put(path, body, config)),
  patch: <T>(path: string, body?: unknown, config?: AxiosRequestConfig) => unwrap<T>(client.patch(path, body, config)),
  del: <T>(path: string, config?: AxiosRequestConfig) => unwrap<T>(client.delete(path, config)),
};

/**
 * Gắn header Idempotency-Key: <uuid mới> vào request config - dùng cho mọi POST mà BE đọc header
 * này (bắt buộc: stock-ledger/adjust, skus/:id/approve, purchase-proposals/.../receive; khuyến
 * khích/best-effort: cutting-proposals, material-issues, production-batches, steel-issues,
 * weaving-issues - xem `idempotencyKey` ở service tương ứng bên BE). Trước đây mỗi call site tự
 * viết `{ headers: { 'Idempotency-Key': crypto.randomUUID() } }` tay - dễ quên, không có gì bắt lỗi
 * lúc build. Dùng hàm này thay vì tự viết tay ở mọi nơi cần gửi header.
 */
export function withIdempotencyKey(config?: AxiosRequestConfig): AxiosRequestConfig {
  return { ...config, headers: { ...config?.headers, 'Idempotency-Key': crypto.randomUUID() } };
}

export const API_BASE_URL = BASE_URL;
