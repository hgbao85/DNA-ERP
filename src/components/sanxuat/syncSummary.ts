/**
 * Logic thuần của "Đồng bộ N bộ" cho bảng mảnh Hàn / Sơn / Vật tư TP (tách từ VatTuDetailBoard, core.tsx, 2026-11-17
 * để test bằng vitest - không phụ thuộc React).
 *
 * Quy ước: mỗi ProcLine là 1 MẢNH; `perManh` = số mảnh đó cần cho 1 BỘ SKU (BomPiece.qtyPerUnit); `needQty` = số mảnh cần
 * cho cả lệnh (= perManh × số bộ); `doneQty` = số mảnh đã báo. Số bộ ráp được từ 1 mảnh = floor(done / perManh).
 *
 * Sửa 2026-11-17 (lỗi "lệch bộ" / "cần hàn thêm" / "SL/bộ ×1" sai vì trước đây không ai gán perManh nên mặc định ×1):
 *  - Số bộ của 1 mảnh CHẶN TRẦN theo định mức của chính nó: min(floor(done/per), floor(need/per)). Mảnh báo dư không làm
 *    lệch và không bù cho mảnh khác (cùng luật chặn trần ở "Đồng bộ Phôi - Hàn" và % tiến độ). MẶC ĐỊNH do Lead chọn,
 *    CHỜ NGƯỜI DÙNG XÁC NHẬN (báo dư có tính là lệch không).
 *  - Dòng nào thiếu perManh (không biết số mảnh / bộ) thì KHÔNG kết luận lệch, không bịa số "cần thêm".
 */

import type { ProcLine } from './core'

const fmtN = (n: number) => n.toLocaleString('vi-VN')

/** Có biết số mảnh / bộ của dòng này không. */
export const hasPerManh = (l: ProcLine) => !!(l.perManh && l.perManh > 0)

/** Số mảnh / bộ; mặc định 1 khi không biết (CHỈ dùng để tính số tham khảo - kết luận lệch phải kiểm hasPerManh). */
export const perManh = (l: ProcLine) => l.perManh && l.perManh > 0 ? l.perManh : 1

/** Số bộ mảnh này đủ cho, chặn trần theo định mức của chính nó. */
export const manhFromLine = (l: ProcLine) => {
  const p = perManh(l)
  return Math.min(Math.floor(l.doneQty / p), Math.floor(l.needQty / p))
}

export const dongBoOf = (lines: ProcLine[]) => lines.length ? Math.min(...lines.map(manhFromLine)) : 0

/**
 * Số mảnh / bộ của 1 dòng batch-plan: lấy `qtyPerUnit` của BE nếu có (> 0); BE cũ chưa trả thì suy ra
 * plannedQty / số bộ của lệnh khi chia hết; không suy được thì undefined (KHÔNG bịa ×1).
 */
export function qtyPerUnitOf(it: { qtyPerUnit?: number; plannedQty: number }, planQuantity: number): number | undefined {
  if (it.qtyPerUnit && it.qtyPerUnit > 0) return it.qtyPerUnit
  if (planQuantity > 0 && it.plannedQty > 0 && it.plannedQty % planQuantity === 0) return it.plannedQty / planQuantity
  return undefined
}

export interface SyncSummary {
  /**
   * 'ok' = có đủ SL/bộ, kết luận được; 'unknown' = có dòng thiếu SL/bộ (không kết luận lệch);
   * 'hidden' = người gọi tắt phần đồng bộ (showSync = false, vd xem nhiều SKU khác sản phẩm).
   */
  status: 'ok' | 'unknown' | 'hidden'
  /** Số bộ đồng bộ (mảnh thiếu nhất). 0 khi không phải 'ok'. */
  db: number
  lech: boolean
  /** Số bộ của mảnh nhiều nhất. */
  maxBo: number
  /** Số mảnh còn thiếu của 1 dòng để kịp mảnh nhiều nhất (0 khi không phải 'ok'). */
  shortOf: (l: ProcLine) => number
  /** "TAY TRÁI +10" cho từng mảnh còn thiếu. */
  needCut: string[]
}

export function syncSummary(lines: ProcLine[], opts: { showSync?: boolean } = {}): SyncSummary {
  const counts = lines.map(manhFromLine)
  const maxBo = counts.length ? Math.max(...counts) : 0
  const status: SyncSummary['status'] = opts.showSync === false ? 'hidden' : lines.every(hasPerManh) ? 'ok' : 'unknown'
  if (status !== 'ok') return { status, db: 0, lech: false, maxBo, shortOf: () => 0, needCut: [] }
  const db = counts.length ? Math.min(...counts) : 0
  const lech = lines.length >= 2 && maxBo !== db
  const shortOf = (l: ProcLine) => (maxBo - manhFromLine(l)) * perManh(l)
  const needCut = lines.filter(l => shortOf(l) > 0).map(l => `${l.itemName} +${fmtN(shortOf(l))}`)
  return { status, db, lech, maxBo, shortOf, needCut }
}

/** "Lệch bộ" = các mảnh đủ cho số bộ không bằng nhau (chỉ kết luận khi biết SL/bộ của mọi mảnh). */
export const lechOf = (lines: ProcLine[]) => syncSummary(lines).lech
