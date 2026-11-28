/** Đầu kỳ ngày bật giao nhận (câu 2, 28/11/2026) - hàm thuần cho ô "Đếm được" khung chờ Sơn (OpeningWaitingSection). */

/** Số khung nhập: nguyên dương; trống / 0 / không phải số -> null. */
export function parseOpeningQty(text: string): number | null {
  const t = text.trim()
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  return n > 0 ? n : null
}

/** Câu lỗi cho nút Lưu (null = lưu được). */
export function openingWaitingError(text: string): string | null {
  if (!text.trim()) return 'Nhập số khung đếm được'
  return parseOpeningQty(text) == null ? 'Số khung phải là số nguyên lớn hơn 0' : null
}

export const openingRowKey = (r: { productionOrderId: string; pieceId: string }): string =>
  `${r.productionOrderId}:${r.pieceId}`
