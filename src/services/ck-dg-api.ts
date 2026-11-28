/**
 * Chuyền kiểm + Đóng gói bằng quét QR (24/11/2026, docs THIET-KE-CHUYEN-KIEM-DONG-GOI-QR, chốt C1-C4, D1-D4) - BE module `ck-dg-qr`.
 *  - Công nhân chuyền kiểm / đóng gói (màn /floor): GET /ck-dg/scan/:ws, POST /ck-dg/scan/:ws/transfer-check | packing.
 *  - KCS chuyền kiểm (màn /floor, tài khoản PIN): GET /ck-dg/kcs/batches, POST /ck-dg/kcs/batches/:id/grade.
 *  - Kho Thành phẩm: GET /ck-dg/transfer-check/batches, GET /ck-dg/packing/reports, POST /ck-dg/packing/reports/:id/cancel.
 * Mọi trả lời đọc có `enabled` (công tắc CK_DG_QR_ENABLED của BE): false thì FE giữ nguyên màn cũ, không hiện gì mới.
 */
import { http } from './core/http'

export type CkDgWorkstationKind = 'TRANSFER_CHECK' | 'PACKING'

export interface CkDgWorkstation {
  id: string
  code: string
  name: string
  stage: 'CHUYEN_KIEM' | 'DONG_GOI'
  kind: CkDgWorkstationKind
  warehouseCode: string | null
  warehouseName: string | null
}

/** 1 lệnh (dòng SKU) làm được ở điểm. */
export interface CkDgItem {
  itemId: string
  productionInvoiceId: string | null
  piCode: string | null
  lenhCode: string
  sku: string
  productName: string
  quantity: number
}

/** Mảnh của SKU đang chọn ở điểm chuyền kiểm. */
export interface CkPiece {
  pieceId: string
  pieceName: string
  pieceCode: string
  totalQty: number
  /** Hiện có (đã về kho). */
  readyQty: number
  /** Đã qua chuyền kiểm (đạt KCS + nhập tay cũ). */
  checkedQty: number
  /** Đạt + lỗi của đợt đang chờ KCS chuyền kiểm. */
  pendingQty: number
  /** KCS chấm bỏ. */
  scrapQty: number
  /** Còn báo được = Hiện có − đã kiểm − chờ KCS − đã bỏ. */
  availableQty: number
}

export interface DgPacking {
  totalQty: number
  packedQty: number
  /** Số bộ đã qua KCS chuyền kiểm (đồng bộ mọi mảnh). */
  setsPassed: number
  availableQty: number
}

export interface CkKcsResult {
  passedQty: number
  reworkQty: number
  scrapQty: number
  defectReason: string | null
  photoUrl: string | null
  note: string | null
  reviewedByName: string | null
  reviewedAt: string | null
  transferCheckResultId: string | null
}

export type CkBatchStatus = 'AWAITING_KCS' | 'KCS_DONE'

/** 1 đợt chuyền kiểm công nhân báo. */
export interface CkBatch {
  id: string
  status: CkBatchStatus
  itemId: string
  productionInvoiceId: string | null
  piCode: string | null
  lenhCode: string
  sku: string
  productName: string
  pieceId: string
  pieceName: string
  workstationCode: string
  warehouseCode: string | null
  warehouseName: string | null
  reportedById: string
  reportedByName: string | null
  reportedAt: string
  passedQty: number
  defectQty: number
  defectReasonId: string | null
  defectReason: string | null
  photoUrls: string[]
  note: string | null
  kcs: CkKcsResult | null
}

/** 1 lần công nhân đóng gói báo. */
export interface DgReport {
  id: string
  itemId: string
  productionInvoiceId: string | null
  piCode: string | null
  lenhCode: string
  sku: string
  productName: string
  qty: number
  note: string | null
  workstationCode: string
  warehouseCode: string | null
  warehouseName: string | null
  reportedById: string
  reportedByName: string | null
  reportedAt: string
  cancelled: boolean
  cancelledAt: string | null
  cancelledByName: string | null
  cancelReason: string | null
  /** Ô đã cất (vị trí kho bật, 25/11/2026); null = báo khi chưa bật. */
  locationCode?: string | null
}

export interface CkDefectReason { id: string; label: string }

export type CkDgScanContext =
  | { enabled: false }
  | {
    enabled: true
    workstation: CkDgWorkstation
    items: CkDgItem[]
    selectedItemId: string | null
    /** Chỉ điểm chuyền kiểm (đã chọn lệnh). */
    pieces: CkPiece[] | null
    /** Chỉ khu đóng gói (đã chọn lệnh). */
    packing: DgPacking | null
    /** Vị trí kho bật (VI_TRI_KHO_ENABLED, 25/11/2026): khu đóng gói phải quét tem ô khi báo. BE cũ không có = false. */
    requireLocation?: boolean
    defectReasons: CkDefectReason[]
    /** Lần báo gần đây của chính mình ở điểm này. */
    recent: (CkBatch | DgReport)[]
  }

export interface ReportCkInput {
  itemId: string
  pieceId: string
  passedQty: number
  defectQty: number
  defectReasonId?: string
  photoUrls?: string[]
  note?: string
}

export interface GradeCkInput {
  passedQty: number
  reworkQty: number
  /** Câu 9a (chốt 25/11/2026): KCS chuyền kiểm không còn chấm "bỏ" - luôn 0 (BE trả 400 nếu > 0). */
  scrapQty: number
  defectReasonId?: string
  photoUrl?: string
  note?: string
}

const key = (idempotencyKey: string) => ({ headers: { 'Idempotency-Key': idempotencyKey } })
const enc = encodeURIComponent

export const getCkDgConfig = () => http.get<{ enabled: boolean }>('/ck-dg/config')

export function getCkDgScan(ws: string, itemId?: string | null) {
  return http.get<CkDgScanContext>(`/ck-dg/scan/${enc(ws)}${itemId ? `?itemId=${enc(itemId)}` : ''}`)
}

export function reportCkBatch(ws: string, data: ReportCkInput, idempotencyKey: string) {
  return http.post<{ replay: boolean; batch: CkBatch }>(`/ck-dg/scan/${enc(ws)}/transfer-check`, data, key(idempotencyKey))
}

export function reportPacking(ws: string, data: { itemId: string; qty: number; note?: string; locationId?: string }, idempotencyKey: string) {
  return http.post<{ replay: boolean; report: DgReport; mixWarning?: string | null }>(`/ck-dg/scan/${enc(ws)}/packing`, data, key(idempotencyKey))
}

export function getKcsCkBatches(status: CkBatchStatus = 'AWAITING_KCS') {
  return http.get<{ enabled: boolean; batches: CkBatch[]; defectReasons: CkDefectReason[] }>(`/ck-dg/kcs/batches?status=${status}`)
}

/** Câu 10 (chốt 25/11/2026): KCS chuyền kiểm tự thêm nguyên nhân lỗi; trùng tên thì BE dùng lại dòng cũ. */
export function addCkDefectReason(label: string) {
  return http.post<{ reason: CkDefectReason; created: boolean; defectReasons: CkDefectReason[] }>('/ck-dg/kcs/defect-reasons', { label })
}

export function gradeCkBatch(id: string, data: GradeCkInput) {
  return http.post<CkBatch>(`/ck-dg/kcs/batches/${enc(id)}/grade`, data)
}

export function getCkBatches(p: { status?: CkBatchStatus; itemId?: string } = {}) {
  const q = new URLSearchParams()
  if (p.status) q.set('status', p.status)
  if (p.itemId) q.set('itemId', p.itemId)
  const s = q.toString()
  return http.get<{ enabled: boolean; batches: CkBatch[] }>(`/ck-dg/transfer-check/batches${s ? `?${s}` : ''}`)
}

export function getPackingReports(itemId?: string) {
  return http.get<{ enabled: boolean; reports: DgReport[] }>(`/ck-dg/packing/reports${itemId ? `?itemId=${enc(itemId)}` : ''}`)
}

export function cancelPackingReport(id: string, reason: string) {
  return http.post<DgReport>(`/ck-dg/packing/reports/${enc(id)}/cancel`, { reason })
}
