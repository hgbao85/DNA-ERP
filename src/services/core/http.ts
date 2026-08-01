/**
 * HTTP client (axios) dùng cho mọi module đã cắt sang BE thật.
 * - Base URL lấy từ env NEXT_PUBLIC_API_BASE_URL (mặc định localhost BE).
 * - Request interceptor: tự gắn Authorization: Bearer <access_token> (qua tokenStorage).
 * - Response interceptor: gỡ envelope chuẩn của BE ({ success, data, ... } -> data thẳng) và
 *   ném ApiError (message + statusCode + error) thay vì lỗi axios thô.
 * - Interceptor 401: tự động gọi POST /auth/refresh 1 lần rồi retry lại request gốc.
 *   Nhiều request 401 cùng lúc chỉ trigger đúng 1 lần refresh (dedupe qua `refreshPromise`).
 *   Refresh thất bại (refresh token cũng hết hạn/không hợp lệ) -> xoá token + phát event
 *   SESSION_EXPIRED_EVENT để AuthContext tự logout và điều hướng về /login.
 */
import axios, { type AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { ApiError } from './apiError';
import { tokenStorage } from './tokenStorage';

const BASE_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE_URL) ||
  'http://localhost:3001/api/v1';

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

const client = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Instance riêng cho chính lời gọi refresh — không gắn interceptor 401 ở trên để tránh đệ quy.
const refreshClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Gỡ envelope { success, data } ngay khi response thành công -> consumer nhận thẳng `data`.
client.interceptors.response.use((res) => {
  const body = res.data as BeEnvelope | null;
  res.data = body && typeof body === 'object' && 'data' in body ? body.data : body;
  return res;
});

function toApiError(err: AxiosError<BeEnvelope>): ApiError {
  const status = err.response?.status ?? 0;
  const body = err.response?.data;
  const msg = body?.message;
  const message = Array.isArray(msg) ? msg.join(', ') : (msg ?? err.message ?? `HTTP ${status}`);
  return new ApiError(message, body?.statusCode ?? status, body?.error ?? 'Error');
}

function notifySessionExpired(): void {
  tokenStorage.clear();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
}

// Dedupe: nhiều request 401 đồng thời chỉ gọi /auth/refresh đúng 1 lần.
let refreshPromise: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = tokenStorage.getRefreshToken();
      if (!refreshToken) throw new ApiError('Phiên đăng nhập đã hết hạn', 401, 'Unauthorized');

      try {
        const res = await refreshClient.post<BeEnvelope<{ accessToken: string; refreshToken: string }>>(
          '/auth/refresh',
          { refreshToken },
        );
        const tokens = (res.data && typeof res.data === 'object' && 'data' in res.data ? res.data.data : res.data) as {
          accessToken: string;
          refreshToken: string;
        };
        tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
        return tokens.accessToken;
      } catch (err) {
        throw toApiError(err as AxiosError<BeEnvelope>);
      }
    })().finally(() => {
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

export const API_BASE_URL = BASE_URL;
