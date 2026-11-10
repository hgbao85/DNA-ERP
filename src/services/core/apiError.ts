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

/**
 * Câu tiếng Việt khi phản hồi KHÔNG có câu lỗi của BE: mất mạng (status 0), proxy/CDN trả trang lỗi HTML
 * (502/503 lúc BE khởi động lại)... Trước đây rơi về câu tiếng Anh của axios ("Network Error",
 * "Request failed with status code 502").
 */
export function fallbackErrorMessage(status: number): string {
  if (status === 0) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Đăng nhập lại.';
  if (status === 403) return 'Tài khoản không có quyền làm việc này';
  if (status === 404) return 'Không tìm thấy dữ liệu';
  if (status === 413) return 'Dữ liệu hoặc file gửi lên quá lớn';
  if (status === 429) return 'Thao tác quá nhanh. Đợi khoảng 1 phút rồi thử lại.';
  if (status >= 500) return 'Hệ thống đang lỗi. Đợi một lát rồi thử lại; vẫn lỗi thì báo quản trị hệ thống.';
  return `Yêu cầu không thành công (mã ${status}). Thử lại; vẫn lỗi thì báo quản trị hệ thống.`;
}

/** Câu BE trả khi sai tên đăng nhập/mật khẩu: bản cũ tiếng Anh + bản tiếng Việt (FE và BE có thể không lên cùng lúc). */
const INVALID_CREDENTIAL_MESSAGES = new Set(['Invalid credentials', 'Tên đăng nhập hoặc mật khẩu không đúng']);

export function isInvalidCredentials(e: unknown): boolean {
  return e instanceof ApiError && INVALID_CREDENTIAL_MESSAGES.has(e.message);
}
