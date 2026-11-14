/**
 * Tồn đoạn kho Phôi theo MÃ ĐOẠN và giữ đoạn theo LỆNH (13/11/2026, anh Nhân trả lời 11 câu tồn đoạn) + sổ báo vượt.
 *  - GET /segment-stock/balances: mỗi ô (kho Phôi, cỡ đoạn, bộ công đoạn) có tồn / còn giữ cho lệnh / dư chung của xưởng.
 *  - GET /segment-overages, POST /segment-overages/:id/resolve: Hàn / Sơn báo vượt không bị chặn, hệ thống ghi lại; QLSX đóng
 *    từng dòng (bắt buộc lý do, có nhật ký).
 */
import { http, withIdempotencyKey } from './core/http'
import { PROCESS_STEP_LABELS } from '../constants/processSteps'
import type { ProcessStep } from '../types/sku'

export interface BeSegmentBalance {
  warehouseId: string
  warehouseCode: string
  warehouseName: string
  segmentSpecId: string
  materialId: string
  materialCode: string
  materialName: string
  cutLengthMm: number
  /** Bộ công đoạn ('' = trơn). */
  segmentSteps: string
  segmentStepsLabel: string
  /** "SAT-005 @ 460mm · Dập". */
  label: string
  /** Tồn thực tế. */
  onHandQty: number
  /** Còn giữ cho các lệnh. */
  heldQty: number
  /** Dư chung của xưởng = tồn - còn giữ (âm = dữ liệu cũ chưa chuyển đổi). */
  surplusQty: number
  holdingOrderCount: number
}

export async function getSegmentBalances(params?: { warehouseId?: string; materialId?: string }): Promise<BeSegmentBalance[]> {
  return http.get<BeSegmentBalance[]>('/segment-stock/balances', { params })
}

export type SegmentOverageStatus = 'open' | 'resolved' | 'all'

export interface BeSegmentOverage {
  id: string
  productionInvoiceId: string
  /** Số LSX (lệnh chưa có LSX thì mã PI). */
  lenhCode: string
  productionOrderId: string
  productionBatchId: string
  pieceCode: string
  pieceName: string
  stage: string
  warehouseName: string
  segmentLabel: string
  neededQty: number
  takenQty: number
  /** Thiếu đoạn - không trừ được (tồn không âm). */
  shortageQty: number
  /** Số mảnh đợt này làm vượt số lượng tổng của lệnh. */
  overPieces: number
  /** Số đoạn lấy thêm ứng với overPieces. */
  extraQty: number
  extraKind: 'OVER_REPORT' | 'REWORK' | null
  reportedByName: string | null
  createdAt: string
  resolvedAt: string | null
  resolvedByName: string | null
  resolveReason: string | null
}

export async function getSegmentOverages(params?: { status?: SegmentOverageStatus; productionInvoiceId?: string }): Promise<BeSegmentOverage[]> {
  return http.get<BeSegmentOverage[]>('/segment-overages', { params })
}

export async function resolveSegmentOverage(id: string, reason: string): Promise<BeSegmentOverage> {
  return http.post<BeSegmentOverage>(`/segment-overages/${id}/resolve`, { reason }, withIdempotencyKey())
}

/** Nhãn bộ công đoạn của mã đoạn ('' = Trơn) - cùng nhãn BE segmentStepsLabel. */
export function segmentStepsLabel(steps: string | null | undefined): string {
  if (!steps) return 'Trơn'
  return steps.split(',').map(s => PROCESS_STEP_LABELS[s as ProcessStep] ?? s).join(' + ')
}

export interface SegmentStocktakeResult {
  label: string
  beforeQty: number
  countedQty: number
  deltaQty: number
  /** Còn giữ cho lệnh ở ô này - lớn hơn số đếm nghĩa là phần giữ vượt tồn thật. */
  heldQty: number
}

/** Kiểm kê 1 mã đoạn ở kho Phôi: nhập số đếm, BE ghi phần chênh (đối ứng "Cân đối tồn kho"). 409 nếu tồn vừa đổi. */
export async function stocktakeSegment(input: {
  warehouseId: string
  segmentSpecId: string
  segmentSteps: string
  countedQty: number
  expectedCurrentQty: number
  note: string
}): Promise<SegmentStocktakeResult> {
  return http.post<SegmentStocktakeResult>('/segment-stock/stocktake', input, withIdempotencyKey())
}
