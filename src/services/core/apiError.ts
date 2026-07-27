/**
 * Lỗi chuẩn hoá cho mọi request tới BE thật.
 * Giữ nguyên `statusCode`/`error` mà `AllExceptionsFilter` (BE) trả về, để tầng gọi
 * (vd interceptor refresh token trong core/http.ts) phân biệt được 401 (cần refresh)
 * với lỗi nghiệp vụ khác (400/409/...) mà không phải parse lại message.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly error: string;

  constructor(message: string, statusCode: number, error: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.error = error;
  }

  get isUnauthorized(): boolean {
    return this.statusCode === 401;
  }
}
