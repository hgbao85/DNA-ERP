/**
 * KCS tự chuyển (P1, 18/11/2026) - BE `src/modules/floor` (floor.controller): KCS tự thấy các đợt công nhân vừa báo
 * và tự "Chốt" đợt đang mở để chấm, không còn chờ QLSX bấm "Gửi KCS".
 *
 * File này chỉ gồm danh sách đợt đang mở (GET /floor/review) + 5 lệnh chốt. Các lệnh CHẤM (qc-review) vẫn nằm ở
 * steel-issues-api.ts / production-batches-api.ts / material-yield-recipe-production-api.ts.
 */
import { http } from './core/http'
import { ApiError } from './core/apiError'
import type { BeFloorReview, FloorStage } from './floor-api'
import type { BeCutBundle, BeStepBundle } from './steel-issues-api'
import type { BeProductionBatch, BePieceStepBundle } from './production-batches-api'
import type { BeMaterialYieldStepBundle } from './material-yield-recipe-production-api'

/** Kết quả khi tài khoản chưa có quyền xem danh sách đợt đang mở (BE trả 403, thường do quyền mới chưa kịp cập nhật). */
export interface KcsFloorForbidden {
  forbidden: true
}

export function isKcsFloorForbidden(r: BeFloorReview | KcsFloorForbidden): r is KcsFloorForbidden {
  return 'forbidden' in r && r.forbidden === true
}

/**
 * Danh sách đợt ĐANG MỞ (chưa chốt, công nhân vừa báo) của 1 tổ, cho KCS. Đợt đã chốt (AWAITING_QC) KHÔNG nằm ở đây: lấy từ
 * các danh sách chấm có sẵn (cut-bundles / step-bundles / production-batches / piece-step-bundles / material-yield-step-bundles).
 * Chỉ có `stoppedPis` tính cả đợt đã chốt. KCS không bị lọc theo xưởng.
 * Lỗi 403 không ném và không ghi console: trả { forbidden: true } để màn hình hiện câu
 * "Chưa có quyền xem các đợt đang mở - tải lại trang sau ít phút hoặc đăng nhập lại." Lỗi khác vẫn ném như thường.
 */
export async function getKcsFloorReview(
  stage: FloorStage,
  productionInvoiceId?: string,
): Promise<BeFloorReview | KcsFloorForbidden> {
  const q = `stage=${stage}${productionInvoiceId ? `&productionInvoiceId=${encodeURIComponent(productionInvoiceId)}` : ''}`
  try {
    return await http.get<BeFloorReview>(`/floor/review?${q}`)
  } catch (e) {
    if (e instanceof ApiError && e.statusCode === 403) return { forbidden: true }
    throw e
  }
}

/** Chốt 1 đợt cắt đang mở để chấm. */
export function closeCutBundle(cutBundleId: string) {
  return http.post<BeCutBundle>(`/floor/kcs/cut-bundles/${encodeURIComponent(cutBundleId)}/close`)
}

/** Chốt nhóm công đoạn phụ (chỉ các dòng đã gán SKU thật). `step` khác CAT; productionOrderId / workerId null = dữ liệu cũ. */
export function closeStepGroup(g: {
  productionInvoiceId: string
  materialId: string
  step: string
  productionOrderId: string | null
  workerId: string | null
}) {
  return http.post<BeStepBundle>('/floor/kcs/step-groups/close', g)
}

/** Chốt 1 lô mảnh Hàn / Sơn / Vật tư TP (chuyển AWAITING_QC, chưa trừ đoạn). */
export function closeProductionBatch(productionBatchId: string) {
  return http.post<BeProductionBatch>(`/floor/kcs/production-batches/${encodeURIComponent(productionBatchId)}/close`)
}

/** Chốt nhóm công đoạn của pat (mảnh). */
export function closePieceStepGroup(g: { productionOrderId: string; pieceId: string; step: string }) {
  return http.post<BePieceStepBundle>('/floor/kcs/piece-step-groups/close', g)
}

/** Chốt nhóm công đoạn của vật tư không gắn mảnh (chân nhôm...). */
export function closeMaterialYieldGroup(g: { productionInvoiceId: string; recipeId: string; step: string }) {
  return http.post<BeMaterialYieldStepBundle>('/floor/kcs/material-yield-groups/close', g)
}
