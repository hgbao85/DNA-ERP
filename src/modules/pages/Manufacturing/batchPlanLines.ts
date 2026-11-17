/**
 * Dựng dòng bảng Hàn / Sơn / Vật tư TP của "Tổng hợp lệnh SX" từ batch-plan của 1 lệnh (tách từ ThongKePagePlan.tsx
 * 2026-11-17 để test bằng vitest).
 */

import type { BeProductionBatchPlan } from '../../../services/production-batches-api'
import type { ProcLine } from '../../../components/sanxuat/core'
import { qtyPerUnitOf } from '../../../components/sanxuat/syncSummary'
import { pieceLine } from '../Floor/progressModel'

// "Đã báo" của mảnh = đạt + chờ KCS + chưa gửi (2026-10-19, mục 47 - trước lấy `passedQty` = chỉ số ĐẠT nên Hàn/Sơn có
// 12 cái đang chờ KCS vẫn hiện 0 + "cần hàn thêm"). Cùng số với thẻ PI của tổ ở "Sản lượng xưởng" (progressModel.pieceLine).
// 2026-11-17: thêm perManh = số mảnh / 1 bộ (BE qtyPerUnit, hoặc suy từ plannedQty / plan.quantity) - trước đây bỏ trống
// nên mọi mảnh bị coi ×1 và báo "lệch bộ" sai khi định mức là ×2 / ×4.
export function mapBatchPlanToLines(plan: BeProductionBatchPlan | null): ProcLine[] {
  return (plan?.items ?? []).map(item => ({
    id: Number(item.pieceId),
    itemName: item.pieceName,
    spec: item.pieceCode,
    needQty: item.plannedQty,
    doneQty: pieceLine(item).done,
    perManh: qtyPerUnitOf(item, plan?.quantity ?? 0),
    kcs: { awaiting: item.awaitingQcQty, open: item.openQty ?? 0 },
    lastInputAt: null,
  }))
}
