/** Lấy thông điệp lỗi từ response API (mock hoặc thật), kèm fallback khi không xác định được. */
export const errMsg = (e: unknown, fallback = 'Lỗi xử lý'): string =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback
