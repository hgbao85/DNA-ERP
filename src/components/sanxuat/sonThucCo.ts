// "Khung sẵn để sơn" của màn Sơn (test tay 09/11 điểm 34d): số mảnh Hàn đã được KCS duyệt ĐẠT
// trừ số Sơn đã báo (lưu đợt + chờ KCS + đã đạt). CHỈ HIỂN THỊ - không chặn Sơn báo sản lượng.
import type { BeProductionBatchPlan } from '../../services/production-batches-api'

export const sonThucCoKey = (productionOrderId: string, pieceId: string) => `${productionOrderId}:${pieceId}`

/** Không có số Hàn (lỗi tải / mảnh không có bên Hàn) → undefined. Không âm. */
export function tinhKhungSanDeSon(
  hanPassedQty: number | undefined,
  son: { openQty?: number; awaitingQcQty: number; passedQty: number },
): number | undefined {
  if (hanPassedQty === undefined) return undefined
  const daBao = (son.openQty ?? 0) + son.awaitingQcQty + son.passedQty
  return Math.max(0, hanPassedQty - daBao)
}

/** Số Hàn đã đạt KCS (passedQty của kế hoạch Hàn) theo khoá `${productionOrderId}:${pieceId}`.
 *  Lỗi từng lệnh (403, mạng) → bỏ lệnh đó, không làm hỏng màn. */
export async function loadHanPassedByPiece(
  orderIds: string[],
  fetcher: (orderId: string) => Promise<Pick<BeProductionBatchPlan, 'items'>>,
): Promise<Map<string, number>> {
  const m = new Map<string, number>()
  await Promise.all([...new Set(orderIds.filter(Boolean))].map(async id => {
    try {
      const plan = await fetcher(id)
      for (const it of plan.items) m.set(sonThucCoKey(id, it.pieceId), it.passedQty)
    } catch { /* bỏ qua */ }
  }))
  return m
}
