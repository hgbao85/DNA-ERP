/** Lấy thông điệp lỗi từ Error/response API, kèm fallback khi không xác định được. */
export const errMsg = (e: unknown, fallback = 'Lỗi xử lý'): string =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error
  ?? (e instanceof Error ? e.message : undefined)
  ?? fallback
