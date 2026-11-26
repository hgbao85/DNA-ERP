/**
 * Công tắc tính năng phía FE (đọc từ biến môi trường lúc build).
 * Next.js chỉ thay giá trị khi viết nguyên `process.env.NEXT_PUBLIC_...` - không gán biến env vào đối tượng trung gian.
 */

/**
 * Nút "Quét mã QR" trong app công nhân (màn /floor). Chỉ đúng chuỗi "true" mới bật; thiếu / sai chính tả / "TRUE" / "1" = TẮT.
 * Tắt: màn quét giữ như trước (không nút quét, không xin quyền camera), công nhân quét tem bằng app camera của điện thoại.
 */
export function isQrScanEnabled(): boolean {
  return process.env.NEXT_PUBLIC_QR_SCAN_ENABLED === 'true'
}
